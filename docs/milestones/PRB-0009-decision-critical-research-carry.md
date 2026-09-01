# PRB-0009 — Carry de investigação crítico para decisão

**Milestone:** `M007` — PRB-0009 Decision-Critical Research Carry
**Autoridade:** autorização explícita do owner, posterior ao fecho de D6
**Estado:** planeado; nenhuma unidade desta milestone foi iniciada

## Âmbito autorizado

M007 é um seguimento de investigação delimitado de D6. O seu objetivo é determinar se métricas operacionais agregadas, comparáveis e legitimamente acessíveis, já produzidas, podem resolver a incerteza de D6 sobre a reestruturação do serviço de resíduos de forma suficiente para uma futura decisão humana de prontidão de avaliação para `PRB-0009`.

M007 **não é D7** e não autoriza execução de avaliação, seleção de intervenção, produto, fornecedor ou arquitetura, promoção de PRB, nem uma fase geral subsequente do programa.

## WU027 — Operational Metrics Availability Research

**Pergunta de investigação:** existem métricas operacionais agregadas e comparáveis antes/depois da reestruturação, com unidade, período e cobertura definidos, suficientes para apoiar uma decisão humana de prontidão de avaliação para `PRB-0009`?

**Objetivo:** determinar se as métricas operacionais agregadas necessárias existem, são comparáveis, têm âmbito suficiente, são suficientemente atuais e são legitimamente acessíveis.

**Evidência mínima procurada:** séries agregadas por período e, quando aplicável, zona ou rota; métricas de atrasos, recolhas falhadas e tempo de resolução; definição, data e âmbito da mudança operacional; denominador ou contexto suficiente para comparação significativa entre períodos; informação de acesso e proveniência que estabeleça uso legítimo. Não são admitidos dados pessoais de pedidos individuais de serviço.

**Métodos permitidos:** inspeção prévia do corpus canónico; inspeção de fontes, dados, portais, documentos e metadados autoritativos ou publicamente disponíveis; identificação de se a entidade responsável aparenta deter métricas agregadas relevantes.

**Limites e paragem:** não há contacto institucional ou de stakeholders, pedidos de dados não públicos, trabalho de campo, recrutamento de residentes, execução de avaliação, pesquisa de soluções ou integração canónica sem Gate 1. Se métricas úteis aparentarem existir mas exigirem acesso não público, o resultado é `ACCESS_NOT_ESTABLISHED` e a investigação para. A investigação para também se não existir ou não for identificável proporcionalmente uma série agregada comparável, se o acesso legítimo e seguro não ficar estabelecido, se as métricas não distinguirem a reestruturação de variação operacional material, ou se descoberta adicional dificilmente alterar proporcionalmente a decisão de prontidão.

Os únicos resultados delimitados são `SUFFICIENT_METRICS_FOUND`, `INSUFFICIENT_METRICS`, `ACCESS_NOT_ESTABLISHED` e `COMPARABILITY_NOT_ESTABLISHED`. A presença ou ausência de dados não permite inferir melhoria ou falha do serviço.

## WU028 — Human Research Gate & Readiness Reassessment

**Dependência:** WU027 bloqueia WU028.

**Objetivo:** rever o resultado exato de WU027 e registar a disposição humana pós-investigação de `PRB-0009`, encerrando M007 e registando o handoff limitado do programa.

As únicas disposições finais permitidas são `EVALUATION_ROUTE_READY`, `CONDITIONAL` e `WATCH`. Não há disposição automática. Caso alterações candidatas a SRC/EVD sejam justificadas, devem seguir o processo normal de workbench e integração; Gate 1 continua obrigatório antes de qualquer integração canónica. A descoberta de WU027 não constitui por si só Evidence canónica.

## Fronteira de integração

Nenhum `PRB-0009`, `SRC-*` ou `EVD-*` é alterado durante este planeamento. M007 não cria trabalho de avaliação, não inicia WU027 e não autoriza integração canónica sem a decisão humana Gate 1 para o delta candidato específico.
