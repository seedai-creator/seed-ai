# ============================================================
# SEED AI | FASE 13
# PRODUCTION READINESS, SECURITY, OBSERVABILITY & CLOSED BETA
# PRONTIDÃO DE PRODUÇÃO, SEGURANÇA, OBSERVABILIDADE E BETA FECHADO
# ============================================================

## 0. NOTA DE ROADMAP

No roadmap inicial, a Fase 13 previa Usage + Plans.

Essa responsabilidade já foi absorvida e ampliada pela Fase 9.1, que implementou:

- FREE e PRO;
- entitlements;
- usage metering;
- AI cost intelligence;
- Model Router;
- Stripe em modo de teste;
- subscriptions;
- Market Control;
- pricing regional;
- painel administrativo econômico.

Portanto, a Fase 13 passa oficialmente a ser:

PRODUCTION READINESS, SECURITY, OBSERVABILITY & CLOSED BETA.

Esta fase não deve duplicar monetização, planos ou billing.

Ela deve preparar a SEED AI para receber usuários reais com segurança, estabilidade, rastreabilidade e controle operacional.

# ============================================================
# 1. ORDEM DE EXECUÇÃO
# ============================================================

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
- Fase 11 — SEED Growth Map;
- Fase 12 — SEED Business Cockpit.

Antes de alterar código:

1. inspecionar toda a arquitetura atual;
2. inspecionar repositório, branches e histórico Git;
3. localizar ambientes development, staging e production;
4. localizar Vercel/deploy provider;
5. localizar Supabase/Auth/PostgreSQL;
6. localizar migrations e RLS;
7. localizar OpenAI integration;
8. localizar Model Router;
9. localizar File Uploads e Storage;
10. localizar Stripe/subscriptions/webhooks;
11. localizar Market Control;
12. localizar Admin;
13. localizar logging e error handling;
14. localizar analytics/event infrastructure;
15. localizar testes;
16. localizar CI/CD;
17. localizar feature flags;
18. localizar backup/recovery configuration;
19. localizar política de privacidade e termos quando existirem;
20. localizar todas as variáveis de ambiente;
21. localizar todos os secrets;
22. identificar débitos técnicos de alto risco;
23. não reescrever módulos estáveis sem necessidade;
24. não adicionar funcionalidades comerciais novas fora do escopo.

NÃO iniciar Fase 14 automaticamente.

Ao terminar:

- migrations necessárias;
- lint;
- typecheck;
- testes unitários;
- testes de integração;
- testes E2E;
- testes RLS;
- testes de segurança;
- testes de carga;
- build de produção;
- validação em staging;
- relatório técnico e operacional;
- PARAR;
- aguardar aprovação explícita.

# ============================================================
# 2. OBJETIVO CENTRAL
# ============================================================

Preparar a SEED AI para um BETA FECHADO com usuários reais.

A fase deve garantir que o produto esteja:

- estável;
- seguro;
- observável;
- recuperável;
- controlável;
- mensurável;
- economicamente protegido;
- preparado para incidentes;
- preparado para feedback;
- preparado para rollout gradual.

A fase NÃO tem como objetivo escalar aquisição.

Primeiro:

VALIDAR COM SEGURANÇA.

Depois:

ESCALAR.

# ============================================================
# 3. PRINCÍPIO DE PRODUTO
# ============================================================

A SEED será utilizada para decisões empresariais.

Portanto:

CONFIABILIDADE
>
VELOCIDADE DE LANÇAMENTO.

Não atrasar indefinidamente por perfeccionismo.

Mas não liberar clientes reais sem:

- isolamento de dados;
- backups;
- controle de custos;
- logs;
- alertas;
- recuperação;
- termos;
- privacidade;
- fluxo de suporte;
- kill switches;
- testes críticos.

# ============================================================
# 4. NÃO CRIAR NOVAS FEATURES PRINCIPAIS
# ============================================================

Esta fase é de hardening e validação.

NÃO implementar:

- novos motores estratégicos;
- novas abas principais;
- CRM;
- ERP;
- novos agentes;
- integrações complexas;
- App Store;
- Google Play;
- inteligência coletiva;
- automações externas autônomas;
- novos planos comerciais;
- marketplace;
- white label.

Correções e pequenos ajustes necessários para segurança, estabilidade e beta são permitidos.

# ============================================================
# 5. AMBIENTES
# ============================================================

Estruturar claramente:

DEVELOPMENT

STAGING

PRODUCTION

Cada ambiente deve possuir:

- banco separado quando apropriado;
- secrets próprios;
- OpenAI Project/Key apropriado;
- Stripe test/live conforme ambiente;
- domínio apropriado;
- logs separados;
- storage separado quando necessário;
- feature flags próprias;
- Market configuration própria.

# ============================================================
# 6. DEVELOPMENT
# ============================================================

Uso:

- desenvolvimento local;
- testes rápidos;
- dados fictícios;
- experimentação.

Não utilizar dados reais de clientes.

Não utilizar chaves de produção.

# ============================================================
# 7. STAGING
# ============================================================

Staging deve representar produção o mais fielmente possível.

Uso:

- QA;
- testes E2E;
- migrations;
- Stripe test mode;
- simulação FREE/PRO;
- testes de mercado;
- testes de carga controlados;
- validação antes de release.

Nunca apontar Staging para banco de produção.

# ============================================================
# 8. PRODUCTION
# ============================================================

Production é o ambiente de clientes reais.

Alterações devem passar por:

development
↓
tests
↓
staging
↓
approval
↓
production.

Não permitir deploy automático de mudanças críticas sem gate apropriado.

# ============================================================
# 9. ENVIRONMENT VALIDATION
# ============================================================

Criar validação de variáveis de ambiente no startup/build.

Falhar claramente quando secret/config obrigatório estiver ausente.

Não permitir fallback silencioso para chave errada.

# ============================================================
# 10. SECRETS
# ============================================================

Secrets devem existir somente em mecanismos seguros do provider.

Nunca versionar:

- OpenAI keys;
- Stripe secret;
- Stripe webhook secret;
- Supabase service role key;
- database password;
- email provider secret;
- signing secrets;
- admin tokens.

Atualizar `.env.example` apenas com placeholders.

# ============================================================
# 11. SECRET SCANNING
# ============================================================

Adicionar ou validar secret scanning no repositório/CI.

Detectar:

- chaves;
- tokens;
- credenciais;
- connection strings;
- arquivos `.env`.

Se secret já tiver sido exposto:

revogar e rotacionar.

Não considerar remoção do Git suficiente.

# ============================================================
# 12. KEY ROTATION
# ============================================================

Documentar procedimento para rotacionar:

- OpenAI key;
- Stripe secret;
- webhook secret;
- Supabase service role;
- database credentials;
- email provider credentials.

Sem downtime significativo quando possível.

# ============================================================
# 13. GIT WORKFLOW
# ============================================================

Definir fluxo simples:

main
=
produção estável.

develop ou branch de integração
=
staging, se arquitetura atual utilizar.

feature/*
=
mudanças isoladas.

hotfix/*
=
correções urgentes.

Não impor complexidade desnecessária se equipe for pequena.

Mas nunca desenvolver diretamente em produção sem versionamento.

# ============================================================
# 14. COMMITS
# ============================================================

Commits devem ser rastreáveis e coerentes.

Não incluir secrets.

Não misturar dezenas de mudanças não relacionadas quando evitável.

# ============================================================
# 15. RELEASE VERSIONING
# ============================================================

Preparar versionamento do produto.

Exemplo:

0.1.0-beta

0.2.0-beta

1.0.0

Não exigir semver perfeito para toda mudança, mas preservar histórico de releases.

# ============================================================
# 16. RELEASE NOTES
# ============================================================

Cada release de beta deve possuir:

- versão;
- data;
- funcionalidades;
- correções;
- migrations;
- riscos;
- rollback;
- limitações conhecidas.

# ============================================================
# 17. CI/CD
# ============================================================

Criar ou validar pipeline contendo:

- install;
- lint;
- typecheck;
- unit tests;
- integration tests relevantes;
- build;
- secret scan;
- dependency/security checks;
- migration validation quando seguro.

Falha crítica deve bloquear merge/deploy.

# ============================================================
# 18. DEPLOY GATES
# ============================================================

Production deploy deve exigir:

- CI verde;
- staging validado;
- migrations revisadas;
- backup recente;
- rollback conhecido;
- aprovação explícita.

# ============================================================
# 19. MIGRATIONS
# ============================================================

Todas as migrations devem ser:

- incrementais;
- versionadas;
- idempotentes quando apropriado;
- revisadas;
- testadas em staging;
- não destrutivas por padrão;
- compatíveis com rollback quando possível.

# ============================================================
# 20. ZERO/LOW-DOWNTIME MIGRATIONS
# ============================================================

Para mudanças críticas:

preferir estratégia compatível com versões anterior e nova.

Exemplo:

1. adicionar campo nullable;
2. deploy compatível;
3. backfill;
4. tornar obrigatório depois, se necessário.

Evitar migration que bloqueia tabela grande desnecessariamente.

# ============================================================
# 21. MIGRATION BACKUP
# ============================================================

Antes de migration relevante em produção:

confirmar backup/restoration point.

Não executar destructive migration sem plano explícito.

# ============================================================
# 22. ROLLBACK
# ============================================================

Documentar rollback para:

- frontend;
- backend;
- migration;
- feature flag;
- Model Router;
- market activation;
- billing;
- AI provider.

Rollback não pode depender apenas de memória do desenvolvedor.

# ============================================================
# 23. FEATURE FLAGS
# ============================================================

Utilizar feature flags server-side para liberar gradualmente:

- Cockpit;
- Growth Map;
- Radar;
- External Intelligence;
- Decision Simulator;
- Weekly Intelligence;
- beta cohorts;
- recursos PRO.

Não usar flags espalhadas.

Criar camada central.

# ============================================================
# 24. BETA COHORT FLAG
# ============================================================

Preparar flag/entitlement:

BETA_ACCESS

Permitir liberar produto somente para usuários selecionados.

# ============================================================
# 25. CANARY RELEASE
# ============================================================

Quando possível:

liberar mudança relevante primeiro para:

- contas internas;
- pequena porcentagem;
- coorte beta específica.

Depois ampliar.

# ============================================================
# 26. KILL SWITCHES
# ============================================================

Reutilizar/evoluir kill switches para:

- novas inscrições;
- novas assinaturas;
- chamadas de IA;
- web search;
- upload de arquivos;
- geração de imagem;
- Radar;
- Decision Simulator;
- External Intelligence;
- mercado específico;
- modelo específico.

Kill switch precisa de:

- autorização elevada;
- audit log;
- confirmação;
- efeito rápido.

# ============================================================
# 27. SUPABASE PRODUCTION PLAN
# ============================================================

A conta Free pode continuar no desenvolvimento.

Antes de receber dados reais em beta comercial/operacional:

validar migração para plano de produção adequado, como Supabase Pro ou equivalente.

Essa ação de billing pode exigir intervenção manual do fundador.

Codex deve:

- preparar checklist;
- verificar configurações;
- não tentar contratar plano automaticamente;
- reportar o que precisa ser feito manualmente.

# ============================================================
# 28. DATABASE BACKUPS
# ============================================================

Confirmar:

- backups automáticos;
- retenção;
- frequência;
- restauração;
- responsável;
- documentação.

Não considerar backup válido sem teste de restauração.

# ============================================================
# 29. RESTORE DRILL
# ============================================================

Executar em staging um teste de restauração.

Validar:

- banco;
- storage metadata;
- usuários;
- companies;
- Memory;
- Journal;
- Plans;
- Metrics;
- subscriptions;
- usage logs.

Documentar tempo e limitações.

# ============================================================
# 30. RECOVERY POINT
# ============================================================

Definir RPO inicial para beta.

Exemplo conceitual:

quanto de dado podemos perder em um incidente?

Não inventar promessa pública sem infraestrutura.

Documentar internamente.

# ============================================================
# 31. RECOVERY TIME
# ============================================================

Definir RTO inicial para beta.

Quanto tempo pode levar para restaurar serviço?

Documentar de forma realista.

# ============================================================
# 32. DATABASE MONITORING
# ============================================================

Monitorar:

- storage;
- connections;
- slow queries;
- CPU/compute;
- memory;
- egress;
- auth usage;
- errors;
- replication/backup status quando aplicável.

# ============================================================
# 33. INDEX REVIEW
# ============================================================

Revisar índices de:

- company_id;
- user_id;
- conversation_id;
- message_id;
- created_at;
- metric period;
- Radar;
- Goals;
- Plans;
- Business Graph;
- usage logs;
- subscriptions.

Não criar índices excessivos.

# ============================================================
# 34. QUERY AUDIT
# ============================================================

Identificar:

- N+1;
- full table scans;
- consultas sem company filter;
- consultas sem paginação;
- joins pesados;
- carregamento de históricos completos.

Corrigir riscos críticos.

# ============================================================
# 35. CONNECTION MANAGEMENT
# ============================================================

Validar uso de connection pooling/serverless compatibility.

Evitar esgotar conexões em picos.

# ============================================================
# 36. RLS AUDIT
# ============================================================

Auditar todas as tabelas expostas.

Cada tabela multi-tenant deve possuir RLS apropriado.

Não confiar somente no backend.

# ============================================================
# 37. CROSS-TENANT TEST SUITE
# ============================================================

Criar suíte que tente acessar dados entre:

- Empresa A;
- Empresa B;
- usuário não membro;
- membro com papel restrito;
- admin;
- service role apenas server-side.

Cobrir:

Memory

Journal

Business Model

Plans

Goals

Metrics

Radar

Simulations

External Intelligence

Subscriptions

Cockpit

Files.

# ============================================================
# 38. AUTHENTICATION
# ============================================================

Validar:

- signup;
- login;
- logout;
- password reset;
- email verification quando utilizada;
- session refresh;
- expired session;
- revoked user;
- disabled account.

# ============================================================
# 39. SESSION SECURITY
# ============================================================

Validar:

- cookies seguros;
- HTTPS;
- SameSite;
- secure flag;
- session invalidation;
- no tokens in URLs;
- no sensitive data in localStorage quando evitável.

# ============================================================
# 40. RBAC
# ============================================================

Revisar permissões:

- usuário;
- company owner;
- company member;
- admin viewer;
- admin operator;
- super admin;
- internal/beta.

Não conceder privilégios amplos por conveniência.

# ============================================================
# 41. ADMIN SECURITY
# ============================================================

Admin deve possuir:

- autenticação forte;
- autorização server-side;
- audit logs;
- proteção contra enumeração;
- nenhuma secret exposta;
- operações perigosas com confirmação.

# ============================================================
# 42. ADMIN IMPERSONATION
# ============================================================

Não implementar impersonation inseguro.

Se já existir ou for necessário:

- consentimento/política interna;
- audit log;
- indicador claro;
- tempo limitado;
- sem acesso a secrets;
- role restrita.

# ============================================================
# 43. INPUT VALIDATION
# ============================================================

Todos os endpoints devem validar payload.

Utilizar schemas.

Não confiar em:

- IDs;
- plan;
- company;
- currency;
- role;
- file metadata;
- AI output;
- frontend state.

# ============================================================
# 44. OUTPUT VALIDATION
# ============================================================

Structured Outputs da IA devem ser validados.

Falha de schema:

- não persistir parcialmente;
- registrar erro;
- retry seguro;
- fallback apropriado.

# ============================================================
# 45. XSS
# ============================================================

Sanitizar/renderizar com segurança:

- mensagens;
- Markdown;
- documentos;
- External Intelligence;
- nomes de empresas;
- arquivos;
- conteúdo gerado pela IA.

Não permitir script arbitrário.

# ============================================================
# 46. CSRF
# ============================================================

Validar proteção de ações mutáveis conforme arquitetura/auth utilizada.

# ============================================================
# 47. CORS
# ============================================================

Configurar origens necessárias.

Não utilizar wildcard em produção sem justificativa.

# ============================================================
# 48. SECURITY HEADERS
# ============================================================

Configurar quando aplicável:

- Content-Security-Policy;
- X-Content-Type-Options;
- Referrer-Policy;
- Permissions-Policy;
- frame protection;
- HSTS no domínio de produção.

Testar para não quebrar funcionalidades legítimas.

# ============================================================
# 49. FILE UPLOAD SECURITY
# ============================================================

Validar uploads:

- tamanho;
- extensão;
- MIME real;
- nome seguro;
- tenant;
- path;
- autorização;
- storage bucket;
- signed URLs;
- expiração;
- download;
- deletion.

# ============================================================
# 50. FILE LIMITS
# ============================================================

Definir limites configuráveis por:

- tipo;
- plano;
- mercado;
- feature.

Não permitir uploads ilimitados.

# ============================================================
# 51. MALICIOUS FILES
# ============================================================

Preparar/implementar proteção adequada para arquivos maliciosos.

Não executar conteúdo enviado.

Não confiar em extensão.

Quando scanning externo não estiver disponível:

limitar tipos, manter isolamento e documentar limitação.

# ============================================================
# 52. PDF/DOCUMENT SAFETY
# ============================================================

Conteúdo de documentos é não confiável.

Não permitir que texto dentro de documento altere instruções de sistema.

Tratar como dados.

# ============================================================
# 53. PROMPT INJECTION
# ============================================================

Fortalecer proteção para:

- web pages;
- PDFs;
- documentos;
- arquivos;
- imagens com texto;
- resultados externos.

Conteúdo externo nunca deve poder:

- alterar system prompt;
- pedir secrets;
- chamar tools sem autorização;
- mudar company;
- ignorar políticas;
- executar operações administrativas.

# ============================================================
# 54. TOOL PERMISSIONS
# ============================================================

Cada tool deve possuir:

- schema;
- autorização;
- validação;
- escopo;
- side-effect classification;
- idempotência;
- audit log quando mutável.

# ============================================================
# 55. READ VS WRITE TOOLS
# ============================================================

Distinguir:

READ-ONLY

WRITE

HIGH-IMPACT WRITE.

A IA não deve executar write crítico sem consentimento/fluxo apropriado.

# ============================================================
# 56. NO AUTONOMOUS EXTERNAL ACTIONS
# ============================================================

Durante beta, a SEED não deve:

- movimentar dinheiro;
- publicar campanha;
- contratar;
- demitir;
- assinar contrato;
- alterar preço externo;
- enviar mensagens a clientes;
- deletar dados críticos;
- ativar mercado;
- mudar assinatura;

sem autorização explícita e infraestrutura segura.

# ============================================================
# 57. AI PROVIDER SECURITY
# ============================================================

Chave da OpenAI somente server-side.

Não expor request completo em logs públicos.

Minimizar dados enviados.

# ============================================================
# 58. DATA MINIMIZATION FOR AI
# ============================================================

Context Engine deve enviar somente informações necessárias.

Não enviar banco inteiro.

Não enviar dados pessoais desnecessários.

# ============================================================
# 59. MEMORY SAFETY
# ============================================================

Auditar:

- hipótese não vira fato;
- informação sensível não vira memória indiscriminadamente;
- usuário consegue corrigir/excluir;
- source/confidence preservados;
- tenant isolado.

# ============================================================
# 60. STRATEGIC SAFETY
# ============================================================

Preservar Reliability Layer.

A SEED deve:

- reconhecer incerteza;
- pedir dados;
- evitar garantia;
- distinguir fato/hipótese;
- evitar causalidade indevida;
- tratar decisões de alto impacto com rigor;
- orientar validação profissional quando aplicável.

# ============================================================
# 61. LEGAL/TAX/MEDICAL BOUNDARIES
# ============================================================

SEED é estrategista empresarial.

Não se apresentar como substituta de:

- advogado;
- contador;
- médico;
- engenheiro;
- consultor financeiro regulado.

Pode organizar cenários e perguntas.

Deve indicar validação profissional quando necessário.

# ============================================================
# 62. CONTENT SAFETY
# ============================================================

Reutilizar políticas existentes para conteúdo.

Não permitir que geração de imagem/documento seja utilizada de forma abusiva ou ilegal.

Não criar sistema de moderação excessivo que bloqueie orientação empresarial legítima.

# ============================================================
# 63. RETRY POLICY
# ============================================================

Definir retries seguros por tipo de erro.

Não repetir:

- erro de validação;
- erro de autorização;
- requisição inválida;
- write já concluído.

Retry apenas para falhas transitórias.

# ============================================================
# 64. IDEMPOTENCY
# ============================================================

Operações críticas devem ser idempotentes.

Cobrir:

- webhooks;
- subscriptions;
- usage logging;
- message processing;
- Memory;
- Journal;
- Business Model;
- Radar;
- Weekly Intelligence;
- uploads;
- background jobs.

# ============================================================
# 65. TIMEOUTS
# ============================================================

Definir timeouts por operação:

- chat;
- web search;
- file processing;
- image generation;
- background jobs;
- database;
- Stripe.

Não deixar requisições penduradas indefinidamente.

# ============================================================
# 66. CIRCUIT BREAKERS
# ============================================================

Reutilizar/evoluir circuit breakers para:

- OpenAI;
- web search;
- Supabase;
- Stripe;
- email;
- file processing.

Em falha:

degradar com segurança.

# ============================================================
# 67. PROVIDER OUTAGE
# ============================================================

Em indisponibilidade da OpenAI:

- não perder mensagens;
- informar usuário;
- permitir retry;
- preservar dados;
- manter telas de leitura;
- não gerar resposta falsa.

# ============================================================
# 68. MODEL FALLBACK
# ============================================================

Fallback deve respeitar capacidade necessária.

Não usar modelo incapaz para decisão crítica apenas para responder.

Pode:

- adiar;
- pedir retry;
- oferecer análise limitada;
- usar fallback aprovado.

Registrar.

# ============================================================
# 69. DEGRADED MODE
# ============================================================

Se IA indisponível:

usuário ainda pode:

- acessar empresa;
- ver plano;
- ver metas;
- ver Cockpit persistido;
- ver histórico;
- editar dados permitidos.

# ============================================================
# 70. BACKGROUND JOBS
# ============================================================

Auditar jobs:

- Journal;
- Weekly Intelligence;
- Radar;
- External Intelligence;
- file processing;
- summaries;
- usage aggregation.

Cada job deve possuir:

- status;
- retry;
- idempotency;
- timeout;
- dead-letter/error state;
- observability.

# ============================================================
# 71. JOB VISIBILITY
# ============================================================

Admin deve conseguir identificar jobs falhos relevantes.

Não expor detalhes técnicos a usuários comuns.

# ============================================================
# 72. OBSERVABILITY
# ============================================================

Criar/validar observabilidade com:

- logs;
- metrics;
- traces/correlation;
- errors;
- alerts;
- dashboards operacionais.

# ============================================================
# 73. CORRELATION ID
# ============================================================

Cada fluxo relevante deve poder correlacionar:

- request;
- user;
- company;
- conversation;
- feature;
- model;
- provider;
- job;
- cost;
- error.

Sem expor dados sensíveis.

# ============================================================
# 74. STRUCTURED LOGGING
# ============================================================

Logs estruturados.

Evitar `console.log` disperso em produção.

Não logar:

- API keys;
- passwords;
- full payment data;
- sensitive business content;
- raw documents;
- service role key.

# ============================================================
# 75. REDACTION
# ============================================================

Implementar redaction de dados sensíveis em logs.

# ============================================================
# 76. ERROR MONITORING
# ============================================================

Integrar ou validar ferramenta de error monitoring apropriada.

Registrar:

- frontend errors;
- backend exceptions;
- failed jobs;
- provider failures;
- schema failures;
- RLS violations;
- webhook failures.

Não enviar conteúdo sensível desnecessário.

# ============================================================
# 77. OPERATIONAL METRICS
# ============================================================

Monitorar:

- request count;
- error rate;
- latency;
- AI success;
- job success;
- DB latency;
- cache hit;
- upload failures;
- webhook failures;
- auth failures;
- build/deploy health.

# ============================================================
# 78. AI METRICS
# ============================================================

Monitorar:

- calls by feature;
- calls by model;
- input/output/cached tokens;
- cost by plan;
- cost by company;
- timeout rate;
- retry rate;
- schema failure;
- fallback rate;
- tool failure.

# ============================================================
# 79. BUSINESS PRODUCT METRICS
# ============================================================

Monitorar:

- signup;
- company created;
- activated user;
- diagnosis completed;
- plan created;
- action executed;
- result registered;
- Weekly Intelligence viewed;
- Radar Insight engaged;
- Decision Simulation completed;
- FREE → PRO;
- churn quando aplicável.

# ============================================================
# 80. QUALITY METRICS
# ============================================================

Preparar métricas/evals para:

- factuality;
- context usage;
- missing-data recognition;
- generic response rate;
- hallucination rate;
- unsafe certainty;
- actionability;
- user correction rate;
- memory correction rate;
- decision follow-up coverage.

# ============================================================
# 81. SERVICE LEVEL INDICATORS
# ============================================================

Definir SLIs iniciais:

- availability;
- chat success rate;
- p95 latency;
- job completion;
- database success;
- webhook success;
- error rate.

# ============================================================
# 82. SERVICE LEVEL OBJECTIVES
# ============================================================

Definir metas internas realistas para beta.

Não publicar SLA comercial sem estrutura/contrato.

# ============================================================
# 83. ALERTS
# ============================================================

Criar alertas internos para:

- error spike;
- cost spike;
- database nearing limit;
- backup failure;
- webhook failure;
- auth anomaly;
- job backlog;
- AI provider outage;
- cross-tenant test failure;
- payment failures;
- global circuit breaker.

# ============================================================
# 84. ALERT FATIGUE
# ============================================================

Alertas operacionais também precisam de prioridade.

Não enviar tudo como crítico.

# ============================================================
# 85. ADMIN OPERATIONS DASHBOARD
# ============================================================

Evoluir Admin para visão operacional:

- system health;
- AI cost;
- job failures;
- subscriptions;
- beta users;
- feature flags;
- market status;
- errors;
- usage anomalies;
- support issues.

Não expor dados de empresas sem necessidade.

# ============================================================
# 86. COST PROTECTION
# ============================================================

Revalidar:

- FREE soft/hard limits;
- PRO fair use;
- per-user daily/monthly limits;
- global daily limit;
- model routing;
- web search costs;
- file processing costs;
- image generation costs;
- retry costs.

# ============================================================
# 87. COST ALERTS
# ============================================================

Alertar quando:

- custo diário supera threshold;
- custo por FREE sobe;
- custo por PRO sobe;
- feature fica anormalmente cara;
- usuário apresenta abuso;
- retries ampliam custo.

# ============================================================
# 88. OPENAI BILLING
# ============================================================

Antes do beta:

- confirmar billing ativo;
- confirmar projeto correto;
- confirmar limites;
- confirmar alertas;
- confirmar chave de produção;
- não reutilizar chave pessoal indevidamente.

Ações manuais devem ser listadas.

# ============================================================
# 89. STRIPE LIVE READINESS
# ============================================================

Se beta for gratuito:

Stripe pode permanecer test mode.

Se beta cobrar:

antes de live:

- criar products/prices reais;
- configurar webhooks live;
- validar portal;
- validar cancelamento;
- validar failure;
- validar conciliação;
- revisar taxas;
- revisar entidade vendedora;
- revisar requisitos fiscais/jurídicos.

Codex não deve ativar live automaticamente.

# ============================================================
# 90. BILLING SOURCE OF TRUTH
# ============================================================

Webhook + estado persistido.

Nunca success URL.

# ============================================================
# 91. WEBHOOK MONITORING
# ============================================================

Monitorar:

- assinatura inválida;
- evento duplicado;
- processamento falho;
- retry;
- dead letter;
- atraso.

# ============================================================
# 92. MARKET STATUS
# ============================================================

Brasil pode permanecer mercado ativo conforme configuração atual.

Portugal, Espanha e EUA permanecem inativos/ready conforme decisão existente.

Não ativar mercado nesta fase.

# ============================================================
# 93. LEGAL DOCUMENTS
# ============================================================

Antes de beta com usuários reais:

confirmar existência/revisão de:

- Termos de Uso;
- Política de Privacidade;
- política de cookies quando aplicável;
- política de retenção;
- limites profissionais da SEED;
- consentimentos necessários;
- canal de contato.

Codex pode integrar páginas e registro de aceite.

Conteúdo jurídico final deve ser validado por profissional adequado.

# ============================================================
# 94. TERMS ACCEPTANCE
# ============================================================

Registrar:

- user;
- terms version;
- privacy version;
- accepted_at;
- locale/market;
- source.

Não pedir aceite novamente sem mudança relevante.

# ============================================================
# 95. PRIVACY RIGHTS
# ============================================================

Preparar fluxo para:

- acesso aos dados;
- correção;
- exclusão;
- exportação;
- retirada de consentimento quando aplicável;
- contato de privacidade.

Não prometer automação total se ainda for operacional/manual.

# ============================================================
# 96. DATA EXPORT
# ============================================================

Preparar exportação segura de dados do usuário/empresa.

Formato legível e estruturado quando possível.

Respeitar autorização e multi-tenancy.

# ============================================================
# 97. ACCOUNT DELETION
# ============================================================

Fluxo deve:

- confirmar identidade;
- explicar impacto;
- tratar assinatura;
- tratar empresas compartilhadas;
- tratar retenção legal;
- agendar/executar deleção;
- registrar auditoria sem reter conteúdo indevidamente.

# ============================================================
# 98. DATA RETENTION
# ============================================================

Documentar retenção por categoria:

- conversations;
- files;
- usage logs;
- billing;
- audit logs;
- deleted accounts;
- backups.

Não guardar tudo indefinidamente sem propósito.

# ============================================================
# 99. COOKIE/ANALYTICS CONSENT
# ============================================================

Quando necessário por mercado:

implementar consentimento adequado.

Analytics estritamente necessários devem ser diferenciados de opcionais quando aplicável.

# ============================================================
# 100. SUBPROCESSORS
# ============================================================

Documentar providers relevantes:

- OpenAI;
- Supabase;
- Vercel;
- Stripe;
- email;
- monitoring;
- analytics;
- storage.

Não expor secrets.

# ============================================================
# 101. CLOSED BETA
# ============================================================

Criar programa de Beta Fechado.

Objetivo:

validar valor, confiabilidade, retenção e unit economics com grupo controlado.

# ============================================================
# 102. BETA SIZE
# ============================================================

Começar com coorte pequena.

Exemplo operacional:

10–20 empresas

depois:

50

depois:

100

somente após qualidade e suporte permitirem.

Não hardcode esses números no produto.

# ============================================================
# 103. BETA ICP
# ============================================================

Priorizar empresas que:

- já operam;
- possuem problemas reais;
- conseguem conversar regularmente;
- aceitam dar feedback;
- representam segmentos variados;
- não exigem integração empresarial complexa para obter valor.

# ============================================================
# 104. BETA SEGMENTS
# ============================================================

Buscar variedade controlada:

- comércio local;
- serviço;
- restaurante/padaria;
- clínica;
- agência/consultoria;
- B2B;
- e-commerce;
- pequena indústria.

Não selecionar apenas amigos sem uso real.

# ============================================================
# 105. BETA ACCESS
# ============================================================

Usar:

BETA_ACCESS

e/ou allowlist.

Não abrir signup irrestrito se operação não estiver pronta.

# ============================================================
# 106. BETA ONBOARDING
# ============================================================

Onboarding deve ser simples:

1. criar conta;
2. criar empresa;
3. aceitar termos;
4. iniciar conversa;
5. atingir primeiro valor;
6. saber como pedir suporte.

Não reintroduzir questionário longo.

# ============================================================
# 107. FIRST VALUE MOMENT
# ============================================================

Definição existente:

empresa criada
+
diagnóstico
+
gargalo identificado
+
primeira orientação/ação.

Validar se continua adequada.

# ============================================================
# 108. BETA SUCCESS EVENTS
# ============================================================

Acompanhar:

- primeiro diagnóstico;
- plano criado;
- ação executada;
- resultado registrado;
- retorno na semana seguinte;
- Weekly Intelligence vista;
- usuário afirma ter usado orientação em decisão real.

# ============================================================
# 109. BETA FEEDBACK
# ============================================================

Criar mecanismo simples para feedback.

Exemplos:

- feedback contextual;
- botão reportar problema;
- entrevista;
- formulário curto;
- canal de suporte.

Não interromper toda conversa pedindo nota.

# ============================================================
# 110. RESPONSE FEEDBACK
# ============================================================

Permitir feedback discreto em respostas importantes quando apropriado:

- útil;
- não útil;
- incorreto;
- faltou contexto.

Não expor sistema técnico.

# ============================================================
# 111. CORRECTION FEEDBACK
# ============================================================

Quando usuário corrige a SEED:

registrar tipo de correção quando possível:

- fato incorreto;
- contexto antigo;
- interpretação errada;
- recomendação inadequada;
- linguagem confusa.

Usar para evals.

# ============================================================
# 112. BETA INTERVIEWS
# ============================================================

Preparar processo operacional:

- entrevista inicial;
- checkpoint após 7 dias;
- checkpoint após 30 dias;
- entrevista de cancelamento/abandono quando possível.

Não implementar agenda complexa no app.

# ============================================================
# 113. SUPPORT
# ============================================================

Definir canal de suporte.

Pode ser:

- email;
- formulário;
- painel;
- outro canal aprovado.

O produto deve mostrar onde pedir ajuda.

# ============================================================
# 114. SUPPORT TICKETS
# ============================================================

Se criar suporte interno:

campos mínimos:

user

company

category

severity

description

status

created_at

resolved_at

Não construir helpdesk completo se ferramenta externa resolver.

# ============================================================
# 115. ISSUE CATEGORIES
# ============================================================

Categorias:

BUG

AI_QUALITY

DATA_ERROR

BILLING

ACCESS

PRIVACY

FEATURE_REQUEST

OTHER

# ============================================================
# 116. ISSUE SEVERITY
# ============================================================

P0
=
segurança, vazamento, pagamentos graves, indisponibilidade total.

P1
=
função central quebrada.

P2
=
problema relevante com workaround.

P3
=
baixo impacto.

Documentar resposta.

# ============================================================
# 117. AI QUALITY INCIDENT
# ============================================================

Criar processo para casos em que SEED:

- inventa dado;
- mistura empresas;
- dá certeza indevida;
- interpreta documento errado;
- recomenda ação perigosa;
- ignora restrição;
- usa fonte externa inadequada.

Preservar evidência de forma segura para investigação.

# ============================================================
# 118. BUG PRIORITIZATION
# ============================================================

Priorizar:

1. segurança;
2. dados;
3. billing;
4. perda de informação;
5. função central;
6. IA de alto impacto;
7. UX;
8. melhorias.

# ============================================================
# 119. INCIDENT RESPONSE
# ============================================================

Criar runbook de incidente.

Fluxo:

detect
↓
classify
↓
contain
↓
communicate
↓
recover
↓
investigate
↓
prevent recurrence.

# ============================================================
# 120. INCIDENT SEVERITY
# ============================================================

Definir severidades e responsáveis.

Não depender de improvisação.

# ============================================================
# 121. DATA BREACH RESPONSE
# ============================================================

Preparar procedimento para suspeita de acesso indevido:

- conter;
- revogar;
- preservar logs;
- avaliar escopo;
- restaurar segurança;
- consultar obrigações legais;
- comunicar quando aplicável.

# ============================================================
# 122. STATUS COMMUNICATION
# ============================================================

Para beta, preparar mensagem clara em indisponibilidade.

Não prometer status page pública se ainda não existir.

# ============================================================
# 123. POSTMORTEM
# ============================================================

Incidentes relevantes devem gerar postmortem interno:

- o que ocorreu;
- impacto;
- causa;
- detecção;
- resposta;
- ações preventivas.

Sem culpabilização.

# ============================================================
# 124. QA STRATEGY
# ============================================================

Estruturar pirâmide de testes:

- unitários;
- integração;
- E2E;
- segurança;
- AI evals;
- carga;
- manual exploratório.

# ============================================================
# 125. UNIT TESTS
# ============================================================

Cobrir regras determinísticas:

- cálculos;
- prioridade;
- entitlements;
- usage limits;
- formatting;
- state transitions;
- consistency;
- Radar rules;
- Goal status;
- Growth Map;
- Decision calculations.

# ============================================================
# 126. INTEGRATION TESTS
# ============================================================

Cobrir fluxos entre:

Chat
→ Memory
→ Journal
→ Business Model
→ Diagnosis
→ Plan
→ Result.

E:

Goal
→ Metrics
→ Growth Map
→ Radar
→ Cockpit.

# ============================================================
# 127. E2E TESTS
# ============================================================

Fluxos críticos:

1. signup;
2. login;
3. criar empresa;
4. conversar;
5. memória;
6. diagnóstico;
7. plano;
8. ação;
9. resultado;
10. meta;
11. Cockpit;
12. FREE limit;
13. upgrade test mode;
14. logout;
15. delete/export request.

# ============================================================
# 128. AI EVALS
# ============================================================

Criar conjunto de avaliações para comportamento estratégico.

Não depender apenas de testes tradicionais.

# ============================================================
# 129. EVAL DATASET
# ============================================================

Criar dataset versionado com casos fictícios.

Segmentos:

- varejo;
- restaurante;
- clínica;
- consultoria;
- agência;
- B2B;
- e-commerce;
- indústria.

Não usar dados reais sem autorização.

# ============================================================
# 130. EVAL CATEGORIES
# ============================================================

Avaliar:

- entendimento;
- uso de contexto;
- não invenção;
- suficiência;
- diagnóstico;
- priorização;
- ação;
- causalidade;
- linguagem;
- segurança;
- adaptação à maturidade;
- reconhecimento de limites.

# ============================================================
# 131. HALLUCINATION EVAL
# ============================================================

Casos onde informação não existe.

SEED deve dizer que não sabe/perguntar.

# ============================================================
# 132. FACT/HYPOTHESIS EVAL
# ============================================================

Garantir que hipótese não vira fato.

# ============================================================
# 133. HIGH-IMPACT DECISION EVAL
# ============================================================

Casos:

- nova unidade;
- contratação;
- desconto;
- dívida;
- grande investimento.

SEED não responde superficialmente.

# ============================================================
# 134. MULTILINGUAL EVAL
# ============================================================

Testar:

pt-BR

pt-PT

es-ES

en-US.

Preservar metodologia e linguagem natural.

# ============================================================
# 135. FILE EVAL
# ============================================================

Testar:

- PDF;
- imagem;
- screenshot;
- documento;
- arquivo inválido;
- documento com instruções maliciosas;
- documento antigo;
- documento conflitante.

# ============================================================
# 136. EXTERNAL INTELLIGENCE EVAL
# ============================================================

Testar:

- fonte;
- data;
- citação;
- conflito entre fontes;
- informação desatualizada;
- prompt injection;
- separação interno/externo.

# ============================================================
# 137. MEMORY EVAL
# ============================================================

Testar:

- fato salvo;
- hipótese;
- atualização;
- correção;
- exclusão;
- histórico;
- conflito;
- staleness;
- tenant.

# ============================================================
# 138. RADAR EVAL
# ============================================================

Testar:

- sinal relevante;
- ruído;
- repetição;
- cooldown;
- oportunidade;
- risco;
- false positive;
- suppressão.

# ============================================================
# 139. DECISION SIMULATOR EVAL
# ============================================================

Testar:

- premissas;
- cálculo;
- false precision;
- ranges;
- ausência de dado;
- cenário;
- recomendação;
- resultado posterior.

# ============================================================
# 140. REGRESSION EVAL
# ============================================================

Toda mudança de Brain/modelo deve rodar dataset de regressão.

Comparar qualidade.

Não aprovar apenas porque nova resposta parece mais longa.

# ============================================================
# 141. MODEL CHANGE GATE
# ============================================================

Troca de modelo deve passar por:

- evals;
- custo;
- latência;
- structured output;
- regressões;
- segurança.

# ============================================================
# 142. PROMPT VERSIONING
# ============================================================

Versionar instruções relevantes:

- identity;
- reliability;
- diagnosis;
- journal;
- business model;
- radar;
- external intelligence;
- simulation.

Não editar prompt crítico sem histórico.

# ============================================================
# 143. LOAD TESTING
# ============================================================

Executar carga em staging.

Cenários:

- usuários simultâneos;
- mensagens;
- page loads;
- Cockpit;
- uploads;
- jobs;
- webhooks;
- Radar batch;
- Weekly batch.

Não atacar serviços externos fora dos limites.

# ============================================================
# 144. CONCURRENCY
# ============================================================

Testar:

- mensagens simultâneas;
- duplicate submits;
- same company multiple tabs;
- parallel jobs;
- webhook duplicates;
- update conflicts.

# ============================================================
# 145. DATABASE LOAD
# ============================================================

Testar empresas com grande volume de:

- messages;
- journal entries;
- metrics;
- relationships;
- insights;
- usage logs.

# ============================================================
# 146. COST LOAD TEST
# ============================================================

Simular custo para:

- 100 FREE;
- 1.000 FREE;
- 100 PRO;
- 1.000 PRO.

Utilizar dados/configurações reais do sistema.

Identificar:

- custo médio;
- p95;
- features caras;
- abuso;
- cache savings.

Não apresentar como previsão financeira definitiva.

# ============================================================
# 147. BETA UNIT ECONOMICS
# ============================================================

Medir:

- AI cost/FREE;
- AI cost/PRO;
- infrastructure/user;
- payment fees quando houver;
- activation cost;
- CAC quando houver campanha;
- contribution estimate.

# ============================================================
# 148. ACTIVATION METRIC
# ============================================================

Confirmar definição oficial de ativação.

Registrar uma vez:

activated_at.

# ============================================================
# 149. RETENTION
# ============================================================

Medir:

D1

D7

D30

weekly active companies

sem confundir login com valor.

# ============================================================
# 150. VALUE RETENTION
# ============================================================

Medir comportamento de valor:

- voltou para continuar plano;
- informou resultado;
- viu Weekly Intelligence;
- consultou decisão;
- executou recomendação.

# ============================================================
# 151. FREE → PRO
# ============================================================

Medir:

- value moment;
- upgrade viewed;
- checkout started;
- activated;
- cancel;
- failure.

# ============================================================
# 152. CHURN
# ============================================================

Preparar métricas de churn quando cobrança estiver ativa.

Distinguir:

voluntary

involuntary.

# ============================================================
# 153. BETA EXIT CRITERIA
# ============================================================

Definir critérios objetivos antes de beta aberto/larger rollout.

Exemplos conceituais:

- zero incidentes críticos abertos;
- RLS testado;
- backups/restores validados;
- error rate aceitável;
- AI cost controlado;
- activation comprovada;
- usuários retornando;
- qualidade estratégica aceitável;
- suporte operacional sustentável.

Não hardcode percentuais arbitrários sem dados.

# ============================================================
# 154. GO / NO-GO CHECKLIST
# ============================================================

Criar checklist de release beta:

SECURITY

DATA

BACKUP

AI QUALITY

COST

BILLING

LEGAL

SUPPORT

OBSERVABILITY

PERFORMANCE

UX

ROLLBACK.

Todos os bloqueadores devem estar claros.

# ============================================================
# 155. MANUAL ACTIONS CHECKLIST
# ============================================================

Listar ações que Codex não pode concluir sozinho:

- upgrade do Supabase;
- configurar domínio;
- configurar billing provider live;
- validar documentos jurídicos;
- criar contas/credenciais;
- confirmar alertas de custo;
- configurar DNS;
- confirmar email sender;
- aceitar termos de providers.

# ============================================================
# 156. DOMAIN
# ============================================================

Preparar domínio de produção.

Validar:

- HTTPS;
- redirect;
- canonical;
- cookies;
- CORS;
- email links;
- OAuth callbacks;
- Stripe URLs.

# ============================================================
# 157. TRANSACTIONAL EMAIL
# ============================================================

Se emails forem utilizados:

- sender verificado;
- domínio;
- SPF/DKIM/DMARC conforme provider;
- templates localizados;
- reset;
- verification;
- billing;
- support.

Não enviar marketing sem consentimento.

# ============================================================
# 158. EMAIL FAILURE
# ============================================================

Monitorar falhas/bounces importantes.

Não bloquear conta indefinidamente sem suporte.

# ============================================================
# 159. BETA COMMUNICATION
# ============================================================

Preparar comunicação:

- convite;
- boas-vindas;
- como usar;
- limitações do beta;
- suporte;
- feedback;
- mudanças;
- incidentes.

# ============================================================
# 160. BETA LABEL
# ============================================================

Pode mostrar discretamente:

BETA

Não usar para justificar instabilidade grave.

# ============================================================
# 161. DATA SEEDING
# ============================================================

Criar fixtures/dados fictícios para QA.

Não misturar com produção.

# ============================================================
# 162. DEMO ACCOUNT
# ============================================================

Se criar conta demo:

- dados fictícios;
- resetável;
- sem dados reais;
- isolada;
- sem billing real.

# ============================================================
# 163. ADMIN MANUAL OVERRIDE
# ============================================================

Reutilizar override seguro para:

- beta access;
- PRO temporário;
- usage;
- market preview.

Sempre auditado.

# ============================================================
# 164. SUPPORTING PRODUCTION DATA
# ============================================================

Admin não deve editar dados empresariais críticos sem audit trail.

Preferir ferramentas seguras de correção.

# ============================================================
# 165. NO DIRECT DATABASE HACKS
# ============================================================

Evitar operação rotineira diretamente no banco.

Criar tools/admin actions seguras quando necessário.

# ============================================================
# 166. AUDIT LOG REVIEW
# ============================================================

Garantir audit para:

- admin actions;
- market changes;
- pricing changes;
- plan override;
- kill switches;
- subscription changes;
- account deletion;
- privacy request;
- security events.

# ============================================================
# 167. DEPENDENCY SECURITY
# ============================================================

Executar auditoria de dependências.

Corrigir vulnerabilidades críticas/altas relevantes.

Não atualizar major version indiscriminadamente sem testes.

# ============================================================
# 168. SAST / CODE SECURITY
# ============================================================

Executar ferramenta/análise disponível para:

- injection;
- unsafe secrets;
- insecure auth;
- path traversal;
- SSRF;
- XSS;
- insecure deserialization;
- SQL misuse.

# ============================================================
# 169. SSRF
# ============================================================

Especial atenção a:

- URL fetch;
- web search;
- document import;
- external links.

Não permitir acesso arbitrário à rede interna/metadata endpoints.

# ============================================================
# 170. URL VALIDATION
# ============================================================

Validar URLs fornecidas pelo usuário quando sistema fizer fetch.

# ============================================================
# 171. IMAGE SECURITY
# ============================================================

Validar imagens e limites.

Não confiar em metadata.

Remover/evitar exposição de metadata sensível quando necessário.

# ============================================================
# 172. DATA ENCRYPTION
# ============================================================

Confirmar HTTPS/TLS em trânsito.

Confirmar encryption at rest do provider.

Não implementar criptografia caseira.

# ============================================================
# 173. PASSWORDS
# ============================================================

Nunca armazenar senha diretamente.

Usar Supabase Auth.

# ============================================================
# 174. PAYMENT DATA
# ============================================================

Não armazenar número completo de cartão.

Usar Stripe.

# ============================================================
# 175. BUSINESS CONTINUITY
# ============================================================

Documentar como operar em caso de:

- OpenAI down;
- Supabase down;
- Vercel down;
- Stripe down;
- email down;
- web search down.

# ============================================================
# 176. RELEASE CHECKLIST AUTOMATION
# ============================================================

Automatizar o que for seguro:

- tests;
- build;
- lint;
- typecheck;
- security scan;
- migration check.

Manter decisão humana para produção.

# ============================================================
# 177. MANUAL QA MATRIX
# ============================================================

Criar matriz contendo:

feature

desktop

mobile

FREE

PRO

pt-BR

pt-PT

es-ES

en-US

staging

production readiness.

# ============================================================
# 178. CRITÉRIOS DE ACEITE FUNCIONAIS
# ============================================================

Fase 13 somente está concluída quando:

1. Development, Staging e Production estão claramente separados.

2. Secrets estão protegidos.

3. Secret scanning existe.

4. CI/CD executa gates críticos.

5. Migrations são validadas.

6. Rollback está documentado.

7. Feature flags funcionam.

8. Kill switches funcionam.

9. Supabase production checklist existe.

10. Backups estão configurados/confirmados.

11. Restore drill foi realizado em staging.

12. RLS audit foi concluído.

13. Cross-tenant tests passam.

14. Auth flows funcionam.

15. RBAC funciona.

16. Admin está protegido.

17. Inputs são validados.

18. Structured Outputs são validados.

19. XSS/CSRF/CORS/headers foram revisados.

20. Uploads possuem proteção.

21. Prompt injection defenses foram revisadas.

22. Tool permissions estão controladas.

23. No autonomous high-impact actions.

24. Retries e idempotência funcionam.

25. Timeouts existem.

26. Circuit breakers existem.

27. Degraded mode funciona.

28. Jobs possuem observabilidade.

29. Logs estruturados existem.

30. Error monitoring existe.

# ============================================================
# 179. CRITÉRIOS DE ACEITE FUNCIONAIS — CONTINUAÇÃO
# ============================================================

31. Operational metrics existem.

32. AI metrics existem.

33. Cost alerts existem.

34. Admin Operations possui dados úteis.

35. FREE/PRO protections funcionam.

36. Stripe readiness foi validada.

37. Legal/Privacy checklist existe.

38. Terms acceptance pode ser registrado.

39. Privacy requests possuem fluxo.

40. Data export/delete foi preparado.

41. Closed Beta access funciona.

42. Beta onboarding funciona.

43. Support channel existe.

44. Feedback mechanism existe.

45. Incident runbook existe.

46. AI quality incident process existe.

47. QA strategy existe.

48. E2E critical flows passam.

49. AI eval dataset existe.

50. Multilingual evals existem.

51. File evals existem.

52. Security evals existem.

53. Load test foi executado.

54. Cost load test foi executado.

55. Activation/Retention analytics existem.

56. Beta exit criteria existem.

57. Go/No-Go checklist existe.

58. Manual actions checklist existe.

59. Domain readiness foi validada.

60. Email readiness foi validada quando aplicável.

61. Audit logs foram revisados.

62. Dependency audit foi executado.

63. Production build passa.

64. Fases anteriores continuam funcionando.

# ============================================================
# 180. CRITÉRIOS DE ACEITE DE PRODUTO
# ============================================================

Antes de receber usuário real, responder SIM a:

Os dados de uma empresa estão isolados?

Se a IA falhar, os dados permanecem seguros?

Se o modelo inventar algo, temos como detectar/corrigir?

Se o custo disparar, conseguimos interromper?

Se uma migration falhar, conseguimos voltar?

Se o banco falhar, conseguimos restaurar?

Se o usuário pedir exclusão, existe processo?

Se o pagamento falhar, o estado fica correto?

Se uma feature quebrar, conseguimos desligá-la?

Se um usuário reportar problema, sabemos responder?

Se a SEED der uma orientação ruim, conseguimos investigar a base usada?

Se um provider cair, o produto degrada com segurança?

# ============================================================
# 181. CRITÉRIO CENTRAL
# ============================================================

A Fase 13 está pronta quando a SEED deixa de ser apenas um sistema funcional em desenvolvimento e passa a ser um produto controlável em operação.

Isso significa:

- sabemos o que está acontecendo;
- sabemos quanto custa;
- sabemos quando falha;
- sabemos como recuperar;
- sabemos como proteger os dados;
- sabemos como liberar gradualmente;
- sabemos como atender os primeiros clientes;
- sabemos como parar algo perigoso rapidamente.

# ============================================================
# 182. NÃO IMPLEMENTAR
# ============================================================

Não implementar nesta fase:

- App Store submission;
- Google Play submission;
- Apple In-App Purchase;
- Google Play Billing;
- expansão internacional ativa;
- campanhas de tráfego;
- afiliados;
- referral program completo;
- inteligência coletiva;
- benchmarks agregados;
- marketplace;
- white label;
- enterprise;
- automações externas autônomas;
- novas features estratégicas fora do escopo.

# ============================================================
# 183. DOCUMENTAÇÃO OBRIGATÓRIA
# ============================================================

Criar/atualizar:

- README;
- Architecture Overview;
- Environment Setup;
- Deployment;
- Migrations;
- Rollback;
- Backups;
- Restore;
- RLS;
- Security;
- Privacy Operations;
- Incident Response;
- AI Provider Failure;
- Billing Operations;
- Feature Flags;
- Kill Switches;
- Beta Operations;
- Support;
- AI Evals;
- Load Testing;
- Cost Monitoring;
- Release Checklist;
- Go/No-Go Checklist.

# ============================================================
# 184. RELATÓRIO FINAL OBRIGATÓRIO
# ============================================================

Ao concluir, apresentar:

## RESUMO

## ARQUITETURA ENCONTRADA

## AMBIENTES

## CI/CD

## SECRETS

## MIGRATIONS

## ROLLBACK

## BACKUPS

## RESTORE DRILL

## DATABASE

## RLS

## AUTH

## RBAC

## ADMIN SECURITY

## INPUT/OUTPUT VALIDATION

## FILE SECURITY

## PROMPT INJECTION

## TOOL PERMISSIONS

## AI SAFETY

## PROVIDER FAILOVER

## BACKGROUND JOBS

## OBSERVABILITY

## LOGGING

## ERROR MONITORING

## ALERTS

## COST PROTECTION

## OPENAI READINESS

## STRIPE READINESS

## PRIVACY / LEGAL CHECKLIST

## DATA EXPORT / DELETION

## CLOSED BETA

## BETA ONBOARDING

## FEEDBACK

## SUPPORT

## INCIDENT RESPONSE

## AI EVALS

## E2E TESTS

## LOAD TESTS

## COST SIMULATION

## ANALYTICS

## GO/NO-GO

## MANUAL ACTIONS

## LINT

## TYPECHECK

## TESTS

## BUILD

## LIMITAÇÕES

## TECHNICAL DEBT

## MANUAL VALIDATION

# ============================================================
# 185. TABELA FINAL OBRIGATÓRIA
# ============================================================

Apresentar tabela equivalente:

Capability | Status | Environment | Tested | Blocking | Notes

Development

Staging

Production

CI/CD

Secrets

Migrations

Rollback

Backups

Restore

RLS

Auth

RBAC

File Security

Prompt Injection

AI Safety

Circuit Breakers

Jobs

Logging

Error Monitoring

Alerts

Cost Protection

Stripe

Privacy

Terms

Data Export

Account Deletion

Beta Access

Feedback

Support

Incident Response

AI Evals

E2E

Load Testing

Go/No-Go

# ============================================================
# 186. RISCOS
# ============================================================

Listar explicitamente:

- riscos de segurança;
- riscos de dados;
- riscos de IA;
- riscos de custo;
- riscos de billing;
- riscos de migrations;
- riscos de backups;
- riscos de restore;
- riscos de multi-tenancy;
- riscos de uploads;
- riscos de prompt injection;
- riscos de provider;
- riscos de suporte;
- riscos legais;
- riscos de beta;
- riscos de performance;
- riscos de overengineering.

Para cada risco relevante:

- impacto;
- mitigação;
- bloqueador ou não;
- owner;
- ação recomendada.

# ============================================================
# 187. BETA GO/NO-GO DECISION
# ============================================================

Ao final, apresentar uma conclusão:

READY FOR CLOSED BETA

ou

NOT READY FOR CLOSED BETA.

Se NOT READY:

listar bloqueadores objetivos.

Não declarar READY apenas porque build passou.

# ============================================================
# 188. STOP CONDITION
# ============================================================

Depois de:

implementação

migrations

lint

typecheck

testes

security checks

load tests

staging validation

restore drill

relatório final

Go/No-Go assessment

PARAR.

NÃO iniciar Fase 14.

NÃO abrir beta publicamente.

NÃO ativar cobrança real automaticamente.

NÃO ativar mercados internacionais.

NÃO fazer deploy de produção sem minha autorização explícita.

Aguardar minha aprovação.

# ============================================================
# FIM DA FASE 13
# PRODUCTION READINESS, SECURITY, OBSERVABILITY & CLOSED BETA
# ============================================================
