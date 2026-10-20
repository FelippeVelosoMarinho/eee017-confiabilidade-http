# Confiabilidade de um servidor HTTP a partir de telemetria de logs

Experimento da disciplina **EEE 017 — Confiabilidade de Sistemas** (Engenharia de Sistemas, UFMG). O sistema real é o servidor HTTP do Kennedy Space Center em agosto de 1995. A fonte é o log público [NASA-HTTP](https://ita.ee.lbl.gov/html/contrib/NASA-HTTP.html), arquivo `NASA_access_log_Aug95.gz`.

O índice acompanhado é a proporção de respostas **404** em janelas de **30 minutos**. Um dia falha na primeira janela em que essa proporção passa de **1,77%**. Em cima dos tempos até a falha, com censura à direita, o experimento ajusta uma Weibull por máxima verossimilhança e calcula um índice carga–resistência.

## O que foi feito

- O log de agosto foi baixado do Internet Traffic Archive (1.569.898 linhas, 1.568.252 parseadas). O dia 2 de agosto não existe no arquivo: o servidor ficou fora por causa do furacão Erin. Esse vão não foi tratado como falha.
- A taxa global de 404 no mês é 0,63% (9.952 respostas). O código 403 aparece 171 vezes e não sustenta uma taxa observável, por isso o estudo usa 404.
- Janelas de 5 e de 15 minutos faziam quase todos os dias cruzarem qualquer limiar alto. A janela de 30 minutos, alinhada à meia-noite no fuso −0400, deixa 23 dias com falha e 7 dias censurados.
- O limiar \(u_0 = 1{,}77\%\) é o percentil 95 das janelas com pelo menos 30 requisições.
- `analyze.py` estima a Weibull com censura, desenha a curva de Kaplan–Meier e calcula \(P(S > L)\) por Monte Carlo.
- Os dias 6 e 9 de agosto foram carregados no Grafana, via Promtail e Loki, com o timestamp original de 1995. O painel repete a mesma divisão de contagens da janela de 30 minutos. No dia 6, às 02:30, a proporção vai a 18,5% (98 de 529). No dia 9 o pico fica em 1,58% e o dia entra como censura.

| Resultado | Valor |
|---|---|
| Amostra | 30 dias |
| Falhas / censuras | 23 / 7 |
| \(\beta\) | 0,69 |
| \(\eta\) | 652 minutos |
| \(P(S > L)\) | 0,945 |

\(\beta < 1\): a taxa de risco cai ao longo do dia. A maior parte dos estouros está na madrugada. Os detalhes, os exemplos e o passo a passo do Grafana estão no [PLANNER.md](PLANNER.md).

## Como reproduzir

```bash
python3 -m pip install -r requirements.txt
python3 analyze.py
python3 replay.py
docker compose up -d
```

O painel abre em [http://localhost:3000/d/nasa-404/nasa-http-e28094-taxa-de-404](http://localhost:3000/d/nasa-404/nasa-http-e28094-taxa-de-404), já posicionado em 6 de agosto de 1995 (fuso de Nova York, o mesmo −0400 do log). A leitura anônima entra direto. Para editar, `admin` / `admin`, senha só deste laboratório local.

`replay.py` grava em `logs/app.log` os dias 6 e 9. Esse arquivo é gerado e não vai no Git. O mês inteiro usado no ajuste está em `data/NASA_access_log_Aug95.gz`. Os números do ajuste estão em `output/`.

## Documentos

- [PLANNER.md](PLANNER.md) — decisões do experimento, janela, Weibull e carga–resistência.
- [docs/ADAPTACAO_DADOS_REAIS.md](docs/ADAPTACAO_DADOS_REAIS.md) — o que muda quando a fonte deixar de ser o log histórico e passar a ser telemetria de um serviço em operação, e os tópicos da matéria para revisar antes dessa etapa.
- [docs/OrientacoesTrabalhoPratico.pdf](docs/OrientacoesTrabalhoPratico.pdf) — orientações do trabalho prático (proposta até 06/11/2026, documento final até 25/11/2026, apresentações em 25/11 e 30/11).

## Licença e materiais de terceiros

O código e os textos escritos neste repositório estão sob a licença MIT. Veja [LICENSE](LICENSE).

O log da NASA pode ser redistribuído, conforme a página do acervo. O PDF de orientações é material da disciplina e permanece com o autor do documento. Nenhum dos dois passa a ser obra licenciada em MIT por estar nesta pasta.
