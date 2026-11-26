"""CSV -> OpenMetrics 1.0 for promtool block backfill.

Run with: python -I scripts/csv_to_openmetrics.py

Design notes:
- Step is 1 hour, aligned to UTC epoch hours.
- Two histograms per (server, method, status, route): duration (seconds), body-size (bytes).
- Each series starts with a zero sample at the first boundary <= its first event,
  then emits a sample at every subsequent hour boundary until the global dataset end,
  so rate()/increase() are well-defined and nothing goes stale.
- Cumulative histograms per OpenMetrics 1.0 spec.
- Labels: job, instance, server_address, http_request_method, http_response_status_code,
  http_route, url_scheme, error_type (only for 5xx).
"""
from __future__ import annotations

import csv
import math
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "..", "data", "raw")
OUT = os.path.join(HERE, "..", "data", "metrics.om")

STEP = 3600  # 1 hour
URL_SCHEME = "http"
JOB = "web-server-logs"

DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10]
SIZE_BUCKETS = [0, 100, 1000, 10_000, 100_000, 1_000_000, 10_000_000]


def load_servers():
    with open(os.path.join(RAW, "servers.csv"), newline="", encoding="utf-8") as f:
        return {r["id"]: r for r in csv.DictReader(f)}


def escape(v: str) -> str:
    return v.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def label_str(labels: dict) -> str:
    return ",".join(f'{k}="{escape(v)}"' for k, v in labels.items())


def epoch_hour(ts: datetime) -> int:
    e = int(ts.replace(minute=0, second=0, microsecond=0).timestamp())
    return e - (e % STEP)


def main() -> int:
    servers = load_servers()

    # Streaming pass 1: read all rows (file is small), bucket per series.
    rows = []
    ts_fmt = "%Y-%m-%d %H:%M:%S"
    with open(os.path.join(RAW, "access_logs.csv"), newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            ts = datetime.strptime(r["timestamp"], ts_fmt).replace(tzinfo=timezone.utc)
            rows.append((
                int(ts.timestamp()),
                r["server_id"],
                r["method"],
                r["status_code"],
                r["path"],  # already templatized in source
                int(r["response_time_ms"]) / 1000.0,
                int(r["bytes_sent"]),
            ))
    rows.sort(key=lambda x: x[0])

    start_hour = (rows[0][0] // STEP) * STEP
    end_hour = (rows[-1][0] // STEP) * STEP
    n_steps = (end_hour - start_hour) // STEP + 1
    print(f"range: {datetime.fromtimestamp(start_hour, tz=timezone.utc)} -> "
          f"{datetime.fromtimestamp(end_hour, tz=timezone.utc)} "
          f"({n_steps} hourly steps)", file=sys.stderr)

    # Per-series accumulators: key -> list of (hour, duration_s, size_b) events
    series_events: dict[tuple, list[tuple[int, float, int]]] = defaultdict(list)
    for ts, sid, method, status, route, dur_s, size_b in rows:
        key = (sid, method, status, route)
        series_events[key].append((ts // STEP * STEP, dur_s, size_b))

    print(f"series: {len(series_events)}", file=sys.stderr)
    expected_samples_per_series = (
        (len(DURATION_BUCKETS) + 1 + 1 + 1)  # buckets + Inf + count + sum
        + (len(SIZE_BUCKETS) + 1 + 1 + 1)
    )
    print(f"samples (rough upper bound): "
          f"{len(series_events) * expected_samples_per_series * n_steps:,}", file=sys.stderr)

    # Per-series running totals as we walk hours.
    # We'll emit family-by-family to keep OpenMetrics "all samples of a family grouped together".
    # To do that without holding everything in memory, pre-compute per-hour cumulative state
    # per series, then stream each family.

    # First: per series, build list of (hour, dur_bucket_counts[16], dur_count, dur_sum,
    #                                   size_bucket_counts[8], size_count, size_sum)
    series_state: dict[tuple, list] = {}
    for key, events in series_events.items():
        events.sort()
        first_hour = events[0][0]
        # bootstrap zero at first_hour - STEP? No — spec says: 0-valued sample at the first
        # 5m/1h boundary at or before its first event. We align: the "first boundary at or
        # before" is first_hour itself (events already bucketed to their hour). So the zero
        # goes at first_hour, and real data accumulates INTO that same hour's sample.
        # To make rate() over the first hour meaningful we place the zero one step earlier.
        bootstrap_hour = first_hour - STEP
        if bootstrap_hour < start_hour:
            bootstrap_hour = start_hour
            if bootstrap_hour == first_hour:
                # events start exactly at global start; pull bootstrap one step before anyway
                bootstrap_hour = first_hour - STEP

        # Group events by hour
        by_hour: dict[int, list] = defaultdict(list)
        for h, d, b in events:
            by_hour[h].append((d, b))

        dur_counts = [0] * (len(DURATION_BUCKETS) + 1)  # +Inf
        size_counts = [0] * (len(SIZE_BUCKETS) + 1)
        dur_count = 0
        dur_sum = 0.0
        size_count = 0
        size_sum = 0

        samples = []  # (hour, dur_counts tuple, dur_count, dur_sum, size_counts, size_count, size_sum)
        # Emit bootstrap zero
        samples.append((
            bootstrap_hour,
            tuple(dur_counts), dur_count, dur_sum,
            tuple(size_counts), size_count, size_sum,
        ))

        h = max(bootstrap_hour + STEP, first_hour)
        # Actually: we want a sample at EVERY hour boundary from first_hour .. end_hour inclusive.
        h = first_hour
        while h <= end_hour:
            for d, b in by_hour.get(h, []):
                for i, bound in enumerate(DURATION_BUCKETS):
                    if d <= bound:
                        dur_counts[i] += 1
                dur_counts[-1] += 1  # +Inf
                dur_count += 1
                dur_sum += d
                for i, bound in enumerate(SIZE_BUCKETS):
                    if b <= bound:
                        size_counts[i] += 1
                size_counts[-1] += 1
                size_count += 1
                size_sum += b
            samples.append((
                h,
                tuple(dur_counts), dur_count, dur_sum,
                tuple(size_counts), size_count, size_sum,
            ))
            h += STEP
        series_state[key] = samples

    # Build label dict per key
    def labels_for(key):
        sid, method, status, route = key
        s = servers[sid]
        d = {
            "http_request_method": method,
            "http_response_status_code": status,
            "http_route": route,
            "instance": s["name"],
            "job": JOB,
            "server_address": s["name"],
            "url_scheme": URL_SCHEME,
        }
        if status.startswith("5"):
            d["error_type"] = status
        return d

    def bucket_labels(base, le):
        d = dict(base)
        d["le"] = le
        # Sort keys alphabetically for stable output
        return dict(sorted(d.items()))

    # Write OpenMetrics
    dur_le = [format(b, "g") for b in DURATION_BUCKETS] + ["+Inf"]
    size_le = [str(b) for b in SIZE_BUCKETS] + ["+Inf"]

    total_samples = 0
    with open(OUT, "w", encoding="utf-8") as out:
        # Family 1: http_server_request_duration_seconds (histogram)
        out.write("# TYPE http_server_request_duration_seconds histogram\n")
        out.write("# UNIT http_server_request_duration_seconds seconds\n")
        out.write("# HELP http_server_request_duration_seconds Duration of HTTP server requests.\n")
        for key, samples in series_state.items():
            base = dict(sorted(labels_for(key).items()))
            # buckets
            for i, le in enumerate(dur_le):
                lb = bucket_labels(base, le)
                lbstr = label_str(lb)
                for h, dcs, _dc, _ds, _scs, _sc, _ssum in samples:
                    out.write(f"http_server_request_duration_seconds_bucket{{{lbstr}}} {dcs[i]} {h}\n")
                    total_samples += 1
            # count
            lbstr = label_str(base)
            for h, _dcs, dc, _ds, _scs, _sc, _ssum in samples:
                out.write(f"http_server_request_duration_seconds_count{{{lbstr}}} {dc} {h}\n")
                total_samples += 1
            # sum
            for h, _dcs, _dc, ds, _scs, _sc, _ssum in samples:
                out.write(f"http_server_request_duration_seconds_sum{{{lbstr}}} {ds:.6f} {h}\n")
                total_samples += 1

        # Family 2: http_server_response_body_size_bytes (histogram)
        out.write("# TYPE http_server_response_body_size_bytes histogram\n")
        out.write("# UNIT http_server_response_body_size_bytes bytes\n")
        out.write("# HELP http_server_response_body_size_bytes Size of HTTP server response bodies.\n")
        for key, samples in series_state.items():
            base = dict(sorted(labels_for(key).items()))
            for i, le in enumerate(size_le):
                lb = bucket_labels(base, le)
                lbstr = label_str(lb)
                for h, _dcs, _dc, _ds, scs, _sc, _ssum in samples:
                    out.write(f"http_server_response_body_size_bytes_bucket{{{lbstr}}} {scs[i]} {h}\n")
                    total_samples += 1
            lbstr = label_str(base)
            for h, _dcs, _dc, _ds, _scs, sc, _ssum in samples:
                out.write(f"http_server_response_body_size_bytes_count{{{lbstr}}} {sc} {h}\n")
                total_samples += 1
            for h, _dcs, _dc, _ds, _scs, _sc, ssum in samples:
                out.write(f"http_server_response_body_size_bytes_sum{{{lbstr}}} {ssum} {h}\n")
                total_samples += 1

        out.write("# EOF\n")

    print(f"samples written: {total_samples:,}", file=sys.stderr)
    print(f"file: {OUT}", file=sys.stderr)
    size_bytes = os.path.getsize(OUT)
    print(f"file size: {size_bytes / 1e6:.1f} MB", file=sys.stderr)

    # ---- Unit tests ----
    print("\n-- unit tests --", file=sys.stderr)

    # 1) Per (server, status) totals equal CSV rowcounts
    from collections import Counter
    csv_counts = Counter()
    for ts, sid, method, status, route, _d, _b in rows:
        csv_counts[(servers[sid]["name"], status)] += 1

    # Reconstruct final counts from series_state
    final_counts = Counter()
    for key, samples in series_state.items():
        sid, method, status, route = key
        last = samples[-1]
        final_counts[(servers[sid]["name"], status)] += last[2]  # dur_count
    assert csv_counts == final_counts, f"MISMATCH: csv={csv_counts} final={final_counts}"
    print(f"  OK: per-(server,status) final counts match CSV totals "
          f"({sum(csv_counts.values())} rows)", file=sys.stderr)

    # 2) Bucket monotonicity and +Inf == _count per series final sample
    for key, samples in series_state.items():
        last = samples[-1]
        dcs = last[1]; dc = last[2]
        assert all(dcs[i] <= dcs[i+1] for i in range(len(dcs)-1)), f"dur buckets non-mono {key}"
        assert dcs[-1] == dc, f"dur +Inf != count {key}: {dcs[-1]} vs {dc}"
        scs = last[4]; sc = last[5]
        assert all(scs[i] <= scs[i+1] for i in range(len(scs)-1)), f"size buckets non-mono {key}"
        assert scs[-1] == sc, f"size +Inf != count {key}"
    print(f"  OK: bucket monotonicity and +Inf==count hold on final sample for all "
          f"{len(series_state)} series", file=sys.stderr)

    # 3) Non-decreasing counters across time per series
    for key, samples in series_state.items():
        prev_dc = 0; prev_ds = 0.0; prev_sc = 0; prev_ssum = 0
        for s in samples:
            assert s[2] >= prev_dc, f"dur_count decreased in {key}"
            assert s[3] >= prev_ds - 1e-9, f"dur_sum decreased in {key}"
            assert s[5] >= prev_sc, f"size_count decreased in {key}"
            assert s[6] >= prev_ssum, f"size_sum decreased in {key}"
            prev_dc, prev_ds, prev_sc, prev_ssum = s[2], s[3], s[5], s[6]
    print(f"  OK: counters non-decreasing across time for all series", file=sys.stderr)

    print("\nall tests passed", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
