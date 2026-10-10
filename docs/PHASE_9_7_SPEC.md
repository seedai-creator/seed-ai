# ============================================================
# SEED AI | FASE 9.7
# SEED RADAR
# PROACTIVE BUSINESS INTELLIGENCE
# INTELIGÊNCIA EMPRESARIAL PROATIVA
# ============================================================

## 0. ORDEM DE EXECUÇÃO

Executar SOMENTE após:

- Fase 9.2 concluída e validada;
- Strategic Reliability Layer concluída;
- Fase 9.3 concluída e validada;
- Fase 9.4 concluída e validada;
- Fase 9.5 concluída e validada;
- Fase 9.6 concluída e validada.

Antes de alterar código:

1. inspecionar toda a arquitetura atual;
2. localizar SEED Brain;
3. localizar Strategic Reliability Layer;
4. localizar Business Memory;
5. localizar Business Journal invisível;
6. localizar Weekly Intelligence;
7. localizar Execution Loop;
8. localizar Business Model;
9. localizar Business Graph;
10. localizar BusinessModelBuilder;
11. localizar BusinessContextResolver;
12. localizar Decision Simulator;
13. localizar Decision Journal;
14. localizar Goals;
15. localizar Metrics;
16. localizar Diagnoses;
17. localizar Recommendations;
18. localizar Plans;
19. localizar Actions;
20. localizar Decisions;
21. localizar Experiments;
22. localizar Results;
23. localizar Learnings;
24. localizar Constraints;
25. localizar Capacity;
26. localizar Model Coverage;
27. localizar Consistency Engine;
28. localizar Model Router;
29. localizar usage/cost logging;
30. localizar RLS/multi-tenancy;
31. localizar i18n/markets;
32. localizar chat UI;
33. localizar Home;
34. localizar infraestrutura de badge/insight existente;
35. localizar scheduler/job/cron existente;
36. localizar analytics/eventos existentes;
37. localizar Admin existente;
38. localizar estruturas de configuração e feature flags.

REUTILIZAR estruturas existentes.

NÃO criar segundo sistema de métricas.

NÃO criar segundo sistema de notificações caso já exista infraestrutura adequada.

NÃO criar novo item principal de navegação.

NÃO iniciar Fase 9.8.

Ao terminar:

- executar migrations necessárias;
- executar lint;
- executar typecheck;
- executar testes unitários;
- executar testes de integração;
- executar testes RLS;
- executar build;
- realizar validação manual;
- entregar relatório técnico;
- PARAR;
- aguardar aprovação explícita.

# ============================================================
# 1. OBJETIVO
# ============================================================

Criar o:

SEED RADAR

Objetivo:

permitir que a SEED identifique mudanças, problemas, oportunidades, desvios, riscos e sinais relevantes na empresa sem depender exclusivamente de uma pergunta direta do usuário.

Fluxo atual:

EMPRESÁRIO PERGUNTA
↓
SEED ANALISA
↓
SEED RESPONDE

Fluxo com Radar:

DADOS / ACONTECIMENTOS MUDAM
↓
SEED OBSERVA
↓
DETECTA UM SINAL
↓
AVALIA RELEVÂNCIA
↓
AVALIA CONFIANÇA
↓
AVALIA IMPACTO E URGÊNCIA
↓
DECIDE SE DEVE PERMANECER EM OBSERVAÇÃO OU SER MOSTRADO
↓
TRAZ SOMENTE O QUE REALMENTE MERECE ATENÇÃO
↓
EMPRESÁRIO CONVERSA COM A SEED
↓
DIAGNÓSTICO / PLANO / DECISÃO
↓
RESULTADO
↓
APRENDIZADO

# ============================================================
# 2. PRINCÍPIO CENTRAL
# ============================================================

O Radar NÃO existe para gerar notificações.

O Radar existe para responder:

"Existe alguma coisa acontecendo nesta empresa que o empresário deveria perceber?"

Essa distinção é obrigatória.

# ============================================================
# 3. PROATIVIDADE COM DISCIPLINA
# ============================================================

A SEED não deve comentar qualquer mudança.

Uma inteligência que alerta sobre tudo se torna ruído.

Princípio:

SIGNAL > NOISE

O Radar deve preferir:

silêncio

a:

insight irrelevante.

# ============================================================
# 4. EXPERIÊNCIA DO USUÁRIO
# ============================================================

O usuário NÃO precisa abrir uma tela chamada Radar.

Quando houver algo realmente relevante, a SEED pode mostrar:

"Percebi algo que merece sua atenção."

Exemplo:

"Nas últimas três semanas, você continuou recebendo mais pessoas interessadas, mas proporcionalmente menos delas compraram.

Antes de aumentar o investimento em divulgação, vale entender o que está acontecendo no fechamento das vendas."

[Analisar comigo]

# ============================================================
# 5. NÃO CRIAR NOVO ITEM PRINCIPAL
# ============================================================

NÃO adicionar:

Radar
Alertas
Monitoramento
Central de sinais

à sidebar principal.

A navegação permanece:

+ Nova conversa

Conversas

Minha Empresa

Diagnóstico

Meu Plano Estratégico

Configurações

O Radar trabalha silenciosamente.

# ============================================================
# 6. O RADAR NÃO SUBSTITUI DIAGNÓSTICO
# ============================================================

Radar:

detecta sinal.

Diagnosis:

interpreta problema ou oportunidade.

Exemplo:

Radar detecta:

conversion caiu por três períodos.

Isso NÃO significa automaticamente:

diagnosis = sales process problem.

O Radar gera um sinal.

Strategic Reliability + Diagnosis investigam.

# ============================================================
# 7. O RADAR NÃO SUBSTITUI RECOMMENDATION
# ============================================================

Radar pode dizer:

"Isso merece atenção."

A recomendação estratégica continua utilizando:

Business Context
+
Strategic Reliability
+
Diagnosis
+
SEED Brain.

Não colocar toda a lógica estratégica dentro do detector de sinais.

# ============================================================
# 8. O RADAR NÃO SUBSTITUI WEEKLY INTELLIGENCE
# ============================================================

Weekly Intelligence:

faz revisão periódica estruturada.

Radar:

observa sinais entre as revisões.

Eles devem cooperar.

Não duplicar relatórios.

# ============================================================
# 9. O RADAR NÃO SUBSTITUI DECISION SIMULATOR
# ============================================================

Radar pode detectar:

"Capacidade operacional está próxima do limite."

Se o usuário perguntar:

"Vale comprar outra máquina?"

Decision Simulator analisa a decisão.

Separar responsabilidades.

# ============================================================
# 10. FONTES INTERNAS DO RADAR
# ============================================================

Radar deve utilizar inicialmente somente fontes internas autorizadas:

Business Journal

Metrics

Business Model

Business Graph

Goals

Diagnosis

Recommendations

Action Plans

Actions

Decisions

Experiments

Results

Learnings

Decision Simulations

Constraints

Capacity

Weekly Intelligence

Não implementar External Intelligence nesta fase.

# ============================================================
# 11. FUTURE EXTERNAL SIGNALS
# ============================================================

Preparar arquitetura para a Fase 9.8 adicionar:

market signals

competitor signals

economic signals

regulatory signals

trend signals

Mas não buscar esses dados agora.

# ============================================================
# 12. DOMÍNIOS INICIAIS
# ============================================================

Radar deve conseguir observar, quando existirem dados suficientes:

SALES

MARKETING

FINANCE

CUSTOMERS

OPERATIONS

CAPACITY

GOALS

EXECUTION

Não exigir que todas as empresas possuam todos os domínios.

# ============================================================
# 13. SALES RADAR
# ============================================================

Sinais possíveis:

sales declining

conversion declining

average ticket changing

sales concentration

sales growth

repeated lost-sale reasons

sales process delay

sales capacity pressure

Não assumir causa.

# ============================================================
# 14. MARKETING RADAR
# ============================================================

Sinais possíveis:

lead volume changing

CAC/CPL changing

marketing spend changing

conversion by channel changing

channel dependence

channel deterioration

channel opportunity

Não recomendar mais mídia automaticamente.

# ============================================================
# 15. FINANCE RADAR
# ============================================================

Quando houver dados suficientes:

revenue changing

margin changing

cost increasing

fixed-cost pressure

cash constraint worsening

revenue concentration

contribution deterioration

Não construir contabilidade nesta fase.

# ============================================================
# 16. CUSTOMER RADAR
# ============================================================

Sinais possíveis:

repeated complaints

repeated objections

retention changes

repeat purchase changes

customer segment changes

new recurring customer need

Não transformar relatos isolados em padrão.

# ============================================================
# 17. OPERATIONS RADAR
# ============================================================

Sinais possíveis:

delivery delays

production delays

service delays

capacity pressure

quality problems

operational bottlenecks

supplier dependency quando internamente conhecida

# ============================================================
# 18. CAPACITY RADAR
# ============================================================

Sinais possíveis:

utilization approaching known capacity

volume exceeding capacity

sales growth exceeding delivery capacity

team capacity pressure

capacity underutilization

Não inferir capacidade se ela for desconhecida.

# ============================================================
# 19. GOAL RADAR
# ============================================================

Comparar, quando possível:

actual progress

vs

goal trajectory.

Sinais:

on track

behind trajectory

ahead of trajectory

goal at risk

goal achieved

Não criar trajetória artificial se a meta não possuir período ou estrutura suficiente.

# ============================================================
# 20. EXECUTION RADAR
# ============================================================

Observar:

actions blocked

important actions overdue

experiments ending

results missing

decisions awaiting review

plans stalled

assumptions contradicted by results

Não transformar SEED em gerenciador de tarefas.

Mostrar somente quando isso afeta a estratégia.

# ============================================================
# 21. SIGNAL
# ============================================================

Criar conceito central:

RADAR SIGNAL

Signal representa:

uma mudança, padrão, desvio, risco ou oportunidade potencialmente relevante.

Signal NÃO é automaticamente:

diagnosis

insight mostrado ao usuário

recommendation.

# ============================================================
# 22. SIGNAL TYPES
# ============================================================

Suportar inicialmente:

CHANGE

TREND

ANOMALY

THRESHOLD

REPETITION

GOAL_DEVIATION

CAPACITY_PRESSURE

EXECUTION_RISK

OPPORTUNITY

RISK

ASSUMPTION_DEVIATION

Estrutura extensível.

# ============================================================
# 23. CHANGE
# ============================================================

Exemplo:

average ticket:

500
→
430.

Uma mudança isolada pode ou não ser relevante.

Radar avalia contexto.

# ============================================================
# 24. TREND
# ============================================================

Exemplo:

conversion:

12%
→
10%
→
8%.

Tendência persistente pode possuir relevância maior que uma mudança isolada.

# ============================================================
# 25. ANOMALY
# ============================================================

Valor foge significativamente do padrão histórico interno conhecido.

Não implementar algoritmo estatístico complexo sem necessidade.

Pode começar com regras determinísticas defensáveis.

# ============================================================
# 26. THRESHOLD
# ============================================================

Exemplo:

capacity known ≈ 100 orders/day.

Current:
95.

Pode gerar:

capacity pressure signal.

Threshold deve vir de:

known capacity

goal

business rule

explicit user threshold

experiment criterion

decision criterion

Não inventar limiar universal.

# ============================================================
# 27. REPETITION
# ============================================================

Exemplo:

cliente reclamou de prazo uma vez.

Isso não necessariamente gera sinal.

Reclamações semelhantes aparecem repetidamente.

Pode gerar:

repeated delivery complaint signal.

# ============================================================
# 28. GOAL DEVIATION
# ============================================================

Exemplo:

goal:

R$120k/month até determinado período.

Progress:

consistent below required trajectory.

Pode gerar sinal.

Não criar se os dados forem insuficientes.

# ============================================================
# 29. CAPACITY PRESSURE
# ============================================================

Exemplo:

known comfortable capacity:
80 orders/day.

Recent volume:
78
82
85.

Radar pode detectar pressão.

Não afirmar:

"Operação vai colapsar."

# ============================================================
# 30. EXECUTION RISK
# ============================================================

Exemplo:

plano estratégico depende de ação importante.

Ação está bloqueada por período relevante.

Isso pode ameaçar objetivo.

Radar pode trazer:

"Seu plano está parado neste ponto."

Somente quando estrategicamente relevante.

# ============================================================
# 31. OPPORTUNITY SIGNAL
# ============================================================

Radar não deve procurar apenas problemas.

Exemplo:

Produto X:

sales ↑

margin healthy

repeat purchase ↑

por múltiplos períodos.

Pode gerar:

"Existe uma oportunidade aqui que vale analisar."

Não concluir automaticamente:

"Invista tudo no Produto X."

# ============================================================
# 32. RISK SIGNAL
# ============================================================

Exemplo:

revenue concentration em um único cliente ou canal, quando dado conhecido.

Pode sinalizar risco.

Não dramatizar.

# ============================================================
# 33. ASSUMPTION DEVIATION
# ============================================================

Decision Simulator assumiu:

CPL permaneceria próximo de R$10.

Após decisão:

CPL observado = R$14.

Radar pode detectar:

premissa relevante não está se sustentando.

Essa é uma integração importante entre 9.6 e 9.7.

# ============================================================
# 34. SIGNAL PIPELINE
# ============================================================

Fluxo:

NEW DATA / EVENT
↓
NORMALIZATION
↓
DETERMINISTIC CHECKS
↓
PATTERN / CHANGE DETECTION
↓
SIGNAL CREATED
↓
RELEVANCE GATE
↓
CONFIDENCE
↓
IMPACT
↓
URGENCY
↓
NOVELTY
↓
USER CONTEXT
↓
SUPPRESSION / SURFACE
↓
IF SURFACED:
USER-FACING INSIGHT
↓
CONVERSATION
↓
DIAGNOSIS / ACTION

# ============================================================
# 35. RADAR ENGINE
# ============================================================

Criar serviço equivalente:

SeedRadarEngine

Responsabilidades:

consume relevant business changes

evaluate rules

detect signals

deduplicate signals

merge related signals

evaluate relevance

apply suppression

persist signals

decide surfacing

trigger safe presentation

Não concentrar toda a lógica em um prompt de LLM.

# ============================================================
# 36. DETERMINISTIC FIRST
# ============================================================

Usar código/SQL para:

percentage changes

moving comparisons

known thresholds

goal deviation

capacity utilization

action deadlines

experiment end dates

assumption vs observed value

repetition counts.

Usar IA para:

semantic grouping

qualitative pattern interpretation

strategic relevance assistance

natural-language explanation

quando necessário.

# ============================================================
# 37. RELEVANCE GATE
# ============================================================

Criar:

RADAR RELEVANCE GATE

Antes de mostrar um sinal ao usuário, avaliar:

IMPACT

CONFIDENCE

URGENCY

NOVELTY

PERSISTENCE

STRATEGIC RELEVANCE

ACTIONABILITY

DATA QUALITY

ALERT FATIGUE

# ============================================================
# 38. RELEVANCE NÃO É SCORE ARBITRÁRIO
# ============================================================

Não pedir ao modelo:

"Dê uma nota de 0 a 100."

Preferir dimensões explícitas.

Pode existir representação interna estruturada.

Não criar score arbitrário para o usuário.

# ============================================================
# 39. IMPACT
# ============================================================

Impacto potencial sobre:

revenue

margin

customers

operations

capacity

goal

strategic plan

Pode ser:

LOW

MODERATE

HIGH

ou equivalente.

# ============================================================
# 40. CONFIDENCE
# ============================================================

Reutilizar Strategic Reliability.

Confidence considera:

source quality

data completeness

consistency

sample size quando relevante

repetition

recency

conflicts.

Não significa probabilidade de que algo ruim acontecerá.

# ============================================================
# 41. URGENCY
# ============================================================

Distinguir:

LOW

MODERATE

HIGH

Exemplo:

capacidade se aproximando gradualmente do limite

vs

decisão importante prestes a ser executada com premissa invalidada.

# ============================================================
# 42. NOVELTY
# ============================================================

Não alertar repetidamente sobre a mesma coisa.

Se o usuário já foi informado:

"Conversão caiu."

e nada material mudou:

não repetir diariamente.

# ============================================================
# 43. PERSISTENCE
# ============================================================

Sinal persistente pode ganhar relevância.

Exemplo:

queda isolada

vs

queda por quatro períodos.

# ============================================================
# 44. ACTIONABILITY
# ============================================================

Pergunta:

"Existe algo útil que o empresário possa fazer com essa informação?"

Se não:

pode não valer interrupção.

# ============================================================
# 45. DATA QUALITY
# ============================================================

Radar deve considerar:

coverage

staleness

missing periods

scope consistency

source

approximation

conflicts.

Não gerar insight forte a partir de dado fraco.

# ============================================================
# 46. ALERT FATIGUE
# ============================================================

Implementar proteção contra excesso de sinais.

Considerar:

quantos Insights recentes foram mostrados

mesmo domínio

mesmo problema

mesma métrica

mesmo Insight

mesma causa provável.

Não inundar o usuário.

# ============================================================
# 47. INTERNAL SIGNAL LEVELS
# ============================================================

Pode utilizar internamente:

OBSERVE

ATTENTION

HIGH_ATTENTION

Evitar linguagem alarmista.

# ============================================================
# 48. OBSERVE
# ============================================================

Sinal interessante, mas ainda insuficiente para interromper.

Persistir internamente quando útil.

Continuar observando.

# ============================================================
# 49. ATTENTION
# ============================================================

Sinal suficientemente relevante para aparecer quando o usuário entrar ou em contexto apropriado.

Exemplo:

"Percebi algo que merece sua atenção."

# ============================================================
# 50. HIGH ATTENTION
# ============================================================

Sinal material, confiável e potencialmente urgente.

Pode ganhar maior destaque dentro do produto.

Ainda assim:

não dramatizar.

# ============================================================
# 51. SIGNAL STATE
# ============================================================

Estados possíveis:

DETECTED

OBSERVING

READY_TO_SURFACE

SURFACED

ACKNOWLEDGED

INVESTIGATING

RESOLVED

DISMISSED

SUPERSEDED

Adaptar à arquitetura existente.

# ============================================================
# 52. SIGNAL PERSISTENCE
# ============================================================

Criar/adaptar estrutura equivalente:

radar_signals

Campos conceituais:

id

company_id

signal_type

domain

title_internal

description_internal

status

attention_level

impact

confidence

urgency

novelty

persistence

actionability

first_detected_at

last_observed_at

surfaced_at nullable

resolved_at nullable

source_type

source_references

related_metric_ids

related_goal_id nullable

related_diagnosis_id nullable

related_plan_id nullable

related_decision_id nullable

related_experiment_id nullable

related_simulation_id nullable

rule_id nullable

rule_version nullable

metadata

created_at

updated_at

Não seguir cegamente caso o schema atual ofereça solução melhor.

# ============================================================
# 53. SIGNAL EVIDENCE
# ============================================================

Cada sinal deve possuir evidência rastreável.

Exemplo:

conversion trend:

Week 1 = 12%

Week 2 = 10%

Week 3 = 8%

Não armazenar somente:

"Conversão está piorando."

# ============================================================
# 54. SIGNAL SOURCE
# ============================================================

Fontes possíveis:

METRIC

JOURNAL

BUSINESS_MODEL

EXECUTION_LOOP

DECISION

EXPERIMENT

RESULT

LEARNING

DECISION_SIMULATION

WEEKLY_INTELLIGENCE

SYSTEM_DERIVED

Um sinal pode possuir múltiplas fontes.

Preservar provenance.

# ============================================================
# 55. SIGNAL DEDUPLICATION
# ============================================================

Evitar múltiplos sinais representando o mesmo fenômeno.

Exemplo:

Signal A:
conversion declining.

Signal B:
fewer leads becoming sales.

Signal C:
sales conversion deterioration.

Se representam a mesma situação:

agrupar ou enriquecer sinal existente.

Não gerar três Insights.

# ============================================================
# 56. SIGNAL FINGERPRINT
# ============================================================

Criar estratégia equivalente a:

company_id
+
domain
+
signal_type
+
affected_entity
+
metric
+
scope

para auxiliar deduplicação.

Não depender somente de comparação textual.

# ============================================================
# 57. SIGNAL MERGING
# ============================================================

Sinais relacionados podem formar Insight mais relevante.

Exemplo:

leads ↑

conversion ↓

sales stable

Pode ser apresentado como:

"Você está atraindo mais pessoas, mas esse crescimento não está se transformando proporcionalmente em vendas."

Preservar evidências individuais.

# ============================================================
# 58. SIGNAL CLUSTERING
# ============================================================

Quando múltiplos sinais apontarem para a mesma área:

agrupar quando semanticamente defensável.

Exemplo:

delivery delays

customer complaints about delivery

capacity utilization high

Podem formar cluster:

OPERATIONAL DELIVERY PRESSURE.

Mas isso ainda não é diagnóstico confirmado.

# ============================================================
# 59. SIGNAL ≠ DIAGNOSIS
# ============================================================

Mesmo um cluster forte não deve virar causa confirmada automaticamente.

Exemplo:

delivery delay
+
capacity high

pode sugerir:

"Capacidade pode estar contribuindo."

Não:

"Capacidade é definitivamente a causa."

# ============================================================
# 60. SEMANTIC REPETITION
# ============================================================

Business Journal pode registrar:

"cliente reclamou da demora"

"pedido atrasou"

"entrega levou muito tempo"

IA pode ajudar a identificar relação semântica.

O agrupamento deve preservar:

source

date

context

confidence.

# ============================================================
# 61. TREND DETECTION
# ============================================================

Implementar detecção determinística de tendência quando os dados permitirem.

Exemplos iniciais:

consecutive increase

consecutive decrease

change relative to previous comparable period

moving average deviation quando justificável

goal trajectory deviation.

Documentar regras.

# ============================================================
# 62. MINIMUM DATA FOR TREND
# ============================================================

Não chamar duas observações automaticamente de tendência forte.

Definir critérios por tipo de sinal.

Exemplo:

TREND pode exigir:

3 períodos comparáveis

quando apropriado.

Permitir regras específicas quando o domínio exigir.

# ============================================================
# 63. COMPARABLE PERIODS
# ============================================================

Somente comparar períodos compatíveis.

Exemplo:

segunda-feira

vs

mês inteiro

não é comparação válida.

Respeitar:

period length

scope

entity

location

channel

product

currency.

# ============================================================
# 64. PARTIAL PERIODS
# ============================================================

Não comparar:

semana atual até terça-feira

com

semana anterior completa

como se fossem equivalentes.

Pode:

normalizar quando matematicamente defensável

ou

aguardar período completo

ou

indicar limitação.

# ============================================================
# 65. SEASONALITY
# ============================================================

Nesta fase:

não inventar sazonalidade.

Se Business Model e histórico interno possuírem evidência suficiente:

pode considerar padrão interno.

Não utilizar sazonalidade externa antes da Fase 9.8.

# ============================================================
# 66. ANOMALY DETECTION
# ============================================================

Começar com abordagem simples e defensável.

Possíveis métodos:

deviation from recent baseline

percentage deviation

rolling average

known business threshold

historical range.

Não implementar ML complexo sem necessidade.

# ============================================================
# 67. ANOMALY SAFETY
# ============================================================

Um valor diferente não significa problema.

Exemplo:

sales +40%.

Pode ser oportunidade.

Outro:

cost +40%.

Pode ser planejado.

Contexto importa.

# ============================================================
# 68. BASELINE
# ============================================================

Radar deve possuir baseline quando necessário.

Baseline pode vir de:

previous comparable period

rolling historical period

explicit target

Decision Simulation baseline

Experiment baseline

known capacity.

Guardar definição do baseline.

# ============================================================
# 69. BASELINE VERSION
# ============================================================

Se regra ou baseline mudar:

preservar versão quando relevante.

Isso permite explicar por que o sinal foi criado.

# ============================================================
# 70. THRESHOLD RULES
# ============================================================

Criar sistema configurável de regras.

Exemplo conceitual:

metric = capacity_utilization

condition = >= configured threshold

scope = operation

Somente utilizar threshold quando houver justificativa.

Não hardcode 90% universalmente.

Threshold pode vir de:

user-defined limit

Business Model capacity

experiment criterion

decision criterion

goal threshold

domain rule validada.

# ============================================================
# 71. USER-DEFINED THRESHOLD
# ============================================================

Usuário pode dizer:

"Se nossa conversão cair abaixo de 10%, quero prestar atenção."

Isso pode gerar regra interna.

Não exigir tela complexa de configuração nesta fase.

Pode ser capturado naturalmente pela conversa.

# ============================================================
# 72. DECISION-DEFINED THRESHOLD
# ============================================================

Decision Simulator pode produzir:

"Reavaliar contratação quando o tempo de resposta ultrapassar X."

Radar pode observar esse indicador.

Integração:

9.6
→
9.7.

# ============================================================
# 73. EXPERIMENT-DEFINED THRESHOLD
# ============================================================

Experiment pode possuir:

evaluation criteria.

Radar pode detectar:

criterion reached

criterion missed

experiment ending.

Não substituir Experiment Analyzer.

# ============================================================
# 74. GOAL-DEFINED THRESHOLD
# ============================================================

Goal pode possuir:

target

deadline

milestones.

Radar pode observar progresso.

Não criar milestones arbitrários se Goal não possuir base suficiente.

# ============================================================
# 75. RADAR RULE ENGINE
# ============================================================

Criar serviço equivalente:

RadarRuleEngine

Responsabilidades:

evaluate deterministic rules

evaluate thresholds

evaluate trends

evaluate repetitions

evaluate goal deviations

evaluate execution risks

evaluate simulation assumption deviations

Não usar LLM para regras matemáticas simples.

# ============================================================
# 76. RULE REGISTRY
# ============================================================

Criar registry e versionamento de regras.

Exemplos conceituais:

METRIC_TREND_V1

CAPACITY_PRESSURE_V1

GOAL_DEVIATION_V1

REPEATED_PROBLEM_V1

ACTION_BLOCKED_V1

EXPERIMENT_ENDING_V1

ASSUMPTION_DEVIATION_V1

Não precisa usar exatamente esses nomes.

# ============================================================
# 77. RULE VERSION
# ============================================================

Cada sinal criado por regra deve indicar:

rule_id

rule_version

Isso permite evolução sem tornar sinais históricos inexplicáveis.

# ============================================================
# 78. RULE CONFIGURATION
# ============================================================

Regras devem aceitar parâmetros quando apropriado.

Evitar valores espalhados pelo código.

Exemplos:

minimum_periods

comparison_window

minimum_repetition

attention threshold

cooldown

max_surface_frequency.

# ============================================================
# 79. RELEVANCE ENGINE
# ============================================================

Criar serviço equivalente:

RadarRelevanceEngine

Entrada:

signal

business context

recent surfaced signals

goal

active diagnosis

active plan

user activity

data quality

preferences.

Saída:

attention_level

should_surface

surface_mode

reason_summary

suppression_reason nullable.

# ============================================================
# 80. DETERMINISTIC + AI HYBRID
# ============================================================

Relevance Engine pode combinar:

regras determinísticas

+

Strategic Model

somente quando necessário.

Exemplo:

numeric deterioration clara:

determinístico.

cluster qualitativo complexo:

Strategic Model pode ajudar.

# ============================================================
# 81. STRATEGIC RELIABILITY
# ============================================================

Todo Insight proativo deve respeitar Reliability Layer.

Antes de afirmar:

"O problema é X."

avaliar:

facts

hypotheses

missing information

confidence

sufficiency.

Radar pode trazer sinal sem diagnóstico definitivo.

# ============================================================
# 82. RADAR INSIGHT
# ============================================================

Criar conceito:

RADAR INSIGHT

Signal é interno.

Insight é apresentação ao usuário.

Um Insight pode representar:

um sinal

ou

um cluster de sinais.

# ============================================================
# 83. INSIGHT STRUCTURE
# ============================================================

Criar/adaptar estrutura equivalente:

radar_insights

Campos conceituais:

id

company_id

signal_ids

title

summary

why_it_matters

evidence_summary

suggested_next_step

attention_level

surface_mode

status

created_at

surfaced_at nullable

acknowledged_at nullable

dismissed_at nullable

resolved_at nullable

metadata

Adaptar ao schema existente.

# ============================================================
# 84. USER-FACING LANGUAGE
# ============================================================

Não mostrar:

ANOMALY DETECTED

THRESHOLD BREACH

ATTENTION_LEVEL_HIGH

SIGNAL_CLUSTER

Mostrar:

"Percebi algo que merece sua atenção."

"Isso começou a se repetir."

"Seus números mudaram neste ponto."

"Existe uma oportunidade aqui."

# ============================================================
# 85. EXAMPLE — CONVERSION
# ============================================================

Dados:

Week 1:
12%

Week 2:
10%

Week 3:
8%

Insight:

"Percebi uma mudança nas suas vendas.

Nas últimas três semanas, proporcionalmente menos pessoas interessadas estão comprando.

Antes de buscar ainda mais interessados, vale entender o que está acontecendo no fechamento."

[Analisar comigo]

Não afirmar causa.

# ============================================================
# 86. EXAMPLE — CAPACITY
# ============================================================

Business Model:

comfortable capacity ≈ 80 orders/day.

Recent:

76
81
84.

Insight:

"Seu volume de pedidos começou a passar da faixa que você informou como confortável para a operação.

Isso pode começar a pressionar prazos e qualidade se o volume continuar subindo."

[Analisar capacidade]

# ============================================================
# 87. EXAMPLE — OPPORTUNITY
# ============================================================

Produto A:

sales increasing

margin healthy

repeat purchase increasing

por períodos suficientes.

Insight:

"Existe uma oportunidade que vale analisar.

O Produto A vem ganhando participação nas suas vendas e continua apresentando margem saudável nos dados disponíveis.

Pode valer entender se existe espaço para dar mais destaque a ele."

[Analisar oportunidade]

# ============================================================
# 88. EXAMPLE — GOAL
# ============================================================

Goal:

R$120k/month.

Trajetória abaixo do necessário.

Insight:

"Sua meta está começando a se distanciar do ritmo atual.

Com o desempenho registrado até aqui, vale revisar o plano antes de simplesmente aumentar o esforço."

[Revisar comigo]

# ============================================================
# 89. EXAMPLE — DECISION ASSUMPTION
# ============================================================

Decision Simulation:

CPL assumption = 10.

Observed:

14.

Insight:

"Uma das premissas da decisão que tomamos mudou.

Quando avaliamos o aumento de mídia, trabalhamos com custo por lead próximo de R$10. O valor observado agora está em torno de R$14.

Vale revisar se a decisão ainda faz sentido."

[Revisar decisão]

# ============================================================
# 90. EXAMPLE — ACTION BLOCKED
# ============================================================

Plano depende de ação importante.

Ação permanece bloqueada.

Insight, somente se estrategicamente relevante:

"Seu plano está parado em um ponto importante.

A próxima etapa depende da revisão da oferta, que continua bloqueada.

Quer que eu te ajude a destravar isso?"

# ============================================================
# 91. INSIGHT CTA
# ============================================================

CTAs devem levar principalmente à conversa.

Exemplos:

[Analisar comigo]

[Entender melhor]

[Revisar decisão]

[Continuar plano]

[Ver o que fazer]

Não criar fluxo isolado desnecessário.

# ============================================================
# 92. INSIGHT → CONVERSATION
# ============================================================

Ao clicar:

abrir conversa com contexto do Insight.

Exemplo:

"Quero entender essa queda na conversão."

SEED já recebe:

signal

evidence

related metrics

Business Model context.

Não fazer usuário repetir tudo.

# ============================================================
# 93. INSIGHT → DIAGNOSIS
# ============================================================

Quando a conversa confirmar problema:

pode criar ou atualizar Diagnosis.

Não criar Diagnosis automaticamente para todo Insight.

# ============================================================
# 94. INSIGHT → PLAN
# ============================================================

Se análise produzir recomendação:

pode utilizar Execution Loop.

Não criar plano diretamente a partir de sinal sem análise suficiente.

# ============================================================
# 95. INSIGHT → DECISION SIMULATOR
# ============================================================

Se sinal levar a decisão:

exemplo:

capacity pressure.

Usuário pergunta:

"Então vale comprar outra máquina?"

Acionar Decision Simulator.

# ============================================================
# 96. INSIGHT ACKNOWLEDGEMENT
# ============================================================

Usuário pode:

abrir

ignorar

dismiss

investigar

resolver por conversa.

Não exigir:

"Confirmar alerta."

# ============================================================
# 97. DISMISS
# ============================================================

Se usuário disser:

"Isso não é relevante."

ou usar ação equivalente:

marcar Insight/Sinal como DISMISSED quando apropriado.

Usar feedback para reduzir repetição.

Não apagar evidência histórica necessariamente.

# ============================================================
# 98. FALSE POSITIVE FEEDBACK
# ============================================================

Permitir registrar internamente:

NOT_RELEVANT

WRONG_CONTEXT

ALREADY_KNOWN

INSUFFICIENT_DATA

ou equivalente.

Não criar interface complexa.

# ============================================================
# 99. COOLDOWN
# ============================================================

Depois de um Insight ser mostrado:

aplicar cooldown quando apropriado.

Não mostrar a mesma mensagem repetidamente.

Cooldown pode depender de:

signal type

domain

materiality

new evidence

user feedback.

# ============================================================
# 100. RESURFACE
# ============================================================

Sinal pode reaparecer se:

piora materialmente

nova evidência aparece

impacto aumenta

contexto muda

usuário não resolveu e situação se torna mais relevante.

Não resurfacing apenas porque passou tempo.

# ============================================================
# 101. RESOLUTION
# ============================================================

Signal pode ser RESOLVED quando:

metric normalizes

problem stops repeating

capacity pressure decreases

action unblocked

goal recovered

decision assumption reviewed

diagnosis resolved

conforme regra.

# ============================================================
# 102. SUPERSEDED
# ============================================================

Sinal pode ser SUPERSEDED quando um novo sinal representa melhor a situação.

Exemplo:

"conversion declining"

é substituído por:

"conversion stabilized after intervention."

Preservar histórico.

# ============================================================
# 103. POSITIVE RESOLUTION
# ============================================================

Radar pode reconhecer melhora relevante.

Exemplo:

"Depois das mudanças no atendimento, sua conversão voltou para perto do nível anterior."

Não transformar o aplicativo em sistema de gamificação.

Registrar apenas quando estrategicamente útil.

# ============================================================
# 104. HOME INTEGRATION
# ============================================================

Home continua tendo como protagonista:

"O que você precisa resolver no seu negócio hoje?"

Não substituir por dashboard Radar.

Quando houver Insight relevante:

mostrar abaixo de forma discreta.

Exemplo:

O QUE MERECE SUA ATENÇÃO

Conversão caiu nas últimas semanas.

[Analisar comigo]

# ============================================================
# 105. HOME PRIORITY
# ============================================================

Mostrar no máximo poucos Insights.

Preferência inicial:

1 principal.

No máximo 2 quando realmente necessário.

Não mostrar feed infinito de alertas.

# ============================================================
# 106. CHAT INTEGRATION
# ============================================================

Durante a conversa, a SEED pode mencionar Insight relevante quando o contexto combinar.

Exemplo:

Usuário:

"Quero aumentar os anúncios."

Radar possui:

conversion decline.

SEED:

"Antes disso, tem um ponto importante: sua conversão vem caindo nas últimas semanas..."

Isso pode ser melhor que mostrar Insight separado.

# ============================================================
# 107. CONTEXTUAL SURFACING
# ============================================================

Um sinal pode não merecer interromper a Home, mas pode ser altamente relevante durante uma conversa específica.

Exemplo:

margin decline.

Usuário pergunta sobre desconto.

Radar Signal deve entrar no contexto.

# ============================================================
# 108. SURFACING MODES
# ============================================================

Suportar internamente:

HOME

CONVERSATION_CONTEXT

WEEKLY_INTELLIGENCE

DIAGNOSIS_CONTEXT

PLAN_CONTEXT

Não implementar notificações externas nesta fase.

# ============================================================
# 109. NO PUSH IN THIS PHASE
# ============================================================

Não implementar:

iOS push

Android push

WhatsApp alert

SMS

email alert

nesta fase.

Radar funciona dentro do produto.

# ============================================================
# 110. BADGE
# ============================================================

Se infraestrutura já existir:

pode utilizar badge discreto.

Exemplo:

um ponto indicador.

Não criar contadores alarmistas como:

"17 ALERTAS".

# ============================================================
# 111. WEEKLY INTELLIGENCE INTEGRATION
# ============================================================

Weekly Intelligence deve poder consumir Radar Signals relevantes.

Exemplo:

"Esta semana, a SEED identificou pressão crescente na capacidade operacional."

Não repetir todos os Insights.

# ============================================================
# 112. RADAR → WEEKLY REVIEW
# ============================================================

Weekly Review pode:

confirmar

rebaixar

resolver

escalar

um sinal.

Não criar dois estados conflitantes.

# ============================================================
# 113. EXECUTION LOOP INTEGRATION
# ============================================================

Radar deve observar:

Plan

Action

Decision

Experiment

Result

Learning.

Exemplo:

ação concluída, mas indicador não melhora.

Pode gerar sinal:

expected signal not observed.

# ============================================================
# 114. EXPECTED SIGNAL
# ============================================================

Actions e Recommendations da 9.4 podem possuir:

expected_signal.

Radar pode verificar quando os dados permitirem.

Exemplo:

Action:
new sales follow-up.

Expected:
conversion improvement.

Depois de período apropriado:

nenhuma melhora observada.

Radar pode sinalizar.

# ============================================================
# 115. NO PREMATURE JUDGMENT
# ============================================================

Não avaliar resultado cedo demais.

Respeitar:

review date

experiment period

decision horizon

data sufficiency.

# ============================================================
# 116. EXPERIMENT INTEGRATION
# ============================================================

Radar pode observar:

experiment ending

metric deviation

criteria reached

result missing.

A análise final do experimento continua no Execution Loop.

# ============================================================
# 117. DECISION SIMULATOR INTEGRATION
# ============================================================

Radar deve poder observar:

accepted scenario

assumptions

primary indicators

decision review date

observed result.

# ============================================================
# 118. ASSUMPTION WATCH
# ============================================================

Criar mecanismo interno:

ASSUMPTION WATCH

Responsabilidade:

acompanhar premissas relevantes de decisões aceitas.

Exemplo:

assumption:
CPL remains around 10.

observed:
14.

Pode gerar ASSUMPTION_DEVIATION.

# ============================================================
# 119. ASSUMPTION WATCH NÃO É MONITORAMENTO UNIVERSAL
# ============================================================

Acompanhar somente premissas:

materialmente relevantes

mensuráveis

associadas a decisão aceita

com indicador disponível.

Não monitorar toda frase hipotética.

# ============================================================
# 120. GOAL INTEGRATION
# ============================================================

Radar deve observar metas apenas quando:

target

baseline/current

timeframe

metric

scope

estiverem suficientemente definidos.

# ============================================================
# 121. GOAL TRAJECTORY
# ============================================================

Quando matematicamente defensável:

calcular trajetória.

Exemplo:

current progress

required pace

remaining period.

Não pressupor crescimento linear quando isso não fizer sentido.

Se utilizar linearidade como aproximação:

marcar como assumption.

# ============================================================
# 122. GOAL AT RISK
# ============================================================

Não gerar "meta em risco" apenas porque um período ficou abaixo.

Considerar:

remaining time

volatility

data completeness

known seasonality interna

trend.

# ============================================================
# 123. CAPACITY INTEGRATION
# ============================================================

Radar deve observar Capacity do Business Model.

Se capacity for aproximada:

preservar aproximação.

Exemplo:

comfortable capacity ≈ 80.

Não tratar 81 como ruptura absoluta.

Pode exigir persistência ou contexto.

# ============================================================
# 124. CONSTRAINT INTEGRATION
# ============================================================

Se constraint conhecida piorar ou se tornar relevante:

Radar pode sinalizar.

Exemplo:

capital constraint

team constraint

owner dependency

supplier dependency

Não inventar constraint.

# ============================================================
# 125. BUSINESS MODEL CHANGE EVENTS
# ============================================================

Mudanças estruturais da 9.5 podem alimentar Radar.

Exemplos:

PRIMARY_CHANNEL_CHANGED

PRODUCT_DISCONTINUED

TEAM_SIZE_CHANGED

CAPACITY_CHANGED

NEW_LOCATION_ADDED

OFFER_CHANGED

CONSTRAINT_ADDED

Nem toda mudança gera Insight.

# ============================================================
# 126. CHANGE EVENT RELEVANCE
# ============================================================

Exemplo:

novo produto criado.

Pode não gerar Insight.

Produto novo passa a concentrar receita rapidamente.

Pode gerar oportunidade ou risco.

Contexto importa.

# ============================================================
# 127. DATA COVERAGE
# ============================================================

Coverage insuficiente deve reduzir confiança.

Exemplo:

Finance coverage = LIMITED.

Não gerar afirmação forte sobre margem.

Pode manter sinal em OBSERVE.

# ============================================================
# 128. STALE DATA
# ============================================================

Não gerar Insight material baseado em dado muito antigo sem considerar staleness.

Pode perguntar/confirmar quando necessário.

# ============================================================
# 129. CONFLICTING DATA
# ============================================================

Se dados conflitarem:

não gerar alerta forte silenciosamente.

Pode criar sinal interno de data inconsistency.

Usuário só deve ser envolvido se isso afetar decisão/análise relevante.

# ============================================================
# 130. UNKNOWN ≠ ZERO
# ============================================================

Ausência de métricas não significa:

zero sales

zero complaints

zero churn

zero margin.

Radar deve respeitar UNKNOWN.

# ============================================================
# 131. ABSENCE OF RECORD ≠ ABSENCE OF EVENT
# ============================================================

Não dizer:

"Não houve reclamações."

Preferir:

"Não foram registradas reclamações nos dados disponíveis."

Quando necessário.

# ============================================================
# 132. APPROXIMATE VALUES
# ============================================================

Se dado for aproximado:

preservar.

Não gerar Insight com falsa precisão.

# ============================================================
# 133. RANGE VALUES
# ============================================================

Se valor for intervalo:

considerar intervalo.

Não escolher midpoint arbitrariamente como verdade.

# ============================================================
# 134. SCOPE AWARENESS
# ============================================================

Sinal deve respeitar escopo:

company

location

product

channel

business unit

period.

Não misturar scopes.

# ============================================================
# 135. MULTI-LOCATION
# ============================================================

Queda em uma unidade não deve ser apresentada automaticamente como queda da empresa inteira.

# ============================================================
# 136. MULTI-CURRENCY
# ============================================================

Não comparar valores monetários de moedas diferentes sem conversão explícita.

Não implementar FX automático nesta fase.

# ============================================================
# 137. INTERNAL VS EXTERNAL DATA
# ============================================================

Nesta fase:

todo Signal deve indicar se é baseado em dados internos.

Preparar campo:

knowledge_source_scope = INTERNAL

Fase 9.8 poderá adicionar EXTERNAL / MIXED.

# ============================================================
# 138. USER PREFERENCES
# ============================================================

Criar/preparar preferência simples:

proactive_insights_enabled

Default:

enabled

quando apropriado ao produto.

Permitir usuário desativar em:

Configurações
→ Preferências

Não criar painel complexo por domínio nesta fase.

# ============================================================
# 139. MUTE
# ============================================================

Opcionalmente, se simples e coerente:

permitir silenciar Insights temporariamente.

Exemplo:

mute_until.

Não ocultar sinais críticos de segurança técnica, que são outra categoria e não fazem parte do Radar empresarial.

# ============================================================
# 140. USER FEEDBACK
# ============================================================

Feedback do usuário deve ser considerado.

Exemplos:

"Isso não é relevante."

"Esse dado está errado."

"Isso já foi resolvido."

"Quero acompanhar isso."

Atualizar Signal/Insight adequadamente.

# ============================================================
# 141. CORRECTION FLOW
# ============================================================

Se Insight foi gerado por dado incorreto:

permitir corrigir fonte quando possível.

Não apenas dismiss.

Exemplo:

"Esse faturamento está errado."

Direcionar para correção do dado.

# ============================================================
# 142. INSIGHT HISTORY
# ============================================================

Não criar menu principal.

Histórico pode permanecer interno.

Pode ser usado por:

Weekly Intelligence

Diagnosis

Audit

Admin

Context Engine.

# ============================================================
# 143. NO FEED OF ALERTS
# ============================================================

Não criar uma tela social/feed com dezenas de sinais.

A SEED deve sintetizar e priorizar.

# ============================================================
# 144. RADAR SUMMARY
# ============================================================

Quando existirem múltiplos sinais relacionados:

pode produzir um Insight consolidado.

Exemplo:

"Seu crescimento começou a pressionar a operação."

Com evidências:

orders ↑

capacity near limit

delays repeated.

# ============================================================
# 145. INSIGHT PRIORITIZATION
# ============================================================

Quando múltiplos Insights estiverem prontos:

priorizar.

Considerar:

impact

urgency

confidence

goal relevance

current plan relevance

novelty

actionability.

# ============================================================
# 146. MAX VISIBLE INSIGHTS
# ============================================================

Criar configuração central para limitar Insights visíveis.

Não hardcode em múltiplos arquivos.

Home inicialmente:

1 principal.

Conversation context:

somente os relevantes à pergunta.

Weekly Intelligence:

resumo seletivo.

# ============================================================
# 147. SURFACING BUDGET
# ============================================================

Criar conceito interno:

SURFACING BUDGET

Objetivo:

limitar interrupções.

Pode considerar:

per session

per day

per domain

recent dismissals.

Não precisa ser mostrado ao usuário.

# ============================================================
# 148. RADAR ORCHESTRATOR
# ============================================================

Criar serviço equivalente:

RadarOrchestrator

Responsabilidades:

receive trigger

load relevant data

run rule engine

create/update signals

run relevance engine

create/update Insights

schedule/surface according to mode

log outcome.

# ============================================================
# 149. EVENT-DRIVEN TRIGGERS
# ============================================================

Radar deve poder ser acionado após eventos relevantes:

metric created/updated

journal entry created

result created

learning created

decision accepted

experiment started/completed

action blocked/completed

goal updated

Business Model changed.

Não rodar tudo para toda mensagem.

# ============================================================
# 150. SCHEDULED SCANS
# ============================================================

Alguns sinais dependem de tempo.

Exemplos:

goal deviation

action blocked for too long

decision review due

experiment ending

missing result

trend across periods.

Utilizar scheduler/cron/job existente.

Não adicionar infraestrutura externa sem necessidade.

# ============================================================
# 151. JOB IDEMPOTENCY
# ============================================================

Jobs devem ser idempotentes.

Rodar duas vezes não pode duplicar Signals/Insights.

# ============================================================
# 152. JOB LOCKING
# ============================================================

Se necessário:

utilizar lock/lease/advisory lock apropriado.

Evitar dois workers processando mesma empresa/regra simultaneamente.

# ============================================================
# 153. JOB FAILURE
# ============================================================

Falha do Radar não deve bloquear chat.

Registrar erro.

Permitir retry seguro.

Não criar Insight parcial inválido.

# ============================================================
# 154. PROCESSING SCOPE
# ============================================================

Evitar scan global pesado em todas as empresas sem necessidade.

Preferir:

event-driven evaluation

company-level scheduled scan

incremental windows

indexed queries.

# ============================================================
# 155. RULE EVALUATION STATE
# ============================================================

Guardar quando necessário:

last_evaluated_at

last_success_at

cursor/window

rule version

company scope.

Isso evita reprocessamento excessivo.

# ============================================================
# 156. APIs / SERVICE LAYER
# ============================================================

Criar camada clara.

Possíveis serviços:

SeedRadarEngine

RadarRuleEngine

RadarRelevanceEngine

RadarOrchestrator

SignalRepository

InsightRepository

RadarContextResolver

RadarNarrativeService

Adaptar à arquitetura existente.

Não criar abstrações vazias.

# ============================================================
# 157. RADAR CONTEXT RESOLVER
# ============================================================

Pode estender BusinessContextResolver.

Entrada:

companyId

signal

domain

affectedEntities

timeframe

Saída:

relevant business context

goals

diagnoses

plans

constraints

metrics

history

learnings

data quality

missing information.

# ============================================================
# 158. NARRATIVE SERVICE
# ============================================================

Criar serviço equivalente:

RadarNarrativeService

Responsabilidade:

transformar Signal/Insight estruturado em linguagem simples.

Não permitir que narrativa altere os fatos detectados.

Structured data continua sendo source of truth.

# ============================================================
# 159. STRUCTURED OUTPUT
# ============================================================

Quando Strategic Model for usado:

exigir structured output.

Exemplo conceitual:

{
  "summary": "...",
  "why_it_matters": "...",
  "hypotheses": [],
  "limitations": [],
  "suggested_next_step": "...",
  "confidence": "..."
}

Validar server-side.

# ============================================================
# 160. NO LLM DETECTION FOR SIMPLE RULES
# ============================================================

LLM não deve detectar:

conversion drop

goal deviation

capacity threshold

date due

quando código pode fazer.

# ============================================================
# 161. MODEL ROUTER
# ============================================================

ECONOMY:

semantic grouping

simple classification

simple narrative

dedup assistance.

STRATEGIC:

complex cluster interpretation

high-impact Insight narrative

strategic relevance

multi-factor context.

Não hardcode modelos.

# ============================================================
# 162. AI USAGE / COST
# ============================================================

Integrar ao sistema existente.

Features equivalentes:

RADAR_SEMANTIC_GROUPING

RADAR_RELEVANCE_ANALYSIS

RADAR_CLUSTER_INTERPRETATION

RADAR_INSIGHT_NARRATIVE

Evitar chamadas redundantes.

# ============================================================
# 163. COST OPTIMIZATION
# ============================================================

Preferir:

deterministic detection

single structured AI call when necessary

cached context

persisted summaries.

Não chamar Strategic Model para cada métrica nova.

# ============================================================
# 164. ENTITLEMENTS
# ============================================================

Integrar à arquitetura FREE/PRO existente.

Não definir nova monetização nesta fase.

Preparar capacidade futura de diferenciar:

frequency

history

advanced proactive insights

por plano.

Não ativar regra comercial nova sem especificação.

# ============================================================
# 165. RLS / MULTI-TENANCY
# ============================================================

Todas as novas tabelas devem respeitar:

company_id

membership

RLS

authorization server-side.

Empresa A nunca acessa Signal/Insight da Empresa B.

# ============================================================
# 166. PRIVACIDADE
# ============================================================

Aplicar:

data minimization

purpose limitation

access control

correction

deletion

export readiness.

Não armazenar payloads sensíveis desnecessários em logs.

# ============================================================
# 167. AUDITABILIDADE
# ============================================================

Persistir quando necessário:

rule

version

evidence

decision to surface

suppression reason

user feedback

resolution reason.

Não armazenar chain-of-thought.

# ============================================================
# 168. ADMIN / OBSERVABILITY
# ============================================================

Se Admin existente comportar:

adicionar área técnica restrita para observar:

signals created

insights surfaced

signals suppressed

false positives

rule failures

processing latency

AI cost.

Não expor a usuários comuns.

Se UI Admin não fizer sentido:

fornecer services/queries/logs equivalentes.

# ============================================================
# 169. ADMIN RULE CONTROL
# ============================================================

Não permitir edição livre de código/regra pelo painel.

Pode permitir:

enable/disable rule

configuration parameters

cooldown

minimum periods

quando seguro e auditável.

Somente papéis autorizados.

# ============================================================
# 170. FEATURE FLAGS
# ============================================================

Criar/reutilizar feature flag:

seed_radar_enabled

Pode existir por:

global

market

plan

company override

conforme arquitetura existente.

Não espalhar checks hardcoded.

# ============================================================
# 171. MARKET / I18N
# ============================================================

Suportar:

pt-BR

pt-PT

es-ES

en-US

Strings visíveis devem usar i18n.

Não hardcode português.

# ============================================================
# 172. CURRENCY / LOCALE
# ============================================================

Formatar:

currency

numbers

dates

percentages

com helpers existentes.

Não alterar cálculo conforme idioma.

# ============================================================
# 173. TIMEZONE
# ============================================================

Sinais temporais devem respeitar timezone da empresa.

Não utilizar timezone do servidor como verdade universal.

# ============================================================
# 174. NO EXTERNAL INTELLIGENCE YET
# ============================================================

Não pesquisar:

concorrentes

mercado

notícias

economia

regulação

tendências externas

nesta fase.

Isso pertence à Fase 9.8.

# ============================================================
# 175. NO AUTONOMOUS ACTION
# ============================================================

Radar NÃO pode sozinho:

alterar campanha

alterar preço

cancelar produto

contratar

demitir

movimentar dinheiro

enviar comunicação externa

executar plano.

Ele percebe, explica e conduz à conversa.

# ============================================================
# 176. NO SCARE TACTICS
# ============================================================

Não utilizar linguagem alarmista para aumentar engajamento.

Evitar:

"URGENTE!"

"Seu negócio está em risco!"

"Você vai perder dinheiro!"

a menos que exista contexto material, linguagem proporcional e necessidade real.

Mesmo assim, manter sobriedade.

# ============================================================
# 177. NO ENGAGEMENT HACKS
# ============================================================

Não criar falso Insight apenas para fazer usuário voltar.

Não criar gamificação artificial.

Não gerar alerta sem evidência.

# ============================================================
# 178. TESTES — SIGNAL TYPES
# ============================================================

Testar:

CHANGE

TREND

ANOMALY

THRESHOLD

REPETITION

GOAL_DEVIATION

CAPACITY_PRESSURE

EXECUTION_RISK

OPPORTUNITY

RISK

ASSUMPTION_DEVIATION.

# ============================================================
# 179. TESTES — TREND
# ============================================================

Dados:

12%
10%
8%

Períodos comparáveis.

Esperado:

TREND detectado.

Não criar Diagnosis automático.

# ============================================================
# 180. TESTES — INSUFFICIENT TREND
# ============================================================

Dados:

12%
10%

Sem regra específica suficiente.

Esperado:

não gerar tendência forte.

Pode manter OBSERVE.

# ============================================================
# 181. TESTES — PARTIAL PERIOD
# ============================================================

Semana atual parcial

vs

semana anterior completa.

Esperado:

não comparar diretamente sem normalização defensável.

# ============================================================
# 182. TESTES — REPETITION
# ============================================================

Journal:

3 reclamações semanticamente semelhantes sobre prazo em períodos próximos.

Esperado:

REPETITION signal.

Preservar fontes.

# ============================================================
# 183. TESTES — FALSE REPETITION
# ============================================================

"Preço alto"

"Prazo alto"

Não agrupar apenas porque possuem palavra semelhante.

# ============================================================
# 184. TESTES — CAPACITY
# ============================================================

Capacity ≈ 80/day.

Recent:

76
81
84.

Esperado:

capacity pressure possível.

Linguagem proporcional à aproximação.

# ============================================================
# 185. TESTES — GOAL
# ============================================================

Meta com target/deadline definidos.

Dados suficientes.

Validar trajectory.

Não gerar se timeframe for desconhecido.

# ============================================================
# 186. TESTES — ACTION BLOCKED
# ============================================================

Ação estratégica bloqueada.

Sem relevância para objetivo:

não mostrar.

Ação crítica bloqueada e impedindo plano:

pode gerar Execution Risk.

# ============================================================
# 187. TESTES — ASSUMPTION DEVIATION
# ============================================================

Simulation assumption:

CPL = 10.

Observed:

14.

Validar sinal.

# ============================================================
# 188. TESTES — OPPORTUNITY
# ============================================================

Produto:

sales ↑

margin healthy

repeat purchase ↑

por períodos suficientes.

Validar Opportunity Signal.

Não recomendar escala automaticamente.

# ============================================================
# 189. TESTES — DEDUP
# ============================================================

Três sinais semanticamente iguais.

Esperado:

um sinal enriquecido.

# ============================================================
# 190. TESTES — MERGE
# ============================================================

Leads ↑

conversion ↓

sales stable.

Validar Insight consolidado.

# ============================================================
# 191. TESTES — COOLDOWN
# ============================================================

Insight mostrado hoje.

Sem mudança material amanhã.

Esperado:

não mostrar novamente.

# ============================================================
# 192. TESTES — RESURFACE
# ============================================================

Mesmo sinal piora materialmente.

Esperado:

pode reaparecer com nova evidência.

# ============================================================
# 193. TESTES — DISMISS
# ============================================================

Usuário marca Insight como irrelevante.

Esperado:

feedback persistido.

Repetição reduzida.

# ============================================================
# 194. TESTES — CORRECTION
# ============================================================

Insight baseado em dado incorreto.

Usuário corrige o dado.

Esperado:

Signal reavaliado.

Pode ser RESOLVED ou SUPERSEDED.

# ============================================================
# 195. TESTES — HOME
# ============================================================

Home:

mantém frase principal.

Mostra no máximo Insight principal.

Sem dashboard pesado.

# ============================================================
# 196. TESTES — CONVERSATION CONTEXT
# ============================================================

Sinal de margin decline existe.

Usuário pergunta sobre desconto.

SEED utiliza sinal no contexto.

# ============================================================
# 197. TESTES — WEEKLY
# ============================================================

Weekly Intelligence consome apenas sinais relevantes.

Não lista todos.

# ============================================================
# 198. TESTES — DIAGNOSIS
# ============================================================

Insight investigado.

Dados suficientes.

Diagnosis pode ser criado/atualizado.

Não automaticamente antes da investigação.

# ============================================================
# 199. TESTES — PLAN
# ============================================================

Insight gera recomendação após análise.

Execution Loop cria plano.

Não diretamente do Signal bruto.

# ============================================================
# 200. TESTES — DECISION SIMULATOR
# ============================================================

Capacity Insight.

Usuário pergunta sobre equipamento.

Decision Simulator é acionado.

# ============================================================
# 201. TESTES — DATA QUALITY
# ============================================================

Dado antigo e conflitante.

Esperado:

confidence reduzida.

Pode permanecer OBSERVE.

# ============================================================
# 202. TESTES — UNKNOWN
# ============================================================

Sem dados de retenção.

Não gerar:

retention decline.

# ============================================================
# 203. TESTES — SCOPE
# ============================================================

Queda em Unidade A.

Não apresentar como empresa inteira.

# ============================================================
# 204. TESTES — MULTI-CURRENCY
# ============================================================

Não comparar valores monetários de moedas diferentes.

# ============================================================
# 205. TESTES — MULTI-TENANT
# ============================================================

Empresa A nunca acessa Radar da Empresa B.

Testar APIs, jobs e queries.

# ============================================================
# 206. TESTES — IDEMPOTÊNCIA
# ============================================================

Rodar mesmo job/regra duas vezes.

Não duplicar Signal/Insight.

# ============================================================
# 207. TESTES — RULE VERSION
# ============================================================

Sinal registra rule_id e version.

# ============================================================
# 208. TESTES — JOB FAILURE
# ============================================================

Falha de processamento.

Chat continua funcionando.

Retry não duplica dados.

# ============================================================
# 209. TESTES — COST
# ============================================================

Regras matemáticas não chamam IA.

Model Router funciona.

Tokens/custos registrados.

# ============================================================
# 210. TESTE COMPLETO — VENDAS
# ============================================================

Empresa fictícia:

Leads:
500 → 560 → 610

Conversion:
12% → 10% → 8%

Sales:
60 → 56 → 49

Radar deve:

detectar tendência

agrupar sinais

avaliar relevância

criar Insight simples

não afirmar causa

oferecer Analisar comigo.

# ============================================================
# 211. TESTE COMPLETO — OPERAÇÃO
# ============================================================

Capacity ≈ 100 orders/day.

Orders:
85 → 96 → 108

Journal:
delays repeated.

Radar deve:

detectar Capacity Pressure

detectar Repetition

clusterizar quando defensável

mostrar Insight proporcional

não afirmar colapso.

# ============================================================
# 212. TESTE COMPLETO — META
# ============================================================

Goal:

R$120k/month em 90 dias.

Progress consistent below required pace.

Radar:

detecta Goal Deviation

considera remaining time

mostra Insight

CTA:
Revisar comigo.

# ============================================================
# 213. TESTE COMPLETO — DECISÃO
# ============================================================

Decision Simulator assumption:

CPL = 10.

Decision accepted.

Observed:
CPL = 14.

Radar:

detecta Assumption Deviation

mostra Insight

CTA:
Revisar decisão.

# ============================================================
# 214. TESTE COMPLETO — OPORTUNIDADE
# ============================================================

Produto A:

revenue share ↑

margin healthy

repeat purchase ↑

dados suficientes.

Radar:

detecta Opportunity

não recomenda escala automaticamente

convida à análise.

# ============================================================
# 215. TESTE COMPLETO — FALSO POSITIVO
# ============================================================

Uma única semana ruim.

Dados incompletos.

Radar:

mantém OBSERVE ou não cria sinal.

Não mostra Insight forte.

# ============================================================
# 216. TESTE COMPLETO — USUÁRIO DESATIVA
# ============================================================

proactive_insights_enabled = false.

Radar pode continuar processando sinais internos se necessário para Weekly Intelligence, conforme decisão arquitetural documentada.

Não mostrar Insights proativos na Home/chat.

# ============================================================
# 217. PERFORMANCE
# ============================================================

Testar volume significativo:

milhares de metrics

Journal entries

signals

insights

companies em ambiente de teste.

Validar:

jobs incrementais

queries indexadas

sem N+1 crítico

Home rápida

Context Resolver seletivo.

# ============================================================
# 218. INDEXES
# ============================================================

Considerar índices para:

company_id

status

domain

signal_type

first_detected_at

last_observed_at

surfaced_at

rule_id

related metric/goal/plan quando aplicável.

Não criar índices indiscriminadamente.

# ============================================================
# 219. MIGRATIONS
# ============================================================

Migrations devem:

ser incrementais

preservar dados

não resetar banco

ter defaults seguros

ser reversíveis quando possível

ser documentadas.

# ============================================================
# 220. DOCUMENTAÇÃO TÉCNICA
# ============================================================

Criar documentação contendo:

1. visão geral do Radar;
2. responsabilidades;
3. fontes internas;
4. domínios;
5. Signal Types;
6. Signal Pipeline;
7. Rule Engine;
8. Rule Registry;
9. Rule Versioning;
10. Relevance Gate;
11. Confidence;
12. Impact;
13. Urgency;
14. Novelty;
15. Persistence;
16. Actionability;
17. Data Quality;
18. Alert Fatigue;
19. Deduplication;
20. Clustering;
21. Signal Lifecycle;
22. Insight Lifecycle;
23. Surfacing Modes;
24. Home integration;
25. Chat integration;
26. Weekly integration;
27. Execution Loop integration;
28. Decision Simulator integration;
29. Scheduler/jobs;
30. Idempotency;
31. Model Router;
32. usage/cost;
33. RLS;
34. Privacy;
35. i18n;
36. Admin/observability;
37. preparação para 9.8.

# ============================================================
# 221. CRITÉRIOS DE ACEITE FUNCIONAIS
# ============================================================

Fase 9.7 somente está concluída quando:

1. Signal model funciona.

2. Signal Types funcionam.

3. Rule Engine funciona.

4. Rule Registry funciona.

5. Rule Versioning funciona.

6. Change detection funciona.

7. Trend detection funciona.

8. Threshold detection funciona.

9. Repetition detection funciona.

10. Goal Deviation funciona.

11. Capacity Pressure funciona.

12. Execution Risk funciona.

13. Opportunity funciona.

14. Risk funciona.

15. Assumption Deviation funciona.

16. Deduplication funciona.

17. Fingerprint funciona.

18. Merging funciona.

19. Clustering funciona.

20. Relevance Gate funciona.

21. Impact funciona.

22. Confidence funciona.

23. Urgency funciona.

24. Novelty funciona.

25. Persistence funciona.

26. Actionability funciona.

27. Data Quality funciona.

28. Alert Fatigue funciona.

29. Signal lifecycle funciona.

30. Insight persistence funciona.

# ============================================================
# 222. CRITÉRIOS DE ACEITE FUNCIONAIS — CONTINUAÇÃO
# ============================================================

31. Insight lifecycle funciona.

32. Cooldown funciona.

33. Resurface funciona.

34. Dismiss funciona.

35. False-positive feedback funciona.

36. Resolution funciona.

37. Home integration funciona.

38. Conversation integration funciona.

39. Weekly Intelligence integration funciona.

40. Diagnosis integration funciona.

41. Execution Loop integration funciona.

42. Decision Simulator integration funciona.

43. Assumption Watch funciona.

44. Goal integration funciona.

45. Capacity integration funciona.

46. Constraint integration funciona.

47. Business Model change integration funciona.

48. Coverage/staleness/conflicts são considerados.

49. Approximation/range são preservados.

50. Scope é preservado.

51. Multi-currency é seguro.

52. User preferences funcionam.

53. Scheduler/jobs funcionam.

54. Event-driven triggers funcionam.

55. Idempotency funciona.

56. RLS funciona.

57. Multi-tenancy funciona.

58. i18n funciona.

59. Model Router funciona.

60. usage/cost logging funciona.

61. Home continua simples.

62. Sidebar continua sem Radar.

63. Não existem push/email/WhatsApp.

64. Fases anteriores não apresentam regressão.

# ============================================================
# 223. CRITÉRIOS DE ACEITE ESTRATÉGICOS
# ============================================================

O sistema deve conseguir responder internamente:

O que mudou?

Isso é isolado ou recorrente?

Os períodos são comparáveis?

O escopo é o mesmo?

O dado é atual?

O dado é confiável?

Existe conflito?

Qual é o impacto possível?

Qual é a urgência?

Isso é novo?

Isso já foi mostrado?

Isso é acionável?

O usuário precisa ser interrompido agora?

Isso deve apenas permanecer em observação?

Qual evidência sustenta o Insight?

Qual limitação existe?

Qual é o próximo passo útil?

# ============================================================
# 224. CRITÉRIO CENTRAL
# ============================================================

A pergunta:

"Existe alguma coisa acontecendo nesta empresa que o empresário deveria perceber?"

deve ser respondida com:

poucos sinais relevantes

bem fundamentados

contextualizados

sem ruído

sem alarmismo

sem falsa certeza

com caminho claro para investigação ou ação.

# ============================================================
# 225. CRITÉRIO DE DIFERENCIAÇÃO
# ============================================================

Após a Fase 9.7, a SEED deve deixar de ser apenas:

uma inteligência que responde quando perguntada.

Ela passa a ser:

uma inteligência que acompanha a empresa, percebe mudanças importantes e chama atenção somente quando existe valor real.

# ============================================================
# 226. CRITÉRIO DE SILÊNCIO
# ============================================================

Uma semana sem Insight pode significar:

nenhum sinal relevante.

Isso é aceitável.

Não fabricar conteúdo para preencher espaço.

# ============================================================
# 227. CRITÉRIO DE SIMPLICIDADE
# ============================================================

O usuário NÃO deve precisar:

configurar centenas de regras

entender thresholds

administrar Signal Types

gerenciar Radar

abrir painel técnico.

Ele apenas percebe:

"A SEED está acompanhando meu negócio."

# ============================================================
# 228. PREPARAÇÃO PARA FASE 9.8
# ============================================================

Fase 9.8 será:

SEED EXTERNAL INTELLIGENCE.

Radar deve estar preparado para futuramente receber:

EXTERNAL SIGNALS

com:

source

URL/reference

retrieved_at

freshness

reliability

market relevance

company relevance.

Não implementar busca externa agora.

# ============================================================
# 229. INTERNAL / EXTERNAL / MIXED
# ============================================================

Preparar enum/conceito:

INTERNAL

EXTERNAL

MIXED

Nesta fase:

Signals devem ser INTERNAL.

# ============================================================
# 230. NÃO IMPLEMENTAR
# ============================================================

Não implementar nesta fase:

Fase 9.8

Fase 10

External Intelligence

web search

competitor monitoring

news monitoring

economic monitoring

push notifications

email alerts

WhatsApp alerts

SMS alerts

autonomous actions

collective intelligence

cross-company learning

arbitrary scores

complex machine learning

engagement hacks

alert feed.

# ============================================================
# 231. PROTEÇÃO CONTRA OVERENGINEERING
# ============================================================

Antes de criar nova regra:

perguntar:

"Existe um sinal empresarial relevante que precisamos detectar agora?"

Se não:

não criar.

Antes de criar novo domínio:

"Já existe uso real?"

Se não:

não criar.

Antes de adicionar IA:

"Regra determinística resolve?"

Se sim:

não utilizar IA.

# ============================================================
# 232. RELATÓRIO FINAL OBRIGATÓRIO
# ============================================================

Ao concluir, apresentar:

## RESUMO

O que foi implementado.

## ARQUITETURA ENCONTRADA

Como o sistema estava antes da 9.7.

## DECISÕES ARQUITETURAIS

Principais decisões tomadas.

## MIGRATIONS

Todas as migrations.

## SIGNAL MODEL

Como funciona.

## SIGNAL TYPES

Tipos implementados.

## RULE ENGINE

Como funciona.

## RULE REGISTRY

Regras criadas.

## RULE VERSIONING

Como funciona.

## TREND DETECTION

Como funciona.

## ANOMALY DETECTION

Como funciona.

## THRESHOLDS

Como funcionam.

## REPETITION

Como funciona.

## GOAL DEVIATION

Como funciona.

## CAPACITY PRESSURE

Como funciona.

## EXECUTION RISK

Como funciona.

## OPPORTUNITY

Como funciona.

## ASSUMPTION WATCH

Como funciona.

## DEDUPLICATION

Como funciona.

## MERGING / CLUSTERING

Como funciona.

## RELEVANCE GATE

Como funciona.

## ALERT FATIGUE

Como funciona.

## INSIGHTS

Como são gerados.

## HOME

Integração.

## CHAT

Integração.

## WEEKLY INTELLIGENCE

Integração.

## EXECUTION LOOP

Integração.

## DECISION SIMULATOR

Integração.

## BUSINESS MODEL

Integração.

## JOBS / SCHEDULER

Como funciona.

## APIS / SERVICES

Tudo criado/alterado.

## RLS / SECURITY

Proteções.

## PRIVACY

Proteções.

## MODEL ROUTER

Uso.

## AI COST

Uso e custo.

## I18N

Internacionalização.

## TESTS

Todos os testes.

## LINT

Resultado.

## TYPECHECK

Resultado.

## BUILD

Resultado.

## PERFORMANCE

Resultados relevantes.

## LIMITAÇÕES

Limitações conhecidas.

## TECHNICAL DEBT

Dívida técnica.

## 9.8 READINESS

Está pronto para External Intelligence?

Explicar.

## MANUAL VALIDATION

Passo a passo para testar.

# ============================================================
# 233. TABELA FINAL
# ============================================================

Apresentar tabela equivalente:

Capability | Status | Deterministic/AI | Tested | Notes

Signal Model

Rule Engine

Trend

Anomaly

Threshold

Repetition

Goal Deviation

Capacity Pressure

Execution Risk

Opportunity

Assumption Deviation

Deduplication

Clustering

Relevance Gate

Alert Fatigue

Insight Generation

Home Surfacing

Conversation Surfacing

Weekly Integration

Execution Loop Integration

Decision Simulator Integration

Scheduler

RLS

I18N

Usage/Cost

# ============================================================
# 234. RISCOS E LIMITAÇÕES
# ============================================================

Listar explicitamente:

riscos de falso positivo

riscos de falso negativo

riscos de dados incompletos

riscos de dados desatualizados

riscos de períodos incompatíveis

riscos de escopo incorreto

riscos de semântica incorreta

riscos de excesso de Insights

riscos de custo de IA

riscos de performance

riscos de privacidade

riscos de cross-tenant leakage

riscos de overengineering.

Para cada risco relevante:

informar mitigação

e

limitações abertas.

# ============================================================
# 235. VALIDAÇÃO FINAL
# ============================================================

Antes de considerar a Fase 9.7 concluída:

executar:

lint

typecheck

unit tests

integration tests

RLS tests

rule tests

signal tests

insight tests

job tests

build

Validar manualmente:

conversion trend

repeated complaints

capacity pressure

goal deviation

blocked action

experiment ending

missing result

assumption deviation

opportunity signal

false positive suppression

deduplication

cooldown

resurface

dismiss

correction

Home Insight

conversation contextual Insight

Weekly Intelligence integration

Execution Loop integration

Decision Simulator integration

user preference off

pt-BR

pt-PT

es-ES

en-US

multi-tenant isolation

cost logging

job idempotency

job failure recovery.

Confirmar também:

chat continua funcionando;

sidebar continua simples;

Minha Empresa continua funcionando;

Diagnóstico continua funcionando;

Meu Plano Estratégico continua funcionando;

Memory continua funcionando;

Business Journal continua invisível;

Weekly Intelligence continua funcionando;

Execution Loop continua funcionando;

Business Model continua funcionando;

Decision Simulator continua funcionando;

não existem regressões críticas.

# ============================================================
# 236. STOP CONDITION
# ============================================================

Depois de:

migrations

implementação

lint

typecheck

testes

build

validação manual

relatório técnico

PARAR.

NÃO iniciar Fase 9.8.

NÃO iniciar Fase 10.

NÃO adicionar funcionalidades fora do escopo.

Aguardar minha autorização explícita.

# ============================================================
# FIM DA FASE 9.7
# SEED RADAR / PROACTIVE BUSINESS INTELLIGENCE
# ============================================================
