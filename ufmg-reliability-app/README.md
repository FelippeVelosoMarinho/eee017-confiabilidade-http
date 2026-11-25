# ufmg-reliability-app — plugin de confiabilidade para o Grafana

App plugin com duas páginas (Visão geral e Configuração) e dois painéis:

| Painel | id | O que mostra |
|---|---|---|
| Resumo | `ufmg-reliability-summary-panel` | Disponibilidade A, MTBF, MTTR, episódios, janelas boas/ruins/não julgadas, R_erro e R_lat do período, e os parâmetros usados |
| Quadro de janelas | `ufmg-reliability-window-grid-panel` | Uma linha por valor de um rótulo e uma coluna por janela: ok, falhou, não julgada, sem tráfego |

Os dois passam pelo mesmo motor (`src/reliability/engine.ts`). Consultas esperadas: **A** = total, **B** = erros, **C** = latência (baldes `le` ou percentil da janela). Os parâmetros e as variáveis do dashboard estão no README da raiz do repositório.

## Código

| Arquivo | Papel |
|---|---|
| `src/reliability/engine.ts` | Eixo regular, contador acumulado → contagem por janela, janelas, resumo |
| `src/reliability/indices.ts` | Julgamento de cada janela (R_erro, R_lat, mínimo) |
| `src/reliability/episodes.ts` | Episódios, MTBF, MTTR e disponibilidade, com a regra para janela não julgada |
| `src/reliability/histogram.ts` | Requisições acima de τ a partir dos baldes (interpola entre baldes) |
| `src/reliability/overrides.ts` | Variáveis do dashboard que sobrescrevem as opções |
| `src/reliability/panelOptions.ts` | Opções comuns dos painéis |
| `provisioning/dashboards/ufmg/` | Dashboards do Hugging Face e do PetShop (montados pelo `lab/`) |

## Desenvolvimento

```bash
npm ci
npm run typecheck
npx jest          # testes de unidade, inclui o gabarito do Hugging Face
npm run build     # gera dist/
```

Para ver no Grafana com os dados, use o `lab/` da raiz (`docker compose up --build`). Testes contra o Prometheus do lab:

```bash
RUN_E2E=1 npx jest e2e      # PowerShell: $env:RUN_E2E=1; npx jest e2e
```
