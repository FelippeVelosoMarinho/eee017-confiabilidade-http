.PHONY: all download profile generate blocks load verify backfill undo clean

PROM_IMG := quay.io/prometheus/prometheus:v3.3.1
VOLUME   := reliability-lab_prometheus-data
COMPOSE_BASE     := /Users/josoesantos/Projects/opentelemetry-demo/docker-compose.yml
COMPOSE_OVERRIDE := /Users/josoesantos/Projects/reliability-lab/docker-compose.override.yml
RETENTION := 1100d

backfill: download generate blocks load verify

download:
	mkdir -p data/raw
	curl -sfL -o data/raw/access_logs.csv https://huggingface.co/datasets/mindweave/web-server-logs/resolve/main/data/access_logs.csv
	curl -sfL -o data/raw/servers.csv     https://huggingface.co/datasets/mindweave/web-server-logs/resolve/main/data/servers.csv

profile:
	python3 -I scripts/profile.py

generate:
	python3 -I scripts/csv_to_openmetrics.py

blocks:
	rm -rf blocks && mkdir -p blocks
	docker run --rm -v "$(CURDIR):/work" -w /work --entrypoint promtool $(PROM_IMG) \
	  tsdb create-blocks-from openmetrics /work/data/metrics.om /work/blocks --max-block-duration=72h
	docker run --rm -v "$(CURDIR):/work" --entrypoint promtool $(PROM_IMG) tsdb list /work/blocks

load:
	docker compose -f $(COMPOSE_BASE) -f $(COMPOSE_OVERRIDE) stop prometheus
	[ -f $(COMPOSE_OVERRIDE).bak ] || cp $(COMPOSE_OVERRIDE) $(COMPOSE_OVERRIDE).bak
	sed -i.tmp 's/--storage.tsdb.retention.time=[^ ]*/--storage.tsdb.retention.time=$(RETENTION)/' $(COMPOSE_OVERRIDE) && rm -f $(COMPOSE_OVERRIDE).tmp
	docker run --rm --entrypoint sh -v $(VOLUME):/prometheus $(PROM_IMG) \
	  -c 'rm -rf /prometheus/* /prometheus/.??* 2>/dev/null; true'
	docker run --rm --entrypoint sh -v $(VOLUME):/prometheus -v "$(CURDIR)/blocks:/blocks:ro" $(PROM_IMG) \
	  -c 'cp -r /blocks/* /prometheus/ && chown -R 65534:65534 /prometheus'
	docker compose -f $(COMPOSE_BASE) -f $(COMPOSE_OVERRIDE) up -d prometheus
	@until curl -sf http://localhost:9090/-/ready >/dev/null 2>&1; do sleep 1; done; echo "prometheus ready"

verify:
	@python3 -I scripts/verify.py

undo:
	docker compose -f $(COMPOSE_BASE) -f $(COMPOSE_OVERRIDE) stop prometheus
	[ -f $(COMPOSE_OVERRIDE).bak ] && mv $(COMPOSE_OVERRIDE).bak $(COMPOSE_OVERRIDE) || true
	docker run --rm --entrypoint sh -v $(VOLUME):/prometheus $(PROM_IMG) \
	  -c 'rm -rf /prometheus/* /prometheus/.??* 2>/dev/null; true'
	docker compose -f $(COMPOSE_BASE) -f $(COMPOSE_OVERRIDE) up -d prometheus

clean:
	rm -rf blocks data/metrics.om
