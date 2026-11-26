"""Profile the mindweave/web-server-logs dataset. Run with: python -I profile.py"""
import csv
import os
import re
from collections import Counter
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "..", "data", "raw")


def read_csv(path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


servers = read_csv(os.path.join(RAW, "servers.csv"))
logs = read_csv(os.path.join(RAW, "access_logs.csv"))

print(f"servers.csv rows: {len(servers)}")
print(f"  columns: {list(servers[0].keys())}")
for s in servers:
    print(f"  {s}")

print(f"\naccess_logs.csv rows: {len(logs)}")
print(f"  columns: {list(logs[0].keys())}")

# Timestamps
ts_fmt = "%Y-%m-%d %H:%M:%S"
times = [datetime.strptime(r["timestamp"], ts_fmt).replace(tzinfo=timezone.utc) for r in logs]
print(f"  timestamp min: {min(times).isoformat()}")
print(f"  timestamp max: {max(times).isoformat()}")
print(f"  span: {max(times) - min(times)}")

# Null counts
null_counts = Counter()
for r in logs:
    for k, v in r.items():
        if v == "" or v is None:
            null_counts[k] += 1
print(f"  nulls: {dict(null_counts) or 'none'}")

# Distinct values
methods = Counter(r["method"] for r in logs)
statuses = Counter(r["status_code"] for r in logs)
server_ids = Counter(r["server_id"] for r in logs)
paths = Counter(r["path"] for r in logs)

print(f"\n  distinct methods: {dict(methods)}")
print(f"  distinct status codes: {dict(sorted(statuses.items()))}")
print(f"  distinct server_ids: {dict(server_ids)}")
print(f"  distinct paths: {len(paths)}")
print("  top 25 paths:")
for p, c in paths.most_common(25):
    print(f"    {c:5d}  {p}")
print("  sample long-tail paths:")
rare = [p for p, c in paths.items() if c == 1]
for p in rare[:15]:
    print(f"    1  {p}")

# Response time + bytes stats (units sanity)
rt = sorted(int(r["response_time_ms"]) for r in logs)
bs = sorted(int(r["bytes_sent"]) for r in logs)


def pct(xs, p):
    return xs[int(len(xs) * p)]


print(f"\n  response_time_ms  min={rt[0]}  p50={pct(rt, .5)}  p95={pct(rt, .95)}  p99={pct(rt, .99)}  max={rt[-1]}")
print(f"  bytes_sent        min={bs[0]}  p50={pct(bs, .5)}  p95={pct(bs, .95)}  p99={pct(bs, .99)}  max={bs[-1]}")

# Route templating preview
ID_RE = re.compile(r"^(?:\d+|[0-9a-f]{8,}|[0-9a-f-]{32,})$", re.I)


def templatize(path):
    parts = path.split("/")
    out = []
    for p in parts:
        if ID_RE.match(p):
            out.append("{id}")
        else:
            out.append(p)
    return "/".join(out) or "/"


routes = Counter(templatize(r["path"]) for r in logs)
print(f"\n  distinct http_route templates: {len(routes)}")
for r_, c in routes.most_common(30):
    print(f"    {c:5d}  {r_}")

# Cardinality estimate
label_combos = set()
for r in logs:
    label_combos.add((r["server_id"], r["method"], r["status_code"], templatize(r["path"])))
print(f"\n  distinct (server,method,status,route) combos: {len(label_combos)}")

# 5-minute step count
import math
start = min(times).replace(second=0, microsecond=0)
start = start.replace(minute=(start.minute // 5) * 5)
end = max(times)
steps = math.ceil((end - start).total_seconds() / 300) + 1
print(f"  5m steps across range: {steps}")
print(f"  duration-histogram sample budget (15 buckets + _count + _sum = 17 series/combo):")
print(f"    series: {len(label_combos) * 17}")
print(f"    samples (series * steps): {len(label_combos) * 17 * steps:,}")
print(f"  +body-size histogram (adds 17 more):")
print(f"    samples: {len(label_combos) * 34 * steps:,}")
