# Plugin — o que inserir e o que acompanhar

O motor é único. O adaptador traduz um tipo de arquivo para o mesmo registro. Identificadores deste ciclo:

| Adaptador | Identificador |
| --- | --- |
| Funil de vendas | `funil.vendas` |
| Requisição HTTPS de descriptografia | `http.descriptografia` |

A explicação de janela, objetivo, censura, MTBF e MTTR está no [README](../README.md). O desenho da caixa está em [`caixa-fechada-tp.md`](./caixa-fechada-tp.md).

Códigos de segmento, de sessão e de chave são opacos. O arquivo não leva nome de pessoa, de conta, de cliente ou de produto, nem segredo.

---

## Funil de vendas (`funil.vendas`)

Serve para uma jornada de várias etapas, observada por cerca de três meses.

### O que inserir

Caminho: `data/funil/eventos.csv`. Uma linha por passo.

| Coluna | Tipo | Obrigatória | O que colocar |
| --- | --- | --- | --- |
| `timestamp` | ISO-8601 | sim | Instante do passo |
| `segmento_id` | string | sim | Código opaco do recorte. Sem nome |
| `etapa` | enum | sim | `impressao`, `visita`, `carrinho`, `checkout` ou `compra` |
| `evento_id` | string | sim | Identificador único da linha |
| `sessao_id` | string | recomendado | Amarra os passos da mesma jornada. Também opaco |
| `custo` | number | só para retorno | Custo atribuído |
| `receita` | number | só para retorno | Receita. Zero se não houve compra |

Janela: **1 dia**. Unidade: **dia × segmento**. Dia sem evento naquele segmento fica de fora.

### Quando a unidade estoura

- A passagem de uma etapa para a seguinte fica pior que o percentil móvel daquela etapa (partida: P80), ou
- se `custo` e `receita` existem, o retorno do dia fica abaixo do objetivo ou do P20 da própria série.

### O que acompanhar

No quadro de três meses, cada linha é um segmento e cada coluna é um dia:

- verde, ok;
- vermelho, falhou, com o instante do primeiro estouro e a etapa;
- cinza, fim sem estouro;
- em branco, sem tráfego, fora da amostra.

Ao lado: confiabilidade da jornada \(R = 1 - f/n\), fração de dias dentro do objetivo, MTBF e MTTR dos episódios de dias ruins.

### Vantagem

A conversão do trimestre vira um mapa. Dá para ver a etapa, o segmento e se os dias ruins são frequentes ou longos, sem publicar quem é a conta.

---

## Descriptografia HTTPS (`http.descriptografia`)

Serve para a etapa que abre o dado. O pedido pode chegar assim:

```text
front → API → [descriptografia] → banco, modelo, gravação, interface
```

A linha do arquivo é a operação entre colchetes. Pedir a chave por HTTPS e abrir o envelope no processo contam como essa operação. O restante da requisição da API não entra.

### O que inserir

Caminho: `data/http/descriptografia.csv` (ou JSONL). Uma linha por operação. Horizonte útil: cerca de quinze dias.

| Coluna | Tipo | Obrigatória | O que colocar |
| --- | --- | --- | --- |
| `timestamp` | ISO-8601 | sim | Fim da operação |
| `rota` | string | sim | Rota agregada, sem identificador no caminho |
| `status` | enum | sim | `ok`, `fail`, `key_mismatch` ou `timeout` |
| `duracao_ms` | number | sim | Duração da operação |
| `chave_id` | string | sim | Id lógico da chave. Sem material secreto |
| `request_id` | string | sim | Correlação. Sem corpo e sem cabeçalho |

Janela: **5 a 15 minutos**. Só entra janela com volume mínimo (partida: 100 operações). Unidade: **dia de serviço**. Dia sem operação fica de fora. Dia observado até o fim sem janela ruim censura em 1440 minutos.

### Quando a unidade estoura

A janela sai do objetivo se a taxa de `fail`, `key_mismatch` ou `timeout` passa do limite, ou se a duração fica lenta demais para a própria etapa.

Ponto de partida, declarado antes da coleta: \(R^{*}_{\mathrm{erro}} = 99\%\) e, no modo lentidão, \(R^{*}_{\mathrm{lat}} = 95\%\) abaixo de \(\tau = 200\,\mathrm{ms}\). Se a história ainda é curta, o limite pode ser um percentil móvel da própria série, em vez do corte fixo. Conta o excesso sobre a taxa típica da rota quando parte dos códigos é uso normal.

### O que acompanhar

- A hora da primeira janela ruim do dia, e a causa (`erro`, `chave`, `timeout` ou `lentidao`).
- A fração de janelas de 5–15 min dentro do objetivo.
- MTBF e MTTR dos episódios de janelas ruins seguidas.
- Dias cinza, que passaram sem estouro, e dias em branco, que não tiveram operação.

### Vantagem

A média de erros do mês esconde um episódio curto no meio de um dia bom. Aqui o dia fica marcado no primeiro estouro, a volta ao objetivo tem duração, e a abertura do dado não se mistura com o tempo do modelo nem com a tela.

---

## O que os dois mostram no Grafana

| Painel | Leitura |
| --- | --- |
| **A — quadro** | Cada unidade: ok, falhou em \(t\), fim sem estouro. A série da janela ao lado do limite |
| **B — curva** | Weibull (\(\beta\), \(\eta\)), Kaplan–Meier, \(P(S>L)\). O ajuste já veio pronto no `relatorio.json` |

Quando o modelo existe, o painel também mostra a chance de a unidade ainda não ter estourado até o instante \(t\): \(R(t)=\exp[-(t/\eta)^{\beta}]\).

---

## Registro que o adaptador entrega

```text
UnitRecord = {
  unit_id,     // funil: 2026-08-06×segmento | descriptografia: 2026-08-06
  t_min,       // minuto do primeiro estouro, ou do fim observado
  censored,    // true no fim sem estouro
  cause?,      // funil: drop_etapa | roi_baixo
               // descriptografia: erro | key_mismatch | timeout | lentidao
  windows[],
  meta         // { dominio: "funil.vendas" | "http.descriptografia" }
}
```

```json
{
  "dominio": "funil.vendas | http.descriptografia",
  "failure_spec": {
    "window": "1d | 5m | 15m",
    "predicate": "drop > threshold OR roi < threshold OR error_rate > threshold OR latency > tau",
    "threshold_mode": "fixed_slo | rolling_p95 | rolling_p80 | rolling_p20",
    "threshold_value": null,
    "eligibility": "min_events_per_window"
  }
}
```

O motor grava `relatorio.json` com `escolha`, `weibull`, `kaplan_meier`, `carga_resistencia`, `amostra`, `dominio`, `failure_spec` e `predicao`.

| Símbolo | Significado |
| --- | --- |
| janela | Intervalo sem sobreposição |
| dentro do objetivo | A carga da janela não cruzou o limite |
| \(t\) | Minuto do primeiro estouro, ou do fim observado |
| censura | Fim sem estouro. A unidade foi vista até o fim |
| exclusão | Sem evento. A unidade não entra na amostra |
| MTBF | Tempo médio dentro do objetivo entre episódios |
| MTTR | Duração média do episódio, até a janela voltar ao objetivo |

Ordem: critério de falha, depois amostra, depois ajuste. Para a Weibull separar forma e escala, a fração de unidades que falham fica tipicamente entre 20% e 80%. Com pouca história, o relatório registra a limitação em vez de fingir precisão.

| Adaptador | Limite de partida | Janela |
| --- | --- | --- |
| Funil — queda de etapa | P80 móvel da etapa | 1 dia |
| Funil — retorno | P20 móvel do retorno, ou o objetivo declarado | 1 dia |
| Descriptografia — erro | \(R^{*}_{\mathrm{erro}} = 99\%\) | 5 a 15 min, com volume mínimo |
| Descriptografia — lentidão | \(R^{*}_{\mathrm{lat}} = 95\%\) abaixo de 200 ms, ou percentil móvel da etapa | 5 a 15 min, com volume mínimo |

---

## Como ligar

1. Escolher `funil.vendas` ou `http.descriptografia`.
2. Anexar o arquivo no caminho daquele adaptador.
3. Declarar o `FailureSpec`.
4. Rodar o adaptador e o motor.
5. Abrir os painéis A e B.

Um arquivo de demonstração, se existir, fica marcado como fictício e separado do arquivo real.

## Roadmap

| Etapa | Entrega |
| --- | --- |
| **A** | Quadro de unidades: ok, falhou em \(t\), fim sem estouro |
| **A′** | Os dois adaptadores, com este contrato e sem dado inventado no lugar do arquivo real |
| **B** | Painel da curva a partir do `relatorio.json` |
| **Preditivo** | \(R(t)\) calculado fora do navegador |

Ficam fora: nome de cliente no arquivo, inventar o CSV, e misturar o resto da API na etapa de descriptografia.

Referências: [proposta](./proposta.md), [caixa fechada](./caixa-fechada-tp.md), [README](../README.md).
