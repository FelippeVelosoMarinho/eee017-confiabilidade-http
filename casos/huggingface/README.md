# Hugging Face — mindweave/web-server-logs

## O dado

`data/access_logs.csv` é a amostra grátis do conjunto [mindweave/web-server-logs](https://huggingface.co/datasets/mindweave/web-server-logs):

- 5.000 requisições, de 01/01 a 06/02/2024 (37 dias);
- três servidores (`server_id` 1, 2 e 3 → `web-prod-01`, `-02`, `-03`);
- uma linha por requisição, com horário, método, rota já sem identificadores, código, `response_time_ms` e bytes.

O cartão do conjunto diz que o dado é **sintético**. A licença é CC BY-NC 4.0.

## Do CSV ao Grafana

```text
access_logs.csv ──conversores/requisicoes_para_openmetrics.py + configs/huggingface.json──▶ OpenMetrics ──promtool──▶ Prometheus (lab, porta 9090)
```

- **Erro:** código 5xx. Vira o rótulo `error_type` com o próprio código. 4xx e 3xx não contam.
- **Duração:** `response_time_ms` / 1000, em baldes. Os baldes são os recomendados pelo OTel mais 0,15, 0,2, 0,3, 0,35 e 0,4 s. Com isso, τ = 200 ms cai exatamente num balde e a conta de lentidão é exata.
- **Rótulos:** `server_address`, `http_route`, `http_response_status_code` e `job`. IP, user agent e referrer ficam de fora.
- **Amostras esparsas:** todas as séries começam com zero em 31/12/2023, e depois há uma amostra só quando o contador muda, 1 ms depois do evento. Isso dá cerca de 126 mil amostras, contra os 20 milhões do backfill antigo de hora em hora. O Prometheus do lab roda com `--query.lookback-delta=60d`, então o valor do contador em qualquer instante é exato. O painel, no modo acumulado, tira a contagem de qualquer janela pela diferença entre dois pontos. A janela fica [início, fim), como a contagem por data do Colab.

## Parâmetros do relatório

Estão no dashboard *Confiabilidade — Hugging Face (web-server-logs)* como padrão:

| Parâmetro | Valor | Por quê |
|---|---|---|
| Janela | 24 h (UTC) | Com cerca de 137 requisições por dia, a janela de 5 min da proposta teria no máximo 6. 24 h é o menor corte do calendário em que o mínimo de 100 se aplica |
| Mínimo | 100 requisições | O da proposta: uma falha em 100 é exatamente 1% |
| τ | 200 ms | O da proposta |
| Metas | 99% (erro) e 95% (latência) | As da proposta, fixadas antes de ver o arquivo |
| Dia não julgado | corta o episódio | Os 9 dias abaixo do mínimo separam os trechos ruins |

O dashboard tem seletores para testar outras janelas, mínimos, τ e metas (análise de sensibilidade). Os valores marcados "(proposta)" ou "(relatório)" são os oficiais.

## Gabarito

`relatorio-logs-huggingface.pdf` traz a análise feita no Colab. O plugin reproduz os números dele:
- 28 de 37 dias julgados;
- nenhum dia dentro das duas metas;
- 4 dias dentro só da meta de erro;
- 6 episódios;
- MTTR de 4,7 dias;
- R_erro de 97,80% e R_lat de 75,20%.

Há dois testes:
- `ufmg-reliability-app/src/reliability/__tests__/engine.test.ts` usa os totais diários do CSV, em `fixtures/hf_por_dia.json`;
- `e2e-huggingface.test.ts` consulta o Prometheus do lab.
