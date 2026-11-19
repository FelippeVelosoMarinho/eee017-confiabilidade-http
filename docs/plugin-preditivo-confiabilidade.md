# Plugin de confiabilidade — o que entra, o que você acompanha

Plugin do Grafana para o TP de EEE 017. O motor é uma caixa fechada: a matemática não muda. O que muda é o **adaptador**, isto é, a peça que lê o arquivo do seu cenário e entrega os eventos no mesmo formato.

Há dois adaptadores neste ciclo:

| Adaptador | Para quem serve | Identificador |
| --- | --- | --- |
| **Funil de vendas** | Quem acompanha uma jornada de várias etapas, do anúncio ou da visita até a compra | `funil.vendas` |
| **Requisição HTTPS** | Quem acompanha um serviço web: código de resposta, rota e duração | `http.request` |

Os dois alimentam os mesmos painéis. Trocar de adaptador é trocar o arquivo e o critério de falha. O desenho da caixa está em [`caixa-fechada-tp.md`](./caixa-fechada-tp.md). A descrição do trabalho está na [proposta do grupo](./grupo_1_proposal.pdf).

Nenhum arquivo deve trazer nome de pessoa, de conta, de cliente ou de produto. Identificadores são códigos opacos que você escolhe.

---

## Para que serve

Um percentual solto de erro não diz se o serviço está piorando, se a queda está numa etapa só, nem se o problema é falhar toda hora ou demorar para voltar. O plugin transforma o arquivo que você anexa em quatro leituras estáveis:

| Leitura | O que responde |
| --- | --- |
| **Confiabilidade por evento** \(R = 1 - f/n\) | De cada evento, qual fração foi atendida como o esperado |
| **Disponibilidade** | Qual fração das janelas ficou dentro do objetivo que você declarou |
| **MTBF e MTTR** | O serviço perde o objetivo porque falha com frequência, ou porque demora a se recuperar |
| **Tempo até a primeira janela ruim** | Em quanto tempo uma unidade (um dia, um segmento) cruza o limite, com os períodos saudáveis preservados como censura |

Em cima disso a caixa ainda ajusta uma Weibull e estima \(P(S>L)\): a chance de a tolerância (o objetivo, ou a faixa histórica) ainda cobrir a carga observada. O ajuste roda fora do navegador. O painel mostra o resultado.

**Vantagem comum aos dois adaptadores.** O mesmo painel serve para um funil e para um serviço HTTPS. Você declara o objetivo antes de olhar a série, compara janelas com volume suficiente e vê o estado de cada unidade: dentro do objetivo, falhou no instante \(t\), ou foi observada até o fim sem cruzar o limite. Um intervalo sem dado sai da amostra. Ele não vira um dia “perfeito” nem uma falha inventada no fim.

---

## Adaptador de funil de vendas

Use quando a pergunta for comercial: em que etapa as pessoas saem, e se um dia ou um segmento está pior do que o habitual daquele funil.

### O que você insere

Um CSV, uma linha por evento da jornada. Caminho previsto: `data/funil/eventos.csv`. Enquanto o arquivo real não estiver anexado, o repositório guarda só este contrato.

| Coluna | Tipo | Obrigatória | O que colocar |
| --- | --- | --- | --- |
| `timestamp` | ISO-8601 | sim | Instante do evento |
| `segmento_id` | string | sim | Código opaco do recorte (conta, praça, campanha). Sem nome |
| `etapa` | enum | sim | `impressao`, `visita`, `carrinho`, `checkout` ou `compra`. Se a sua jornada usa outros nomes, mapeie para estes cinco antes de anexar |
| `evento_id` | string | sim | Identificador único da linha |
| `sessao_id` | string | recomendado | Amarra os passos da mesma jornada. Também opaco |
| `custo` | number | só se quiser ROI | Custo atribuído ao evento |
| `receita` | number | só se quiser ROI | Receita da conversão. Zero se não houve compra |

Janela padrão: **1 dia**. Unidade que o painel acompanha: **dia × segmento**. Horizonte típico do arquivo: cerca de três meses, o que o CSV realmente cobrir. Um dia sem eventos naquele segmento fica de fora. Um dia com tráfego que não cruza o limite entra como censura.

### Critério de falha que você declara

Escolha um, ou os dois:

- **Queda de etapa.** A passagem de uma etapa para a seguinte fica pior do que o percentil móvel daquela mesma etapa (ponto de partida: P80).
- **Retorno.** Se você preencheu `custo` e `receita`, o ROI do dia fica abaixo do objetivo declarado ou do percentil móvel baixo da própria série (ponto de partida: P20).

### O que você passa a acompanhar

- A etapa em que o funil esvazia, dia a dia, por segmento.
- Se o dia daquele segmento está saudável, falhou e em que momento, ou chegou ao fim sem estouro.
- Confiabilidade da jornada, fração de dias dentro do objetivo, tempo médio entre dias ruins e duração média do episódio ruim.
- Quando houver custo e receita, a mesma leitura para o retorno, ao lado da queda de etapa.

### Vantagem

A queda deixa de ser uma impressão sobre o mês inteiro. Você vê qual etapa cedeu, se o problema se repete no mesmo segmento e se os dias bons ainda sustentam a curva. Dois segmentos entram no mesmo painel porque o identificador é um código, não um nome.

---

## Adaptador de requisição HTTPS

Use quando a pergunta for a do serviço: a requisição chegou, com que código, por qual rota e em quanto tempo. Vale para qualquer servidor que exporte essas três medidas. O banco, quando não é medido direto, aparece pelo efeito na API (códigos e duração).

### O que você insere

Um CSV ou JSONL, uma linha por requisição. Caminho previsto: `data/http/requisicoes.csv`.

| Coluna | Tipo | Obrigatória | O que colocar |
| --- | --- | --- | --- |
| `timestamp` | ISO-8601 | sim | Instante em que a requisição terminou |
| `rota` | string | sim | Rota agregada. `/pedidos/123` vira `/pedidos/{id}`. Sem identificador no caminho |
| `status` | number | sim | Código HTTP |
| `duracao_ms` | number | sim | Duração da requisição |
| `request_id` | string | sim | Correlação. Sem corpo, sem cabeçalho, sem credencial |
| `componente` | string | não | Papel no fluxo: `front`, `api` ou `banco` |

Janela padrão: **5 minutos**. Só entra janela com **pelo menos 100 requisições**, para uma falha isolada não derrubar o índice. Unidade que o painel acompanha: **dia de serviço**. Um dia sem tráfego fica de fora. Um dia observado até o fim sem janela ruim entra como censura, em 1440 minutos.

### Critério de falha que você declara antes da coleta

Dois modos, os mesmos da proposta:

- **Erro.** A requisição recebe 5xx, ou o código com que aquele serviço sinaliza falha percebida. Conta o excesso sobre a taxa típica da rota, porque parte dos 4xx é uso normal. Objetivo de partida: \(R^{*}_{\mathrm{erro}} = 99\%\).
- **Lentidão.** A duração passa de \(\tau = 200\,\mathrm{ms}\). Objetivo de partida: \(R^{*}_{\mathrm{lat}} = 95\%\).

Uma janela falha quando \(R_{\mathrm{erro}}\) ou \(R_{\mathrm{lat}}\) daquela janela fica abaixo do objetivo. Se a série ainda é curta para um objetivo fixo, o `FailureSpec` aceita percentil móvel da própria rota. O corte de 200 ms é o objetivo do serviço, declarado antes de olhar os dados. Ele não é um limite copiado de outra camada.

### O que você passa a acompanhar

- \(R_{\mathrm{erro}}\) e \(R_{\mathrm{lat}}\), no período, por janela e por componente.
- Os percentis 95 e 99 da duração, ao lado da fração de requisições lentas.
- A fração de janelas de 5 minutos dentro do objetivo.
- Episódios de janelas ruins seguidas: de quanto em quanto tempo começam (MTBF) e quanto duram (MTTR).
- O estado do dia: dentro do objetivo, primeira janela ruim no minuto \(t\), ou censurado.

### Vantagem

A leitura fica a da pessoa que usa o serviço, não a de um componente isolado. Rota agregada e código opaco permitem juntar vários serviços no mesmo plugin sem publicar quem acessou o quê. O mínimo de 100 requisições e o excesso sobre a taxa típica separam uma lentidão real de um punhado de acessos ou de um código que já é comum naquela rota.

---

## O que os dois mostram no Grafana

| Painel | Você vê | Você não precisa calcular |
| --- | --- | --- |
| **A — estado** | Série da janela, objetivo, e cada unidade como OK, falhou em \(t\) ou censurada | A comparação da taxa com o limite |
| **B — sobrevivência** | \(\beta\), \(\eta\), curva de Kaplan–Meier, \(P(S>L)\) e a tabela da amostra | O ajuste da Weibull e o Monte Carlo |

Quando o modelo já está ajustado, o painel também mostra a confiabilidade residual \(R(t)=\exp[-(t/\eta)^{\beta}]\).

---

## Contrato que o adaptador entrega à caixa

```text
ReliabilityInput = {
  fonte,            // CSV ou JSONL do adaptador escolhido
  definicao_falha,  // FailureSpec: janela, predicado, limiar, elegibilidade
  unidade_amostral, // funil: dia × segmento | https: dia de serviço
  request_evento    // funil: 1 evento de etapa | https: 1 requisição
}

UnitRecord = {
  unit_id,     // 2026-08-06×segmento | 2026-08-06
  t_min,       // tempo até a falha ou até a censura
  censored,    // true se a unidade terminou sem cruzar o limite
  cause?,      // funil: drop_etapa | roi_baixo
               // https: erro | lentidao | timeout
  windows[],
  meta         // { dominio: "funil.vendas" | "http.request" }
}
```

```json
{
  "dominio": "funil.vendas | http.request",
  "failure_spec": {
    "window": "1d | 5m",
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
| \(L\) | Carga observada na janela (queda, \(1/\mathrm{ROI}\), taxa de erro ou duração) |
| \(S\) | Resistência: objetivo declarado, percentil ou intervalo |
| \(t\) | Tempo até a primeira janela ruim, ou até o fim observado |
| censura | A unidade foi observada até o fim e não cruzou o limite |

Ordem do estudo: primeiro o critério de falha, depois a amostra, depois o ajuste. Para a Weibull separar forma e escala, a fração de unidades que falham fica tipicamente entre 20% e 80%. Com pouca história, o relatório registra a limitação.

| Adaptador | Limiar de partida | Janela |
| --- | --- | --- |
| Funil — queda de etapa | P80 móvel daquela etapa | 1 dia |
| Funil — retorno | P20 móvel do ROI, ou o objetivo declarado | 1 dia |
| HTTPS — erro | \(R^{*}_{\mathrm{erro}} = 99\%\), excesso sobre a taxa típica da rota | 5 min, com pelo menos 100 requisições |
| HTTPS — lentidão | \(R^{*}_{\mathrm{lat}} = 95\%\) abaixo de \(\tau = 200\,\mathrm{ms}\) | 5 min, com pelo menos 100 requisições |

---

## Como ligar

1. Escolha o adaptador: `funil.vendas` ou `http.request`.
2. Anexe o arquivo no caminho daquele adaptador, só com as colunas da tabela.
3. Declare o `FailureSpec` (janela, predicado, modo do limiar, mínimo de eventos).
4. Rode o adaptador. Ele emite `UnitRecord[]`.
5. Rode o motor. Ele emite `relatorio.json`.
6. Abra os painéis A e B.

Um arquivo de demonstração, se existir, fica marcado como fictício e separado do CSV real.

---

## Roadmap

| Etapa | Entrega |
| --- | --- |
| **A** | Painel de estado: OK, falhou em \(t\), censurado, com o `FailureSpec` no JSON |
| **A′** | Os dois adaptadores, com schema e sem dados inventados no lugar do arquivo real |
| **B** | Painel que lê `relatorio.json`: \(\beta\), \(\eta\), Kaplan–Meier, \(P(S>L)\) |
| **Preditivo** | O job em Python publica \(R(t)\); o painel só avalia a função |

Ficam fora deste ciclo: inventar o CSV, colocar nome de cliente no arquivo, e calcular a Weibull dentro do navegador.

Referências: [proposta do grupo](./grupo_1_proposal.pdf), [descrição em Markdown](./proposta.md), [caixa fechada](./caixa-fechada-tp.md), [README](../README.md).
