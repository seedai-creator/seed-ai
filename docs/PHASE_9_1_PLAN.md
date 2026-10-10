# Fase 9.1 — mapa inicial e estado de preparação

> Registro histórico anterior à implementação. Para o estado atual, consulte [PHASE_9_1_STATUS.md](PHASE_9_1_STATUS.md).

Pré-requisito: Fase 9 concluída em 28/09/2026. Migração 202609270002_experiments.sql aplicada com confirmação; ciclo Planejado → Em execução → Inconclusivo verificado na interface, persistência após recarga e separação da empresa principal. Registro fictício e027db29-5923-4aa9-b697-6d1fe3f42175. Lint, typecheck, 74 testes e build aprovados antes da aplicação.

## Estruturas encontradas
- Next App Router; autenticação Supabase; autorização por company_members e cookie de empresa ativa.
- Seis migrações incrementais. Tabelas: profiles, companies, company_members, company_facts, strategies, actions, decisions, experiments.
- Não existem tabelas de planos, assinaturas, custos, preços, mercados comerciais ou administração.
- O mercado empresarial existente fica em company_facts (country/currency), com preferências de idioma/locale/timezone em companies. Perfil possui locale. Não confundir isso com mercado comercial de uma assinatura por usuário.
- Quatro catálogos i18n existentes; um Brain global com seleção por intenção.
- Orquestrador em src/lib/seed/orchestrator.ts; integração OpenAI em respond.ts, pipeline.ts e request.ts.
- Duas chamadas Responses por análise: classificação e resposta estruturada com diagnóstico. Atualmente usam OPENAI_MODEL; limites de saída 800/3800; timeout conjunto 45s; retries automáticos desativados.
- Contexto de memória limitado a 12 fatos de até 500 caracteres. Inspecionar seleção de histórico antes de modificar; preservar informações necessárias à validação de evidências.
- Custos e usage retornados pelo SDK ainda não são persistidos. Não há Stripe nem administrador.
- Cadastro cria perfil e primeira empresa atomicamente via trigger; create_company hoje não impõe limite comercial. A restrição futura precisa existir no banco, não apenas na UI.

## Plano de integração
1. Configuração comercial incremental: planos, entitlements, políticas, mercados, preços versionados, assinatura por usuário; preservar empresas existentes acima da futura cota, bloquear somente novas criações conforme política.
2. Medição confiável de cada chamada IA, pricing versionado e custo desconhecido explícito; reserva atômica de orçamento antes de chamadas, idempotência e controle de concorrência distribuídos.
3. Seleção central de modelo por tarefa e capacidade, preservando qualidade estratégica; segredos no ambiente e políticas comerciais no banco.
4. Stripe exclusivamente sandbox: checkout, assinatura verificada por webhook, reconciliação idempotente, portal e preservação de dados no downgrade.
5. Admin com RBAC, auditoria, readiness, preview e controles de emergência. Nenhum usuário recebe papel administrativo por dados editáveis de cadastro.
6. Testes de limites, isolamento, custos, webhooks e simulações internacionais; aplicação remota somente no ambiente expressamente autorizado.

## Pendências externas
- Conta/sandbox Stripe: usuário informou que ainda não possui e solicitou orientação. Não há chaves Stripe configuradas nesta preparação.
- Confirmar ambiente de desenvolvimento isolado para mudanças comerciais antes de aplicação remota; confirmação recebida nesta etapa se refere à migração da Fase 9.
- Bootstrap de administrador deve identificar explicitamente o usuário autorizado, sem promoção automática.
- Valores PRO de fair use precisam de configuração claramente identificada como teste, sem alegar margem real ou cotação inexistente.

Esta preparação não implementa nem conclui a Fase 9.1. Nenhuma cobrança, país adicional ou Fase 10 foi ativado. Não aplicar futuras migrações comerciais automaticamente ao projeto atual.
