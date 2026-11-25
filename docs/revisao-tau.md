# τ — nota curta para escolher o tempo

A proposta fixou a meta **antes** de olhar as séries: uma janela cumpre a latência quando pelo menos 95% das requisições respondem em até **τ = 200 ms**. Isso está em [docs/proposta.md](proposta.md). O seletor do dashboard não troca essa meta. Os outros valores são teste de sensibilidade. O marcado com “(proposta)” continua sendo o oficial.

Esta nota só registra uma revisão rápida de referências públicas, para decidir se 1 s é um segundo limite razoável em cada base. Não substitui a proposta.

## O que as referências usam

Três fontes, com papéis diferentes:

1. **Limite de percepção, não SLO de servidor.** Nielsen (1993), a partir de Miller (1968) e Card, Moran e Newell (1991): cerca de 0,1 s parece instantâneo; cerca de 1 s ainda preserva o fluxo de pensamento; cerca de 10 s é o limite para manter a atenção. [Response Time Limits](https://www.nngroup.com/articles/response-times-3-important-limits/).
2. **Exemplo de SLO do Google, não norma.** No [SLO document](https://sre.google/workbook/slo-document/) do SRE Workbook, o servidor HTTP visto pelo usuário usa dois cortes: 90% das requisições em até 200 ms e 99% em até 1 s. A API do mesmo exemplo usa 90% em até 400 ms e 99% em até 850 ms. Os autores arredondaram os tempos para cima e avisam que não verificaram correlação forte com a experiência do usuário.
3. **Como escrever o índice.** O [artigo de SLOs do Google Cloud](https://cloud.google.com/blog/products/gcp/building-good-slos-cre-life-lessons/) pede a fração de requisições abaixo de um limiar, medida o mais perto do cliente possível, e desaconselha a média. O exemplo ilustrativo de lá é outro par (50% em 250 ms e 99% em 3 s): serve para o formato, não como número a copiar.

A própria proposta já cita o material de SRE: o objetivo não deve ser escolhido a partir do desempenho já observado. Por isso 200 ms permanece a meta declarada. Os números abaixo dizem onde cada série está, para a sensibilidade não ser um chute.

## Os dois datasets não medem a mesma coisa

| | Hugging Face `web-server-logs` | PetShop |
| --- | --- | --- |
| O que a duração é | Tempo de uma requisição no access log: página, estático e API no mesmo arquivo | p95 de uma janela de 5 min do PetSite, o front que espera a cadeia de microsserviços |
| Onde a série está | p50 = 90 ms, p95 = 629 ms, p99 = 1,46 s. Em 15/01/2024, o p95 por servidor vai de 0,39 s a 1,32 s | p95 mediano cerca de 310 ms e p99 cerca de 450 ms, o tempo todo |
| τ = 200 ms no p95 | A cauda inteira fica fora da meta. Com poucas requisições por janela, o modo latência quase não separa episódio | Disponibilidade de latência = 0%. Não há episódio de lentidão: 310 ms é o estado normal |
| τ = 1 s | Cabe no segundo corte do exemplo HTTP do Google (99% ≤ 1 s). O p95 do conjunto (629 ms) passa; o p99 (1,46 s) e o p95 do `web-prod-02` (1,32 s) continuam fora | Em 500 ms a disponibilidade de latência já está em 99,5–100%. Em 1 s o modo latência deixa de ver falha |

## O que dá para levar para a revisão

1 s melhora o índice, mas não “um pouco”, e não do mesmo jeito nas duas bases.

- **Logs HTTP (Hugging Face).** 1 s é um candidato de literatura para a **cauda** (o corte de 99%), ao lado dos 200 ms para a massa (90%). No p95, 1 s fica no meio da série observada e passa a separar servidor. O histograma do backfill já tem balde em 1 s, então o plugin não precisa interpolar esse ponto.
- **Front de microsserviços (PetShop).** O exemplo de API do mesmo documento do Google fica em 400 ms (90%) e 850 ms (99%). Nesta série, o p95 só começa a separar janela boa e ruim por volta de **350 ms** (disponibilidade 91–96%). Em 400 ms quase tudo passa. **1 s apaga o modo latência**: a disponibilidade vai a 100% e MTBF/MTTR deixam de existir. Não é um ajuste fino.

Sugestão para a conversa do grupo, sem alterar o texto da proposta: manter 200 ms como meta oficial; usar 1 s só como segundo corte de cauda no Hugging Face; no PetShop, se a sensibilidade for discutida, o intervalo que ainda informa é 350–400 ms, não 1 s.

## Como aparece no seletor

No dashboard do PetShop, a variável `tau_ms` é do tipo custom. A opção nova é `1000 (1 s)`, com valor `1000`. O padrão continua `200`. O painel já divide `$tau_ms` por 1000 quando desenha a linha de τ em segundos, e a janela continua ruim quando o percentil escolhido passa desse valor.

Quem quiser um número que não está na lista pode digitá-lo: `allowCustomValue` já está ligado. O dashboard do Hugging Face (`reliability.json`) não tem seletor de τ; o corte de 200 ms está no texto dos painéis e na configuração do plugin.
