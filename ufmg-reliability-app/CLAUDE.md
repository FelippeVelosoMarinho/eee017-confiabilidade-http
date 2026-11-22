## Project knowledge

This repository contains a **Grafana plugin**. You must Read @./.config/AGENTS/instructions.md before doing changes.

## O que este plugin faz

App plugin `ufmg-reliability-app` (EEE017 UFMG) que renderiza os índices de confiabilidade da proposta em `../docs/proposal/proposal.tex`:

- **I1** — `R_erro = 1 - f_err/n` e `R_lat = 1 - f_lat/n` por janela.
- **I2** — Disponibilidade `A` = fração de janelas dentro dos SLOs (R_erro ≥ 99%, R_lat ≥ 95%, τ = 200 ms).
- **I3** — MTBF e MTTR a partir de episódios de janelas ruins consecutivas (porte fiel de `../motor.py#episodios`).

Datasource: Prometheus local do reliability-lab (UID `webstore-metrics`), com métricas OTel semconv `http_server_request_duration_seconds_{count,bucket}` backfilladas em `../data/reliability-backfill/`.

## Estrutura

- `src/reliability/` — motor de cálculo em TypeScript. `episodes.ts` é o porte de `motor.py#episodios`. Testes unitários em `src/reliability/__tests__/` (14 unitários + 1 e2e contra Prometheus com `RUN_E2E=1`).
- `src/panels/summary/` — painel customizado com A, MTBF, MTTR, episódios, boas/ruins/censuradas. Lê três refIds: `A` = total, `B` = erros 5xx, `C` = buckets de latência (por `le`).
- `src/panels/window-grid/` — painel customizado "Painel A — quadro" (servidor × janela, ok/falhou/censurada).
- `src/pages/PageOne.tsx` — página "Visão geral" (metodologia em pt-BR).
- `src/components/AppConfig/` — formulário com `datasourceUid`, `slo_erro`, `slo_lat`, `tau_ms`, `window`, `min_requests`.
- `provisioning/dashboards/ufmg/reliability.json` — dashboard "Confiabilidade HTTP — EEE017" com 5 painéis (os 2 customizados + R_erro, R_lat e p95/p99 em timeseries padrão).
- `provisioning/plugins/apps.yaml` — habilita o app com os defaults.

## Decisões não óbvias

- **Janela default = `2h`, não `1h`.** O backfill tem passo de 1 h; `increase([1h])` em `query_range` retorna vazio porque Prom exige ≥2 amostras dentro do lookback. Em coleta ao vivo com scrape de minutos, voltar para `5m` conforme a metodologia.
- **`min_requests = 1` no dashboard provisionado.** O backfill tem ~5 req por janela de 2 h; 100 req censura tudo. Em coleta real, voltar para 100.
- **Datasource UID = `webstore-metrics`.** Herdado do provisioning do OTel demo (`opentelemetry-demo/src/grafana/provisioning/datasources/default.yaml`). Não criar um novo — reusar.
- **5 painéis, mas só 2 customizados.** R_erro(t), R_lat(t) e p95/p99 são timeseries padrão com PromQL direto — a casca de app agrega tudo e temática a UI em torno de confiabilidade. Isso virou decisão explícita após descobrir que `@grafana/ui`'s `TimeSeries` moveu para `graveyard/` em 11.x.
- **Interpolação linear de buckets em `src/reliability/histogram.ts`.** τ = 200 ms fica entre os buckets OTel `le=0.1` e `le=0.25`; sem interpolar, dá para subestimar `f_lat` em até 15 pontos percentuais.

## Instalação no reliability-lab

Bind-mount feito em `/Users/josoesantos/Projects/reliability-lab/docker-compose.override.yml`:

```yaml
grafana:
  volumes:
    - /Users/josoesantos/Projects/eee017-confiabilidade-http/ufmg-reliability-app/dist:/var/lib/grafana/plugins/ufmg-reliability-app:ro
  environment:
    - GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=ufmg-reliability-app,ufmg-reliability-summary-panel,ufmg-reliability-window-grid-panel
    - GF_DEFAULT_APP_MODE=development
```

Dashboard importado via API (não via provisioning file, pois o OTel-demo já ocupa `/etc/grafana/provisioning/`).

## Como rodar o dev loop

```bash
npm run dev            # watch build para dist/
cd ../../reliability-lab && ./run.sh up       # sobe o stack
docker restart grafana                        # só quando plugin.json muda
```

Dashboard em `http://localhost:8080/grafana/d/ufmg-reliability` (login anônimo-admin).

## Verificação end-to-end

- Range 2024-01-01 → 2024-02-06, janela 2 h.
- Identidade `A = MTBF / (MTBF + MTTR)` tem que valer (0.87 ≈ 8.05 / (8.05+1.17)). Rodar `RUN_E2E=1 npx jest src/reliability/__tests__/e2e-backfill.test.ts` com o Prometheus local de pé.
- Disponibilidade de 2024-01-15 por request-weighted PromQL: `0.98136` (vs. `0.9826` no `data/reliability-backfill/README.md:82` — diferença dentro da tolerância de fronteira de janela).

## Não fazer

- Não criar backend plugin, custom datasource ou código Go. V1 é frontend puro em cima do Prometheus padrão.
- Não portar Weibull nem Kaplan–Meier aqui — fica em `../motor.py` e `../analisar.py` offline.
- Não importar `@grafana/ui`'s `TimeSeries` do caminho público — está em `graveyard/`. Para gráficos, usar painéis stock via dashboard JSON.
