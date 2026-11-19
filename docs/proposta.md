# Descrição do TP — confiabilidade de sistemas distribuídos a partir de sinais OpenTelemetry

Texto de leitura da proposta do grupo 1. O documento entregue é [grupo_1_proposal.pdf](./grupo_1_proposal.pdf). A fonte LaTeX está em [proposal/](./proposal/).

**Autores:** Felippe Veloso Marinho, Josoe Santos Queiroz, Maria Eduarda Sampaio, Matheus Amorim Soares Salles, Raphael Lucas Silva Amaral. 2026.

## Resumo

O trabalho estuda a confiabilidade de sistemas de software distribuídos com sinais do padrão aberto OpenTelemetry. A iniciativa busca levar práticas de *Site Reliability Engineering* (SRE) a médias e pequenas empresas brasileiras, com menos dependência de fornecedores proprietários de monitoramento.

## 1. Introdução

Sistemas de software estão em toda parte e ficaram mais complexos e mais críticos. Separar partes de uma aplicação em servidores ligados por rede é o que chamamos de sistema distribuído: cada servidor é um componente que pode falhar ou sair do esperado.

A prática voltada à confiabilidade de sistemas web é o SRE. No Brasil ela é comum desde a metade da última década, e ainda assim chega pouco às médias e pequenas empresas: pede investimento e planejamento longos, e o fornecedor de monitoramento é uma das peças mais caras. Poucos fornecedores competitivos elevam o preço e criam *vendor lock-in*. O OpenTelemetry existe para padronizar e simplificar a coleta desses sinais em software aberto.

## 2. Descrição do sistema

A proposta mede uma requisição que parte do front-end, atravessa uma ou mais APIs e chega a consultas de banco. Vários serviços participam do mesmo fluxo. HTTP, banco, CPU e memória seguem o OpenTelemetry: um servidor instrumentado entrega esses dados no mesmo formato, qualquer que seja a finalidade.

O plugin explora essa medida com dois adaptadores, sem nome de produto nem de cliente.

- **Funil de vendas.** Cerca de três meses. Cada linha é uma etapa da jornada.
- **Requisição HTTPS de descriptografia.** Só a operação que abre o dado. Consulta de chave, modelo, gravação e interface ficam de fora. Quando o banco deixa de responder, a falha aparece no código com que o serviço encerra a chamada; parte desse código é uso normal e entra só o excesso. No modo de tempo, a resposta percebida como rápida fica abaixo de 200 ms.

Se a autorização de uma fonte não se confirmar, outro servidor instrumentado ocupa o lugar. Os dados liberados chegam mascarados: código de estado, rota agregada, duração e, quando existirem, medidas de máquina. Identidade e conteúdo ficam de fora. A coleta do serviço é de cerca de quinze dias. O funil usa os cerca de três meses que o arquivo cobrir.

## 3. Revisão de literatura

A avaliação considera a falha percebida pelo usuário, não só a falha do componente isolado. A literatura de referência combina três linhas: falha de serviço diante de falha de componente (Oppenheimer, Ganapathi e Patterson, 2003); confiabilidade por requisição \(R = 1 - f/n\) a partir de logs, com a carga no denominador (Tian, Rudraraju e Li, 2004; Nelson); e ajuste por máxima verossimilhança de distribuições aos tempos entre falhas, com Weibull e gama à frente da exponencial (Schroeder e Gibson, 2006). Do lado prático, o material de SRE do Google separa SLI e SLO e recomenda que o objetivo não seja escolhido a partir do desempenho já observado.

O que a proposta junta: índices de confiabilidade e distribuição do tempo até a falha, em sistemas web instrumentados com OpenTelemetry, com a falha definida por um SLO declarado. As referências completas estão no PDF.

## 4. Metodologia

O objeto é um sistema web genérico. A análise mede o serviço do ponto de vista do usuário e cada componente do fluxo, para indicar onde as falhas se concentram. O produto dessa análise é um plugin do Grafana.

**Coleta.** Os componentes são instrumentados com OpenTelemetry. A métrica `http.server.request.duration` registra código de resposta, rota e duração. Os spans de cliente de banco registram as consultas feitas pela API. Quando o banco não é instrumentado, a falha dele é inferida pelo sinal que aparece na API. O plugin calcula os índices por janela; um CSV com as mesmas contagens serve para conferir o plugin. A coleta usa tráfego real por cerca de 15 dias, condicionada à autorização do responsável por cada fonte. Os dados são mascarados: código de resposta, rotas sem identificadores e as métricas de interesse.

**Critério de falha.** Há dois modos.

- **Erro.** A requisição recebe 5xx, ou o código com que a fonte sinaliza falha percebida (por exemplo, 401 em massa quando a perda do banco encerra sessões). Conta só o excesso sobre a taxa típica da rota, porque parte desse código é uso normal.
- **Lentidão.** A duração passa de \(\tau = 200\,\mathrm{ms}\).

O tempo é dividido em janelas de \(\Delta = 5\,\mathrm{min}\). Só entram janelas com pelo menos 100 requisições. Os SLOs são fixados antes da coleta: \(R^{*}_{\mathrm{erro}} = 99\%\) e \(R^{*}_{\mathrm{lat}} = 95\%\).

**I1 — confiabilidade por requisição.** \(R = 1 - f/n\), com \(f\) requisições em falha e \(n\) o total. \(R\) é a probabilidade de uma requisição ser atendida corretamente. O índice sai para cada modo (\(R_{\mathrm{erro}}\) e \(R_{\mathrm{lat}}\)) e para os dois juntos, no período inteiro, por janela (\(R_j\)) e por componente (\(R_i\)). Os percentis 95 e 99 da latência complementam \(R_{\mathrm{lat}}\).

**I2 — disponibilidade em relação ao SLO.** A janela \(j\) está em falha quando \(R_{\mathrm{erro},j} < R^{*}_{\mathrm{erro}}\) ou \(R_{\mathrm{lat},j} < R^{*}_{\mathrm{lat}}\). A disponibilidade \(A\) é a fração de janelas dentro do SLO.

**I3 — MTBF e MTTR.** Uma sequência de janelas consecutivas em falha forma um episódio. O MTBF é o tempo total dentro do SLO dividido pelo número de episódios. O MTTR é a duração média dos episódios. Como \(A = \mathrm{MTBF}/(\mathrm{MTBF}+\mathrm{MTTR})\), os dois mostram se o serviço perde disponibilidade por falhar com frequência ou por demorar a se recuperar.

## 5. Resultados esperados

- Um plugin do Grafana que, a partir das métricas do OpenTelemetry, calcula \(R_{\mathrm{erro}}\) e \(R_{\mathrm{lat}}\), a disponibilidade em relação ao SLO, o MTBF e o MTTR.
- Um plugin genérico, aplicável a qualquer sistema que exporte contagens de sucesso, falha e duração.
- Os valores desses índices para o sistema estudado nos cerca de quinze dias de coleta.
- Indicadores que traduzam a métrica técnica numa leitura da experiência do usuário.

## 6. Onde isso entra na caixa fechada

O plugin genérico da proposta é o motor descrito em [caixa-fechada-tp.md](./caixa-fechada-tp.md). A caixa recebe uma fonte e um `FailureSpec` e devolve os indicadores. Os adaptadores deste ciclo são o de funil de vendas (`funil.vendas`) e o de requisição HTTPS de descriptografia (`http.descriptografia`). Os dois passam pelas mesmas portas. O que inserir, o que acompanhar e a vantagem de cada um estão em [plugin-preditivo-confiabilidade.md](./plugin-preditivo-confiabilidade.md).

## Declaração de uso de IA

Conforme a proposta: ferramenta Claude Opus 5.5 (Anthropic), usada na busca e validação de referências bibliográficas e na discussão dos índices. As referências sugeridas foram conferidas nas fontes originais. A seleção das referências e dos índices finais foi do grupo. A ferramenta não gerou o texto do trabalho.
