"""Verification: row counts, gap check, retention flag. Run with: python -I verify.py"""
import csv
import json
import os
import sys
import urllib.parse
import urllib.request
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "..", "data", "raw")
PROM = "http://localhost:9090"
EVAL_TIME = 1707224400  # 2024-02-06T13:00:00Z (last backfill hour)


def q(query, t=EVAL_TIME):
    url = f"{PROM}/api/v1/query?" + urllib.parse.urlencode({"query": query, "time": t})
    with urllib.request.urlopen(url, timeout=10) as f:
        return json.load(f)["data"]["result"]


def main():
    # CSV truth
    with open(os.path.join(RAW, "access_logs.csv"), newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    with open(os.path.join(RAW, "servers.csv"), newline="", encoding="utf-8") as f:
        servers = {r["id"]: r["name"] for r in csv.DictReader(f)}
    csv_total = len(rows)
    by_server = Counter(servers[r["server_id"]] for r in rows)
    by_status = Counter(r["status_code"] for r in rows)

    # Query totals
    total = float(q("sum(http_server_request_duration_seconds_count)")[0]["value"][1])
    assert int(total) == csv_total, f"total mismatch: prom={total} csv={csv_total}"
    print(f"OK  total requests: {int(total)} == CSV {csv_total}")

    for s, c in by_server.items():
        v = float(q(f'sum(http_server_request_duration_seconds_count{{server_address="{s}"}})')[0]["value"][1])
        assert int(v) == c, f"server {s} mismatch: {v} vs {c}"
        print(f"OK  server {s}: {int(v)} == CSV {c}")

    for status, c in sorted(by_status.items()):
        v = float(q(f'sum(http_server_request_duration_seconds_count{{http_response_status_code="{status}"}})')[0]["value"][1])
        assert int(v) == c, f"status {status} mismatch: {v} vs {c}"
        print(f"OK  status {status}: {int(v)} == CSV {c}")

    # Gap check: at the end of a full day, each series should have 24 samples/day (1h step)
    r = q('count_over_time(http_server_request_duration_seconds_count{http_route="/healthz",http_request_method="GET"}[1d] @ 1706659200)')
    for s in r:
        v = int(float(s["value"][1]))
        assert v == 24, f"gap for {s['metric']}: {v}"
    print(f"OK  no-gap check: /healthz GET series = 24 samples/day")

    # Retention flag
    with urllib.request.urlopen(f"{PROM}/api/v1/status/flags") as f:
        flags = json.load(f)["data"]
    ret = flags["storage.tsdb.retention.time"]
    print(f"OK  retention.time = {ret}")

    # Sanity queries
    avail = float(q('1 - sum(increase(http_server_request_duration_seconds_count{http_response_status_code=~"5.."}[1d])) / sum(increase(http_server_request_duration_seconds_count[1d]))', t=1705363200)[0]["value"][1])
    print(f"    availability on 2024-01-15: {avail:.4f}")
    p95 = q('histogram_quantile(0.95, sum by (le, server_address) (rate(http_server_request_duration_seconds_bucket[1d])))', t=1705363200)
    for s in p95:
        print(f"    p95 latency 2024-01-15 {s['metric']['server_address']}: {float(s['value'][1]):.3f}s")

    print("\nall verifications passed")


if __name__ == "__main__":
    sys.exit(main())
