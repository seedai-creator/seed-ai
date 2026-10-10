# Fase 9.1 — relatório de entrega

30/09/2026. Implementação e validação em teste concluídas. Este documento substitui o estado histórico de PHASE_9_1_STATUS.md. Não é lançamento comercial, aprovação jurídica ou autorização para cobranças reais. Fase 10 não iniciada.

## IMPLEMENTADO

FREE/PRO por usuário, permissões e políticas centralizadas, limites econômicos de IA, preços versionados, custos, seleção de modelos, Stripe sandbox, administração, auditoria, readiness e preview de mercados.

O teste autorizado com mensagem fictícia e dois fatos da empresa retornou resposta real da OpenAI e diagnóstico estruturado. A resposta distinguiu simulação de dados confirmados; nenhum fato fictício foi salvo. O painel exibiu as duas chamadas e seus custos.

Estado final: rollout habilitado em teste. Restaurados os bloqueios BR existentes antes dos testes: novos cadastros, novas assinaturas e chamadas IA pausados. Leitura continua disponível. O administrador pode liberar cada controle em `/admin`, com motivo e confirmação. PT/ES/US permanecem DRAFT.

## ARQUITETURA

Next.js + Supabase/PostgreSQL. `src/lib/commercial` concentra contratos, permissões, políticas, mercados, roteamento e custos. `src/lib/billing` concentra Stripe e validação. Orquestrador → autorização → reserva atômica → Responses API → medição → finalização. O webhook consulta o provedor; o navegador não concede PRO.

Arquivos principais da conclusão: `src/lib/commercial/metering.ts` e `ai-cost.ts`; `src/app/billing/actions.ts`; `src/app/admin/catalog-actions.ts`, `catalog/page.tsx` e `economics-report.tsx`; `src/components/commercial-usage.tsx`; páginas de home/login/billing; `src/lib/seed/orchestrator.ts`; testes comerciais e migração de conclusão. Checkout aberto é reutilizado sem recriar a solicitação com parâmetros diferentes.

## DATABASE / MIGRATIONS

Migrações incrementais aplicadas ao projeto `gqumxaapjyujrpqggnon`, expressamente autorizado pelo usuário como teste. O Supabase identifica sua branch padrão como `main PRODUCTION`; não houve autorização de lançamento público. Não resetar ou reaplicar essas migrações.

| Arquivo | Finalidade |
| --- | --- |
| 202609280001_commercial_foundation.sql | Contas, planos, mercados, preços, configurações |
| 202609280002_billing_operations.sql | Tentativas e eventos de assinatura |
| 202609280003_ai_budget.sql | Reservas e medição |
| 202609280004_commercial_admin.sql | Papéis e auditoria |
| 202609280005_commercial_guards.sql | Proteção de operações e limites |
| 202609280006_commercial_analytics.sql | Relatórios |
| 202609280007_commercial_catalog.sql | Catálogo e exceções temporárias |
| 202609280008_commercial_events.sql | Eventos comerciais |
| 202609290001_commercial_completion.sql | Checkout, cache, reconciliação e configuração |

Entidades: commercial_accounts, commercial_plans, commercial_markets, commercial_prices, commercial_settings, subscriptions, checkout_attempts, billing_events, ai_requests, usage_logs, ai_model_pricing, commercial_overrides, commercial_events, admin_roles e admin_audit_log. Dados empresariais permanecem separados e protegidos por membership/RLS.

## FREE

Uma empresa, memória, diagnóstico limitado e primeira estratégia. Novas decisões/experimentos exigem PRO; dados anteriores continuam legíveis. Política inicial: até 3 diagnósticos/30 chamadas, janela total da conta, alvo US$0,10, aviso US$0,12, soft US$0,15 e hard US$0,25. Uma análise normalmente faz duas chamadas. Reservas/custos podem bloquear antes da quantidade máxima; esses números não são franquia garantida.

## PRO

BR: R$99,99/mês em sandbox, uma empresa, estratégias, decisões, experimentos e análise avançada. Política mensal UTC de teste: alvo US$2, soft US$4, hard US$8, até 200 diagnósticos/500 chamadas, US$2/dia. Limite global inicial US$10/dia. Valores são hipóteses econômicas configuráveis, não prova de margem ou uso ilimitado. Outros planos não são vendidos.

## AI MODEL ROUTER

Classificação usa OPENAI_ECONOMY_MODEL; diagnóstico usa OPENAI_STRATEGIC_MODEL, verificados como gpt-6-luna e gpt-6-sol. OPENAI_MODEL é fallback. Qualidade estratégica não é reduzida só por custo. Saída configurável: 800/3800 tokens. Modelo sem preço vigente impede chamada paga.

## OPENAI USAGE & COSTS

SDK oficial, Responses API, store:false, chave somente no servidor. Usage real do provedor e preço vigente são persistidos. Raciocínio integra a saída e não é somado novamente; leitura/escrita de cache têm preços separados. UNKNOWN não vira zero e conserva reserva. Reconciliação exige SUPER_ADMIN, evidência e auditoria.

Preços USD por milhão, verificados/cadastrados em 29/09/2026:

| Modelo | Entrada | Leitura cache | Escrita cache | Saída |
| --- | ---: | ---: | ---: | ---: |
| gpt-6-luna | 0,10 | 0,01 | 0,125 | 0,50 |
| gpt-6-sol | 2,00 | 0,20 | 2,50 | 10,00 |

Fontes: [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [Sol](https://developers.openai.com/api/docs/models/gpt-6-sol). Faixa standard de contexto curto; limite conservador impede faixa longa não cadastrada. Revalidar ao trocar modelo/tier. Estimativas não substituem fatura do fornecedor.

Teste real 30/09: classificação 723 tokens entrada/93 saída, US$0,0001188; diagnóstico 2556/735, US$0,0137385. Total US$0,0138573, ambos COMPLETED/ESTIMATED. Zero operações de custo desconhecido. O painel mostrou custos por modelo/recurso/plano/mercado, média, cache, erros e maiores consumidores.

## STRIPE

Somente teste. Checkout BR, Portal explícito, assinatura de webhook, idempotência, rejeição de eventos antigos e validação de moeda/preço. Redirect não concede PRO. Evidências:

- 29/09: Checkout com cartão fictício → webhook HTTP 200 → PRO; Portal agendou cancelamento mantendo acesso até o vencimento. Corrigido o tratamento de cancel_at igual ao fim do período, com regressão automatizada.
- Cancelamento imediato da assinatura fictícia → FREE. Contagens preservadas: 3 empresas, 9 fatos, 2 estratégias, 5 ações, 1 decisão e 1 experimento; comparação de contagens, não hash integral.
- 30/09: assinatura fictícia dedicada, card_declined → past_due persistido na SEED; recuperação → active no Stripe; cancelamento final → canceled persistido. As duas assinaturas terminaram canceladas.
- Nova contratação após cancelamento abriu Checkout BR; retornar e abrir novamente reutilizou a mesma sessão. Sessão não paga expirada e tentativa encerrada ao finalizar.

Nenhuma cobrança real. Não há Connect, Tax, Apple IAP ou Google Billing em operação. Manter encaminhamento de webhook ativo para sincronizar o ambiente local.

## UNIT ECONOMICS

MRR não é caixa recebido. USD não é somado diretamente a BRL/EUR. Taxas e câmbio exigem valor, data e fonte. Sem eles, contribuição fica desconhecida, nunca lucro presumido.

Tabela somente SIMULAÇÃO, não gravada como receita ou usuários reais:

| Plan | Users | Revenue mensal | AI Cost | Payment Cost | Contribution |
| --- | ---: | ---: | ---: | --- | --- |
| FREE | 1 fictício | R$0,00 | US$0,10 hipotético | Não informado | Desconhecida |
| PRO BR | 1 fictício | R$99,99 hipotético | US$2,00 hipotético | Não informado | Desconhecida |

Painel ao encerrar: 2 contas FREE, 0 PRO, MRR sandbox zero e custo IA total US$0,0138573. Chamadas feitas durante assinatura de teste ativa preservam o plano histórico após downgrade.

## MARKETS

FREE habilitado no catálogo não significa cadastro público aberto.

| Market | Locale | Currency | FREE | PRO | Price mensal | Billing | Readiness | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BR | pt-BR | BRL | Estruturado | Estruturado | R$99,99 | Teste; novas assinaturas bloqueadas | 0/11 formal | ACTIVE com controles pausados |
| PT | pt-PT | EUR | Preparado | Inativo | €19,99 hipótese | Desligado | 0/11 | DRAFT |
| ES | es-ES | EUR | Preparado | Inativo | €19,99 hipótese | Desligado | 0/11 | DRAFT |
| US | en-US | USD | Preparado | Inativo | US$19,99 hipótese | Desligado | 0/11 | DRAFT |

## BRAZIL

Fluxos técnicos verificados com serviços reais em teste. Restaurados os bloqueios anteriores de cadastro, assinatura e IA. Dados continuam disponíveis. Evidências formais de lançamento não foram inventadas.

## PORTUGAL

pt-PT, EUR, Europe/Lisbon, preço separado INACTIVE. Preview administrativo. Simulação PostgreSQL cobre cadastro, reserva FREE, estado PRO, pausa e preservação. Não houve compra Stripe EUR ou diagnóstico pago português nesta rodada.

## SPAIN

es-ES, EUR, Europe/Madrid; catálogo próprio apesar do preço hipotético igual a PT. Simulação técnica equivalente, sem ativação remota ou aprovação fiscal.

## UNITED STATES

en-US, USD, America/New_York; catálogo INACTIVE. Simulação equivalente; sem lançamento ou engine tributária.

## ADMIN

/admin: visão geral, uso, assinaturas, mercados, políticas, preços e auditoria. /admin/catalog: preços versionados, flags, acessos temporários, readiness, rollout, saída IA, reconciliação e premissas econômicas. ADMIN_VIEWER consulta; alterações sensíveis exigem SUPER_ADMIN. Bootstrap exclusivamente para a conta autorizada; metadata de cadastro não promove usuários.

Exceções têm motivo, autor e vencimento máximo de 180 dias; nova exceção substitui a vigente. Beta em READY exige mercado da conta definido e override explícito; não abre cadastro público internacional.

## MARKET READINESS

Onze categorias com evidências: configuração, localização, produto, preço, billing, jurídico/fiscal, privacidade, proteção IA, analytics, testes e emergência. Ativação exige transição válida, evidências, preço e proteção econômica. international_launch permanece falso. Teste técnico não aprova jurídico/fiscal.

## SECURITY

RLS e autorização no backend, segredos somente no servidor, reservas atômicas, concorrência/frequência controladas, idempotência e circuit breakers. Logs comerciais não guardam conversa ou fatos. Memória é enviada ao provedor na análise autorizada, como dados separados de instruções. Kill switches preservam registros. Webhook não confia no redirect.

## TESTS

30/09: lint, typecheck e build aprovados; 97 testes, zero falhas. Cobertura comercial: RLS, orçamento, UNKNOWN, replay, downgrade, preços, cache, reconciliação e simulações PT/ES/US com rollback. Fixtures internacionais não são homologação Stripe/fiscal. Evidências: phase91-live-diagnosis.png, phase91-checkout-retry.png, phase91-admin-costs.png e billing-free-after-test.png.

## ENV VARIABLES

.env.example contém placeholders. Servidor: OPENAI_API_KEY, OPENAI_MODEL, OPENAI_ECONOMY_MODEL, OPENAI_STRATEGIC_MODEL, SUPABASE_SECRET_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PORTAL_CONFIGURATION_ID. Públicas: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SITE_URL. OPENAI_PREMIUM_MODEL é reservado, não usado. Nunca colocar segredo em NEXT_PUBLIC_.

## HOW TO TEST LOCALLY

Na pasta do projeto: npm ci, configurar .env.local, npm run dev -- --port 3001. Abrir http://127.0.0.1:3001. Para repetir IA, desmarcar disable_ai_requests somente em Brasil no /admin e confirmar com motivo. Enviar mensagem fictícia e conferir resposta e /admin#usage. Não confirmar fatos fictícios. Restaurar controles ao terminar teste controlado.

## HOW TO TEST STRIPE

Com credenciais TEST, executar npm run stripe:listen em outro terminal. O script salva segredo local sem exibi-lo e encaminha à porta 3001. Liberar novas assinaturas BR temporariamente no admin. Em /billing, conferir aviso de teste e R$99,99. Usar apenas cartão oficial de teste, data futura e dados fictícios, nunca cartão pessoal.

## HOW TO TEST FREE → PRO

FREE → Conhecer o PRO → Checkout sandbox → concluir com cartão de teste → aguardar webhook → conferir PRO. Abrir Gerenciar assinatura e cancelar: agendamento conserva PRO até vencer. Para downgrade rápido, cancelar somente a assinatura fictícia na sandbox. Conferir FREE e dados preservados; restaurar bloqueio de novas assinaturas.

## HOW TO PREVIEW PORTUGAL

Como administrador, /admin/preview/PT. Preview não ativa país, não cobra e não altera país da conta. ES/US têm rotas equivalentes.

## HOW TO ACTIVATE PORTUGAL IN THE FUTURE

Somente após decisão explícita: revisar localização, preço, termos e obrigações com responsáveis; configurar preço EUR; registrar evidências reais; validar fluxo completo sandbox; habilitar controle internacional e passar READY → ACTIVE com motivo. Cobrança real requer evolução/homologação do adaptador hoje limitado a TEST, HTTPS e webhook público. Trocar a chave para live não basta.

## HOW TO ACTIVATE SPAIN IN THE FUTURE

Mesmo processo com catálogo/evidências próprios ES e locale es-ES. Aprovação de PT não aprova ES. Não realizado remotamente.

## HOW TO ACTIVATE USA IN THE FUTURE

Mesmo processo para USD/en-US, validação comercial/legal própria e responsabilidades tributárias definidas. Sem lançamento automático.

## WHAT STILL REQUIRES A MOBILE APP UPDATE

App nativo, Apple/Google, validação de recibos, restauração de compras, notificações das lojas e revisão de políticas não implementados. Configurações suportadas pelo backend mudam sem deploy; novos recursos/clientes e lojas exigirão desenvolvimento/publicação.

## RISKS / TECHNICAL DEBT

Sem gateway live. Calibrar preços/políticas com amostra real: um teste não prova margem ou qualidade geral. Estimativa não substitui fatura. Reconciliação pode corrigir total sem decomposição de tokens. MRR não mede caixa, impostos ou lucro. Listagens limitadas a 200, totais separados. Timeout conjunto de análise 45s. Reconciliação manual auditada, sem scheduler. Sem ponta a ponta Stripe internacional ou homologação mobile/fiscal. Testes não constituem aprovação legal.

## NEXT RECOMMENDED STEP

Revisar entrega e decidir liberação dos controles BR para uso de teste. Depois, somente com autorização, iniciar Fase 10: metas e indicadores. Não houve avanço automático.
