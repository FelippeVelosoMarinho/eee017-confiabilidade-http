# PetShop — os índices da proposta num sistema de microsserviços

Esta pasta aplica os índices da proposta (R por requisição, disponibilidade em relação ao SLO, MTBF e MTTR) ao **PetShop Dataset** da Amazon Science, como alternativa ou complemento aos logs sintéticos do Hugging Face.

**Status:** primeira versão para o grupo avaliar. As escolhas de método abaixo seguem a proposta, mas precisam ser revisadas e assumidas pelo grupo antes de entrarem no documento final.

## O dataset

- **O que é:** métricas do aplicativo de demonstração de adoção de pets da AWS, rodando em infraestrutura AWS, com 41 componentes (microsserviços em ECS/Fargate, Lambda, Step Functions, DynamoDB, RDS/PostgreSQL, SQS, SNS, balanceadores). O tráfego é gerado por um simulador de usuários que acompanha o aplicativo; não são usuários reais.
- **Métricas:** coletadas pelo Amazon CloudWatch, agregadas em janelas de 5 minutos, por componente: número de requisições, latência (média, p50, p90, p95, p99) e disponibilidade = 1 − erros/requisições.
- **Fonte:** <https://github.com/amazon-science/petshop-root-cause-analysis>
- **Licença:** CC-BY-4.0 (exige atribuição; a citação está abaixo).
- **Citação:** Hardt, M., Orchard, W. R., Blöbaum, P., Kirschbaum, E. & Kasiviswanathan, S. (2024). *The PetShop Dataset — Finding Causes of Performance Issues across Microservices.* Proceedings of the Third Conference on Causal Learning and Reasoning, PMLR 236:957–978.

### O que está em `data/`

Só os trechos de **operação normal** (pasta `noissue` do repositório original), que são séries contínuas. As pastas de incidentes injetados (`train/`, `test/`) não entraram: cada uma tem só algumas janelas em volta do problema, não uma linha do tempo.

| Pasta | Cenário | Período (UTC) | Janelas de 5 min |
|---|---|---|---|
| `low_traffic/` | Tráfego baixo | 21/08/2023 09:00 – 23/08/2023 10:05 | 589 |
| `high_traffic/` | Tráfego alto | 05/09/2023 14:00 – 07/09/2023 15:05 | 589 |
| `temporal_traffic1/` | Tráfego variável ao longo do dia | 22/04/2023 19:55 – 28/04/2023 13:35 | 1.652 |

O cenário `temporal_traffic2` do repositório original tem exatamente os mesmos números do `temporal_traffic1` (só as colunas estão em outra ordem), por isso foi deixado de fora.

Cada pasta tem `metrics.csv` (cabeçalho em três níveis: componente, métrica, estatística) e `graph.csv` (mapa de chamadas: linha chama coluna). Para baixar de novo do original: `bash baixar_dados.sh`.

## Como rodar

```bash
pip install -r requirements.txt
python analise_petshop.py
```

Grava tudo em `resultados/` em poucos segundos.

## Decisões de método

| Ponto | Decisão | Por quê |
|---|---|---|
| Serviço avaliado | **PetSite**, o front-end | Ninguém chama o PetSite no mapa de chamadas: ele é a porta de entrada, então a falha dele é a falha percebida pelo usuário (Oppenheimer et al.). Os outros componentes entram na comparação por componente |
| Janela | **5 min** | É a janela original da proposta e a granularidade do próprio dataset |
| Mínimo por janela | **100 requisições** | Igual à proposta. O PetSite tem de 325 a 1.426 requisições por janela, então nenhuma janela fica de fora |
| Metas | R*_erro = 99%, R*_lat = 95%, τ = 200 ms | Iguais à proposta, fixadas antes de olhar os dados |
| Erro | f = n × (1 − disponibilidade) | A disponibilidade do CloudWatch é exatamente 1 − erros/requisições: a conta devolve números inteiros de erros. O artigo **não diz quais códigos contam como erro** (5xx, 4xx, throttling) |
| Latência por janela | A janela passa se **p95 ≤ 200 ms** | Por definição de percentil, "p95 ≤ τ" é o mesmo que "pelo menos 95% das requisições em até τ", que é a meta R*_lat. Essa parte é exata |
| R_lat do período | **Faixa** + estimativa | Sem a duração de cada requisição, só dá para dizer entre quais percentis os 200 ms caem. A estimativa interpola linearmente entre esses percentis e é aproximada |
| Episódio | Janelas ruins consecutivas | Igual à proposta. Como nenhuma janela é descartada, a dúvida sobre dias não julgados do Hugging Face não aparece aqui |
| IC do R | Wilson **e** bootstrap por blocos | O de Wilson supõe requisições independentes. O bootstrap reamostra blocos de 12 janelas (1 h), 2.000 vezes, e respeita o fato de os erros virem em rajadas |
| Tempo entre falhas | Exponencial × Weibull por máxima verossimilhança, com censura | Os trechos que tocam o início ou o fim da observação são censurados (só se sabe que duraram pelo menos aquilo) |

## Resultados — PetSite

### Modo erro (meta de 99%)

| Cenário | Requisições | Erros | R_erro | IC 95% Wilson | IC 95% bootstrap | A_erro | Episódios | MTBF | MTTR |
|---|---|---|---|---|---|---|---|---|---|
| Tráfego baixo | 285.225 | 1.167 | 99,59% | 99,57–99,61% | 99,08–99,90% | 96,3% | 13 | 3,6 h | 8,5 min |
| Tráfego alto | 406.226 | 364 | 99,91% | 99,90–99,92% | 99,89–99,93% | 98,8% | 6 | 8,1 h | 5,8 min |
| Tráfego variável | 944.067 | 1.675 | 99,82% | 99,81–99,83% | 99,74–99,89% | 98,3% | 25 | 5,4 h | 5,6 min |
| **Total** | **1.635.518** | **3.206** | **99,80%** | 99,80–99,81% | — | **98,0%** | **44** | — | — |

A identidade A = MTBF / (MTBF + MTTR) fecha nos três cenários.

### Modo latência (p95 ≤ 200 ms)

| Cenário | p95 mediano | p99 mediano | R_lat (faixa) | R_lat estimado | A_lat |
|---|---|---|---|---|---|
| Tráfego baixo | 309 ms | 469 ms | 50–90% | 78,7% | 0% |
| Tráfego alto | 309 ms | 445 ms | 50–90% | 77,9% | 0% |
| Tráfego variável | 308 ms | 449 ms | 50–90% | 79,4% | 0,06% (1 janela) |

Com as duas metas juntas, a disponibilidade fica em 0% (uma única janela passa), porque a latência nunca cumpre a meta.

**Sensibilidade ao τ** (a meta declarada continua 200 ms; isto só mostra onde está o sistema):

| τ | 200 ms | 250 ms | 300 ms | 350 ms | 400 ms | 500 ms |
|---|---|---|---|---|---|---|
| A_lat (baixo / alto / variável) | 0 / 0 / 0,06% | 0 / 0 / 0,1% | 36 / 34 / 33% | 91 / 96 / 96% | 98,8 / 99,7 / 99,9% | 99,5 / 99,8 / 100% |

### Leitura

1. **Aqui os índices de erro discriminam.** No Hugging Face nenhum dia passou e MTBF e MTTR viraram 0 e "nunca recuperou". No PetShop o serviço cumpre a meta de erro em 96 a 99% das janelas, sai dela em 44 episódios curtos e volta: o MTTR fica entre 5,6 e 8,5 min, e o MTBF entre 3,6 e 8,1 h. É o tipo de leitura para o qual a proposta foi desenhada: o serviço perde disponibilidade por falhar com certa frequência, não por demorar a voltar.
2. **Os erros vêm em rajadas.** O índice de dispersão (variância dos erros por janela dividida pela variância esperada se as requisições fossem independentes) é 433 no tráfego baixo, 4,0 no alto e 61 no variável. Se os erros fossem independentes, ficaria perto de 1. Por isso o IC de Wilson é estreito demais, e o bootstrap por blocos é o intervalo honesto: no tráfego baixo, 99,08–99,90% em vez de 99,57–99,61%. Mesmo assim, o IC inteiro fica acima de 99%, então o R_erro do período cumpre a meta em todos os cenários.
3. **A diferença entre cenários é de incidentes, não de volume.** O qui-quadrado entre cenários dá χ² = 914 com 2 graus de liberdade e p ≈ 0. Mas no tráfego baixo, 2 dos 13 episódios somam 851 dos 1.167 erros (73%): o início da observação (10 janelas) e uma janela às 05:45 de 23/08 com R = 40,7%. O tráfego baixo não é "mais frágil"; ele teve dois incidentes.
4. **A falha tem lugar.** No caminho síncrono (os 19 componentes com alguma janela de 100 ou mais requisições), o PetSite sozinho tem 3.206 erros, contra 317 em todos os outros juntos. Isso é o contrário do Hugging Face, onde a taxa de 5xx era igual em todo lugar. O qui-quadrado entre componentes dá p ≈ 0, mesmo sem o PetSite (há diferença também do lado da busca: PetSearch e seus balanceadores).
5. **Componentes assíncronos ficaram fora da comparação.** Step Functions, as Lambdas do fluxo de adoção, Evidently e um balanceador nunca têm janela com 100 requisições e mostram R de 0% a 100% conforme o cenário (por exemplo, Evidently: 100% no baixo, 0% no alto). Isso parece configuração do ambiente ou instrumentação, não falha percebida. É o mesmo problema que a proposta previa com "parte desse código é uso normal": sem saber o que cada erro significa, não dá para chamá-lo de falha. Os números estão em `resultados/R_por_componente.csv`, coluna `grupo`.
6. **Tempo entre falhas: Weibull com k < 1, evidência fraca.** Nos 46 trechos bons (5 censurados), a Weibull dá k = 0,81 (escala 5,2 h), e a exponencial dá média de 5,6 h. O AIC favorece pouco a Weibull (560,3 contra 561,5), e o teste de razão de verossimilhança de k = 1 dá p = 0,07. Um k abaixo de 1 quer dizer que, logo depois de uma falha, a chance de outra é maior, o que combina com as rajadas do item 2. Vai na mesma direção da literatura citada na proposta (Schroeder e Gibson), mas com 46 intervalos não dá para afirmar com 5% de significância.
7. **O MTTR está no limite da resolução.** 39 dos 44 episódios duraram uma única janela. A recuperação real pode ter sido mais curta que 5 min; com janela de 5 min, não dá para ver. O ajuste de distribuição ao tempo de reparo não foi feito por isso.
8. **A meta de latência não é cumprida por este sistema.** O p95 do PetSite fica em torno de 310 ms o tempo todo, longe de 200 ms. Não há episódio de lentidão: a lentidão é o estado normal. A meta só passaria a separar janelas boas e ruins com τ perto de 350 ms (tabela de sensibilidade). A meta foi fixada antes de ver os dados, e o resultado honesto é que ela não é cumprida.

## No Grafana, com o plugin do grupo

O caminho é o mesmo da proposta: métricas no formato do OpenTelemetry → Prometheus → plugin no Grafana. A análise em Python acima serve de conferência.

```text
data/*.csv ──conversor──▶ OpenMetrics ──promtool──▶ Prometheus ──plugin + dashboard──▶ Grafana
```

### Como subir (só precisa do Docker Desktop)

```bash
cd lab            # na raiz do repositório
docker compose up --build
```

O lab é o mesmo do Hugging Face: sobe os dois casos juntos (ver o README da raiz).

A primeira vez demora alguns minutos: o Docker converte os dados, gera os blocos do Prometheus e compila o plugin. Depois:

- **Grafana:** <http://localhost:3000> → Dashboards → Confiabilidade → *Confiabilidade — PetShop (caso secundário)*. Entra sem senha.
- **Prometheus do PetShop:** <http://localhost:9091>, para testar consultas.
- **Para trocar de cenário,** use os links no topo do dashboard. Cada cenário está numa data diferente (abril, agosto e setembro de 2023), e o link ajusta o período. O dashboard não tem seletor de cenário: quem decide o que aparece é o período.
- **No topo,** "Componente" escolhe o componente dos índices e das séries. O quadro e a tabela mostram os 10 componentes principais, os do caminho que atende o usuário.
- **Para testar outras metas,** use os seletores τ, "Meta de latência", "Meta de erro" e "Mínimo de requisições". Os valores marcados com "(proposta)" são os oficiais; os outros servem só para a análise de sensibilidade. A meta de latência só aceita 50, 90, 95 e 99%, porque são os percentis que o dataset traz (a janela passa se o percentil correspondente ficar abaixo de τ). Os números do dashboard com τ = 350 ms batem com a tabela de sensibilidade acima (96,2% e 51 episódios no tráfego variável).
- **Para parar:** `docker compose down`.
- **Depois de atualizar o código ou os dados,** rode `docker compose down -v` e depois `docker compose up --build`. O `-v` apaga os volumes antigos e garante que nada da versão anterior fique para trás.

### O conversor (`conversores/petshop_para_openmetrics.py`, na raiz)

Os dados não vieram de uma instrumentação OpenTelemetry; o conversor os **mapeia** para as convenções semânticas do OTel para HTTP:

| CloudWatch (por componente, janela de 5 min) | OpenMetrics |
|---|---|
| requisições − erros | `http_server_request_duration_seconds_count{service_name, scenario}` |
| erros = requisições × (1 − disponibilidade) | o mesmo contador com `error_type="_OTHER"` (a convenção do OTel para erro de tipo desconhecido) |
| p50, p90, p95, p99 | `http_server_request_duration_window_seconds{..., quantile="0.95"}` |

Além do nome técnico (`service_name`), cada série leva o rótulo `componente`, com um nome legível ("Site (front-end)", "Busca de pets", "Banco de adoções (PostgreSQL)"…), e `principal="sim"` nos 10 componentes do caminho que atende o usuário. Os nomes foram deduzidos do nome técnico e do mapa de chamadas, e estão no dicionário `NOMES` do conversor.

- **O contador é acumulado,** com uma amostra no fim de cada janela e um zero no início da série. A diferença entre duas amostras seguidas é exatamente o volume da janela.
- **O histograma só tem o balde +Inf,** porque o dataset não traz a duração de cada requisição.
- **Nada foi inventado:** nem código HTTP, nem duração por requisição, nem horário de chegada.

### Opções do plugin que o PetShop usa (`ufmg-reliability-app`)

O dashboard do PetShop liga estas opções (a lista completa de parâmetros está no README da raiz):

| Opção | Valores | Para quê |
|---|---|---|
| Formato das contagens | por janela (padrão) / **acumulado** | Com uma amostra por janela, o `increase()` do Prometheus 3 volta vazio, e ele também extrapola. No modo acumulado, o painel faz a diferença entre pontos seguidos, e a conta fica exata |
| Fonte da latência | histograma (padrão) / **p95 da janela** | A janela fica ruim se p95 > τ, o que é o mesmo que "menos de 95% até τ" |
| Modo de falha (painel Summary) | erro ou latência (padrão) / só erro / só latência | Mostrar A, MTBF e MTTR de cada modo separado |

O quadro de janelas usa o rótulo `componente` nas linhas e julga só o erro (a latência nunca cumpre a meta e deixaria o quadro todo vermelho; dá para trocar nas opções do painel). O dashboard está em `ufmg-reliability-app/provisioning/dashboards/ufmg/petshop.json`.

### Conferência

O teste `ufmg-reliability-app/src/reliability/__tests__/e2e-petshop.test.ts` consulta o Prometheus, passa as séries pelo **mesmo código do painel Summary** e confere com a análise em Python. Nos três cenários, A_erro, o número de episódios e o MTTR batem exatamente. Para rodar, com o lab no ar (Prometheus do PetShop na porta 9091):

```bash
cd ufmg-reliability-app
npm ci
RUN_E2E=1 npx jest --ci --watchAll=false --watchman=false e2e-petshop
```

No PowerShell do Windows, a variável se define antes: `$env:RUN_E2E=1; npx jest --ci --watchAll=false --watchman=false e2e-petshop`.

## Limitações

- **Tráfego simulado**, embora a infraestrutura e as falhas sejam de um ambiente AWS real.
- **O que conta como erro não está documentado** no artigo.
- **Latência só em percentis:** o R_lat do período sai como faixa (50–90%), não como número exato.
- **Períodos curtos:** de 2 a 5,7 dias por cenário.
- **Os cenários não são contínuos entre si** (abril, agosto e setembro de 2023). Os episódios foram contados dentro de cada cenário, e o ajuste de distribuição junta os três supondo o mesmo processo de falha.
- **Resolução de 5 min:** limita o que se pode dizer sobre o MTTR.

## Arquivos em `resultados/`

| Arquivo | Conteúdo |
|---|---|
| `indices_petsite.csv` | Índices do PetSite por cenário, nos três modos (erro, latência e os dois juntos) |
| `episodios_erro_petsite.csv` | Cada episódio do modo erro: início, duração, pior R da janela e erros |
| `R_por_componente.csv` | R_erro, IC e A_erro de cada componente, com o grupo (síncrono ou assíncrono/baixo volume) |
| `sensibilidade_tau.csv` | A_lat, episódios e MTTR para τ de 200 a 500 ms |
| `resumo.json` | Tudo acima, mais os testes qui-quadrado e o ajuste exponencial × Weibull |
| `fig1_R_erro_por_janela.png` | R_erro por janela, com a meta e os episódios destacados |
| `fig2_p95_por_janela.png` | p95 por janela contra τ = 200 ms |
| `fig3_R_erro_por_componente.png` | R_erro por componente do caminho síncrono, com IC |
| `fig4_tempo_entre_falhas.png` | Curva de sobrevivência empírica (Kaplan–Meier) contra exponencial e Weibull |

## Uso de IA

O script, as figuras e este README foram produzidos com apoio do Claude (Anthropic), a pedido do grupo. Pelas orientações da disciplina, o grupo precisa conferir as contas, conseguir explicar cada passo e declarar esse uso (ferramenta, versão, finalidade e etapa) no documento final.
