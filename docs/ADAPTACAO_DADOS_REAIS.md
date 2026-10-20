# Adaptação para telemetria real

Este texto prepara a passagem do log histórico da NASA para medições de um serviço em operação. Ele não substitui o relatório do trabalho prático. Serve para revisar a matéria em cima do que o experimento já calculou e do que a próxima coleta precisa mudar.

As orientações da disciplina estão em [OrientacoesTrabalhoPratico.pdf](OrientacoesTrabalhoPratico.pdf). O experimento atual está descrito no [PLANNER.md](../PLANNER.md).

## O que já está medido

A fonte de hoje é um arquivo. Cada linha é uma requisição de agosto de 1995, com horário e código HTTP. Não há duração da resposta, não há identificador de transação e não há vários serviços na mesma chamada.

Por isso o estudo inteiro cabe em um sinal: o **log**. A proporção de 404 em 30 minutos é contada em Python e repetida no Grafana com LogQL. A Weibull (\(\beta = 0{,}69\), \(\eta = 652\) minutos) e o índice \(P(S > L) = 0{,}945\) saem dessa contagem, com 23 falhas e 7 censuras em 30 dias.

## O que a telemetria real acrescenta

Num serviço em operação a medição deixa de ser um arquivo único. Três sinais respondem perguntas diferentes, e os três entram no OpenTelemetry:

| Sinal | Pergunta | Onde mora na stack |
|---|---|---|
| Log | Por que aconteceu | Loki |
| Métrica | Quantas vezes aconteceu | Prometheus, ou Mimir na stack LGTM |
| Trace | Onde aconteceu e quanto tempo levou | Tempo |

O quarto nome que aparece na instrumentação, o *baggage*, não é um sinal. Ele só carrega contexto de um serviço para o outro.

O log continua necessário, e deixa de ser a fonte da taxa. Com muitos serviços registrando a mesma transação, o volume explica mal “quantas falhas houve”. Essa conta passa a ser uma **métrica**: um contador incrementado no código, ou gerado pela instrumentação automática, com um rótulo de rota e de código HTTP. Vários processos podem incrementar o mesmo contador ao mesmo tempo. O coletor soma.

O **trace** entra quando a chamada atravessa mais de um serviço. Ele é uma pilha de *spans*. Cada span é um trecho com início, fim e duração. Um trace de sucesso pode não ter log de erro nenhum. O elo entre os dois, quando o erro existe, é o `trace_id`. A duração do span é o dado que o log da NASA não tem. Uma referência prática de resposta percebida como rápida é ficar abaixo de 200 ms. Esse número não sai do arquivo de 1995. Ele só passa a ser critério quando houver span.

Dois usos da telemetria real mudam o critério de falha, sem abandonar o que já foi feito:

1. **Comparar a taxa de hoje com a série anterior.** A proporção de um código de erro (no experimento, 404; num serviço autenticado, o análogo discutido foi 401) deixa de ser julgada só por um percentil fixo. Os dias anteriores formam um intervalo de confiança. Uma retenção de poucos dias não fecha esse intervalo. A ordem de grandeza combinada para a série de referência é cerca de 30 dias, a mesma ordem do mês da NASA.
2. **Marcar o que mudou o comportamento da requisição.** Um evento no span, por exemplo uma *feature flag*, permite separar as chamadas que passaram pela mudança das que não passaram, e ver se o erro ou a lentidão acompanham essa marca.

O Grafana continua sendo o lugar em que a série aparece. Ele não ajusta Weibull, não calcula censura e não desenha o ajuste de um modelo em cima da série. Essa conta permanece no `analyze.py`. Um painel em JavaScript que fizesse o ajuste dentro do Grafana é uma possibilidade posterior, não o próximo passo.

O custo da telemetria real está em enviar, guardar e processar os sinais. Para o volume de um único serviço pequeno, o mesmo Compose, com mais um coletor e um Prometheus, resolve. O log deixa de ser o sinal principal quando o volume faz a contagem por linha ficar cara. Aí a métrica carrega a taxa, e o log fica restrito ao caso em que é preciso explicar uma falha já vista na métrica ou no trace.

Dados de produção não vão para ferramenta externa sem anonimização. Status, rota agregada, duração e identificadores opacos bastam para os índices abaixo. Corpo de requisição, nome de utilizador e conteúdo de banco ficam de fora.

## Alterações previstas no experimento

A ordem abaixo evita instrumentar trace antes de existir um serviço real que emita span.

1. **Critério de falha em dois níveis.** Manter a janela de 30 minutos e a proporção de erro. Acrescentar, quando houver span, a falha por duração: a janela falha se a proporção de erro passar de \(u_0\) ou se a latência combinada da janela passar do limite declarado. Enquanto não houver duração, o segundo braço fica desligado e o texto diz isso.
2. **Métrica nativa, além do LogQL.** Um contador `http_requests_total` com rótulo de código HTTP. A proporção da janela passa a ser razão de incrementos, não contagem de linhas. O LogQL do painel atual permanece como conferência enquanto os dois existirem lado a lado.
3. **Intervalo de confiança da taxa.** Com a série diária já produzida em `output/janelas.csv`, calcular o intervalo da proporção de 404 e o intervalo de \(\beta\) e de \(\eta\). Na telemetria contínua, a referência do intervalo são os dias anteriores, e o dia corrente é o ponto comparado com ela. Trinta dias é a meta de histórico. Menos do que isso fica registado como limitação, no mesmo espírito da censura: a informação que não chegou não vira falsa precisão.
4. **Carga e resistência com resistência observável.** Hoje \(S\) é uma normal hipotética em torno de 1,77%. Com histórico, \(S\) pode ser o limite superior do intervalo de confiança dos dias anteriores, ou o SLO declarado, com a incerteza desse limite como dispersão de \(S\). \(L\) continua sendo a taxa observada na janela. O índice segue \(R = P(S > L)\). Se no futuro existir latência, \(L\) e \(S\) passam a ser durações, e o par de proporções permanece como segundo índice.
5. **Trace só com serviço instrumentado.** Collector OpenTelemetry e Tempo entram no Compose quando houver aplicação emitindo span. A pergunta do trace é onde o tempo foi gasto e se um evento de mudança (flag) acompanha o erro. O `trace_id` liga o span ao log dessa chamada.
6. **O que não muda.** Unidade amostral diária, janela de 30 minutos, censura à direita quando a coleta acaba antes do limiar, Weibull por máxima verossimilhança, Kaplan–Meier como curva sem família assumida, e a separação entre o relógio do dado e o relógio do painel.

## Tópicos para revisão

A ementa não está nas orientações do trabalho prático. A lista abaixo é o que este estudo precisa sustentar na arguição. Cada item diz onde ele já aparece e o que a telemetria real pede a mais.

### Função de confiabilidade \(R(t)\)

Probabilidade de o dia ainda não ter cruzado o limiar até \(t\). No ajuste atual,

\[
R(t)=\exp\left[-\left(\frac{t}{652}\right)^{0{,}69}\right].
\]

Rever a leitura de \(R(\eta)=e^{-1}\approx 0{,}37\): perto de 10 h 52 min, cerca de 63% dos dias já falharam. Na telemetria contínua, \(t\) continua sendo tempo desde o início do dia, ou desde o início da coleta, e isso tem de ser dito antes do ajuste.

### Taxa de risco \(h(t)\) e o parâmetro \(\beta\)

\[
h(t)=\frac{\beta}{\eta}\left(\frac{t}{\eta}\right)^{\beta-1}.
\]

\(\beta < 1\) é risco decrescente. Foi o caso do mês da NASA: os picos de 404 concentram-se na madrugada. \(\beta = 1\) é risco constante. \(\beta > 1\) é risco crescente. Na série real, a mesma leitura muda de sentido se o limiar passar a incluir latência: um \(\beta > 1\) pode indicar degradação ao longo do dia, não um defeito de página inexistente.

### Exponencial como caso particular

Weibull com \(\beta = 1\) é a exponencial, e a taxa de risco vira \(1/\eta\). Vale reestimar o modelo exponencial nos mesmos 30 dias e comparar a verossimilhança com a da Weibull. Se a exponencial ficar pior, o \(\beta = 0{,}69\) não é um enfeite. Esse confronto ainda não está no `analyze.py` e é exercício direto de revisão.

### Weibull de dois parâmetros e máxima verossimilhança

\(\beta\) é forma e \(\eta\) é escala, ambos em minutos para \(\eta\). A verossimilhança multiplica, para cada dia, \(f(t)\) se houve falha e \(R(t)\) se houve censura. Maximizar esse produto é o que o script faz, pelo negativo do logaritmo. Revisar por que tratar os 7 dias censurados como falha em 1.440 minutos encurtaria \(\eta\).

O tempo médio da distribuição ajustada é

\[
\mathrm{MTTF}=\eta\,\Gamma\left(1+\frac{1}{\beta}\right)\approx 834 \text{ minutos}.
\]

Ele não é a média dos 23 tempos de falha. A média da Weibull inclui a cauda dos dias que duram além da observação. Recalcular esse valor à mão confirma o ajuste.

Se a disciplina apresentou Weibull com terceiro parâmetro de localização, o experimento atual não o estima. Dizer isso na arguição evita misturar os dois modelos.

### Censura à direita

Os dias 9, 12, 13, 14, 16, 18 e 23 de agosto terminam sem janela acima de 1,77%. O registro é \(T > t_{\text{fim}}\), não uma falha às 24 h. O dia 2 não entra na amostra: não houve observação, e ausência de log por desligamento do servidor não é o mesmo que censura de um dia monitorado. Na coleta contínua, um dia em que o coletor cai no meio da tarde é censura no instante da queda, desde que isso fique registado. Preencher o resto do dia com “zero erros” fabricaria confiabilidade.

### Kaplan–Meier

Curva empírica de sobrevivência que não assume Weibull. Está em `output/relatorio.json`. Revisar o passo do estimador: a cada tempo de falha, a sobrevivência cai na razão entre falhas e dias ainda em risco. Dia censurado sai do grupo em risco sem contar como falha. Serve para ver se a curva ajustada acompanha a empírica. Um afastamento grande é motivo para desconfiar da Weibull antes de interpretar \(\beta\).

### Intervalo de confiança

Este é o tópico que o experimento ainda não entrega e que a telemetria real exige. Revisar o intervalo de uma proporção e o intervalo dos parâmetros da Weibull sob censura. No mês da NASA, o alvo imediato é o intervalo de \(\beta\), de \(\eta\) e da proporção de 404 na janela. Na operação, o alvo passa a ser o intervalo construído com os dias anteriores, contra o qual a janela corrente é comparada. Sem esse intervalo, “1,77%” é um percentil descritivo, não uma faixa de incerteza.

### Carga–resistência

\(R = P(S > L)\). Hoje \(L\) é a proporção de 404 da janela (mediana 0,52%) e \(S\) é hipótese: normal com média 1,77% e desvio 0,20 ponto percentual. O Monte Carlo deu 0,945. Se \(S\) fica cravado em 1,77%, o índice cai para 0,950, que repete o percentil 95 por construção. Revisar essa diferença para não apresentar 0,950 como medição de capacidade do servidor. Na adaptação, \(S\) precisa ganhar uma origem nos dados ou no SLO, e o texto tem de continuar dizendo qual das duas foi usada.

### Confiabilidade e disponibilidade

A confiabilidade aqui é a permanência do dia abaixo do limiar. Disponibilidade seria a fração de tempo em que o serviço responde. O vão do furacão Erin é indisponibilidade, e ficou fora da amostra de propósito. Com trace e métrica de saúde, os dois índices podem coexistir. Eles não são o mesmo número. Acurácia de um classificador, se algum modelo entrar depois, também não é índice de confiabilidade. As orientações do trabalho prático fazem essa ressalva.

### Critério de falha antes do modelo

O limiar e a janela foram escolhidos para a taxa de dias em falha ficar entre 20% e 80%. Sem isso a Weibull não separa forma de escala. Revisar essa ordem: primeiro o que é falha, depois a amostra, depois o ajuste. Trocar 404 por outro código, ou somar latência, exige repetir a escolha da janela. Não se herda 30 minutos sem olhar a nova série.

## Encaixe no texto do trabalho

A proposta pede, em até 6 páginas de coluna simples, título, resumo, introdução, descrição do sistema, revisão da literatura, metodologia, resultados esperados e referências. O documento final expande isso com materiais e métodos, resultados e conclusão, em até 12 páginas de coluna simples.

O sistema descrito na proposta pode ser o servidor da NASA, com a telemetria real anunciada como continuação. A metodologia precisa declarar ferramenta de IA, finalidade, estratégia e responsabilidade autoral. Referência encontrada com ajuda de IA só entra depois de conferida no original.

Literatura que este experimento de fato usa, e que convém reler:

- A página do acervo NASA-HTTP e o artigo que ela aponta: Arlitt e Williamson, *Web Server Workload Characterization: The Search for Invariants*, ACM SIGMETRICS, 1996. É a caracterização deste log, não um artigo de Weibull.
- A especificação do OpenTelemetry para o nome dos três sinais, do span e do `trace_id`, quando a adaptação sair do arquivo.

Qualquer outro artigo de Weibull, censura ou carga–resistência entra na revisão só depois de aberto e conferido. O PDF da disciplina pede essa verificação.
