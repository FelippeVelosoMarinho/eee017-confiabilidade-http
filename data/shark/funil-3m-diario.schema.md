# Schema — Shark funil diário (Meta Ads / Delivery)

Fonte real anexada: `funil-3m-diario.csv` (Bitts — campanhas Foodporns/Cardápio).

| Coluna | Tipo | Obrigatória | Notas |
| --- | --- | --- | --- |
| `Data` | `DD/MM/YYYY` | sim | 1 linha = 1 dia |
| `Cliques no link` | int | sim | |
| `Visualizações da página de destino` | int | sim | |
| `Checkouts iniciados` | int | sim | |
| `Compras` | int | sim | |
| `Custo por compra (R$)` | money BR | sim | |
| `ROAS` | number BR | sim | |
| `Ticket médio (R$)` | money BR | sim | |
| `Valor de conversão (R$)` | money BR | sim | |
| `Investimento` | money BR | sim | |
| `Taxa de Conversão` | percent BR | não | |

## Cobertura
- Intervalo: 01/08/2026 → 31/10/2026 (92 dias, sem gaps)
- Dias zerados (investimento/cliques/compras = 0): excluir da amostra Weibull (não censurar)

## Domínio na caixa
`shark.funnel_3m` — falha tipicamente por ROAS/CPA vs limiar relativo na janela diária; funil clique→landing→checkout→compra para drop opcional.
