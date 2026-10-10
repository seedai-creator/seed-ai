# Fase 10 — Goals & Metrics Engine

Data: 09/10/2026. Escopo: somente Fase 10. Fases 11 e 12 não iniciadas.

## RESUMO

Metas e indicadores passaram a ter estrutura, histórico, fontes, correções e cálculos determinísticos. A conversa identifica compromissos e resultados; o servidor valida evidências e persiste no mesmo processamento do Business Journal. O objetivo principal aparece em blocos simples nas telas existentes.

Fase concluída, publicada e aceita pelo titular em 09/10/2026. Implementação e migrações validadas; 353 testes passaram, além de lint, typecheck e build. Testes reais usaram exclusivamente empresas fictícias. O aceite geral do titular não representa uma auditoria automatizada de todas as combinações visuais.

## ARQUITETURA ENCONTRADA

Next.js App Router, autenticação e associação a empresas no Supabase, memória automática com identidade/versionamento, Journal com fila durável e relatórios, Business Model, diagnóstico, Execution Loop, simulador, Radar, pesquisa externa e controle comercial já existiam. Preservados seus contratos e a navegação.

## DECISÕES ARQUITETURAIS

- `goals` estende a identidade de um `business_memories` do tipo GOAL, com o mesmo UUID. Não cria uma memória paralela.
- Observações continuam em `business_journal_entries`. `metric_observations` é uma VIEW com `security_invoker`, não uma segunda tabela de resultados.
- O número pontual existe apenas na coluna `value`; o JSON guarda qualificadores, intervalos, período e escopo. Adaptadores recompõem o contrato de leitura.
- Resultados do Business Model e Execution Loop são lidos pelas fontes existentes. Fórmulas geram projeções calculadas, com rastreio dos operandos, sem replicar o histórico bruto.
- Extração integra a chamada já medida do Journal. Nenhum novo worker, scheduler, vector store, framework ou pacote foi adicionado.
- `SEED_GOALS_ENABLED=true` depende de `SEED_JOURNAL_ENABLED=true`. Desativar o primeiro interrompe a interface e a integração da fase; dados e trilhas persistem.

## MIGRATIONS

1. `202610090001_goals_metrics.sql`: metas, eventos, definições, vínculos, extensão do Journal, VIEW, RLS e funções transacionais. Aplicação confirmada pelo titular e estruturas verificadas remotamente.
2. `202610090002_goals_memory_integrity.sql`: corrigir a memória coloca sua meta estruturada em revisão; exclusão cancela o acompanhamento; alterações invalidam sinais dependentes do Radar. Aplicação confirmada pelo titular; correção e exclusão testadas em registro fictício no banco remoto.

Todas as migrações do repositório foram aplicadas em PostgreSQL PGlite durante a suíte. Não houve exclusão de dados empresariais reais nem alteração permanente de plano comercial.

## GOAL MODEL

Título, descrição, tipo, direção, baseline, alvo, unidade, moeda, cadência, datas, prazo/revisão, escopo, indicador, prioridade principal, meta pai, plano, motivo, critérios, períodos de consistência e etapas. Campos desconhecidos permanecem nulos. Metas antigas sem estrutura permanecem na memória e podem ser enriquecidas; não recebem números inferidos.

## GOAL TYPES

GROWTH, PROFITABILITY, EFFICIENCY, CUSTOMER, SALES, MARKETING, OPERATIONAL, CAPACITY, STRATEGIC, RISK_REDUCTION e GENERAL. Direções: INCREASE, DECREASE, MAINTAIN, REACH, RANGE e COMPLETE.

## GOAL STATES

DRAFT, ACTIVE, PAUSED, ACHIEVED, MISSED, CANCELLED e SUPERSEDED. Uma meta incompleta não pode ser ativada. A IA não grava ACHIEVED/MISSED por julgamento livre: o servidor verifica os critérios. A indicação calculada e a decisão explícita de registrar o estado são separadas. MAINTAIN exige acompanhamento; não é encerrada por uma observação isolada.

## GOAL VERSIONING

Versão otimista, motivo obrigatório, evento com estado anterior, chave de idempotência e bloqueio de alterações por aba desatualizada. Apenas uma meta principal ativa por empresa. Hierarquia limitada, sem ciclos ou referências a outra empresa. Corrigir/excluir pela tela legada de memória não deixa uma meta ativa com informação antiga.

## METRIC DEFINITIONS

Catálogo inicial de 35 indicadores: receita, vendas, leads, conversão, ticket, aquisição/CAC, anúncios/ROAS, capacidade, recompra, quatro margens distintas, entrega, resposta, custos, reembolsos, recorrência, frequência, retenção, critérios booleanos, status, estoque e produção/hora. Definições são específicas da empresa, criadas sob demanda. Indicador desconhecido mantém a meta em rascunho para esclarecimento; não há índice ou nota inventada.

## METRIC OBSERVATIONS

Valor pontual ou intervalo, booleano ou texto, unidade, moeda, início/fim, período completo/parcial, escopo, fonte, qualidade, confiança, evidência e versão. Correções guardam o estado anterior. A interface consulta histórico limitado; a ação de série oferece paginação de 50 registros. Não há soma automática de snapshots, percentuais ou estoques.

## SOURCES

CHAT, USER_EXPLICIT, MANUAL_EDIT, JOURNAL, DOCUMENT, IMPORT, INTEGRATION e SYSTEM_DERIVED distinguem proveniência. IMPORT/INTEGRATION são contratos preparados, não conectores de importação novos. Documentos são provisórios; pesquisa externa nunca vira desempenho interno. Identidades do Journal, Business Model e Execution Loop acompanham o contexto e as fórmulas.

## CONFIDENCE

Cobertura UNKNOWN/LIMITED/PARTIAL/SUFFICIENT/STRONG considera observações compatíveis e limites de consulta. Qualidade é independente de confiança. Dado conflitante, parcial, antigo ou de baixa confiança não gera progresso afirmado. Não é uma nota da empresa nem uma probabilidade estatística.

## APPROXIMATION / RANGE

Intervalos mantêm os dois extremos; não se usa ponto médio. Aproximação propaga para gap/progresso e reduz confiança. Um ponto aproximado não certifica meta atingida. Valores negativos de margem e resultados financeiros são possíveis; taxas de conversão/retenção e contagens têm limites próprios. Exibição usa formatação do idioma, sem conversão cambial.

## DERIVED METRICS

Calculadas somente com denominador positivo, mesma empresa/escopo/período, registros completos, qualidade válida e moedas compatíveis. ROAS exige receita atribuída explicitamente. Resultado contém fórmula, versão e IDs/versões das entradas. O contexto distingue GOAL, METRIC e DERIVED_METRIC; o diagnóstico real passou nessa validação.

## FORMULA REGISTRY

| Fórmula | Regra |
|---|---|
| conversion | vendas ÷ leads × 100 |
| average_ticket | receita ÷ vendas |
| cac | investimento em aquisição ÷ novos clientes |
| roas | receita atribuída ÷ gasto em anúncios |
| capacity_utilization | volume realizado ÷ capacidade conhecida × 100 |
| repeat_purchase_rate | clientes recorrentes ÷ clientes elegíveis × 100 |

Fórmulas são código versionado, sem execução de expressões fornecidas pela IA. Moeda não é convertida. Lacunas/denominador zero retornam ausência de cálculo, não zero.

## CONSISTENCY

Comparação exige identidade de escopo, unidade, moeda e cadência. Períodos parciais não são tratados como fechados; períodos CUSTOM_RANGE exigem compatibilidade com a duração de baseline. Correções manuais não são sobrescritas pela extração de conversa. Repetição do mesmo evento não é uma nova evidência independente. Meses distintos e consistência configurada são necessários para critérios sustentados.

## GOAL PROGRESS ENGINE

Para baseline/alvo pontuais: `(atual − baseline) / (alvo − baseline) × 100`, inclusive redução. A barra visual é limitada a 0–100%, mas o número informa o resultado real. Gap mantém sinal e unidade; 10%→15% são 5 pontos percentuais e 50% relativos. RANGE informa relação com a faixa, sem percentual inventado. COMPLETE só tem percentual quando o usuário informou pesos para todas as etapas.

## GOAL TRAJECTORY

Estados: dados insuficientes, acima/no/um pouco abaixo da referência, risco, atingida e prazo não atingido. Ritmo linear só aparece com baseline, início/prazo, pelo menos dois períodos compatíveis e sem aproximação/histórico truncado. Tolerâncias determinísticas: 5 pontos percentuais ao redor da referência; atraso acima de 15 pontos caracteriza AT_RISK. São convenções de acompanhamento, não previsão, probabilidade, benchmark ou causalidade.

Antiguidade conservadora por cadência: DAY 3 dias, WEEK 14, MONTH 62, QUARTER 120, YEAR 400, CUSTOM_RANGE 90. São limites do MVP, ainda sem personalização por indicador. Prazo passado sem resultado correspondente não implica automaticamente fracasso.

## LEADING / LAGGING INDICATORS

Vínculos suportam PRIMARY/SUPPORTING/GUARDRAIL e LEADING/LAGGING/CONTEXT. A semântica depende do que foi explicitamente definido. Não inferimos que mais leads causam receita ou que uma ação altera um indicador. A edição avançada desses vínculos permanece orientada pela conversa.

## GUARDRAILS

Limites mínimo/máximo explícitos, ligados ao mesmo escopo/período. Receita pode atingir alvo e margem violar proteção ao mesmo tempo. Limites inventados na extração são rejeitados. Guardrail sem observação, aproximado ou conflitante fica UNKNOWN. O Radar aplica seus controles de relevância e frequência.

## BUSINESS MODEL INTEGRATION

Usa entidades/observações existentes com estado, escopo e proveniência. Correções substituem a leitura antiga; indicadores estruturados do Journal não são novamente reduzidos a números exatos pelo adaptador legado. Não reconstrói o Business Model nem copia resultados.

## EXECUTION LOOP INTEGRATION

Lê `execution_results` como resultados de plano/experimento, com os IDs originais. Resultado de um plano não se torna receita de toda a empresa. Registro de execução e Journal com a mesma mensagem/indicador não é contado duas vezes. Meta pode apontar para plano; tela apresenta foco e próxima ação existentes. Concluir ação não significa atingir resultado.

## WEEKLY INTELLIGENCE INTEGRATION

Relatório incorpora contexto limitado de metas, progresso/gap calculados e limitações. A interface apresenta esses números separadamente do texto da IA. Fingerprint inclui versões das metas; geração identifica a versão 10. Leituras/exibição não chamam IA. Relatórios automáticos continuam sujeitos às regras PRO e ao orçamento existentes. O acumulador legado exclui intervalos/aproximações/provisórios e indicadores não aditivos.

## DECISION SIMULATOR INTEGRATION

O contexto de metas é carregado pelo orquestrador antes da análise/simulação existente: objetivo, limites, desempenho observado e valores derivados identificados. Simular não cria meta, resultado nem alteração de alvo. Fórmulas do simulador não foram substituídas. A integração foi revista no código e nas regressões; não foi feito novo ciclo autenticado de aceitação de simulação no navegador nesta fase.

## RADAR INTEGRATION

Sinais para desvio da referência, guardrail, marco atrasado, critério atingido e ausência/antiguidade de dados. Dados insuficientes ficam em observação com baixa confiança, sem alarme seguro. Fontes incluem versão da meta; alteração invalida o sinal. Mesmo scheduler, RLS, deduplicação, cooldown e orçamento de exibição. Nenhum novo agendamento ou notificação externa.

## EXTERNAL INTELLIGENCE INTEGRATION

Contexto externo continua em seu fluxo existente, com fontes e consentimentos próprios; não entra no ledger interno de métricas. O contexto de decisão pode usar meta interna e pesquisa identificada separadamente. Não há benchmark automático, importação automática de dados financeiros ou conversão de fonte externa em resultado confirmado.

## UI CHANGES

Blocos compactos na Home vazia, Minha Empresa e Diagnóstico; acompanhamento completo em Meu Plano Estratégico. Editar alvo/prazo/plano/status/prioridade exige motivo; registrar/corrigir resultado informa período e aproximação. Histórico e detalhes ficam recolhidos. Conversa permanece entrada principal. Sem novo item de navegação, dashboard de BI, gráfico de pontuação ou exposição do Business Journal como produto separado.

## APIs / SERVICES

`src/app/goals/actions.ts`: readGoals, writeGoal, writeMetric, readGoalHistory, readMetricSeries. Todas exigem sessão, empresa ativa e membership. `src/lib/goals`: domínio, ingestão, cálculo, contexto, leitura/persistência, adaptador de execução, Radar e traduções. Chamadas de IA continuam no servidor via SDK/Responses existente.

## RLS / SECURITY

RLS em goals, goal_events, metric_definitions e goal_metric_links; VIEW invoker sobre Journal protegido. Escrita direta por cliente negada. Funções privileged limitadas a service_role, com associação à empresa, UUIDs, referências compostas e versões. Wrapper aplica extração e objetivos na mesma transação; erro desfaz o lote. Backend valida schema, evidências e cálculos; nunca confia no company_id do cliente ou na autorização sugerida pelo modelo.

Teste local exercitou dois tenants reais no PostgreSQL, anônimo e escrita direta; teste remoto confirmou anônimo sem acesso. Não foi criado um segundo usuário Auth de produção para repetir todo o teste RLS remoto. 27 assets de cliente examinados: nenhum valor dos secrets de servidor configurados encontrado. Isso é evidência pontual, não auditoria completa de segurança.

## I18N

pt-BR, pt-PT, en-US e es-ES, com textos de UI e formatação Intl. Extração real em quatro idiomas/variantes. Moeda/fuso não são inferidos do idioma. Períodos relativos são resolvidos pelo software no fuso da empresa; fuso ausente impede acompanhamento temporal confiável.

## MODEL ROUTER

Sem modelo fixado na feature. Utiliza roteamento/tetos existentes e `OPENAI_MODEL`; structured extraction dentro do BUSINESS_JOURNAL_EXTRACTION. Metadado `goals_feature` permite identificar custo sem duplicá-lo. Progresso, gap, comparação, regras de estado e Radar não usam LLM.

## USAGE / COST

Autorização recebida: empresas fictícias, PRO temporário por até duas horas, máximo adicional US$ 2. Total acumulado contabilizado na auditoria de 09/10: **US$ 0,045062075**, incluindo tentativas que ajudaram a corrigir validações. Zero requisições UNKNOWN e zero overrides temporários ativos ao final. 13 jobs fictícios concluídos. Registros sintéticos permanecem claramente nomeados para preservar trilha financeira; não são métricas de produção do titular.

O custo observado não é previsão de custo por assinante. Modelos, limites de saída, tamanho do contexto e frequência de uso continuam determinantes. Visualizar/editar manualmente não chama a OpenAI; conversar segue os limites comerciais normais depois que o PRO de teste é restaurado.

## TESTS

353 testes aprovados: unidades, integrações, SQL transacional/RLS e regressões das fases anteriores. Casos da fase: baseline 80→100/atual 90, redução 5→3/atual 4, conversão pp/relativo, dados insuficientes, prazo, aproximações/faixas, guardrails, fórmulas, unidades/moedas/escopos/períodos, correção, versão, replay, rollback, hierarquia, fontes e memória.

IA/Supabase reais: faturamento mensal, correção 87→89 mil preservando histórico, leads/vendas e conversão derivada 12%, meta operacional, qualitativa sem pesos inventados, objetivo ambíguo em DRAFT, intervalo aproximado 90–95 mil e diagnóstico com evidência validada. Correção de versão de criação e evidência não contígua foi testada; payload já pago foi retomado sem segunda cobrança.

Comandos: `npm test`; avaliação opt-in em `scripts/verify-goals-live.mjs`; auditoria em `scripts/audit-goals-live.mjs`. Os testes reais exigem autorização e ledger vigente; não resetar o ledger para prolongar a janela.

## LINT

`npm run lint`: aprovado.

## TYPECHECK

`npm run typecheck`: aprovado. Compilação separada dos testes reais também aprovada.

## BUILD

`npm run build`: aprovado, 7 páginas estáticas geradas e rotas dinâmicas preservadas. Nenhuma dependência nova.

## PERFORMANCE

Consulta limitada: até 40 metas, 300 registros Journal, 200 observações Business Model e 100 resultados de execução; fontes auxiliares e combinações de fórmulas também limitadas. Contexto principal: no máximo duas metas/oito entradas. Limites atingidos reduzem cobertura e impedem confiança indevida na trajetória. Histórico tem paginação separada.

Amostra remota fictícia: leitura de cinco metas/oito observações em aproximadamente 573 ms; 500 cálculos locais em aproximadamente 12,4 ms. Não é teste de carga nem promessa de latência de produção. Múltiplas fontes exigem consultas paralelas; usuários com históricos grandes podem precisar de paginação/otimizações posteriores.

## LIMITAÇÕES

Metas antigas sem estrutura não ganham baseline/indicador automaticamente. Uma meta extraída pode permanecer em rascunho mesmo suficientemente definida, até revisão/ativação explícita. A extração é assíncrona; usar Atualizar se o worker ainda estiver processando. Histórico limitado pode omitir resultados antigos, identificado pela cobertura. Baseline/alvo em intervalo não recebem percentual exato. Valores aproximados não certificam cumprimento. Critérios temporais/heurísticas são gerais do MVP; não incorporam sazonalidade.

Não há interface de edição de fórmulas arbitrárias, conversão cambial, índice sintético, previsão estatística, atribuição causal, connectors ERP/ads, dashboard avançado ou migração semântica em massa de metas antigas. O histórico expandido da UI apresenta dez resultados por meta; paginação completa existe no serviço, sem novo explorador visual.

## TECHNICAL DEBT

Adicionar testes autenticados de browser quando a ferramenta estiver disponível; ampliar benchmarks de carga; personalizar validade por indicador caso dados reais justifiquem; melhorar recuperação de extração rejeitada sem cobrança duplicada; evoluir edição simples de vínculos e paginação sem transformar o MVP em BI.

## PHASE 11 READINESS

Metas, definições e observações com fontes e escopos fornecem base para Growth Map determinístico futuro. Nenhum score ou mapa foi implementado. Exige nova autorização.

## PHASE 12 READINESS

Leituras estruturadas permitem um cockpit futuro sobre dados reais. Home atual permanece simples. Nenhum dashboard avançado foi implementado. Exige nova autorização.

## MANUAL VALIDATION

Em 09/10/2026, após a publicação e a solicitação de conferir Meu Plano Estratégico, Minha Empresa e Diagnóstico, o titular confirmou **“TUDO CERTO”**. Aceite geral registrado. Não houve detalhamento por dispositivo, idioma ou cenário; preservamos abaixo os limites da cobertura técnica efetivamente realizada.

| Cenário | Evidência / estado |
|---|---|
| Receita e conversão | OpenAI + persistência reais; fórmulas testadas |
| Operação | Resultado real; meta fica DRAFT quando falta cadência explícita |
| Qualitativa | IA real, duas etapas sem pesos, sem progresso percentual inventado |
| Ambígua / sem baseline / alvo / prazo | IA real para ambígua; unidades e SQL para campos ausentes |
| Aproximação / intervalo | IA real e cálculo intervalar, sem ponto médio |
| Escopo / período / moeda conflitante | Unidades, integrações e RLS; não simulado visualmente |
| Correção de resultado / revisão de meta | Banco local/remoto e extração real; trilha preservada |
| Atingida / não atingida / guardrail | Unidades e validação de serviço; aceite geral recebido, sem relato visual individual |
| Radar / Weekly | Integração determinística, adaptações e regressões; aceite geral recebido, sem relato visual individual |
| Simulador | Contexto integrado e regressões; novo ciclo completo via UI não executado |
| Desktop / mobile | Aceite geral do titular; dispositivos não detalhados. Navegador automatizado indisponível |

### Como conferir no aplicativo

1. Em uma empresa de teste, diga: “Meu objetivo principal é aumentar o faturamento mensal de R$80 mil para R$100 mil até 31 de dezembro de 2026. Em setembro completo de 2026 faturamos R$90 mil.”
2. Abra Meu Plano Estratégico e clique Atualizar após o processamento. Confira meta, período, valor atual e gap; não espere uma previsão automática.
3. Corrija o resultado para R$89 mil e confira histórico. Ajuste alvo/prazo informando motivo. Nova conversa deve recuperar esses dados.
4. Confira Minha Empresa, Diagnóstico e Home; navegação deve permanecer simples. Teste também em tela estreita/celular.
5. Confira dados incompletos: “Quero melhorar minha empresa, ainda não defini indicador nem prazo.” A meta precisa de esclarecimento, sem números inventados.

Os testes anteriores de IA já foram pagos pelo orçamento temporário autorizado. Novas conversas do titular seguem o saldo real do seu plano, não um PRO permanente.

## TABELA FINAL

| Capability | Status | Source of Truth | Deterministic/AI | Tested | Notes |
|---|---|---|---|---|---|
| Goal Creation | Implementado | memory UUID + goals | IA extrai; servidor valida | Real + SQL | Rascunho quando incompleto |
| Goal Versioning | Implementado | goal_events | Determinístico | SQL | Versão/motivo/replay |
| Goal Status | Implementado | goals | Determinístico | Unit + SQL | Sem auto vitória pela IA |
| Metric Definitions | Implementado | metric_definitions | Catálogo | Unit + SQL | 35 indicadores |
| Metric Observations | Implementado | Journal | IA/manual + validação | Real + SQL | VIEW, sem ledger duplicado |
| Derived Metrics | Implementado | Inputs versionados | Determinístico | Unit | Projeção rastreável |
| Formula Registry | Implementado | Código | Determinístico | Unit | Seis fórmulas |
| Goal Progress | Implementado | Goal + observações | Determinístico | Unit + real | Unknown ≠ zero |
| Goal Trajectory | Implementado | Histórico comparável | Determinístico | Unit | Referência, não previsão |
| Leading Indicators | Estrutura/contexto | goal_metric_links | Explícito | Contrato | Sem causalidade |
| Lagging Indicators | Estrutura/contexto | goal_metric_links | Explícito | Contrato | Resultado separado de ação |
| Guardrails | Implementado | Links + resultados | Determinístico | Unit | Conflito → desconhecido |
| Plan Integration | Implementado | strategies/actions | Determinístico | SQL + revisão | Aceite geral do titular |
| Execution Loop Integration | Implementado | execution_results | Adaptador | Integração | Escopo preservado |
| Business Model Integration | Implementado | business_observations | Adaptador | Integração | Sem copiar dados brutos |
| Decision Simulator Integration | Contexto integrado | Goals/context engine | IA + regras existentes | Regressões | Ciclo visual específico não executado |
| Radar Integration | Implementado | Sinais derivados | Determinístico | Integração + SQL | Sem scheduler novo |
| External Intelligence Integration | Contexto separado | Research existente | IA + validação | Regressões | Externo não é resultado interno |
| RLS | Implementado | PostgreSQL | Determinístico | Dois tenants locais + anon remoto | Sem segundo Auth remoto |
| I18N | Implementado | Labels/Intl | Determinístico | Quatro idiomas/extração | Sem auditoria visual individual por idioma |
| Usage/Cost | Integrado | ai_requests/usage_logs | Determinístico | Real | PRO de teste restaurado |

## RISCOS E MITIGAÇÕES

| Risco | Mitigação existente | Limitação aberta |
|---|---|---|
| Dados incompletos | Nulos, rascunhos, missing/coverage | Depende do que usuário informa |
| Dados desatualizados | Validade por cadência e aviso | Heurística ainda geral |
| Metas mal definidas | Campos mínimos, direção e prazo | IA pode exigir revisão desnecessária |
| Métricas mal definidas | Catálogo/unidades distintos | Indicador fora do catálogo pede esclarecimento |
| Scope mismatch | Identidades e tenant exatos | Texto legado sem entidade pode não ser comparável |
| Period mismatch | Períodos fechados/mesma cadência | Sem agregação arbitrária ou ajuste sazonal |
| Currency mismatch | Igualdade de moeda; sem FX | Conversão cambial futura não implementada |
| Falsa precisão | Intervalos/≈; sem midpoint | Exibição monetária segue casas da moeda |
| Trajetória como previsão | Aviso explícito; critérios mínimos | Usuário ainda pode interpretar mal |
| Duplicação | UUID canônico, idempotência, adaptadores | Relatos independentes sem identidade podem conflitar |
| Performance | Limites/paginação/contexto reduzido | Sem teste de carga massivo |
| Custo de IA | Chamada compartilhada, teto, reserva/log | Contexto estruturado aumenta tokens da extração |
| Privacidade | Fontes limitadas, secrets no servidor | Dados internos selecionados chegam à OpenAI |
| Cross-tenant leakage | RLS, FKs, membership, serviço valida | Precisa manter auditoria em futuras funções |
| Overengineering | Reuso de Journal/memória/Radar | Complexidade de adapters deve ser monitorada |

## ESTADO DE PUBLICAÇÃO

**Publicada em produção em 09/10/2026, com autorização explícita do titular (“AUTORIZO”).** Duas migrações aplicadas e verificadas; flag `SEED_GOALS_ENABLED` habilitada localmente e em produção. Lint, typecheck, 353 testes e build aprovados; build remoto também concluído.

- Endereço: https://seed-ai-ashy.vercel.app
- Deployment: `dpl_2A5m3s7YvoKMvZeEgpvRhJKELSPF` — READY, target production.
- URL imutável: https://seed-6x2gwlc4a-joao13jgc-5689.vercel.app
- Verificações públicas concluídas às 10h13 (America/Sao_Paulo): login HTTP 200; Home e empresas redirecionam para login sem sessão; chat retorna 401 sem sessão; worker retorna 401 sem segredo. Nenhuma chamada de IA nessas verificações.
- Evidências locais: `.test-build/phase-10-deploy.log` e `.test-build/phase-10-production-smoke.json`.

**Aceite final recebido em 09/10/2026: “TUDO CERTO”. Fase 10 encerrada.** A ferramenta de navegador permaneceu indisponível; a confirmação visual veio do titular. Os limites de cobertura por dispositivo e cenário estão documentados acima. O encerramento não altera as limitações técnicas declaradas.
