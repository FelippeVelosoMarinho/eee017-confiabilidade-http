# Screenshots do plugin `ufmg-reliability-app`

Capturados contra o Prometheus local do `reliability-lab`, usando o backfill de
`data/reliability-backfill/` (37 dias, 5000 requisições reais).

| Arquivo | O que mostra |
|---|---|
| `dashboard-overview.png` | Dashboard "Confiabilidade HTTP — EEE017" em range `2024-01-01 → 2024-02-06`, janela `2h`. Mostra o painel Summary (A, MTBF, MTTR, episódios), o Painel A (quadro servidor×janela), R_erro(t), R_lat(t) e p95/p99 por `server_address`. |
| `app-overview-page.png` | Página "Visão geral" do app plugin, com a metodologia da proposta em pt-BR. |
| `app-configuration.png` | Página de configuração do app: `datasourceUid`, `slo_erro`, `slo_lat`, `tau_ms`, `window`, `min_requests`. |

Valores notáveis do dashboard na captura:

- **Disponibilidade A = 13.03%** — baixa por característica do dataset: janelas
  de 2 h com ~5 req cada não conseguem sustentar SLO de 99% (um erro já derruba
  a janela). Em coleta real de 5 min com ≥100 req, o número é bem outro.
- **MTBF = 2.58 janelas** (≈ 5.2 h), **MTTR = 17.22 janelas** (≈ 1.4 d),
  81 episódios. Satisfaz a identidade `A = MTBF / (MTBF + MTTR)`.
- **Boas / ruins / censuradas = 209 / 1395 / 152**.
