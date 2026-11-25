## Project knowledge

This repository contains a **Grafana plugin**. You must Read @./.config/AGENTS/instructions.md before doing changes.

## O que este plugin faz

App plugin `ufmg-reliability-app` (EEE017 UFMG) com os índices da proposta (`../docs/proposal/`): R = 1 − f/n (erro e latência), disponibilidade A em relação ao SLO, MTBF e MTTR por episódios de janelas ruins consecutivas.

Dados: Prometheus do `../lab/` (dois casos: `huggingface-prom` e `petshop-prom`), gerados pelos conversores em `../conversores/`. Contrato: `http_server_request_duration_seconds_{count,bucket}` com `error_type` nas falhas; o PetShop traz latência como `http_server_request_duration_window_seconds{quantile}`.

## Estrutura

- `src/reliability/engine.ts` — motor único dos dois painéis (eixo regular, contador acumulado → janela, resumo).
- `src/reliability/episodes.ts` — episódios/MTBF/MTTR; janela não julgada (`null`) corta o episódio por padrão (`censoredBreaks`).
- `src/reliability/overrides.ts` — variáveis do dashboard que sobrescrevem as opções ($tau_ms, $tau_s, $slo_erro, $slo_lat, $min_req, $modo_falha, $censura_corta, $agrupar, $meta_disp).
- `src/panels/summary/` e `src/panels/window-grid/` — refIds A = total, B = erros, C = latência.
- `provisioning/dashboards/ufmg/huggingface.json` e `petshop.json` — dashboards montados pelo lab.

## Decisões não óbvias

- **Modo acumulado é o recomendado.** O conversor genérico grava amostras esparsas (só quando o contador muda) e o Prometheus do HF roda com `--query.lookback-delta=60d`; o painel faz a diferença entre pontos e a contagem por janela é exata. `increase()` extrapola e não serve com amostras esparsas.
- **Passo da consulta = janela.** Os painéis usam `interval: $window` e `maxDataPoints: 11000`; a duração da janela é lida do passo da série (`windowSeconds = 0`).
- **Dashboard do HF em UTC.** O Grafana alinha o passo ao fuso do dashboard; em UTC, a janela de 1d é o dia civil do relatório.
- **Variáveis de texto não disparam nova consulta**, por isso `$censura_corta` usa 1/0 e entra no `+ 0 * (...)` da consulta A.
- **Interpolação linear de baldes em `histogram.ts`.** O conversor do HF inclui baldes em 0.15–0.4 s para τ cair exatamente num balde.

## Não fazer

- Não criar backend plugin, datasource próprio ou código Go.
- Não importar `TimeSeries` de `@grafana/ui` (está em `graveyard/`); séries vão em painéis padrão no JSON do dashboard.
