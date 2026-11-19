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

A coleta prevista é de cerca de quinze dias, com tráfego real, condicionada à autorização de cada fonte. Entram código de estado, rota agregada, duração e, quando existirem, medidas de máquina. Identidade e conteúdo clínico ficam de fora. Os exemplos com que o grupo trabalha são duas aplicações clínicas (uma em operação, uma em teste). Se a autorização de uma fonte não se confirmar, outro servidor instrumentado ocupa o lugar.

## O que a caixa fechada desenvolve

Um único motor calcula três indicadores. Do lado de fora só mudam a fonte e o critério de falha. Do lado de dentro a matemática permanece.

| Indicador | Papel na caixa |
| --- | --- |
| **① Taxa × janela** | A taxa da janela contra o limiar do cenário |
| **② Weibull com censura** | Tempo até a primeira janela ruim; dia observado até o fim sem estouro entra como censura |
| **③ \(P(S>L)\)** | Carga observada contra a resistência (SLO, percentil ou intervalo) |

Dois plug-ins de cenário usam o mesmo contrato:

- **Shark** (`shark.funnel_3m`) — funil de três meses. A fonte é o CSV real do funil. Dia sem dado sai da amostra.
- **Sabia** (`sabia.decrypt`) — somente a etapa de desembrulho / descriptografia. A fonte é a telemetria dessa etapa. A latência dessa camada entra como atraso relativo à própria série (\(d / P50\) móvel). O corte \(\tau = 200\,\mathrm{ms}\) continua sendo o modo lentidão da proposta, no serviço instrumentado.

Trocar de cenário é trocar adaptador, fonte e `FailureSpec`. O motor e os painéis ficam.

## Documentos

- [docs/grupo_1_proposal.pdf](docs/grupo_1_proposal.pdf) — proposta do grupo, descrição do TP.
- [docs/proposta.md](docs/proposta.md) — a mesma descrição em Markdown.
- [docs/caixa-fechada-tp.md](docs/caixa-fechada-tp.md) — motor, portas e os dois plug-ins.
- [docs/plugin-preditivo-confiabilidade.md](docs/plugin-preditivo-confiabilidade.md) — contrato de entrada, saída e Grafana.
- [docs/proposal/](docs/proposal/) — fonte LaTeX da proposta.
- [docs/OrientacoesTrabalhoPratico.pdf](docs/OrientacoesTrabalhoPratico.pdf) — orientações da disciplina (proposta até 06/11/2026, documento final até 25/11/2026, apresentações em 25/11 e 30/11).

## Licença

O código e os textos escritos neste repositório estão sob a licença MIT. Veja [LICENSE](LICENSE).

A proposta do grupo e o PDF de orientações são material da disciplina e permanecem com os autores desses documentos. Estar nesta pasta não os torna obra licenciada em MIT.
