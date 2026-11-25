# Conversores (adaptadores)

Cada fonte de dado tem um conversor que grava OpenMetrics no contrato do plugin. As métricas seguem as convenções semânticas do OpenTelemetry para HTTP, com os nomes do Prometheus. Depois disso, `promtool tsdb create-blocks-from openmetrics` carrega o arquivo no Prometheus. O `lab/` faz tudo isso no `docker compose up --build`.

| Conversor | Fonte | Quando usar |
|---|---|---|
| `requisicoes_para_openmetrics.py` | Log com **uma linha por requisição** (CSV) | Qualquer log de acesso. Tudo o que muda de uma fonte para outra fica num JSON em `configs/` |
| `petshop_para_openmetrics.py` | Métricas **já agregadas por janela** (CloudWatch do PetShop) | Quando não há a requisição individual, só totais e percentis por janela |

## Configuração do conversor genérico

O exemplo é `configs/huggingface.json`.

| Campo | O que é |
|---|---|
| `colunas.tempo`, `formato_tempo` | Coluna do horário e formato do `strptime` (interpretado como UTC) |
| `colunas.duracao`, `unidade_duracao` | Coluna da duração e unidade (`ms`, `s` ou `us`) |
| `erro.coluna`, `erro.regex` | A requisição é erro quando a coluna casa com a expressão. Ex.: `status_code` e `^5` para 5xx. O valor vira o rótulo `error_type` |
| `rotulos` | `{rótulo do Prometheus: coluna do CSV}`. Use rótulos de baixa cardinalidade: nada de IP, usuário ou ID |
| `mapas` | Troca de valores por coluna (ex.: `server_id` 1 → `web-prod-01`) |
| `rotulos_fixos` | Rótulos iguais em todas as séries (ex.: `job`) |
| `baldes_segundos` | Limites do histograma. Inclua o τ que será usado, para a conta de lentidão ser exata |

```bash
python -I conversores/requisicoes_para_openmetrics.py \
  --config conversores/configs/huggingface.json \
  --entrada casos/huggingface/data/access_logs.csv \
  --saida conversores/saida/huggingface.om
```

O conversor genérico grava uma amostra só quando o contador muda. Por isso, o Prometheus que recebe o arquivo precisa de `--query.lookback-delta` maior que a duração do conjunto (o conversor imprime o mínimo). O lab usa 60 dias. Os painéis usam o modo de contagem **acumulado**.
