# Planner — confiabilidade do servidor HTTP da NASA (EEE 017)

Estudo em cima do log real de agosto de 1995 do Kennedy Space Center, arquivo `NASA_access_log_Aug95.gz` do Internet Traffic Archive (`https://ita.ee.lbl.gov/traces/NASA_access_log_Aug95.gz`, 15,8 MB compactados).

O mês tem 1.569.898 linhas. O parser aceitou 1.568.252. As 1.646 restantes estão sem o formato completo e ficam de fora da conta. O dia 2 de agosto não existe no arquivo: o servidor ficou fora entre 1/ago 14:52 e 3/ago 04:36 por causa do furacão Erin. Esse vão não entra como falha.

## Janela de tempo

A janela do estudo é **30 minutos** do relógio do log, fuso −0400, sem sobreposição, alinhada à meia-noite. Cada dia vira no máximo 48 janelas.

A métrica em cada janela é a proporção de respostas **404**:

\[
p_{404}=\frac{\text{respostas 404}}{\text{requisições da janela}}
\]

Uma janela só pode caracterizar falha se tiver pelo menos 30 requisições. A mediana das janelas do mês é 947 requisições, então o corte tira o ruído de um punhado de acessos e não muda o miolo do dia.

Por que 30 minutos, e não 5:

| Janela | Limiar no percentil 95 | Dias que falham |
|---|---|---|
| 5 min | 2,70% | 30 de 30 |
| 15 min | 2,07% | 29 de 30 |
| 30 min | 1,77% | 23 de 30 |

Em 5 ou 15 minutos a oscilação de um intervalo curto faz todo dia cruzar o limiar. A curva de confiabilidade deixa de ter dias que sobrevivem. Em 30 minutos a proporção fica estável o bastante para um limiar, e ainda aparecem 7 dias que nunca o cruzam.

O limiar fixado é \(u_0 = 1{,}77\%\), o percentil 95 das janelas com tráfego. A taxa global de 404 no mês é **0,63%** (9.952 de 1.568.252). O código 403 aparece 171 vezes (0,011%) e não dá uma taxa para observar. O 404 fica acima do piso do mês e abaixo de um estouro contínuo.

Falha do dia: a primeira janela elegível com \(p_{404} > 1{,}77\%\). O tempo \(t\) é o minuto em que essa janela termina, contado desde 00:00. Dia que chega ao fim sem cruzar o limiar é censura à direita, com \(T\) igual ao fim da última janela (em geral 1.440 minutos).

## Dois exemplos já carregados no Grafana

**6 de agosto — falha.** Das 00:00 às 02:30 a proporção fica sob o limiar. A janela 02:30–03:00 tem 529 requisições e 98 respostas 404, proporção **18,53%**. O dia falha em \(t = 180\) minutos. Há uma segunda janela acima do limiar mais tarde; o tempo até a falha usa só a primeira.

**9 de agosto — censura.** O pico do dia é a janela das 20:00, com 1.078 requisições e 17 respostas 404, proporção **1,58%**, abaixo de 1,77%. O registro é \(T > 1440\).

No mês inteiro: 23 dias falham e 7 ficam censurados (9, 12, 13, 14, 16, 18 e 23 de agosto).

## Weibull por máxima verossimilhança

O tempo até a falha, em minutos, é modelado por

\[
R(t)=\exp\left[-\left(\frac{t}{\eta}\right)^{\beta}\right]
\]

\(R(t)\) é a probabilidade de um dia ainda não ter cruzado o limiar até o instante \(t\).

A amostra tem 30 dias. A contribuição de cada dia para a verossimilhança depende do que aconteceu:

- Dia que falhou em \(t\): entra a densidade \(f(t)=\dfrac{\beta}{\eta}\left(\dfrac{t}{\eta}\right)^{\beta-1}\exp\left[-\left(\dfrac{t}{\eta}\right)^{\beta}\right]\).
- Dia censurado em \(t\): entra \(R(t)\). O dia informa que a falha, se vier, vem depois de \(t\). Tratar esses sete dias como falha às 24 h encurtaria a vida estimada.

A verossimilhança é o produto das 30 contribuições. A máxima verossimilhança procura \(\beta\) e \(\eta\) que maximizam esse produto. Na prática o `analyze.py` minimiza o negativo do logaritmo, com quatro chutes iniciais, porque o log evita o produto de números muito pequenos. O ajuste convergiu em

\[
\beta = 0{,}69 \qquad \eta = 652 \text{ minutos}
\]

Leitura direta desses números:

- Em \(t = \eta\), \(R(\eta)=e^{-1}\approx 0{,}37\). Cerca de 63% dos dias já falharam por volta de 10 h 52 min.
- \(\beta < 1\) faz a taxa de risco \(h(t)=\dfrac{\beta}{\eta}\left(\dfrac{t}{\eta}\right)^{\beta-1}\) diminuir com \(t\). Os dias que atravessam a madrugada sem um pico de 404 tendem a cumprir o resto do dia. Foi o que o log mostrou: a maior parte das falhas está entre 00:30 e 04:30, em geral com centenas de requisições e não com uma linha isolada. O 6 de agosto, com 98 páginas inexistentes em meia hora, é o caso extremo.
- \(\beta = 1\) seria risco constante, a exponencial. \(\beta > 1\) seria risco crescente ao longo do dia. Nenhum dos dois descreve este mês.

A curva de Kaplan–Meier no `output/relatorio.json` é a sobrevivência empírica, sem assumir Weibull. Ela serve de conferência visual do ajuste.

## Carga e resistência

A carga \(L\) é a própria proporção de 404 de cada janela de 30 minutos. No mês, a mediana é 0,52% e o percentil 90 é 1,32%.

A resistência \(S\) não está no log. Não há CPU, fila nem throttling. \(S\) é a tolerância operacional, declarada como hipótese: normal com média 1,77% e desvio-padrão de 0,20 ponto percentual, truncada entre 0 e 1. O desvio representa incerteza do limiar, não uma medição do servidor.

O índice é a probabilidade de a tolerância superar a carga:

\[
R = P(S > L)
\]

Vinte mil sorteios, reamostrando \(L\) das janelas reais e sorteando \(S\) dessa normal, deram **\(R = 0{,}945\)**.

Dois casos concretos:

- Janela típica, \(L = 0{,}52\%\). A média de \(S\) está em 1,77%. Quase todo sorteio de \(S\) fica acima da carga.
- 6 de agosto, 02:30, \(L = 18{,}5\%\). A carga está muitas vezes acima da tolerância. Nessa meia hora, \(P(S > L) \approx 0\).

Se \(S\) fosse um número fixo igual ao limiar, o índice cairia para a fração de janelas com \(p_{404} \le 1{,}77\%\), que deu **0,950**. Esse valor repete o percentil 95, porque o limiar foi definido como esse percentil. Ele confere a conta. A informação nova está na vida do dia (Weibull) e na tolerância incerta em torno do limiar.

## Como observar a taxa

O projeto está em `/home/felippe/Documentos/Github/Ciano/Engelmig/estudo-confiabilidade-http`. O Grafana abre o dia 6 de agosto de 1995 no fuso de Nova York, o mesmo −0400 do log.

1. Suba a pilha, se ela não estiver no ar:

```bash
cd /home/felippe/Documentos/Github/Ciano/Engelmig/estudo-confiabilidade-http
python3 replay.py
docker compose up -d
```

`replay.py` grava em `logs/app.log` só os dias 6 e 9, com a linha original. O Promtail lê esse arquivo, extrai o código HTTP e devolve ao Loki o timestamp de 1995.

2. Abra [http://localhost:3000](http://localhost:3000). O acesso anônimo entra como leitor. Para editar, `admin` / `admin`.
3. Vá em Dashboards → pasta Confiabilidade → **NASA HTTP — taxa de 404**.
4. O painel de cima é a proporção na janela de 30 minutos. A consulta é

```logql
sum(count_over_time({job="nasa_http", status_code="404"}[30m]))
/ sum(count_over_time({job="nasa_http"}[30m]))
```

O `[30m]` é a mesma janela do estudo. A divisão de contagens é \(p_{404}\). A linha fica verde até 1,77% e vermelha acima.

5. No dia 6, por volta das 02:30, a curva sobe para cerca de 18%. O painel de quantidade deve mostrar 98 respostas 404, e o de total, 529 requisições. O painel de baixo lista as linhas 404 daquele intervalo.
6. Para o dia que não falha, troque o intervalo do canto superior direito para **9 de agosto de 1995**, o dia inteiro. O pico fica em 1,58%, abaixo da linha vermelha. Esse é o dia censurado.
7. A Weibull e o índice \(P(S>L)\) do mês inteiro não saem do Grafana. Eles estão em `output/relatorio.json`, `output/tempos_ate_falha.csv` e `output/janelas.csv`, gerados por

```bash
python3 analyze.py
```

Os dois dias no Grafana são o exemplo visível. Os 30 dias do CSV são a amostra do ajuste.
