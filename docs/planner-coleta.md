# Planner de coleta — funil e descriptografia

A apresentação é na terça ou na quarta. O funil já tem arquivo. A descriptografia ainda não tem o evento que o adaptador lê. Os dois caminhos são diferentes.

## Funil de vendas — já dá para analisar

O arquivo diário cobre **01/08/2026 a 31/10/2026**: 92 dias, mais uma linha de total que não entra. Doze dias têm clique e visita zerados. Esses doze saem da amostra. Não são censura e não são falha.

Cada linha já é a janela de um dia. Não há evento dentro do dia para reagrupar.

| Coluna do arquivo | Uso no adaptador `funil.vendas` |
| --- | --- |
| Data | dia da unidade |
| Cliques no link | etapa `impressao` / topo |
| Visualizações da página de destino | etapa `visita` |
| Checkouts iniciados | etapa `checkout` |
| Compras | etapa `compra` |
| Investimento e valor de conversão | custo e receita, para o retorno |
| ROAS e taxa de conversão | conferência; o adaptador pode recalcular |

Unidade: o dia. Há um segmento só, opaco. O quadro da apresentação é uma linha de ~80 dias úteis (92 menos os 12 vazios), cada dia ok, falhou em \(t\) ou fim sem estouro.

Critério para declarar antes de olhar o gráfico de novo: queda visita→checkout, ou checkout→compra, acima do P80 móvel dos dias anteriores; ou ROAS abaixo do P20 móvel. O arquivo fica fora do Git. Entra no repositório só o relatório agregado, sem nome de conta.

## Descriptografia — o log atual não serve

A etapa que abre o dado não grava uma linha por operação. O que existe hoje no processo:

- sucesso da abertura local: silêncio;
- sucesso do pedido da chave: silêncio, e a chave fica em cache por cerca de 5 minutos, então o HTTPS externo nem acontece em toda leitura;
- aviso só quando o serviço de chave responde 5xx ou estoura o tempo, e ainda assim sem duração da operação bem-sucedida, sem `status` estável e sem `request_id`.

Baixar as últimas 100 mil linhas do Portainer não monta o CSV do adaptador `http.descriptografia`. Essas linhas misturam o resto da API. Quase nenhuma é a operação de abertura. As que são falha de chave não trazem as operações que deram certo, e sem as que deram certo não há taxa, não há P50 e não há janela. O volume de 100 mil linhas também não é “quinze dias”: depende da rotação do container e pode ser algumas horas.

O arquivo de produção pode ter identificador e conteúdo. Ele não entra no repositório do trabalho, nem inteiro nem colado no chat público.

## O que fazer até a apresentação

Registrar daqui até terça ou quarta, no formato do adaptador, uma linha por operação de abertura.

1. No processo, no ponto em que o dado fechado é aberto (pedido de chave, quando houver, e abertura do envelope), emitir um JSON por operação, sem segredo e sem identificador de pessoa:

```json
{"timestamp":"2026-11-20T14:03:11.120Z","status":"ok","duracao_ms":12.4,"chave_id":"dek:v1","request_id":"…","dominio":"http.descriptografia"}
```

`status` é `ok`, `fail`, `key_mismatch` ou `timeout`. `chave_id` é a versão lógica, não a chave.

2. Ligar isso só por variável de ambiente, com o arquivo fora da imagem e fora do Git. Subir essa versão no mesmo ambiente que atende tráfego real.
3. Deixar correr até a véspera da apresentação. Exportar o JSONL e ficar só com essas colunas.
4. Janela de 5 a 15 minutos. Dia sem nenhuma linha sai da amostra. Dia com linhas e sem janela ruim censura em 1440 minutos.

Cinco ou seis dias são poucos para a Weibull separar forma e escala. O relatório diz isso. A fração de janelas dentro do objetivo, o primeiro estouro do dia, o MTBF e o MTTR ainda saem dessa amostra curta. Inventar dias para completar quinze não entra.

Se a versão instrumentada não subir a tempo, o funil é um dos cenários com dado. O outro, para mostrar que o motor não muda, é `cage.aviacao`: mês como janela, ano como unidade, fontes públicas em `data/cage/`. A descriptografia fica como contrato. Não se preenche o gráfico dela com log bruto de outra camada.
