# Hugging Face (mindweave/web-server-logs): CSV -> OpenMetrics -> blocos do Prometheus.
FROM python:3.12-slim AS conversor
WORKDIR /w
COPY conversores ./conversores
COPY casos/huggingface/data/access_logs.csv ./access_logs.csv
RUN python -I conversores/requisicoes_para_openmetrics.py \
      --config conversores/configs/huggingface.json \
      --entrada access_logs.csv \
      --saida /w/metrics.om

FROM quay.io/prometheus/prometheus:v3.3.1 AS blocos
COPY --from=conversor /w/metrics.om /tmp/metrics.om
RUN promtool tsdb create-blocks-from openmetrics /tmp/metrics.om /tmp/tsdb --max-block-duration=72h

FROM quay.io/prometheus/prometheus:v3.3.1
COPY --from=blocos --chown=65534:65534 /tmp/tsdb /tsdb
