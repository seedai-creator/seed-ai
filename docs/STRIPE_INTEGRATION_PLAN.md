# Stripe — plano validado pelo planejador

**Estado atual em 17/10/2026:** o roteiro abaixo preserva o planejamento histórico de setembro. A preparação vigente está em [STRIPE_ACTIVATION.md](STRIPE_ACTIVATION.md): PRO de 1/3/5 empresas, preços R$ 99,99/199,99/399,99 e franquias US$ 4/8/16. Integração test mode validada, novos planos e cobrança real desativados. O adapter atual ainda aceita somente um PRO por mercado; não confundir a proposta com três ofertas já implantadas.

Verificação em 28/09/2026 nesta conversa: MCP disponível, conta SEED TECNOLOGIAS retornada com `livemode: false`. Planejador chamado e escolhas aceitas no guia `iguide_61VU1aKcrdzszmlIZ41B8iUtsHOj7`.

## Escolhas

- Aplicação web existente; Stripe Billing com Checkout hospedado.
- PRO por usuário: mensalidade fixa BRL 99,99, quantidade 1. Limites internos de IA não representam cobrança por tokens nem medição faturável no Stripe.
- Customer Portal para gerenciar pagamento e cancelamento.
- Recuperação padrão de pagamentos do Stripe; comportamento a configurar e testar somente no ambiente de teste.
- Connect, Managed Payments, impostos automáticos, faturamento anual e Apple/Google Billing fora desta implementação.
- Obrigações fiscais não verificadas: não interpretar exclusão de Stripe Tax como ausência de obrigações.

## Implementação no projeto

1. Criar adaptador Stripe exclusivamente no servidor, usando SDK oficial e credenciais de teste. Rejeitar credenciais/eventos de produção neste estágio.
2. Criar preços e assinatura local versionados; vincular o preço BR ao identificador Stripe de teste. Não aceitar valor, usuário, plano ou identificador de cliente como autoridade vindos do navegador.
3. Endpoint de Checkout autenticado, com autorização, resolução de preço no servidor e idempotência. Associar usuário e cliente Stripe de forma verificável; impedir assinaturas duplicadas.
4. Webhook com corpo original, assinatura validada, deduplicação persistente e sincronização do estado atual da assinatura para tratar eventos fora de ordem. Retorno ao site nunca concede PRO sozinho.
5. Entitlements centrais independentes do provedor. Preservar acesso até o fim do período quando aplicável e preservar todos os dados após downgrade. Definir explicitamente a política de past_due.
6. Portal acessível somente ao titular autenticado do cliente Stripe.
7. Verificar upgrade, retorno sem webhook, assinatura inválida, eventos repetidos/fora de ordem, falha de pagamento, cancelamento ao fim do período e isolamento entre usuários.

## Documentação indicada pelo planejador

- https://docs.stripe.com/billing/subscriptions/build-subscriptions?payment-ui=checkout&ui=stripe-hosted
- https://docs.stripe.com/subscriptions/pricing-models/flat-rate-pricing?dashboard-or-api=api
- https://docs.stripe.com/customer-management/integrate-customer-portal
- https://docs.stripe.com/billing/revenue-recovery

## Estado e limites desta verificação

A conexão MCP e o planejador foram verificados; isso não equivale a configurar credenciais da aplicação, produto, preço, webhook ou checkout. Nenhum desses recursos foi criado nesta verificação. A Fase 9.1 permanece incompleta; continuar a partir de PHASE_9_1_PLAN.md. Não alterar produção, ativar PT/ES/US ou iniciar a Fase 10.
