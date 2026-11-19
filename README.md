# Confiabilidade de sistemas de software distribuídos a partir de sinais OpenTelemetry

Trabalho prático da disciplina **EEE 017 — Confiabilidade de Sistemas** (Engenharia de Sistemas, UFMG), 2026.

Felippe Veloso Marinho, Josoe Santos Queiroz, Maria Eduarda Sampaio, Matheus Amorim Soares Salles e Raphael Lucas Silva Amaral.

O estudo mede a confiabilidade de um sistema web distribuído pelo que o usuário percebe: a requisição sai do front-end, atravessa uma ou mais APIs e chega ao banco. Os sinais seguem o OpenTelemetry. O grupo entrega um plugin do Grafana que calcula os índices da proposta, e um motor genérico que aceita mais de um cenário pela mesma porta.

Duas referências organizam este repositório:

1. **A descrição do TP** — [docs/grupo_1_proposal.pdf](docs/grupo_1_proposal.pdf). O texto legível, com a mesma estrutura, está em [docs/proposta.md](docs/proposta.md). A fonte LaTeX fica em [docs/proposal/](docs/proposal/).
2. **A caixa fechada** — o que estamos desenvolvendo para calcular esses índices. Visão em [docs/caixa-fechada-tp.md](docs/caixa-fechada-tp.md); contrato dos plug-ins em [docs/plugin-preditivo-confiabilidade.md](docs/plugin-preditivo-confiabilidade.md).

## O que a proposta fixa

O objeto é um sistema web genérico. A falha é a do serviço, vista pelo usuário. Há dois modos: erro (5xx, ou o código com que a fonte sinaliza a falha percebida, contando só o excesso sobre a taxa típica da rota) e lentidão (duração acima de \(\tau = 200\,\mathrm{ms}\)). O tempo entra em janelas de \(\Delta = 5\,\mathrm{min}\), com pelo menos 100 requisições. Os SLOs são declarados antes da coleta: \(R^{*}_{\mathrm{erro}} = 99\%\) e \(R^{*}_{\mathrm{lat}} = 95\%\).

| Índice | O que mede |
| --- | --- |
| **I1** | Confiabilidade por requisição, modelo de Nelson: \(R = 1 - f/n\), nos dois modos e nos dois juntos |
| **I2** | Disponibilidade em relação ao SLO: fração de janelas dentro do objetivo |
| **I3** | MTBF e MTTR a partir de episódios de janelas consecutivas em falha |

A coleta prevista é de cerca de quinze dias, com tráfego real, condicionada à autorização de cada fonte. Entram código de estado, rota agregada, duração e, quando existirem, medidas de máquina. Identidade e conteúdo ficam de fora. Se a autorização de uma fonte não se confirmar, outro servidor instrumentado ocupa o lugar.

## O plugin

O plugin é genérico. A caixa calcula os mesmos índices para qualquer arquivo que um adaptador saiba ler. Neste ciclo há dois adaptadores. Nenhum deles pede nome de pessoa, de conta ou de cliente: o recorte entra como código opaco.

| Adaptador | Você insere | Você acompanha |
| --- | --- | --- |
| **Funil de vendas** | Uma linha por etapa da jornada: instante, segmento opaco, etapa (`impressao`, `visita`, `carrinho`, `checkout`, `compra`) e, se quiser retorno, custo e receita | Qual etapa esvazia, se o dia daquele segmento ficou dentro do objetivo, e se o problema é queda de jornada ou retorno |
| **Requisição HTTPS** | Uma linha por requisição: instante, rota agregada, código HTTP, duração e um id de correlação | \(R_{\mathrm{erro}}\) e \(R_{\mathrm{lat}}\), janelas de 5 min dentro do SLO, e se a indisponibilidade vem de falhar sempre ou de demorar a voltar |

Os dois mostram, no mesmo Grafana, a confiabilidade por evento, a fração de janelas dentro do objetivo, o MTBF, o MTTR e o estado de cada unidade (ok, falhou no instante \(t\), ou observada até o fim sem estouro). A vantagem é trocar de cenário sem trocar de painel, e ler a falha como quem usa o serviço a lê, com objetivo declarado antes da coleta.

O que colocar em cada coluna, o critério de cada adaptador e o que fica de fora estão em [docs/plugin-preditivo-confiabilidade.md](docs/plugin-preditivo-confiabilidade.md). O desenho da caixa está em [docs/caixa-fechada-tp.md](docs/caixa-fechada-tp.md).

## Documentos

- [docs/grupo_1_proposal.pdf](docs/grupo_1_proposal.pdf) — proposta do grupo, descrição do TP.
- [docs/proposta.md](docs/proposta.md) — a mesma descrição em Markdown.
- [docs/caixa-fechada-tp.md](docs/caixa-fechada-tp.md) — motor, portas e os dois adaptadores.
- [docs/plugin-preditivo-confiabilidade.md](docs/plugin-preditivo-confiabilidade.md) — o que inserir, o que acompanhar e a vantagem de cada adaptador.
- [docs/proposal/](docs/proposal/) — fonte LaTeX da proposta.
- [docs/OrientacoesTrabalhoPratico.pdf](docs/OrientacoesTrabalhoPratico.pdf) — orientações da disciplina (proposta até 06/11/2026, documento final até 25/11/2026, apresentações em 25/11 e 30/11).

## Licença

O código e os textos escritos neste repositório estão sob a licença MIT. Veja [LICENSE](LICENSE).

A proposta do grupo e o PDF de orientações são material da disciplina e permanecem com os autores desses documentos. Estar nesta pasta não os torna obra licenciada em MIT.
