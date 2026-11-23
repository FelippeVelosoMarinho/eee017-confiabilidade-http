FROM python:3.12-slim AS conversor
RUN pip install --no-cache-dir "pandas>=2.2"
WORKDIR /w
COPY petshop/data ./data
COPY petshop/conversor/petshop_para_openmetrics.py ./conversor/
RUN python conversor/petshop_para_openmetrics.py --dados data --saida /w/metrics.om

FROM quay.io/prometheus/prometheus:v3.3.1 AS blocos
COPY --from=conversor /w/metrics.om /tmp/metrics.om
RUN promtool tsdb create-blocks-from openmetrics /tmp/metrics.om /tmp/petshop-tsdb --max-block-duration=72h

FROM quay.io/prometheus/prometheus:v3.3.1
COPY --from=blocos --chown=65534:65534 /tmp/petshop-tsdb /petshop-tsdb
