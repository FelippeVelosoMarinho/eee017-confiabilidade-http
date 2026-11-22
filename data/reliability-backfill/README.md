# reliability-backfill

Backfill of the Hugging Face dataset [`mindweave/web-server-logs`](https://huggingface.co/datasets/mindweave/web-server-logs)
into the local Prometheus (`http://localhost:9090`) as OpenTelemetry semantic-convention
HTTP server metrics, via `promtool tsdb create-blocks-from openmetrics`.

## What was done

1. Inspected the running Prometheus (v3.3.1, docker compose project `reliability-lab`, volume `reliability-lab_prometheus-data`, config at `/Users/josoesantos/Projects/opentelemetry-demo/src/prometheus/prometheus-config.yaml`, launch flags in `/Users/josoesantos/Projects/reliability-lab/docker-compose.override.yml`).
2. Downloaded `access_logs.csv` (5000 rows, 2024-01-01 → 2024-02-06) and `servers.csv` (3 rows) into `data/raw/`.
3. Profiled the data; established it is in milliseconds (response time) and bytes (response size).
4. Decided the sampling step: **1h** (user-chosen compromise after the 5m step blew the 60M-sample budget).
5. Generated `data/metrics.om` (OpenMetrics 1.0, ~5 GB, 20.36 M samples, 1297 series × 2 histograms × 902 steps).
6. Validated with unit tests: final `_count` per `(server,status)` matches CSV row counts; bucket monotonicity; `+Inf == _count`; counters non-decreasing.
7. Created TSDB blocks with promtool (`--max-block-duration=72h`, resulting in 18 blocks, 55 MB).
8. **Destructive** (user-approved): stopped Prometheus, backed up the override to `.bak`, changed retention `35d → 1100d`, wiped the volume, copied blocks in with UID 65534, restarted.
9. Verified via HTTP API (see Verification below).

## Metric schema

Two cumulative histograms (OTel semconv → Prometheus names):

| OTel attr / metric | Prometheus name |
|---|---|
| `http.server.request.duration` (s) | `http_server_request_duration_seconds_{bucket,count,sum}` |
| `http.server.response.body.size` (B) | `http_server_response_body_size_bytes_{bucket,count,sum}` |

**Duration buckets** (OTel recommended, seconds):
`0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10, +Inf`

**Size buckets** (bytes): `0, 100, 1000, 10000, 100000, 1000000, 10000000, +Inf`

**Labels** (semconv → Prom naming):

| Label | Source | Notes |
|---|---|---|
| `job` | constant `web-server-logs` | |
| `instance` | `servers.name` | |
| `server_address` | `servers.name` | |
| `http_request_method` | `access_logs.method` | |
| `http_response_status_code` | `access_logs.status_code` | string |
| `http_route` | `access_logs.path` | identity (see Route mapping) |
| `url_scheme` | constant `http` | **decision**: dataset has no scheme info |
| `error_type` | `status_code` when 5xx | absent otherwise |

IP, user agent, and referrer are deliberately **not** used as labels.

### Route mapping

The dataset's `path` field is already templatized at the source (e.g. `/blog/{slug}`, `/api/v2/orders/{id}`, `/docs/{page}`). I inspected all 33 distinct paths; none contained bare numeric IDs, UUIDs, or hashes. **Route mapping is identity.** The full set:

```
/  /about  /blog  /blog/{slug}  /contact  /docs  /docs/{page}
/favicon.ico  /healthz  /login  /register  /robots.txt  /sitemap.xml
/static/images/logo.png  /static/js/app.js  /.well-known/security.txt
/api/v2/cart  /api/v2/cart/checkout  /api/v2/categories
/api/v2/orders  /api/v2/orders/{id}  /api/v2/payments/process
/api/v2/products/{id}  /api/v2/reviews  /api/v2/search
/api/v2/shipping/rates  /api/v2/users/login  /api/v2/users/me
/api/v2/users/register  /api/v2/wishlist
```

## Retention

Value chosen: **`1100d`** = (now 2026-11-21 − oldest sample 2024-01-01) + 30 day margin, rounded up (minimum 2y).

Set in `/Users/josoesantos/Projects/reliability-lab/docker-compose.override.yml`:
```yaml
      - --storage.tsdb.retention.time=1100d
```
Original value (`35d`) is preserved at `docker-compose.override.yml.bak`.

## Verification

Run `make verify`. At the time of the backfill, results were:

- Total rows: Prom `5000` == CSV `5000` ✓
- Per-server: `web-prod-01=1670`, `web-prod-02=1642`, `web-prod-03=1688` (all match) ✓
- Per-status: all 10 status codes match CSV exactly ✓
- No-gap check: `count_over_time(...[1d])` = 24 samples/day (1h step) ✓
- Retention flag `1100d` live ✓
- Availability on 2024-01-15: **0.9826** (98.26%)
- p95 latency on 2024-01-15: `web-prod-01 0.822s`, `web-prod-02 1.320s`, `web-prod-03 0.390s`

Sanity PromQL for the reliability plugin:
```promql
# availability over a day
1 - sum(increase(http_server_request_duration_seconds_count{http_response_status_code=~"5.."}[1d]))
  / sum(increase(http_server_request_duration_seconds_count[1d]))

# p95 latency per server over a day
histogram_quantile(0.95,
  sum by (le, server_address) (rate(http_server_request_duration_seconds_bucket[1d])))
```

## Rerun / undo

End-to-end rerun:
```
make backfill
```
Runs: download → generate OpenMetrics → create blocks → stop Prom → wipe volume → load blocks → start Prom → verify.

Undo (restore original config, wipe backfill data):
```
make undo
```
Restores `docker-compose.override.yml` from `.bak` (retention back to 35d) and wipes the TSDB volume. Prometheus starts empty.

## Decisions made on your behalf

1. **Sampling step = 1h** (not 5m). Chosen by you from the options presented after the 5m plan would have exceeded the 60M sample budget by ~8×. Hourly resolution is what the Grafana reliability plugin can rely on.
2. **`url_scheme = "http"`** constant. The dataset has no scheme info and OTel semconv marks this as a core attribute.
3. **`--max-block-duration=72h`**. Fits inside Prometheus's `max-block-duration=3d12h` and produced sensibly sized blocks. Prometheus compacted them further on startup.
4. **Bootstrap zero at `first_hour - 1`** per series. The spec requested a 0-valued sample at the first boundary ≤ the first event; placing it one step earlier makes `rate()` over the first hour well-defined. Does not affect totals.
5. **No `_created` samples** emitted. OpenMetrics `_created` is optional and promtool's parser accepts histograms without it.
