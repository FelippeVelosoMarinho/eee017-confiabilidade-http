# Capturas do Grafana (lab, 25/11/2026)

Tiradas do `lab/` com os padrões da proposta. Os parâmetros usados aparecem no topo de cada imagem.

**Hugging Face** — janela de 1 dia, mínimo de 100 requisições, τ = 200 ms, metas de 99% e 95%

| Arquivo | O que mostra |
|---|---|
| `hf-01-dashboard-visao-geral.jpg` | Dashboard inteiro |
| `hf-02-so-erro.jpg` | Resumo, só erro: 4 de 28 dias bons, 7 episódios, MTTR 3,4 d |
| `hf-03-so-latencia.jpg` | Resumo, só latência: 0 de 28, 6 episódios, MTTR 4,7 d |
| `hf-04-erro-ou-latencia.jpg` | Resumo, definição da proposta: 0 de 28, 6 episódios, MTTR 4,7 d |
| `hf-05-quadro-de-janelas-servico.jpg` | Quadro de janelas do serviço: dias ruins e os 9 dias não julgados |
| `hf-06-quadro-por-servidor-nao-julgado.jpg` | Mesmo quadro por servidor: nenhum servidor chega a 100 requisições por dia |
| `hf-07-requisicoes-por-dia-e-minimo.jpg` | Requisições por dia contra o mínimo de 100 |
| `hf-08-p95-por-dia-e-tau.jpg` | p95 por dia contra τ = 200 ms |
| `hf-09-r-erro-por-dia.jpg` | R_erro por dia contra a meta de 99% |
| `hf-10-r-lat-por-dia.jpg` | R_lat por dia contra a meta de 95% |

**PetShop** — PetSite, tráfego baixo (21–23/08/2023), janela de 5 min, mínimo de 100

| Arquivo | O que mostra |
|---|---|
| `ps-01-dashboard-visao-geral.jpg` | Dashboard inteiro |
| `ps-02-so-erro.jpg` | Resumo, só erro: 96,26% das janelas, 13 episódios, MTTR 8,5 min |
| `ps-03-erro-ou-latencia-tau200.jpg` | Definição da proposta com τ = 200 ms: 0% |
| `ps-04-erro-ou-latencia-tau350.jpg` | Mesma conta com τ = 350 ms: 87,27%, 56 episódios, MTTR 6,7 min (sensibilidade) |
| `ps-05-quadro-por-componente.jpg` | Quadro por componente, meta de erro |
| `ps-06-tabela-r-erro-por-componente.jpg` | R_erro de cada componente no período |
| `ps-07-r-erro-por-janela.jpg` | R_erro por janela contra a meta |
| `ps-08-p95-por-janela-e-tau.jpg` | p95 e p50 por janela contra τ |

`plugin-pagina-visao-geral.jpg`: página do plugin com o método e os parâmetros configuráveis.
