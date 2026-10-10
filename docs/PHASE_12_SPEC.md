# ============================================================
# SEED AI | FASE 12
# SEED BUSINESS COCKPIT
# COCKPIT EMPRESARIAL E HOME ESTRATÉGICA
# ============================================================

## 0. ORDEM DE EXECUÇÃO

Executar esta fase SOMENTE após a conclusão, teste e aprovação de:

- Fase 9.2 — Core Experience + Memória Automática;
- Fase 9.2.1 — Strategic Reliability Layer;
- Fase 9.3 — Business Journal Invisível + Weekly Intelligence;
- Fase 9.4 — SEED Execution Loop;
- Fase 9.5 — SEED Business Model;
- Fase 9.6 — SEED Decision Simulator;
- Fase 9.7 — SEED Radar;
- Fase 9.8 — SEED External Intelligence;
- Fase 10 — Goals & Metrics Engine;
- Fase 11 — SEED Growth Map.

Antes de alterar código:

1. inspecionar toda a arquitetura atual;
2. localizar a Home existente;
3. localizar Chat, Composer, Conversations e Sidebar;
4. localizar Minha Empresa;
5. localizar Diagnóstico;
6. localizar Meu Plano Estratégico;
7. localizar Goals e Metrics;
8. localizar Growth Map;
9. localizar Radar Signals e Radar Insights;
10. localizar Weekly Intelligence;
11. localizar Business Model;
12. localizar Execution Loop;
13. localizar Decision Simulator;
14. localizar External Intelligence;
15. localizar Memory e Business Journal;
16. localizar Context Engine;
17. localizar Model Router;
18. localizar usage/cost logging;
19. localizar entitlement engine FREE/PRO;
20. localizar RLS e multi-tenancy;
21. localizar i18n, markets, locale, currency e timezone;
22. localizar analytics/event infrastructure;
23. localizar design system, tokens, componentes e logomarca oficiais;
24. reutilizar componentes e services já validados;
25. evitar duplicação de sources of truth;
26. evitar regressões nas Fases anteriores.

NÃO iniciar qualquer fase posterior automaticamente.

Ao terminar:

- executar migrations necessárias;
- lint;
- typecheck;
- testes unitários;
- testes de integração;
- testes de UI;
- testes RLS;
- build de produção;
- validação manual em desktop e mobile;
- relatório técnico final;
- PARAR;
- aguardar aprovação explícita.

# ============================================================
# 1. OBJETIVO
# ============================================================

Construir o:

SEED BUSINESS COCKPIT

O Cockpit é a Home estratégica da SEED.

Ele deve reunir, de forma simples e priorizada:

- o que o empresário deseja resolver agora;
- o objetivo atual;
- o foco estratégico;
- o próximo passo;
- o progresso do plano;
- o principal ponto de atenção;
- a situação do crescimento;
- a leitura mais relevante da semana;
- os resultados e aprendizados que realmente importam.

O Cockpit NÃO deve substituir o chat.

O chat continua sendo o centro da experiência.

# ============================================================
# 2. PRINCÍPIO CENTRAL
# ============================================================

A Home deve responder duas perguntas:

1. "O que você precisa resolver no seu negócio hoje?"

2. "Considerando tudo que a SEED sabe, o que merece sua atenção agora?"

A primeira pertence ao empresário.

A segunda pertence à inteligência da SEED.

# ============================================================
# 3. CHAT PRIMEIRO
# ============================================================

A conversa continua sendo a principal forma de uso.

O usuário não deve precisar aprender a navegar por um dashboard para receber valor.

Fluxo principal:

ENTRAR
↓
VER O QUE MERECE ATENÇÃO
↓
CONVERSAR COM A SEED
↓
RECEBER ORIENTAÇÃO
↓
CONTINUAR O PLANO
↓
INFORMAR RESULTADO
↓
RECEBER NOVA ORIENTAÇÃO.

# ============================================================
# 4. COCKPIT NÃO É DASHBOARD TRADICIONAL
# ============================================================

Não construir:

- painel cheio de gráficos;
- dezenas de KPIs;
- grade de cards administrativos;
- BI genérico;
- central de relatórios;
- ERP visual;
- painel técnico da IA;
- feed de alertas;
- página semelhante a software financeiro.

O Cockpit deve ser:

- simples;
- estratégico;
- pessoal;
- orientado à solução;
- orientado ao próximo passo;
- compreensível para pequenos e médios empresários.

# ============================================================
# 5. COCKPIT É O ESTADO INICIAL DA HOME
# ============================================================

Quando nenhuma conversa específica estiver selecionada, a área central deve apresentar o Cockpit.

Quando o usuário iniciar ou abrir uma conversa:

a área central passa a priorizar a conversa.

A Sidebar permanece disponível no desktop.

No mobile, permanece no drawer/menu já criado.

# ============================================================
# 6. NÃO CRIAR NOVO ITEM PRINCIPAL
# ============================================================

NÃO adicionar obrigatoriamente:

Dashboard

Cockpit

Visão Geral

à Sidebar.

Preferência:

o Cockpit é a própria Home ao clicar na marca, no início da aplicação ou ao criar nova conversa.

Se a arquitetura atual exigir uma rota:

usar uma rota de Home clara.

Não poluir a navegação.

# ============================================================
# 7. NAVEGAÇÃO VISÍVEL
# ============================================================

Preservar a navegação simples:

+ Nova conversa

Conversas

Minha Empresa

Diagnóstico

Meu Plano Estratégico

Configurações

Não adicionar à navegação principal:

Radar

Diário

Decisões

Experimentos

Business Model

Decision Simulator

External Intelligence

Growth Engine

Learnings

Results Engine.

Esses recursos continuam internos ou contextuais.

# ============================================================
# 8. FRASE OFICIAL DA HOME
# ============================================================

Manter exatamente:

"O que você precisa resolver no seu negócio hoje?"

Não substituir por outra frase principal.

Essa pergunta deve permanecer visualmente central.

# ============================================================
# 9. SUBTEXTO
# ============================================================

Pode utilizar texto auxiliar simples, por exemplo:

"Conte para a SEED do seu jeito. Ela conhece sua empresa e ajuda você a encontrar o melhor caminho."

Não criar promessa de resultado garantido.

# ============================================================
# 10. LAYOUT DESKTOP
# ============================================================

Estrutura conceitual:

┌──────────────────────────────────────────────────────────────┐
│ SEED AI                                  🇧🇷  ⚙  usuário    │
├────────────────┬─────────────────────────────────────────────┤
│                │                                             │
│ + Nova conversa│  O que você precisa resolver                │
│                │  no seu negócio hoje?                       │
│ Conversas      │                                             │
│                │  [ Conte para a SEED...                ]    │
│ Minha Empresa  │  [ +                                ➤ ]     │
│                │                                             │
│ Diagnóstico    │  CONTINUE DE ONDE PARAMOS                   │
│                │  Foco atual                                 │
│ Meu Plano      │  Próximo passo                              │
│ Estratégico    │                                             │
│                │  SUA META                                   │
│ Configurações  │  Progresso e situação                       │
│                │                                             │
│                │  O QUE MERECE ATENÇÃO                       │
│                │  Insight principal                          │
└────────────────┴─────────────────────────────────────────────┘

A ordem e presença das seções devem se adaptar aos dados disponíveis.

# ============================================================
# 11. LAYOUT MOBILE
# ============================================================

No mobile:

- chat/home ocupa quase toda a largura;
- Sidebar vira drawer;
- bandeira/idioma permanece no header;
- Composer permanece acessível;
- cards são empilhados;
- nenhuma tabela horizontal obrigatória;
- touch targets adequados;
- safe area respeitada;
- teclado não cobre o Composer.

Estrutura conceitual:

SEED   🇧🇷   ☰

O que você precisa resolver
no seu negócio hoje?

[ Conte para a SEED... ]
[ +                 ➤ ]

CONTINUE DE ONDE PARAMOS
[...]

SUA META
[...]

O QUE MERECE ATENÇÃO
[...]

# ============================================================
# 12. LOGOMARCA E IDENTIDADE
# ============================================================

Preservar integralmente:

- logomarca oficial;
- cores oficiais;
- tipografia oficial;
- assets existentes;
- identidade visual;
- design system.

A Fase 12 altera experiência e composição da Home.

Não redesenhar a marca.

# ============================================================
# 13. CAMADA VISÍVEL
# ============================================================

O usuário pode ver:

- conversa;
- objetivo;
- foco;
- próximo passo;
- progresso;
- diagnóstico em linguagem simples;
- Growth Map resumido;
- insight relevante;
- resumo semanal;
- resultado importante;
- chamada para continuar com a SEED.

# ============================================================
# 14. CAMADA INVISÍVEL
# ============================================================

A SEED processa internamente:

- Memory;
- Business Journal;
- Decisions;
- Experiments;
- Learnings;
- Business Model;
- Business Graph;
- Reliability;
- Radar Signals;
- External Intelligence Sources;
- Decision Simulations;
- Confidence;
- Sufficiency;
- Context Resolution;
- Next Best Action;
- Growth Map rules.

Não expor essa complexidade na Home.

# ============================================================
# 15. SOURCES OF TRUTH
# ============================================================

O Cockpit não deve virar source of truth.

Ele agrega dados existentes.

Sources of truth permanecem:

Goals/Metrics
→ metas e indicadores.

Diagnosis
→ diagnóstico atual.

Action Plan/Actions
→ plano e execução.

Growth Map
→ situação das dimensões de crescimento.

Radar
→ sinais e insights.

Weekly Intelligence
→ revisão semanal.

Business Model
→ estrutura do negócio.

Decision Simulator/Decision Journal
→ cenários e decisões.

Results/Learnings
→ resultados e aprendizados.

Cockpit:
→ representação agregada e priorizada.

# ============================================================
# 16. NÃO DUPLICAR DADOS
# ============================================================

Não criar cópias independentes de:

goal

metric

diagnosis

plan

action

insight

growth dimension

weekly report

result

learning.

O Cockpit referencia/agrega.

# ============================================================
# 17. ESTADOS DA HOME
# ============================================================

Suportar pelo menos:

NEW_USER

LOW_CONTEXT

ACTIVE_BUSINESS

ACTIVE_PLAN

ATTENTION_REQUIRED

GOAL_AT_RISK

NO_ACTIVE_GOAL

NO_ACTIVE_PLAN

RECENT_RESULT

WEEKLY_REVIEW_AVAILABLE

Esses estados podem se combinar.

Não criar uma tela separada para cada um.

# ============================================================
# 18. NEW USER
# ============================================================

Usuário novo deve encontrar:

- frase oficial;
- Composer;
- anexos;
- poucos atalhos;
- explicação simples.

Não mostrar:

- cards vazios;
- gráficos zerados;
- diagnóstico fictício;
- metas inexistentes;
- Growth Map inventado.

# ============================================================
# 19. LOW CONTEXT
# ============================================================

Quando a SEED ainda conhece pouco:

mostrar valor sem falsa inteligência.

Exemplo:

"Conte o que está acontecendo no seu negócio. Conforme vocês conversarem, a SEED entenderá melhor sua empresa e suas prioridades."

Pode mostrar:

"Minha Empresa"

como acesso para conferir contexto.

Não mostrar score arbitrário de conhecimento.

# ============================================================
# 20. ACTIVE BUSINESS
# ============================================================

Quando existe contexto suficiente:

manter a pergunta principal.

Abaixo, apresentar somente os elementos mais relevantes.

Não transformar a Home em relatório completo.

# ============================================================
# 21. CONTINUE DE ONDE PARAMOS
# ============================================================

Quando existe plano, ação ou conversa relevante:

mostrar seção:

CONTINUE DE ONDE PARAMOS

Possíveis elementos:

Foco atual

Próximo passo

Progresso do plano

[Continuar com a SEED]

Esse CTA deve abrir conversa com contexto carregado.

# ============================================================
# 22. FOCO ATUAL
# ============================================================

O foco atual deve vir de:

Next Best Action

active diagnosis

active plan

goal priority

Radar/Weekly Intelligence

conforme regra de prioridade.

Não gerar foco novo apenas para preencher a Home.

# ============================================================
# 23. PRÓXIMO PASSO
# ============================================================

Mostrar a ação prioritária em linguagem simples.

Exemplo:

"Revisar as principais objeções das vendas perdidas."

Não mostrar:

NEXT_BEST_ACTION = REVIEW_LOST_SALES.

# ============================================================
# 24. CTA CONTINUAR
# ============================================================

[Continuar com a SEED]

Ao clicar:

- abrir ou criar conversa contextual;
- incluir plan/action/goal/diagnosis relevante;
- não exigir que usuário repita contexto;
- preservar histórico;
- não iniciar chamada de IA apenas ao clicar se a conversa ainda não foi enviada.

# ============================================================
# 25. META ATUAL
# ============================================================

Quando existe Goal ativo:

mostrar de forma simples:

SUA META

Meta

Valor atual

Valor desejado

Prazo

Situação

Próximo foco.

Não mostrar todos os indicadores auxiliares na Home.

# ============================================================
# 26. PROGRESSO DA META
# ============================================================

Pode utilizar:

barra de progresso

valor atual

valor alvo

gap

status.

Somente quando matematicamente defensável.

Não utilizar barra para metas não lineares sem regra adequada.

# ============================================================
# 27. SITUAÇÃO DA META
# ============================================================

Linguagem visível:

No ritmo

Abaixo do ritmo

Acima do ritmo

Meta concluída

Dados insuficientes

Não mostrar códigos técnicos.

# ============================================================
# 28. TRAJETÓRIA NÃO É PREVISÃO
# ============================================================

Se houver análise de trajetória:

deixar claro que é referência matemática.

Não afirmar:

"Você atingirá a meta."

Preferir:

"No ritmo registrado até aqui..."

# ============================================================
# 29. SEM META ATIVA
# ============================================================

Não forçar card vazio.

Pode mostrar CTA discreto quando contexto indicar valor:

"Definir uma meta com a SEED"

Não bloquear uso do app.

# ============================================================
# 30. MÚLTIPLAS METAS
# ============================================================

A Home deve mostrar apenas uma meta principal.

Critérios:

- primary goal;
- active priority;
- prazo;
- relevância;
- relação com plano atual.

Permitir acesso a outras metas em contexto secundário futuro, sem poluir.

# ============================================================
# 31. DIAGNÓSTICO RESUMIDO
# ============================================================

Quando relevante:

mostrar:

O QUE MAIS MERECE ATENÇÃO

Exemplo:

"Poucas pessoas interessadas estão avançando para a compra."

Ação:

[Entender o diagnóstico]

Não mostrar:

MAIN_BOTTLENECK = CONVERSION

CONFIDENCE = MODERATE

na Home.

# ============================================================
# 32. DIAGNÓSTICO NÃO CONFIRMADO
# ============================================================

Se diagnóstico ainda é preliminar:

usar linguagem proporcional.

Exemplo:

"Existe um sinal que vale investigar."

Não apresentar como certeza.

# ============================================================
# 33. MEU PLANO ESTRATÉGICO
# ============================================================

Resumo na Home pode conter:

- nome/foco do plano;
- progresso;
- próxima ação;
- bloqueio relevante;
- data de revisão.

Não mostrar lista completa de ações.

# ============================================================
# 34. PROGRESSO DO PLANO
# ============================================================

Mostrar quando útil:

2 de 4 ações concluídas

ou representação equivalente.

Não transformar em ferramenta de gestão de projetos.

# ============================================================
# 35. AÇÃO BLOQUEADA
# ============================================================

Se ação bloqueada ameaça o objetivo:

pode ganhar prioridade na Home.

Exemplo:

"Seu plano está parado na revisão da oferta."

[Destravar com a SEED]

Não mostrar todo bloqueio operacional irrelevante.

# ============================================================
# 36. GROWTH MAP RESUMIDO
# ============================================================

A Home pode mostrar resumo do Growth Map.

Dimensões:

Aquisição

Conversão

Ticket

Frequência

Retenção

Margem.

Preferir:

situação textual ou visual simples.

Não mostrar tabela técnica completa.

# ============================================================
# 37. GROWTH MAP — VISUAL
# ============================================================

Pode utilizar indicadores como:

Saudável

Merece atenção

Dados insuficientes

Oportunidade

Evitar excesso de vermelho/verde como único significado.

Garantir acessibilidade.

# ============================================================
# 38. PRINCIPAL DIMENSÃO
# ============================================================

A Home deve destacar no máximo uma dimensão principal do Growth Map.

Exemplo:

"Conversão merece atenção."

Não exibir seis problemas simultâneos.

# ============================================================
# 39. NÃO CRIAR GROWTH SCORE
# ============================================================

Não criar:

SEED Score

Growth Score 0–100

sem fórmula validada e já aprovada.

Usar estados e evidências da Fase 11.

# ============================================================
# 40. RADAR INSIGHT
# ============================================================

Quando existe Radar Insight relevante:

mostrar seção:

O QUE MERECE SUA ATENÇÃO

Exemplo:

"Você está recebendo mais interessados, mas proporcionalmente menos deles estão comprando."

[Analisar comigo]

Mostrar no máximo um Insight principal na Home, salvo justificativa forte.

# ============================================================
# 41. RADAR ATTENTION LEVEL
# ============================================================

Não mostrar códigos:

OBSERVE

ATTENTION

HIGH_ATTENTION.

Traduzir para linguagem natural.

# ============================================================
# 42. SEM ALERTA RELEVANTE
# ============================================================

Não mostrar card:

"Nenhum alerta."

O silêncio é válido.

# ============================================================
# 43. WEEKLY INTELLIGENCE
# ============================================================

Quando nova Inteligência Semanal estiver disponível:

mostrar resumo curto.

Exemplo:

INTELIGÊNCIA DA SEMANA

"Suas vendas melhoraram, mas os atrasos começaram a se repetir."

[Ver análise]

Não renderizar relatório completo na Home.

# ============================================================
# 44. RELATÓRIO SEMANAL LIDO
# ============================================================

Depois de visto:

não manter destaque alto indefinidamente.

Pode permanecer acessível em contexto secundário.

# ============================================================
# 45. RESULTADO RECENTE
# ============================================================

Quando um resultado importante foi registrado:

pode mostrar:

RESULTADO

"A nova abordagem foi acompanhada por melhora da conversão de X para Y durante o período."

Preservar segurança causal.

# ============================================================
# 46. LEARNING RELEVANTE
# ============================================================

Aprendizado pode aparecer somente quando útil para ação atual.

Não criar feed de aprendizados.

Exemplo:

"Da última vez que vocês testaram essa condição, a margem caiu."

Isso pode entrar no contexto da conversa ou insight.

# ============================================================
# 47. DECISION SIMULATOR
# ============================================================

Não mostrar simulações antigas na Home por padrão.

Pode mostrar:

"Você possui uma decisão aguardando revisão."

somente quando isso merece atenção.

# ============================================================
# 48. EXTERNAL INTELLIGENCE
# ============================================================

Não criar seção permanente de notícias/mercado.

External Intelligence deve aparecer apenas quando:

- relevante para a empresa;
- atual;
- fundamentada;
- relacionada a uma decisão, risco ou oportunidade.

Exemplo:

"Uma mudança externa pode afetar este ponto do seu negócio."

[Entender impacto]

# ============================================================
# 49. INTERNAL VS EXTERNAL
# ============================================================

Quando Insight combinar dados internos e externos:

deixar claro.

Exemplo:

"Dentro da sua empresa..."

"No mercado..."

"Minha leitura juntando os dois..."

Não misturar fontes.

# ============================================================
# 50. HIERARQUIA DE CONTEÚDO
# ============================================================

A Home deve priorizar:

1. pergunta principal + Composer;

2. foco/próximo passo;

3. atenção urgente/relevante;

4. meta;

5. progresso do plano;

6. Growth Map resumido;

7. Weekly Intelligence;

8. resultados/aprendizados.

Não mostrar tudo obrigatoriamente.

# ============================================================
# 51. LIMITE DE BLOCOS
# ============================================================

Evitar mais de 3 blocos estratégicos abaixo do Composer na Home inicial.

O usuário pode acessar detalhes por CTA.

Objetivo:

clareza.

# ============================================================
# 52. COCKPIT PRIORITY RESOLVER
# ============================================================

Criar serviço equivalente:

CockpitPriorityResolver

Responsabilidades:

- receber estado atual da empresa;
- avaliar itens elegíveis;
- ordenar por prioridade;
- remover duplicações;
- limitar quantidade;
- escolher foco principal;
- escolher CTA;
- respeitar leitura/acknowledgement;
- respeitar data quality;
- respeitar user context.

# ============================================================
# 53. ORDEM DE PRIORIDADE INICIAL
# ============================================================

Regra inicial sugerida:

1. High-attention Radar Insight validado;

2. ação bloqueada que ameaça meta/plano;

3. Next Best Action ativo;

4. Goal at risk;

5. decisão/revisão relevante;

6. nova Weekly Intelligence;

7. principal Growth Map concern;

8. resultado relevante;

9. oportunidade estratégica.

Essa ordem deve ser configurável e testável.

Não hardcode em dezenas de componentes.

# ============================================================
# 54. NÃO DUPLICAR A MESMA HISTÓRIA
# ============================================================

Exemplo:

Radar diz:

"Conversão caiu."

Growth Map diz:

"Conversão merece atenção."

Diagnosis diz:

"Conversão é o gargalo."

Home deve consolidar isso em um bloco principal.

Não mostrar três cards repetidos.

# ============================================================
# 55. COCKPIT ITEM
# ============================================================

Criar modelo interno equivalente a:

CockpitItem

Campos conceituais:

id

type

title

summary

priority

attention_level

source_type

source_id

primary_action

secondary_action optional

freshness

data_quality

acknowledged

created_at

updated_at

Não precisa ser tabela persistida.

Pode ser ViewModel derivado.

# ============================================================
# 56. COCKPIT VIEW MODEL
# ============================================================

Criar contrato de resposta equivalente a:

{
  "hero": {},
  "primary_focus": {},
  "goal_summary": {},
  "plan_summary": {},
  "growth_summary": {},
  "radar_insight": {},
  "weekly_summary": {},
  "recent_result": {},
  "items": [],
  "data_freshness": {},
  "available_actions": []
}

Campos devem ser optional/nullable conforme disponibilidade.

# ============================================================
# 57. COCKPIT AGGREGATION SERVICE
# ============================================================

Criar serviço equivalente:

CockpitAggregationService

Responsabilidades:

- carregar fontes existentes;
- construir ViewModel;
- aplicar Priority Resolver;
- localizar conteúdo;
- formatar para UI;
- não modificar sources of truth;
- evitar chamadas desnecessárias de IA;
- respeitar autorização;
- respeitar entitlements.

# ============================================================
# 58. DETERMINISTIC FIRST
# ============================================================

Construção do Cockpit deve ser prioritariamente determinística.

Usar dados persistidos.

Não chamar LLM toda vez que a Home abrir.

# ============================================================
# 59. LLM NO COCKPIT
# ============================================================

LLM pode ser utilizado apenas quando necessário para:

- narrativa curta previamente gerada;
- resumo estratégico persistido;
- transformação de linguagem já calculada;
- explicação contextual.

Não utilizar LLM como agregador de toda Home em cada carregamento.

# ============================================================
# 60. NARRATIVE FORMATTER
# ============================================================

Criar/reutilizar serviço equivalente:

CockpitNarrativeFormatter

Preferir templates localizados para casos simples.

Usar modelo quando narrativa exigir interpretação relevante e o resultado for persistido/cacheado.

# ============================================================
# 61. NÃO GERAR NOVA ANÁLISE NO PAGE LOAD
# ============================================================

Abrir a Home não deve:

- gerar novo diagnóstico;
- executar Radar completo;
- rodar Decision Simulator;
- pesquisar a web;
- gerar Weekly Intelligence;
- recalcular Growth Map inteiro via IA;
- criar Recommendation.

A Home lê resultados já processados.

Cálculos leves determinísticos são permitidos.

# ============================================================
# 62. ATUALIZAÇÃO DO COCKPIT
# ============================================================

O Cockpit pode ser atualizado quando:

- Goal muda;
- Metric muda;
- Diagnosis muda;
- Plan/Action muda;
- Radar Insight muda;
- Weekly Intelligence é gerada;
- Growth Map muda;
- Result/Learning muda;
- Market/locale muda;
- user acknowledges item.

Utilizar invalidation/eventos existentes.

# ============================================================
# 63. CACHE
# ============================================================

Pode utilizar cache para ViewModel.

Cache deve ser:

- por company;
- por user/role quando necessário;
- invalidável;
- com TTL seguro;
- sem vazamento entre tenants.

# ============================================================
# 64. CACHE INVALIDATION
# ============================================================

Invalidar quando fontes relevantes mudarem.

Não manter:

meta antiga;

próxima ação antiga;

Insight resolvido;

plano concluído;

por longos períodos.

# ============================================================
# 65. COCKPIT SNAPSHOT
# ============================================================

Persistência de snapshot é opcional.

Somente criar tabela se houver benefício real para:

- performance;
- auditabilidade;
- comparação;
- carga.

Se criar:

cockpit_snapshots

não vira source of truth.

# ============================================================
# 66. FRESHNESS
# ============================================================

Cada item deve conhecer sua atualização.

Exemplo:

"Atualizado hoje"

"Com base nos dados registrados até 05/10"

Não mostrar timestamp técnico excessivo.

# ============================================================
# 67. STALE DATA
# ============================================================

Não destacar recomendação como atual se depende de dado materialmente desatualizado.

Pode mostrar:

"Antes de seguir, preciso confirmar se este número continua atual."

[Atualizar com a SEED]

# ============================================================
# 68. DATA QUALITY
# ============================================================

Itens do Cockpit devem considerar:

- coverage;
- staleness;
- conflicts;
- approximation;
- range;
- scope;
- period;
- source;
- confidence.

Não mostrar certeza falsa.

# ============================================================
# 69. UNKNOWN ≠ ZERO
# ============================================================

Sem dados de retenção:

não mostrar retenção = 0.

Mostrar:

"Dados insuficientes"

ou omitir.

# ============================================================
# 70. APPROXIMATION
# ============================================================

Se dado é aproximado:

preservar.

Exemplo:

Faturamento atual:
aproximadamente R$82 mil.

Não apresentar R$82.000,00 como exato.

# ============================================================
# 71. RANGE
# ============================================================

Se valor é intervalo:

preservar.

Exemplo:

R$80 mil–R$100 mil.

Não escolher midpoint para exibição principal sem explicação.

# ============================================================
# 72. SCOPE
# ============================================================

Deixar claro quando indicador pertence a:

- empresa;
- unidade;
- produto;
- canal;
- período.

Não apresentar dado de uma unidade como dado total.

# ============================================================
# 73. PERIOD
# ============================================================

Sempre que necessário, exibir período.

Exemplo:

Faturamento de setembro

Conversão nas últimas 3 semanas

Meta até dezembro.

# ============================================================
# 74. SIMPLE LANGUAGE
# ============================================================

A Home deve utilizar linguagem simples.

Interno:

GOAL_TRAJECTORY_BEHIND

Usuário:

"Você está abaixo do ritmo necessário para atingir essa meta."

Interno:

CONVERSION_ATTENTION

Usuário:

"Poucas pessoas interessadas estão avançando para a compra."

# ============================================================
# 75. ADAPTIVE LANGUAGE
# ============================================================

Usuário sofisticado pode receber termos técnicos em detalhes.

A Home principal continua acessível.

Não infantilizar.

# ============================================================
# 76. CTA PRINCIPAL
# ============================================================

Cada bloco deve ter no máximo um CTA principal.

Exemplos:

[Continuar com a SEED]

[Analisar comigo]

[Revisar meu plano]

[Entender o diagnóstico]

[Ver minha meta]

[Atualizar informação]

# ============================================================
# 77. CTAS NÃO PODEM SER GENÉRICOS
# ============================================================

Evitar:

[Saiba mais]

quando ação pode ser específica.

# ============================================================
# 78. AÇÕES CONTEXTUAIS
# ============================================================

Ao clicar em CTA:

usar Action Resolver para decidir:

- abrir conversa;
- abrir Diagnóstico;
- abrir Plano;
- abrir Minha Empresa;
- abrir detalhe de Weekly Intelligence;
- abrir Growth Map;
- abrir decisão.

Não duplicar rotas.

# ============================================================
# 79. COCKPIT ACTION RESOLVER
# ============================================================

Criar/reutilizar serviço equivalente:

CockpitActionResolver

Responsabilidades:

- mapear item para destino;
- incluir contexto;
- respeitar permissões;
- preservar conversation state;
- não executar IA sem ação do usuário.

# ============================================================
# 80. CONVERSA CONTEXTUAL
# ============================================================

Ao abrir conversa por um item:

enviar contexto estruturado interno.

Exemplo:

source = RADAR_INSIGHT

related_signal_id

goal_id

diagnosis_id

plan_id

Não colocar tudo no texto do usuário.

# ============================================================
# 81. ATALHOS DA HOME
# ============================================================

Preservar atalhos simples quando usuário ainda não iniciou conversa:

Quero vender mais

Estou com um problema

Preciso tomar uma decisão

Quero melhorar meu negócio

Não adicionar dezenas.

# ============================================================
# 82. COMPOSER
# ============================================================

Preservar suporte a:

- texto;
- imagem;
- foto;
- documento;
- arquivo.

Não remover funcionalidades da 9.2.

# ============================================================
# 83. GERAÇÃO DE IMAGEM
# ============================================================

Não adicionar botão principal de geração de imagem ao Cockpit.

O usuário pode pedir no chat.

Estratégia primeiro.

Produção depois.

# ============================================================
# 84. EMPTY STATES
# ============================================================

Criar empty states úteis.

Sem Goal:

"Você ainda não definiu uma meta principal."

Sem Plan:

"Quando a SEED identificar um caminho e você decidir seguir, seu plano aparecerá aqui."

Sem dados suficientes:

"A SEED ainda precisa conhecer melhor este ponto antes de orientar com segurança."

Não inventar dados.

# ============================================================
# 85. LOADING
# ============================================================

Usar skeletons simples.

Não mostrar spinner global longo se partes podem carregar independentemente.

# ============================================================
# 86. PARTIAL FAILURE
# ============================================================

Se um bloco falhar:

não derrubar toda Home.

Exemplo:

Weekly summary indisponível.

Meta e Plano continuam funcionando.

# ============================================================
# 87. DEGRADED MODE
# ============================================================

Em caso de falha de serviço secundário:

mostrar Home básica com:

- pergunta principal;
- Composer;
- conversas;
- dados persistidos disponíveis.

Não bloquear o empresário.

# ============================================================
# 88. ERROR LANGUAGE
# ============================================================

Mensagem ao usuário:

"Não consegui carregar esta parte agora."

Não mostrar stack trace.

Não expor IDs/secrets.

# ============================================================
# 89. API
# ============================================================

Criar endpoint/action equivalente:

GET /api/companies/:companyId/cockpit

Retornar CockpitViewModel autorizado.

Pode usar server action conforme arquitetura.

# ============================================================
# 90. API RESPONSE
# ============================================================

Resposta deve conter somente dados necessários à UI.

Não expor:

raw Business Graph;

raw Memory;

prompt;

internal confidence details desnecessários;

private metadata;

secrets.

# ============================================================
# 91. API SECURITY
# ============================================================

Validar:

authentication;

company membership;

role;

entitlements;

market;

locale.

Não confiar no companyId do frontend.

# ============================================================
# 92. RLS
# ============================================================

Se houver nova tabela/cache/snapshot:

RLS obrigatório.

Empresa A nunca pode ler Cockpit de Empresa B.

# ============================================================
# 93. MULTI-TENANCY
# ============================================================

Testar:

- usuário com uma empresa;
- usuário com múltiplas empresas, se já suportado;
- company switch;
- roles diferentes;
- admin.

# ============================================================
# 94. PERMISSÕES
# ============================================================

Se empresa possui membros:

o Cockpit pode variar conforme permissão somente quando necessário.

Não ocultar indiscriminadamente dados essenciais do dono.

Reutilizar RBAC existente.

# ============================================================
# 95. FREE / PRO
# ============================================================

Integrar com entitlements existentes.

O Cockpit FREE deve entregar valor real.

Não mostrar uma Home vazia.

Recursos PRO podem aparecer:

- com explicação clara;
- sem dark pattern;
- sem bloquear dados já fornecidos;
- sem expor tokens.

Não criar nova política comercial nesta fase.

# ============================================================
# 96. UPGRADE
# ============================================================

Quando CTA PRO for apropriado:

mostrar valor empresarial.

Exemplo:

"Continue acompanhando seu plano, metas e evolução com a SEED PRO."

Não:

"Compre mais tokens."

# ============================================================
# 97. INTERNATIONALIZATION
# ============================================================

Suportar:

pt-BR

pt-PT

es-ES

en-US.

Todas as strings devem usar i18n existente.

# ============================================================
# 98. BANDEIRA / IDIOMA
# ============================================================

Preservar seletor de idioma/região por bandeira já implementado.

Não confundir idioma com mercado.

# ============================================================
# 99. FORMATADORES
# ============================================================

Utilizar helpers existentes para:

currency

numbers

percentages

dates

periods

timezone.

Não hardcode R$.

# ============================================================
# 100. ACCESSIBILITY
# ============================================================

Implementar:

- headings semânticos;
- aria-labels;
- keyboard navigation;
- focus states;
- contraste;
- status não dependente apenas de cor;
- touch targets adequados;
- screen reader labels;
- reduced motion quando aplicável.

# ============================================================
# 101. RESPONSIVIDADE
# ============================================================

Testar:

desktop grande

laptop

tablet

mobile comum

mobile estreito.

Evitar:

overflow horizontal;

cards cortados;

Composer coberto;

drawer quebrado;

texto impossível de ler.

# ============================================================
# 102. PERFORMANCE
# ============================================================

Objetivos:

- evitar cascatas de fetch;
- evitar N+1;
- carregar itens em paralelo quando seguro;
- não enviar dados excessivos;
- não rodar IA no page load;
- não carregar históricos completos;
- paginar quando necessário;
- usar cache com segurança.

# ============================================================
# 103. FIRST LOAD
# ============================================================

A Home deve ser útil rapidamente.

Priorizar:

hero + Composer

primary focus

goal summary.

Blocos secundários podem carregar depois.

# ============================================================
# 104. OBSERVABILIDADE
# ============================================================

Registrar quando apropriado:

cockpit_load_started

cockpit_load_completed

cockpit_partial_failure

cockpit_item_shown

cockpit_item_clicked

cockpit_context_opened

cockpit_cache_hit

cockpit_cache_miss

Não registrar conteúdo empresarial sensível desnecessariamente.

# ============================================================
# 105. ANALYTICS
# ============================================================

Preparar eventos:

home_viewed

composer_started

quick_action_clicked

continue_plan_clicked

goal_opened

diagnosis_opened

radar_insight_opened

weekly_intelligence_opened

growth_map_opened

cockpit_item_dismissed quando aplicável.

# ============================================================
# 106. MÉTRICAS DE PRODUTO
# ============================================================

Preparar análise futura de:

- Home → conversa;
- Home → plano;
- Home → diagnóstico;
- Home → meta;
- Insight → conversa;
- próximo passo executado;
- retenção semanal;
- tempo até primeira ação útil.

Não otimizar somente cliques.

# ============================================================
# 107. SEM DARK PATTERNS
# ============================================================

Não:

- esconder dados do usuário;
- criar urgência falsa;
- exagerar alertas;
- mostrar progresso fictício;
- forçar upgrade;
- simular atividade da IA;
- inventar Insights.

# ============================================================
# 108. DESIGN SYSTEM
# ============================================================

Reutilizar componentes existentes.

Criar novos componentes somente quando necessários.

Possíveis componentes:

CockpitHero

CockpitComposer

PrimaryFocusCard

GoalSummaryCard

PlanSummaryCard

GrowthSummaryCard

RadarInsightCard

WeeklySummaryCard

RecentResultCard

CockpitSection

CockpitSkeleton

Não criar cada card com estilo independente.

# ============================================================
# 109. CARDS
# ============================================================

Cards devem:

- ter hierarquia clara;
- evitar bordas excessivas;
- evitar sombras pesadas;
- evitar excesso de cores;
- possuir CTA claro;
- caber em mobile;
- funcionar com textos longos.

# ============================================================
# 110. CHARTS
# ============================================================

Usar gráficos somente quando melhorarem compreensão.

Não adicionar gráfico por estética.

Gráficos simples possíveis:

- progresso de meta;
- tendência curta;
- Growth Map resumido.

Evitar:

- múltiplos eixos;
- gráficos densos;
- visualização técnica.

# ============================================================
# 111. COLORS
# ============================================================

Não utilizar vermelho para toda atenção.

Utilizar hierarquia visual moderada.

Status devem possuir texto/ícone além da cor.

# ============================================================
# 112. ICONS
# ============================================================

Ícones simples e consistentes.

Não depender exclusivamente de ícone para significado.

# ============================================================
# 113. MOTION
# ============================================================

Animações sutis.

Não criar cockpit com efeitos chamativos.

Respeitar prefers-reduced-motion.

# ============================================================
# 114. NEW USER WIREFRAME
# ============================================================

Exemplo:

O que você precisa resolver
no seu negócio hoje?

[ Conte para a SEED... ]

Quero vender mais

Estou com um problema

Preciso tomar uma decisão

Quero melhorar meu negócio

Texto auxiliar:

"Você não precisa saber fazer prompts. Conte do seu jeito."

Sem cards falsos.

# ============================================================
# 115. RETURNING USER WIREFRAME
# ============================================================

O que você precisa resolver
no seu negócio hoje?

[ Conte para a SEED... ]

CONTINUE DE ONDE PARAMOS

Foco:
Melhorar o fechamento das vendas

Próximo passo:
Revisar as objeções mais frequentes

[Continuar com a SEED]

SUA META

R$82 mil de R$100 mil

Abaixo do ritmo necessário

O QUE MERECE ATENÇÃO

Conversão caiu nas últimas semanas

[Analisar comigo]

# ============================================================
# 116. ATTENTION STATE WIREFRAME
# ============================================================

Não substituir a pergunta principal.

Abaixo:

ISSO MERECE SUA ATENÇÃO

"Uma premissa da decisão que tomamos mudou."

Resumo curto.

[Revisar decisão]

Depois:

foco/plano/meta.

# ============================================================
# 117. ACTIVE PLAN STATE
# ============================================================

Mostrar:

Foco atual

Progresso

Próxima ação

Revisão.

Não mostrar todas as tarefas.

# ============================================================
# 118. GOAL AT RISK STATE
# ============================================================

Mostrar:

"Você está abaixo do ritmo necessário."

Explicar de forma simples.

CTA:

[Revisar meu plano]

Não gerar medo.

# ============================================================
# 119. OPPORTUNITY STATE
# ============================================================

Mostrar oportunidade somente quando evidência suficiente.

Exemplo:

"Produto X vem crescendo e mantendo margem saudável."

CTA:

[Analisar oportunidade]

Não dizer:

"Invista tudo no Produto X."

# ============================================================
# 120. DATA INSUFFICIENT STATE
# ============================================================

Exemplo:

"Ainda não tenho dados suficientes para avaliar seu ticket médio."

CTA opcional:

[Atualizar com a SEED]

Não mostrar zero.

# ============================================================
# 121. PRIMARY FOCUS CARD
# ============================================================

Conteúdo mínimo:

- título humano;
- resumo;
- por que importa;
- próximo passo;
- CTA.

Não mostrar taxonomy.

# ============================================================
# 122. GOAL SUMMARY CARD
# ============================================================

Conteúdo:

- meta;
- atual;
- alvo;
- prazo;
- status;
- CTA.

Somente dados confiáveis.

# ============================================================
# 123. PLAN SUMMARY CARD
# ============================================================

Conteúdo:

- foco;
- progresso;
- próxima ação;
- bloqueio relevante;
- CTA.

# ============================================================
# 124. GROWTH SUMMARY CARD
# ============================================================

Conteúdo:

- principal dimensão;
- estado;
- evidência curta;
- CTA.

Não repetir Diagnosis/Radar em outro texto.

# ============================================================
# 125. RADAR INSIGHT CARD
# ============================================================

Conteúdo:

- título simples;
- resumo;
- evidência;
- CTA;
- data/freshness quando útil.

# ============================================================
# 126. WEEKLY SUMMARY CARD
# ============================================================

Conteúdo:

- resumo curto;
- principal mudança;
- foco recomendado;
- CTA.

# ============================================================
# 127. RECENT RESULT CARD
# ============================================================

Conteúdo:

- o que foi testado/executado;
- resultado observado;
- limitação causal;
- aprendizado;
- CTA quando necessário.

# ============================================================
# 128. NO HEALTH SCORE
# ============================================================

Não criar:

Saúde da empresa 78/100

sem metodologia validada.

Cockpit deve comunicar prioridades, não criar falsa precisão.

# ============================================================
# 129. NO INFORMATION DUMP
# ============================================================

Não renderizar:

20 métricas

10 alertas

8 metas

15 ações.

A Home prioriza.

Detalhes ficam em telas existentes.

# ============================================================
# 130. USER DISMISSAL
# ============================================================

Se um Insight pode ser dispensado:

permitir ação discreta.

Não apagar sinal histórico necessariamente.

Respeitar Radar suppression.

# ============================================================
# 131. ACKNOWLEDGEMENT
# ============================================================

Abrir um Insight pode marcar como visto.

Não resolver automaticamente.

# ============================================================
# 132. FEATURE FLAGS
# ============================================================

Se arquitetura possuir feature flags:

permitir ativar Cockpit gradualmente.

Possíveis flags:

cockpit_enabled

cockpit_growth_summary_enabled

cockpit_weekly_enabled

cockpit_external_insight_enabled

Não espalhar verificações.

# ============================================================
# 133. MARKET CONFIGURATION
# ============================================================

Cockpit deve respeitar mercados ativos.

Textos/preços/planos conforme Market Control existente.

Não ativar novo mercado nesta fase.

# ============================================================
# 134. CONTENT CONFIGURATION
# ============================================================

Textos comerciais variáveis podem vir de configuração quando já suportado.

Não transformar toda interface em CMS.

# ============================================================
# 135. DATA REFRESH
# ============================================================

Definir estratégia:

- eventos para invalidação;
- refresh manual quando útil;
- TTL;
- polling mínimo;
- nenhuma chamada cara contínua.

# ============================================================
# 136. NO REAL-TIME REQUIREMENT
# ============================================================

Não implementar websockets/realtime indiscriminadamente.

Utilizar Supabase Realtime apenas se já existir necessidade clara.

# ============================================================
# 137. COCKPIT SNAPSHOT TABLE
# ============================================================

Se implementada, estrutura conceitual:

cockpit_snapshots

id

company_id

view_model

source_versions

generated_at

expires_at

created_at

updated_at

RLS obrigatório.

Snapshot não substitui fontes.

# ============================================================
# 138. SOURCE VERSIONS
# ============================================================

Se cache/snapshot:

guardar referências/versões suficientes para invalidar.

Exemplo:

goal_updated_at

plan_updated_at

radar_updated_at

growth_map_updated_at

weekly_report_updated_at.

# ============================================================
# 139. COCKPIT VIEW MODEL SERVICE
# ============================================================

Implementar serviço central.

Não montar lógica de prioridade diretamente em componentes React.

# ============================================================
# 140. COCKPIT PRIORITY RESOLVER SERVICE
# ============================================================

Implementar regras centralizadas e testáveis.

Não usar LLM como única fonte de ordenação.

# ============================================================
# 141. COCKPIT FRESHNESS SERVICE
# ============================================================

Responsável por:

- staleness;
- updated labels;
- suppression de conteúdo desatualizado;
- pedido de atualização.

# ============================================================
# 142. COCKPIT ACTION RESOLVER SERVICE
# ============================================================

Responsável por rotas/ações e contexto.

# ============================================================
# 143. COCKPIT NARRATIVE FORMATTER
# ============================================================

Responsável por linguagem localizada e simples.

Não duplicar lógica em cards.

# ============================================================
# 144. MODEL ROUTER
# ============================================================

Abrir Cockpit:

nenhum modelo.

Atualizar narrativa complexa:

ECONOMY ou STRATEGIC conforme materialidade.

Não hardcode modelos.

# ============================================================
# 145. USAGE/COST LOGGING
# ============================================================

Se houver uso de IA relacionado ao Cockpit, registrar features equivalentes:

COCKPIT_NARRATIVE_GENERATION

COCKPIT_PRIORITY_INTERPRETATION

COCKPIT_CONTEXT_SUMMARY

Evitar chamadas redundantes.

# ============================================================
# 146. RATE LIMITING
# ============================================================

Proteções existentes devem evitar refresh causando custos.

GET do Cockpit não deve gerar nova IA.

# ============================================================
# 147. UNIT TESTS
# ============================================================

Testar:

Priority Resolver

deduplicação

máximo de blocos

new user

low context

active goal

no goal

active plan

blocked action

Radar Insight

Weekly Intelligence

Growth Map summary

result summary

stale data

unknown

approximation

range

scope

locale

entitlements.

# ============================================================
# 148. INTEGRATION TESTS
# ============================================================

Testar:

Goals → Cockpit

Metrics → Goal status → Cockpit

Diagnosis → Focus → Cockpit

Plan → Next Action → Cockpit

Radar → Insight → Cockpit

Weekly Intelligence → Cockpit

Growth Map → Cockpit

Result/Learning → Cockpit

External Intelligence → Cockpit

CTA → Conversation context.

# ============================================================
# 149. UI TESTS
# ============================================================

Testar:

desktop layout

mobile layout

Sidebar

drawer

Composer

cards

loading

empty states

partial failure

CTA navigation

keyboard

screen reader labels

long text

locale changes.

# ============================================================
# 150. RLS TESTS
# ============================================================

Empresa A nunca acessa Cockpit da Empresa B.

Testar:

API

cache

snapshot

service queries.

# ============================================================
# 151. I18N TESTS
# ============================================================

Testar:

pt-BR

pt-PT

es-ES

en-US

currency/date/number formatting.

# ============================================================
# 152. PERFORMANCE TESTS
# ============================================================

Testar empresa com:

muitas métricas

muitas ações

muitos Signals

muitos relatórios

muito histórico.

Cockpit deve continuar carregando de forma eficiente.

# ============================================================
# 153. TESTE — NEW USER
# ============================================================

Esperado:

frase oficial

Composer

atalhos

sem cards falsos

sem chamadas de IA no load.

# ============================================================
# 154. TESTE — RETURNING USER
# ============================================================

Empresa possui:

Goal ativo

Plan ativo

Radar Insight

Growth Map.

Esperado:

no máximo 3 blocos abaixo do Composer

sem duplicação

foco claro.

# ============================================================
# 155. TESTE — GOAL AT RISK
# ============================================================

Meta abaixo da trajetória.

Plan existe.

Cockpit deve priorizar revisão do plano.

Não mostrar cinco cards repetindo a mesma situação.

# ============================================================
# 156. TESTE — ACTION BLOCKED
# ============================================================

Ação bloqueada ameaça meta.

Cockpit destaca:

próximo passo/destravar.

# ============================================================
# 157. TESTE — OPPORTUNITY
# ============================================================

Radar detecta oportunidade confiável.

Sem risco maior concorrente.

Cockpit pode mostrar oportunidade.

# ============================================================
# 158. TESTE — INSUFFICIENT DATA
# ============================================================

Sem dados de margem.

Growth Map margem = dados insuficientes.

Cockpit não mostra margem 0.

# ============================================================
# 159. TESTE — MULTIPLE SIGNALS
# ============================================================

Três sinais semelhantes sobre conversão.

Cockpit mostra um Insight consolidado.

# ============================================================
# 160. TESTE — FREE
# ============================================================

Usuário FREE recebe Home útil.

Recursos PRO são apresentados sem apagar dados.

# ============================================================
# 161. TESTE — MOBILE
# ============================================================

Composer acessível

cards empilhados

drawer preserva estado

sem overflow

CTA funciona.

# ============================================================
# 162. TESTE — NO AI ON LOAD
# ============================================================

Abrir Home repetidamente.

Esperado:

nenhuma chamada OpenAI nova apenas pelo page load.

# ============================================================
# 163. TESTE — CACHE INVALIDATION
# ============================================================

Atualizar Goal.

Cockpit deve refletir mudança sem deploy e sem cache antigo prolongado.

# ============================================================
# 164. TESTE — PARTIAL FAILURE
# ============================================================

Weekly service falha.

Cockpit continua mostrando Hero, Goal e Plan.

# ============================================================
# 165. CRITÉRIOS DE ACEITE FUNCIONAIS
# ============================================================

Fase 12 somente está concluída quando:

1. Cockpit é a Home inicial.

2. Frase oficial é preservada.

3. Composer permanece protagonista.

4. Sidebar desktop permanece visível.

5. Mobile utiliza drawer.

6. Navegação não ganhou módulos técnicos.

7. New User funciona sem dados falsos.

8. Returning User possui continuidade.

9. Focus atual é exibido quando existe.

10. Next Step é exibido quando existe.

11. Goal Summary funciona.

12. Goal status funciona.

13. Plan Summary funciona.

14. Radar Insight funciona.

15. Weekly Summary funciona.

16. Growth Summary funciona.

17. Recent Result funciona.

18. External Insight é contextual.

19. Conteúdos duplicados são consolidados.

20. Limite de blocos é respeitado.

21. Priority Resolver funciona.

22. Cockpit Aggregation funciona.

23. Action Resolver funciona.

24. Freshness funciona.

25. Unknown não vira zero.

26. Approximation é preservada.

27. Range é preservado.

28. Scope é preservado.

29. Period é exibido quando necessário.

30. CTAs levam ao contexto correto.

# ============================================================
# 166. CRITÉRIOS DE ACEITE FUNCIONAIS — CONTINUAÇÃO
# ============================================================

31. Page load não chama IA desnecessariamente.

32. Cache é seguro e invalidável.

33. API é autorizada.

34. RLS funciona.

35. Multi-tenancy funciona.

36. Entitlements funcionam.

37. i18n funciona.

38. Bandeira/idioma funciona.

39. Desktop funciona.

40. Mobile funciona.

41. Acessibilidade básica funciona.

42. Partial failure funciona.

43. Degraded mode funciona.

44. Analytics events funcionam.

45. Usage/cost logging funciona quando aplicável.

46. Logomarca permanece.

47. Design system permanece.

48. Fases anteriores não sofrem regressão.

49. lint passa.

50. typecheck passa.

51. testes passam.

52. build passa.

# ============================================================
# 167. CRITÉRIOS DE ACEITE DE PRODUTO
# ============================================================

Ao abrir a SEED, o empresário deve entender rapidamente:

O que posso perguntar?

Qual é meu foco atual?

Qual é meu próximo passo?

Como estou em relação à minha meta?

Existe algo importante acontecendo?

O que devo fazer agora?

Sem precisar interpretar dezenas de gráficos.

# ============================================================
# 168. TESTE DE DIFERENCIAÇÃO
# ============================================================

Perguntar:

"Esta Home parece apenas uma caixa de chat vazia?"

Se SIM:

faltou continuidade/contexto.

Perguntar:

"Esta Home parece um dashboard empresarial complicado?"

Se SIM:

há excesso.

O resultado esperado:

"Esta Home parece um estrategista que já conhece minha empresa e sabe onde paramos."

# ============================================================
# 169. TESTE ANTI-DASHBOARD
# ============================================================

Se a Home possuir:

muitos cards

muitos gráficos

muitos KPIs

muitos alertas

muitas cores

simplificar antes de concluir.

# ============================================================
# 170. TESTE ANTI-GENÉRICO
# ============================================================

Com empresa conhecida:

Cockpit deve usar contexto real.

Não mostrar recomendações genéricas que serviriam igualmente para qualquer negócio.

# ============================================================
# 171. REGRESSION CHECK
# ============================================================

Confirmar funcionamento de:

Chat

Composer

Anexos

Memória

Minha Empresa

Diagnóstico

Meu Plano Estratégico

Business Journal invisível

Weekly Intelligence

Execution Loop

Business Model

Decision Simulator

Radar

External Intelligence

Goals & Metrics

Growth Map

FREE/PRO

Markets

i18n

usage/cost.

# ============================================================
# 172. NÃO IMPLEMENTAR
# ============================================================

Não implementar nesta fase:

- ERP;
- CRM;
- BI completo;
- contabilidade;
- central de notícias;
- feed infinito;
- score arbitrário;
- push mobile;
- WhatsApp alert;
- e-mail de Cockpit;
- app nativo novo;
- novos planos comerciais;
- inteligência coletiva;
- execução autônoma externa;
- nova fase automaticamente;
- deploy automático em produção.

# ============================================================
# 173. DOCUMENTAÇÃO
# ============================================================

Criar documentação contendo:

1. visão do Cockpit;

2. relação Home/Chat;

3. Sources of Truth;

4. CockpitAggregationService;

5. CockpitPriorityResolver;

6. CockpitFreshnessService;

7. CockpitActionResolver;

8. CockpitNarrativeFormatter;

9. ViewModel;

10. API;

11. cache;

12. invalidation;

13. entitlements;

14. i18n;

15. accessibility;

16. performance;

17. analytics;

18. testes;

19. limitações;

20. operação.

# ============================================================
# 174. RELATÓRIO FINAL OBRIGATÓRIO
# ============================================================

Ao concluir, apresentar:

## RESUMO

O que foi implementado.

## ARQUITETURA ENCONTRADA

Estado anterior da Home.

## DECISÕES DE UX

Escolhas e justificativas.

## COMPONENTES

Criados e alterados.

## SERVICES

Aggregation, Priority, Freshness, Action e Narrative.

## VIEW MODEL

Contrato final.

## API

Rotas/actions.

## CACHE

Estratégia e invalidation.

## HOME NEW USER

Como funciona.

## HOME RETURNING USER

Como funciona.

## PRIMARY FOCUS

Como é escolhido.

## GOAL SUMMARY

Integração.

## PLAN SUMMARY

Integração.

## GROWTH SUMMARY

Integração.

## RADAR INSIGHT

Integração.

## WEEKLY INTELLIGENCE

Integração.

## EXTERNAL INTELLIGENCE

Integração.

## RESULTS / LEARNINGS

Integração.

## CHAT CONTEXT

Como CTAs abrem conversa.

## FREE / PRO

Como funciona.

## I18N

Idiomas e formatação.

## MOBILE

Experiência.

## ACCESSIBILITY

Implementação.

## SECURITY / RLS

Proteções.

## PERFORMANCE

Resultados.

## ANALYTICS

Eventos.

## TESTS

Resultados.

## LINT

Resultado.

## TYPECHECK

Resultado.

## BUILD

Resultado.

## LIMITAÇÕES

Itens ainda não suportados.

## TECHNICAL DEBT

Dívidas.

## MANUAL VALIDATION

Passo a passo completo.

# ============================================================
# 175. TABELA FINAL OBRIGATÓRIA
# ============================================================

Apresentar tabela equivalente:

Capability | Source | Status | Tested | Notes

Hero / Composer

Primary Focus

Next Step

Goal Summary

Plan Summary

Diagnosis Summary

Growth Summary

Radar Insight

Weekly Summary

Recent Result

External Insight

Priority Resolver

Deduplication

Freshness

Action Resolver

Cache

API

RLS

FREE/PRO

I18N

Mobile

Accessibility

Performance

Analytics

# ============================================================
# 176. RISCOS
# ============================================================

Listar explicitamente:

- risco de excesso de informação;
- risco de duplicação;
- risco de conteúdo desatualizado;
- risco de falsa precisão;
- risco de cache antigo;
- risco de page load caro;
- risco de chamadas IA involuntárias;
- risco de vazamento entre empresas;
- risco de paywall agressivo;
- risco de interface genérica;
- risco de transformação em dashboard complexo;
- risco de performance;
- risco de acessibilidade;
- risco de overengineering.

Para cada risco relevante:

informar mitigação e limitação.

# ============================================================
# 177. VALIDAÇÃO FINAL
# ============================================================

Executar:

- migrations;
- lint;
- typecheck;
- unit tests;
- integration tests;
- UI tests;
- RLS tests;
- i18n tests;
- performance checks;
- production build.

Validar manualmente:

- novo usuário;
- usuário com pouco contexto;
- usuário com meta;
- usuário sem meta;
- plano ativo;
- ação bloqueada;
- Radar Insight;
- Weekly Intelligence;
- Goal at risk;
- Growth Map;
- resultado recente;
- oportunidade;
- dados insuficientes;
- FREE;
- PRO;
- desktop;
- tablet;
- mobile;
- mudança de idioma;
- troca de empresa, se suportada;
- partial failure;
- cache invalidation;
- ausência de chamada IA no page load.

# ============================================================
# 178. STOP CONDITION
# ============================================================

Depois de:

implementação

migrations

lint

typecheck

testes

build

validação manual

relatório final

PARAR.

NÃO iniciar nova fase.

NÃO alterar roadmap.

NÃO fazer deploy automático em produção.

NÃO adicionar funcionalidades fora do escopo.

Aguardar minha autorização explícita.

# ============================================================
# FIM DA FASE 12
# SEED BUSINESS COCKPIT
# ============================================================
