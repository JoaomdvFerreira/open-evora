# PRB-0009 — WU027: investigação sobre disponibilidade de métricas operacionais

**Milestone:** `M007`
**Work unit:** `WU027`
**Data:** 2026-09-01

## Pergunta de investigação

Existem métricas operacionais agregadas e comparáveis antes/depois da reestruturação do serviço de resíduos, com unidade, período e cobertura definidos, suficientes para apoiar uma futura decisão humana de prontidão de avaliação para `PRB-0009`?

## Baseline do corpus

O corpus de `PRB-0009` já fixa a sequência de atualidade: perturbação na recolha em fevereiro de 2026 (`EVD-000071`, `EVD-000072`), normalização parcial com quatro viaturas em maio (`EVD-000095`) e reestruturação de frota, recursos, modelos de recolha, responsabilidades e monitorização em julho–agosto (`EVD-000065`, `EVD-000066`). Não fixa unidade operacional, período de implementação completo, denominadores ou séries pós-mudança.

Não contém série municipal pública para atrasos, recolhas falhadas, tempo de resolução ou ocorrências acumuladas depois de agosto de 2026. Os relatos públicos individuais ligados ao PRB não foram usados como métricas nem foram recolhidos dados de pedidos individuais.

## Método e fontes efetivamente inspecionadas

Foi feita primeiro a leitura de todos os `EVD-*` e `SRC-*` ligados a `PRB-0009`, bem como dos registos D6/M007 aplicáveis. A descoberta externa foi limitada a material público e autoritativo:

- [Município de Évora — Prestação de Contas 2025](https://www.cm-evora.pt/wp-content/uploads/2026/05/PRESTACAO_CONTAS_2025.pdf), relatório público municipal;
- [Município de Évora — Relatório de Atividade 2023](https://www.cm-evora.pt/?listas_ficheiros=relatorio-de-atividade), relatório público municipal;
- [Município de Évora — normalização da recolha, 14–15 de maio de 2026](https://www.cm-evora.pt/municipio-de-evora-reforca-meios-para-normalizar-recolha-de-residuos-no-concelho/), já representado no corpus;
- [arquivo municipal de avisos e editais](https://www.cm-evora.pt/municipe/camara-municipal/avisoseditais/), consultado para publicações posteriores à reestruturação;
- [ERSAR — Resíduos Urbanos](https://www.ersar.pt/pt_setor_caracterizacao_residuos-urbanos.html) e [qualidade dos serviços](https://www.ersar.pt/pt_consumidor_qualidade-dos-servicos.html), fontes regulatórias públicas.

Não houve contacto institucional, pedido de dados, navegação autenticada, recolha de dados pessoais, avaliação, nem pesquisa de soluções.

## Constatações relevantes

O relatório municipal de 2023 apresenta, para recolha domiciliária de resíduos urbanos volumosos (RUV), 1 668 solicitações respondidas; o relatório de 2025 apresenta 1 472 respostas em 1 907 solicitações e 180,98 toneladas. São contagens agregadas públicas, anuais e municipais, mas dizem respeito ao subserviço RUV e não definem atrasos, recolhas falhadas ou tempo de resolução da recolha regular de RSU. Não cobrem o período posterior à reestruturação de 2026, nem documentam um denominador ou uma definição operacional estável que permita atribuir a variação entre anos à mudança.

As páginas municipais de 2026 confirmam contexto e cronologia da alteração, incluindo atrasos acumulados e a introdução de mecanismos de monitorização, mas não publicam valores de desempenho. A consulta do arquivo municipal não identificou publicação de série agregada pós-agosto de 2026 para os resultados mínimos procurados.

A ERSAR disponibiliza indicadores públicos de qualidade por município, mas a página setorial indica que os dados validados mais recentes são de 2023. Demonstra uma via pública para indicadores regulatórios agregados, mas não fornece observação municipal pós-reestruturação de 2026 nem série alinhada com a mudança em causa.

## Avaliação de comparabilidade, acesso e atualidade

| Dimensão | Avaliação delimitada |
| --- | --- |
| Autoridade e âmbito | Relatórios e comunicados municipais são autoritativos para os seus factos e cobrem o Município de Évora; a ERSAR é autoritativa para os seus indicadores regulatórios. |
| Agregação, unidade e período | Há valores anuais agregados de RUV para 2023/2025 e indicadores ERSAR de 2023; não há série por rota/zona/período para recolha regular antes/depois da reestruturação de 2026. |
| Definição e denominadores | A publicação identifica solicitações respondidas e toneladas em RUV, mas não estabelece definição estável de atraso, recolha falhada ou tempo de resolução, nem o contexto operacional necessário para comparação causal. |
| Alinhamento com a mudança | A mudança é documentada entre maio e agosto de 2026; não foi localizada medida pública posterior a agosto que permita confronto com baseline comparável. |
| Atualidade | As métricas acessíveis são de 2023 ou 2025; a documentação de 2026 é contextual, não métrica. |
| Acesso e reutilização | Os materiais foram acedidos publicamente sem autenticação. As condições de reutilização não são declaradas nas fontes municipais consultadas; apenas a consulta, descrição limitada e ligação de proveniência foram usadas. |

## Não-inferências

- A ausência de métricas localizadas não prova fiabilidade nem falha do serviço.
- Os valores RUV, isoladamente, não medem o desempenho da recolha regular, não provam prevalência e não permitem concluir melhoria ou deterioração.
- A disponibilidade pública de indicadores ERSAR não torna os seus períodos um comparador válido para a reestruturação de 2026.
- A entrada de viaturas, a reestruturação ou a monitorização anunciada não demonstram eficácia.
- `digital_tractability: low` não equivale a inevaliabilidade.

## Aplicação da regra de paragem

Aplica-se a condição de paragem «as métricas acessíveis não permitem uma comparação significativa antes/depois por incompatibilidade material de período, unidade, cobertura, definições, denominadores e alinhamento da reestruturação». A descoberta adicional em fontes públicas já consultadas não é proporcionalmente suscetível de alterar esta conclusão. Não foi tentado acesso não público.

## Resultado final delimitado

**`COMPARABILITY_NOT_ESTABLISHED`**

Foram encontradas métricas agregadas públicas relevantes, mas não um conjunto comparável suficiente para uma rota posterior de avaliação: faltam métricas pós-agosto de 2026 de recolha regular, alinhamento antes/depois, definições e contexto/denominadores.

## Delta canónico candidato e limites do WU

O relatório municipal de 2025 aparenta justificar um candidato local de `SRC/EVD` estritamente delimitado à disponibilidade de métricas RUV prévias, preparado em `.research-workbench/`. Não é evidência de desempenho da recolha regular nem altera o resultado acima. Não ocorreu Gate 1, integração canónica, alteração de `PRB-0009`/`SRC-*`/`EVD-*`, nem decisão humana de prontidão.

`WU028` não foi iniciada e permanece uma decisão humana dependente.
