# Plugin Grafana de análise preditiva — caixa fechada (Shark × Sabia)

Desenho do TP EEE 017 ([eee017-confiabilidade-http](https://github.com/FelippeVelosoMarinho/eee017-confiabilidade-http)) como **sistema em caixa fechada**: o motor dos três indicadores é fixo; dois **plug-ins de cenário** alimentam o mesmo contrato de entrada.

| Decisão do usuário (obrigatória) | Como entra neste desenho |
| --- | --- |
| **Shark** | Funil de **3 meses** de um cliente — CSV anexado no repo em breve; **não inventar dados**; documentar schema + placeholder |
| **Sabia** | **Somente** requests de **desembrulho / descriptografia** — não o pipeline KMS→LLM→… |
| Forma | Uma caixa; dois cenários; mesmas portas |

Narrativa visual + Mermaid: [`caixa-fechada-tp.md`](./caixa-fechada-tp.md).

A descrição do TP é a [proposta do grupo](./grupo_1_proposal.pdf). Este desenho é o motor genérico dessa proposta: o ajuste (Weibull, MTBF/MTTR, \(P(S>L)\)) fica fora do painel; o Grafana mostra o estado e a curva.

---

## 0. Visão: caixa fechada

```text
  [Plug-in Shark: funil 3m] ──┐
                              ├──▶ portas (fonte, FailureSpec) ──▶ adaptador
  [Plug-in Sabia: decrypt]  ──┘              │
                                             ▼
                                      UnitRecord[]
                                             │
                    ┌────────────────────────┴────────────────────────┐
                    │              CAIXA FECHADA                       │
                    │  ① taxa×janela  ② Weibull+censura  ③ P(S>L)     │
                    │              → relatorio.json / gauges           │
                    └────────────────────────┬────────────────────────┘
                                             ▼
                                      Grafana (A + B)
```

Trocar de Shark para Sabia = trocar adaptador + fonte + `FailureSpec`. O motor e os painéis **não** mudam.

---

## 1. Contrato único de entrada

Todo cenário entra pelas mesmas portas. Sem isso, cada painel inventa “falha” de novo e os três indicadores deixam de ser comparáveis.

```text
ReliabilityInput = {
  fonte,            // onde vivem os eventos (CSV funil, log/span decrypt, …)
  definicao_falha,  // predicado + limiar relativo + elegibilidade  (= FailureSpec)
  unidade_amostral, // o que “sobrevive” ou “falha”
  request_evento    // átomo observável
}
```

### Campos obrigatórios

| Campo | O que fixa | Shark (funil 3m) | Sabia (decrypt) |
| --- | --- | --- | --- |
| `fonte` | Sinal + schema mínimo | `data/shark/funil-3m.csv` (a anexar) | logs/spans de desembrulho |
| `definicao_falha` | Predicado, limiar relativo, elegibilidade | drop de etapa > limiar **ou** ROI abaixo do SLO | `decrypt_fail` / `key_mismatch` > limiar **ou** duração > P99 da camada |
| `unidade_amostral` | Uma linha na tabela de sobrevivência | `dia × cliente` | dia de serviço |
| `request_evento` | Contagem / atributo | 1 evento de etapa do funil | 1 operação decrypt |

### Saída do adaptador → entrada da caixa

```text
UnitRecord = {
  unit_id,          // Shark: 2025-08-06×cliente_X | Sabia: 2025-08-06
  t_min,            // tempo até falha ou até censura
  censored,         // true se terminou sem cruzar limiar
  cause?,           // Shark: drop_checkout | roi_baixo | …  Sabia: decrypt_fail | key_mismatch | latency_rel
  windows[],        // agregados por janela (ind. 1 e carga L)
  meta              // { dominio: "shark.funnel_3m" | "sabia.decrypt", … }
}
```

### FailureSpec (JSON estável)

```json
{
  "dominio": "shark.funnel_3m | sabia.decrypt",
  "failure_spec": {
    "window": "1d | 15m",
    "predicate": "error_rate > threshold OR relative_latency > k OR drop > threshold OR roi < threshold",
    "threshold_mode": "rolling_p95 | rolling_p20 | fixed_slo | ic_upper",
    "threshold_value": null,
    "eligibility": "min_events_per_window"
  }
}
```

---

## 2. Plug-ins de cenário

### 2.1 Shark — funil de 3 meses (um cliente)

| Campo | Valor |
| --- | --- |
| `dominio` | `shark.funnel_3m` |
| fonte | CSV do funil do cliente (3 meses). **Arquivo real ainda não anexado** — ver schema e placeholder abaixo |
| falha | (A) **jornada**: drop na etapa > limiar relativo daquela etapa; (B) **orçamento** (opcional): ROI da janela < limiar relativo / SLO |
| unidade | `dia × cliente` |
| evento | impressão → cardápio → carrinho → checkout → compra |
| horizonte | 3 meses (amostra completa do CSV) |

**Fora deste plug-in (agora):** WhatsApp 1:1 / IA Shark — não misturar no CSV do funil.

#### O que o usuário anexa no repo

```text
data/shark/funil-3m.csv            ← arquivo real (anexar em breve; NÃO inventar)
data/shark/funil-3m.PLACEHOLDER    ← “cole o CSV aqui”
data/shark/funil-3m.schema.md      ← contrato de colunas (abaixo)
```

#### Schema esperado do funil (contrato de entrada)

| Coluna | Tipo | Obrigatória | Notas |
| --- | --- | --- | --- |
| `timestamp` | ISO-8601 | sim | instante do evento |
| `cliente_id` | string | sim | define a fatia da unidade |
| `campanha_id` | string | não | filtro opcional |
| `etapa` | enum | sim | `impressao` \| `cardapio` \| `carrinho` \| `checkout` \| `compra` |
| `evento_id` | string | sim | único |
| `sessao_id` | string | recomendado | amarra a jornada |
| `custo_anuncio` | number | se falha=ROI | |
| `receita` | number | se falha=ROI | 0 se não converteu |
| `meta` | string/JSON | não | tags |

Até o CSV chegar: adaptadores e demos usam **somente** o schema + fixtures sintéticas **explicitamente marcadas como fake** (nunca misturadas com `funil-3m.csv`).

### 2.2 Sabia — somente decrypt / desembrulho

| Campo | Valor |
| --- | --- |
| `dominio` | `sabia.decrypt` |
| fonte | logs / spans / métricas **só** da etapa de descriptografia |
| falha | taxa de `decrypt_fail` / `key_mismatch` / `timeout` na janela > limiar relativo **ou** duração > P99 móvel da própria camada |
| unidade | dia de serviço |
| evento | 1 operação de decrypt |

**Explicitamente fora de escopo deste TP:** consulta KMS/Infisical, LLM, criptografia de saída, persistência DB, interface. Essas camadas podem virar plug-ins futuros com o **mesmo** contrato; hoje a caixa só recebe decrypt.

#### Schema mínimo de telemetria decrypt

| Campo | Tipo | Significado |
| --- | --- | --- |
| `timestamp` | ISO-8601 | instante |
| `status` | enum | `ok` \| `fail` \| `key_mismatch` \| `timeout` |
| `duracao_ms` | number | duração |
| `chave_id` | string | id lógico (sem material secreto) |
| `request_id` | string | correlação |

---

## 3. Os três indicadores nos dois cenários

Indicadores do TP (matemática **igual** dentro da caixa):

1. **Taxa de “erro” em janela** × limiar  
2. **Weibull MLE com censura** (tempo até falha da unidade)  
3. **Carga–resistência** \(P(S>L)\)

### Glossário

| Símbolo | Significado |
| --- | --- |
| janela | intervalo de agregação sem overlap |
| \(L\) | carga observada na janela |
| \(S\) | resistência (SLO / percentil / IC) |
| \(t\) | tempo até 1ª falha (ou censura) |
| censura | unidade terminou sem cruzar limiar — **não** inventar falha no fim |

### Tabela-mestre (escopo atual)

| Domínio | Ind. 1 — taxa/janela | Ind. 2 — Weibull / \(t\) / censura | Ind. 3 — \(L\), \(S\), \(P(S>L)\) |
| --- | --- | --- | --- |
| **Shark funil 3m** | drop da etapa (ou ROI) na janela diária vs limiar relativo | unidade `dia×cliente`; \(t\) até 1ª janela ruim no horizonte 3m; campanha/cliente sem estouro = censura | \(L=\) drop ou 1/ROI; \(S=\) meta de drop / ROI mínimo |
| **Sabia decrypt** | taxa de falha de decrypt na janela (5–15 min) vs P95 móvel | unidade = dia; \(t\) até 1ª janela ruim; dia limpo = censura | \(L=\) taxa ou atraso relativo \(d/\mathrm{P50}\); \(S=\) SLO ou P99 da camada |

### Calibração

A proposta fixa o critério do serviço instrumentado: janela \(\Delta = 5\,\mathrm{min}\), pelo menos 100 requisições, SLOs declarados antes da coleta (\(R^{*}_{\mathrm{erro}} = 99\%\), \(R^{*}_{\mathrm{lat}} = 95\%\)) e, no modo lentidão, \(\tau = 200\,\mathrm{ms}\).

- A janela e o limiar de cada plug-in saem dos dados daquele cenário ou do SLO declarado para ele.
- Ordem: critério de falha, depois amostra, depois ajuste. Para a Weibull separar \(\beta\) de \(\eta\), a taxa de unidades que falham fica tipicamente entre 20% e 80%.
- Unidade sem observação (apagão) fica fora da amostra. Censura é a unidade observada até o fim sem cruzar o limiar.
- Na camada Sabia, a latência entra como atraso relativo \(d / P50\) móvel. O \(\tau = 200\,\mathrm{ms}\) permanece o modo lentidão da proposta, no serviço, e não vira corte absoluto do decrypt.

---

## 4. Arquitetura Grafana (dentro / fora da caixa)

### Decisão de tipo

| Fase | Tipo Grafana | Papel |
| --- | --- | --- |
| **A** | **panel** | Estado da unidade: OK / Falhou em \(t\) / Censurado; taxa×limiar; banda IC |
| **B** | **panel** (+ JSON) | Visualiza \(\beta,\eta\), KM, \(P(S>L)\), tabela — **não** calcula MLE |
| Preditivo | panel + job Python | \(R(t)\) / risco restante a partir do modelo já ajustado |

**Não** começar por app nem por MLE no browser.

### Onde cada coisa roda

```text
[Fonte Shark CSV | Sabia decrypt]
        │
        ▼
[Adaptador]  ← shark_funnel_adapter | sabia_decrypt_adapter
        │  emite UnitRecord[] + windows[] + FailureSpec
        ▼
[Motor — CAIXA FECHADA]  ← Python (MLE, KM, Monte Carlo P(S>L))
        │  relatorio.json / gauges
        ▼
[Grafana]
   ├─ Panel A: série + limiar + estado
   └─ Panel B: R(t), KM, tabela, P(S>L)
```

| Responsabilidade | Browser (panel) | Backend Python |
| --- | --- | --- |
| Comparar taxa da janela com limiar | sim | opcional (alerta) |
| Estado OK/Falhou/Censurado | sim (se receber série + spec) | sim (fonte da verdade) |
| MLE Weibull, NLL, MTTF | **não** | **sim** |
| Kaplan–Meier | só plot | sim |
| Monte Carlo \(P(S>L)\) | não | sim |
| Predição \(R(t^*)\) | sim **se** β,η já vierem | sim |

### Predição sem MLE no painel

1. Job Python ajusta \(\beta,\eta\) na amostra (Shark: 3 meses; Sabia: janela histórica de dias).  
2. Emite \(R(t)=\exp[-(t/\eta)^\beta]\).  
3. Painel avalia a função — não reajusta.

Contrato de saída do motor, em `relatorio.json`: `escolha`, `weibull`, `kaplan_meier`, `carga_resistencia`, `amostra`, `dominio`, `failure_spec`, `predicao`.

---

## 5. Critérios de falha relativos

1. Limiar sai dos **dados do próprio cenário** ou de um **SLO declarado**.  
2. Preferir percentil rolante / IC dos N períodos anteriores (~30 unidades quando possível).  
3. Latência Sabia só como atraso relativo: \(L_{\text{rel}} = d / P50_{\text{móvel}}\).  
4. Pouca história ⇒ declarar limitação; não fingir precisão.

| Contexto | Limiar sugerido | Janela a calibrar |
| --- | --- | --- |
| Proposta (serviço instrumentado) | SLO declarado: \(R^{*}_{\mathrm{erro}}=99\%\), \(R^{*}_{\mathrm{lat}}=95\%\); lentidão em \(\tau=200\,\mathrm{ms}\) | 5 min, com pelo menos 100 requisições |
| Shark funil (drop) | P80 móvel do drop por etapa | 1 dia |
| Shark funil (ROI) | P20 móvel de ROI ou SLO mínimo | 1 dia |
| Sabia decrypt | P95 móvel da taxa de erro; latência: \(d/P50\) móvel | 5–15 min |

\(S\) observável: SLO ± σ, IC histórico, ou percentil. Índice: \(R=P(S>L)\) por Monte Carlo.

---

## 6. Como ligar o cenário (resumo)

1. Escolher plug-in: `shark.funnel_3m` ou `sabia.decrypt`.  
2. Anexar fonte (CSV funil **real** ou telemetria decrypt).  
3. Declarar `FailureSpec`.  
4. Rodar adaptador → `UnitRecord[]`.  
5. Rodar motor Python → `relatorio.json`.  
6. Abrir Grafana A + B.  
7. Trocar cenário = repetir 1–3; caixa e painéis ficam.

Passo a passo visual (sequência Mermaid): [`caixa-fechada-tp.md`](./caixa-fechada-tp.md) §7.

---

## 7. Roadmap curto

| Etapa | Entrega |
| --- | --- |
| **A** | Panel estado OK/Falhou/\(t\)/Censurado + `FailureSpec` no JSON |
| **A′** | Adaptadores `shark.funnel_3m` (schema+placeholder) e `sabia.decrypt` → `UnitRecord` |
| **B** | Panel lê `relatorio.json`: β, η, KM, \(P(S>L)\) |
| **Preditivo** | Job Python; painel mostra \(R(t)\) / risco restante |

### Fora de escopo deste desenho

- Pipeline Sabia além de decrypt.  
- WhatsApp Shark neste ciclo.  
- Inventar CSV do funil.  
- Treinar LLM / classificador como “confiabilidade”.  
- Usar \(\tau = 200\,\mathrm{ms}\) como corte da camada Sabia decrypt. Esse valor é o modo lentidão da proposta, no serviço instrumentado.  
- MLE no browser como linha principal.

---

## 8. Resumo operacional

1. **Caixa fechada** com portas `fonte` + `FailureSpec` → `UnitRecord[]` → ①②③ → Grafana.  
2. **Shark** = funil 3m (schema + placeholder até o CSV).  
3. **Sabia** = só decrypt.  
4. **Plugin:** A → A′ → B → preditivo; MLE só em Python.  
5. Visual completo: [`caixa-fechada-tp.md`](./caixa-fechada-tp.md).

Referências: [proposta do grupo](./grupo_1_proposal.pdf), [descrição em Markdown](./proposta.md), [caixa fechada](./caixa-fechada-tp.md), [README](../README.md).
