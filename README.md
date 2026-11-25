# Confiabilidade de sistemas de software distribuídos a partir de sinais OpenTelemetry

Trabalho prático da disciplina **EEE 017 — Confiabilidade de Sistemas** (Engenharia de Sistemas, UFMG), 2026.

Felippe Veloso Marinho, Josoe Santos Queiroz, Maria Eduarda Sampaio, Matheus Amorim Soares Salles e Raphael Lucas Silva Amaral.

## O que é

Um plugin do Grafana que calcula os índices de confiabilidade da proposta sobre métricas HTTP no formato do OpenTelemetry. Os índices são: R por requisição (modelo de Nelson), disponibilidade em relação ao SLO, MTBF e MTTR. As metas, o limite de lentidão, o tamanho da janela e o volume mínimo mudam conforme o sistema avaliado.

```text
fonte (log ou métrica) ──conversor──▶ OpenMetrics (convenção OTel) ──▶ Prometheus ──▶ plugin + dashboard no Grafana
```

O plugin não lê arquivo cru. Cada fonte tem um **conversor** (o adaptador) que grava sempre o mesmo contrato:

| Métrica | Significado |
|---|---|
| `http_server_request_duration_seconds_count` | total de requisições (contador acumulado) |
| o mesmo contador com `error_type` | requisições com falha no modo erro (5xx, ou o erro que a fonte marca) |
| `http_server_request_duration_seconds_bucket{le}` | latência como histograma (quando a fonte tem a duração de cada requisição) |
| `http_server_request_duration_window_seconds{quantile}` | latência como percentil da janela (quando a fonte só traz percentis) |

Os painéis recebem três consultas: **A** = total, **B** = erros, **C** = latência.

## O que está em cada pasta

**Entregável**

| Pasta | Conteúdo |
|---|---|
| [`ufmg-reliability-app/`](ufmg-reliability-app/) | O plugin: app com página de explicação, painel de resumo (A, MTBF, MTTR, R) e quadro de janelas. Dashboards em `provisioning/dashboards/ufmg/` |
| [`conversores/`](conversores/) | Adaptadores fonte → OpenMetrics. Um genérico para log de requisições, configurado por JSON, e um para o PetShop |
| [`lab/`](lab/) | `docker compose` que converte os dois casos, sobe um Prometheus para cada um e um Grafana com o plugin |
| [`casos/huggingface/`](casos/huggingface/) | Caso Hugging Face: `access_logs.csv` do mindweave/web-server-logs e o relatório que serve de gabarito |
| [`casos/petshop/`](casos/petshop/) | Caso PetShop: PetShop Dataset (Amazon Science), análise em Python e resultados |
| [`docs/`](docs/) | Proposta (LaTeX e PDF), relatório final (LaTeX) e orientações da disciplina |

**Contexto (não faz parte da entrega)**

| Pasta | Conteúdo |
|---|---|
| [`contexto/`](contexto/) | Versões anteriores e material de trabalho: motor em Python do funil/Cage, caixa fechada, planner de coleta, backfill antigo do HF, screenshots antigos. Ver [`contexto/README.md`](contexto/README.md) |

## Como rodar

Só precisa do Docker Desktop.

```bash
cd lab
docker compose up --build
```

A primeira vez demora alguns minutos: o Docker converte os dados, gera os blocos do Prometheus e compila o plugin.

- **Grafana:** <http://localhost:3000>, sem senha. Os dashboards estão em *Dashboards → Confiabilidade*:
  - *Confiabilidade — Hugging Face (web-server-logs)*
  - *Confiabilidade — PetShop (Amazon Science)*
- **Prometheus do Hugging Face:** <http://localhost:9090>
- **Prometheus do PetShop:** <http://localhost:9091>
- **Para parar:** `docker compose down`. Depois de mudar código ou dados: `docker compose down -v` e `docker compose up --build`.

## O que se configura

Tudo vem com o padrão da proposta e pode ser trocado sem mexer no código. A prioridade é esta: **variável do dashboard > opção do painel > padrão da proposta**.

| Parâmetro | Variável do dashboard | Padrão (proposta) | Observação |
|---|---|---|---|
| Duração da janela | `$window` | 5 min | Vai no intervalo mínimo da consulta, para o passo ser igual à janela. O plugin lê a duração do próprio passo. HF: 24 h |
| Volume mínimo por janela | `$min_req` | 100 | Abaixo disso a janela não é julgada |
| τ (limite de requisição lenta) | `$tau_ms` (ms) ou `$tau_s` (s) | 200 ms | No histograma, τ exato precisa ser um balde; entre baldes o plugin interpola |
| Meta de erro R*_erro | `$slo_erro` | 99% | Aceita 0.99 ou 99 |
| Meta de latência R*_lat | `$slo_lat` | 95% | Aceita 0.95 ou 95 |
| Modo de falha | `$modo_falha` | erro ou latência | `ambos`, `erro` ou `latencia`. Os dashboards mostram os três lado a lado |
| Janela não julgada corta o episódio | `$censura_corta` | sim | `sim`/`nao` ou `1`/`0` |
| Linhas do quadro | `$agrupar` | `server_address` | Qualquer rótulo: `job`, `http_route`, `componente`... |
| Formato das contagens | opção do painel | por janela | **Acumulado** é o recomendado: o painel faz a diferença e a conta fica exata |
| Fonte da latência | opção do painel | histograma | Ou percentil da janela (a janela é ruim se o percentil passa de τ) |

### Para avaliar outro sistema

1. **Log com uma linha por requisição:** copie `conversores/configs/huggingface.json`. Ajuste as colunas de horário e duração, a regra de erro (coluna e expressão regular), os rótulos e os baldes (inclua o τ que o grupo quer usar). Rode `conversores/requisicoes_para_openmetrics.py`.
2. **Sistema já instrumentado com OpenTelemetry:** não precisa de conversor. O coletor já grava `http_server_request_duration_seconds` e `error_type`.
3. Copie um dos dashboards e troque as variáveis.

## Regras de cálculo

- Uma requisição falha por **erro** (código 5xx, ou o que a fonte marca em `error_type`) ou por **lentidão** (duração acima de τ).
- A janela fica **ruim** quando R_erro < R*_erro ou R_lat < R*_lat. Os modos também são calculados separadamente.
- Uma janela abaixo do mínimo **não é julgada**: não conta como boa nem como ruim. Por padrão ela **encerra o episódio em curso**, porque não se sabe o que aconteceu nela.
- **Disponibilidade A** = janelas boas / janelas julgadas.
- **MTBF** = janelas boas / episódios.
- **MTTR** = janelas ruins / episódios.
- Vale A = MTBF / (MTBF + MTTR).
- **R do período** = 1 − f/n, somando todas as requisições.
- Se as falhas passarem do total numa janela, o painel avisa. É sinal de consultas A e B trocadas, como o erro de 116% do Colab.

## Conferência

Os testes do plugin (`cd ufmg-reliability-app && npm ci && npx jest`) reproduzem o relatório do Hugging Face a partir dos totais diários do CSV. Os valores são janela de 24 h, mínimo 100, τ = 200 ms e metas de 99% e 95%. O resultado:

| | Relatório | Plugin |
|---|---|---|
| Dias julgados | 28 de 37 | 28 de 37 |
| Dias dentro das duas metas | 0 | 0 |
| Dias dentro só da meta de erro | 4 (13/01, 17/01, 31/01, 05/02) | os mesmos 4 |
| Episódios | 6 (6, 6, 5, 5, 5 e 1 dia) | 6 |
| MTTR | 4,7 dias | 28/6 = 4,67 dias |
| R_erro / R_lat do arquivo | 97,80% / 75,20% | 97,80% / 75,20% |

Com o lab no ar, `RUN_E2E=1 npx jest e2e` confere os mesmos números contra o Prometheus. Também confere os do PetShop contra `casos/petshop/resultados/`.

## Dados e licenças

- O código e os textos deste repositório estão sob a licença MIT ([LICENSE](LICENSE)).
- **Hugging Face — mindweave/web-server-logs:** dado sintético, licença CC BY-NC 4.0, Mindweave Technologies. <https://huggingface.co/datasets/mindweave/web-server-logs>
- **PetShop Dataset:** CC BY 4.0. Hardt et al. (2024), *The PetShop Dataset — Finding Causes of Performance Issues across Microservices*, CLeaR 2024. <https://github.com/amazon-science/petshop-root-cause-analysis>
- A proposta do grupo e o PDF de orientações são material da disciplina e permanecem com seus autores.

## Uso de IA

Partes do código, dos conversores, dos dashboards e destes textos foram feitas com apoio do Claude (Anthropic), a pedido do grupo. Pelas orientações da disciplina, o grupo confere as contas, explica cada passo e declara esse uso no documento final.
