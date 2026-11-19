# Confiabilidade de sistemas de software distribuídos a partir de sinais OpenTelemetry

Trabalho prático da disciplina **EEE 017 — Confiabilidade de Sistemas** (Engenharia de Sistemas, UFMG), 2026.

Felippe Veloso Marinho, Josoe Santos Queiroz, Maria Eduarda Sampaio, Matheus Amorim Soares Salles e Raphael Lucas Silva Amaral.

## A ideia

O plugin é um motor só de confiabilidade, com painel no Grafana. Ele não é universal no sentido de engolir qualquer arquivo cru. Cada tipo de dado precisa de um **adaptador**: uma peça que traduz as linhas daquele arquivo para o mesmo registro interno. A matemática, os painéis e as perguntas ficam iguais. Mudam a fonte e o que conta como falha.

Neste ciclo a ideia é explorada com dois adaptadores:

| Adaptador | Identificador | O arquivo |
| --- | --- | --- |
| Funil de vendas | `funil.vendas` | Cerca de três meses de etapas da jornada |
| Requisição HTTPS de descriptografia | `http.descriptografia` | Só a operação que abre o dado, não o resto do serviço |

Nenhum dos dois pede nome de pessoa, de conta, de cliente ou de produto. O recorte entra como código opaco.

A descrição acadêmica está em [docs/proposta.md](docs/proposta.md). O desenho da caixa está em [docs/caixa-fechada-tp.md](docs/caixa-fechada-tp.md). Colunas, critérios e o que o painel devolve estão em [docs/plugin-preditivo-confiabilidade.md](docs/plugin-preditivo-confiabilidade.md).

## Como o modelo funciona

Cada linha do arquivo vira um evento. O adaptador junta os eventos em **janelas** (intervalos sem sobreposição) e em **unidades** (a coisa que sobrevive ou falha).

No funil, a janela é um dia e a unidade é um dia de um segmento. Na descriptografia, a janela é de 5 a 15 minutos e a unidade é um dia de serviço.

Uma janela só entra na conta se tiver volume mínimo. No HTTPS, o ponto de partida é 100 requisições em 5 minutos: uma falha isolada não derruba o índice. Um dia sem tráfego sai da amostra. Ele não vira sucesso e não vira falha.

Para cada janela elegível o motor compara a carga com um objetivo declarado antes de olhar a série. Exemplos de carga: queda de uma etapa, retorno do dia, fração de descriptografias com erro, fração lenta. A janela está **dentro do objetivo** quando a carga não cruza esse limite.

A **fração de janelas dentro do objetivo** é a disponibilidade. Se o dia teve 20 janelas com tráfego e 18 ficaram abaixo do limite, a disponibilidade daquele dia é 18/20 = 90%. O número responde: quanto do tempo observado o serviço (ou o funil) cumpriu o que foi combinado.

A **unidade** resume o dia inteiro em um de três estados:

- **Ok.** Nenhuma janela elegível cruzou o limite.
- **Falhou em \(t\).** A primeira janela ruim terminou no minuto \(t\), contado desde o começo do dia. As janelas ruins seguintes não mudam esse \(t\): a vida da unidade acaba no primeiro estouro.
- **Fim sem estouro (censura).** A unidade foi observada até o fim e o limite não foi cruzado. Isso é informação: “até aqui, não falhou”. Tratar esse dia como falha à meia-noite encurtaria a vida de mentira. Censura não é dia vazio. Dia vazio é excluído.

Com muitos dias assim, o motor ajusta uma Weibull: a curva de quanto tempo uma unidade tende a aguentar até o primeiro estouro. Dias censurados entram na conta como “a falha, se vier, vem depois”. Em seguida estima \(P(S>L)\): a chance de a tolerância (o objetivo, ou a faixa histórica) ainda cobrir a carga observada.

## O que isso vê além de uma média de falhas

Uma média do mês — “0,4% das descriptografias falharam” — mistura três coisas diferentes.

Um exemplo didático, com números inventados. O objetivo é: janela de 5 minutos com taxa de erro acima de 1% está ruim. Num dia há 200 janelas com tráfego.

- 197 janelas têm erro perto de zero.
- Três janelas seguidas, por volta das 14h, passam de 1%. Depois o serviço volta.

A média do dia pode continuar baixa, porque três janelas ruins se diluem em duzentas. O modelo marca outra coisa: a unidade **falhou em \(t = 14\,\mathrm{h}\)**, houve **um episódio** de 15 minutos, e o resto do dia não apaga esse fato.

Dois nomes medem o episódio, não a média:

- **MTBF** (*mean time between failures*) é o tempo médio dentro do objetivo entre um episódio e o próximo. MTBF curto: o limite é cruzado o tempo todo.
- **MTTR** (*mean time to recovery*) é a duração média do episódio, o tempo até a janela voltar para dentro do objetivo. MTTR longo: quando quebra, demora a voltar.

Os dois se completam. Perder disponibilidade porque falha toda hora é diferente de perder porque uma pane dura a tarde. A média de falhas não separa esses casos. Também não diz se a lentidão piorou em relação à própria série, mesmo com status de sucesso, nem guarda os dias que passaram inteiros sem estouro.

## Funil de vendas — como apresentar os três meses

O arquivo cobre cerca de três meses. Cada linha é um passo: instante, segmento opaco, etapa (`impressao`, `visita`, `carrinho`, `checkout`, `compra`) e, se o retorno interessar, custo e receita.

A apresentação que cabe no painel é um quadro:

- Cada **linha** é um segmento (o código opaco, nunca o nome).
- Cada **coluna** é um dia, ao longo dos cerca de noventa dias.
- A **cor** é o estado da unidade: ok, falhou em \(t\), fim sem estouro, ou em branco se aquele dia não teve evento.
- Ao abrir um dia vermelho, aparece a etapa que esvaziou e se o estouro foi de jornada ou de retorno.

O que se observa: em que etapa as pessoas saem, se o problema mora num segmento, se os dias ruins vêm em sequência (MTTR) ou espalhados (MTBF baixo), e quantos dias atravessam o trimestre sem cruzar o limite. A vantagem é sair de uma taxa única de conversão do trimestre e ver o dia e a etapa em que o funil deixou o objetivo.

## Requisição HTTPS de descriptografia — o que entra na conta

Num serviço web o pedido chega pelo front, passa pela API e, quando o dado está fechado, uma etapa abre esse dado. Só essa etapa alimenta o adaptador `http.descriptografia`.

A arquitetura medida é esta:

```text
front  →  API  →  [descriptografia]  →  banco, modelo, gravação, interface
                         │
                         └── uma linha por operação
```

A operação pode pedir a chave a um serviço externo, por HTTPS, e em seguida abrir o envelope no próprio processo. As duas coisas pertencem à mesma etapa. O que vem antes (login, listagem) e o que vem depois (modelo, tela) não entra neste adaptador. Medir a requisição inteira da API misturaria esses tempos e esses erros com a abertura do dado.

Cada linha do arquivo é uma operação: instante, rota agregada, status (`ok`, `fail`, `key_mismatch`, `timeout`), duração, identificador lógico da chave (sem material secreto) e um `request_id`. A coleta útil do serviço é de cerca de quinze dias.

O que se observa: a que horas a etapa sai do objetivo, se a causa é erro, chave errada, estouro de tempo ou lentidão relativa à própria série, quanto tempo ela leva para voltar, e quais dias passam em branco de falha (censura) ou sem tráfego (fora da amostra). A vantagem é a mesma do funil, noutro objeto: a confiabilidade da abertura do dado, vista em janela, e não uma média solta de erros no log.

## Documentos

- [docs/proposta.md](docs/proposta.md) — descrição do trabalho, sem identificar fonte.
- [docs/grupo_1_proposal.pdf](docs/grupo_1_proposal.pdf) — texto entregue na disciplina.
- [docs/caixa-fechada-tp.md](docs/caixa-fechada-tp.md) — motor, portas e os dois adaptadores.
- [docs/plugin-preditivo-confiabilidade.md](docs/plugin-preditivo-confiabilidade.md) — colunas, critérios e leituras do painel.
- [docs/proposal/](docs/proposal/) — fonte LaTeX.
- [docs/OrientacoesTrabalhoPratico.pdf](docs/OrientacoesTrabalhoPratico.pdf) — orientações da disciplina.

## Licença

O código e os textos escritos neste repositório estão sob a licença MIT. Veja [LICENSE](LICENSE).

A proposta do grupo e o PDF de orientações são material da disciplina e permanecem com os autores desses documentos.
