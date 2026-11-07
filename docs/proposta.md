# Confiabilidade de sistemas de software distribuídos a partir de sinais Opentelemetry

O tema de confiabilidade de software é um tema relativamente recente mas amplamente discutido, a ubiquidade de sistemas de software em diversas áreas da sociedade tornou-os complexos e mais críticos. Nas décadas mais recentes, com os avanços no campo da internet e sistemas de software dependentes dela, tornou-se prática comum separar diferentes partes complexas de aplicações em servidores conectados por redes [Ref martinf Fowler], isto é o que denominamos sistemas distribuídos. A partir dessa definição cada servidor em um sistema distribuído é tratado como um componente que pode falhar ou se comportar fora do esperado, similarmente a componentes de outros tipos de artefatos de engenharia.

A prática que estuda a confiabilidade de sistemas web é conhecida como *software reliability engineering* (SRE) [Gooogle SRE] é prática comum no Brasil desde a metade da última década. Contudo esse campo ainda não é consistentemente aplicado em empresas brasileiras, porque o tema demanda alto investimento e planejamento estratégico de longo prazo. Portanto, sendo inviável para médias e pequenas empresas. Os custos relacinadoss a tempo, pessoas e fornecedores são altos demais para uma adoção da prática que realmente impacte positivamente a confiabilidade de sistemas novos.

Normalmente um dos fornecedores mais caros da SRE é o fornecedor de monitoramento, que são empresas cujo maior produto é uma suíte de bibliotecas e ferramentas de núvem especializados em coletar e processar dados de monitoramento de sistemas distribuídos[]. Contudo o número relativamente pequeno de fornecedores competitivos leva a preços altos e ao efeito de vendor lock-in, que é a incapacitação de uma organização de substiuir o fornecedor porque é complexo ou caro de mais. Essa situação irrita o mercado de software há anos e para tanto foi criado a Opentelemetry[site otel]. essa iniciativa de código aberto que tem como finalidade padronizar e simplificar a adoção de software de monitoramento.

## Descrição do sistema

- Iniciar com um servidor simples e mostrar a stack LGTM com base nos dados de um sistema
- Adicionar um segundo e mostrar os princípios se repetindo
- Aplicar o padrão para N servidores interconectados com redundância ou não. Nessa fase podemos usar algorítimos de grafos e as formulas de probabilidade combinada (independente e dependente).

## Revisão de literatura

- Livros de SRE do Gooogle
- Artigos da IEEE
- Artigos da Thoughtworks (martinfowler.com)

## Metodologia

- Coleta de dados por 30d
- Padronização de sinais pelo Opentelemetry
- Desenvolvimento de ferramentas baratas para usar no grafana

## Resultados esperado

- Visão mais realista da saúde do sistema - os resultaodos devem estar em par com a opinião do usuário
- Melhoria da visibilidade de problemas para usuários do grafana

## Declaração de uso de inteligência artificial

- Geração de código para testes
- Correção de texto
- formatação latex

## Referências

O LatexGera
