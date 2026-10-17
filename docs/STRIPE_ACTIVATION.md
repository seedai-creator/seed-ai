# SeedAI — preparação para ativar as assinaturas

17/10/2026. Preparação autorizada; ativação NÃO autorizada nesta etapa. Não criar cobrança, alterar planos de usuários, liberar mercados ou substituir as credenciais de produção. A landing continua disponível.

## Oferta acordada

| Identificador da oferta | Mensalidade BRL | Empresas por usuário | Orçamento interno de IA por ciclo |
| --- | --- | --- | --- |
| PRO_1 | R$ 99,99 | 1 | US$ 4 |
| PRO_3 | R$ 199,99 | 3 | US$ 8 |
| PRO_5 | R$ 399,99 | 5 | US$ 16 |

Fonte executável: `src/lib/commercial/pro-proposal.ts`. São limites compartilhados, sem adicional por empresa, sem excedente automático e sem conta OpenAI exigida ao cliente. Não anunciar quantidade ilimitada de análises. FREE: até três análises totais, limite financeiro existente, convite somente após análise útil. Relatórios automáticos permanecem PRO e consomem o orçamento de IA.

## Diferença entre proposta e integração atual

A integração atual valida apenas Stripe **test mode**, possui um único PRO por mercado e não aceita escolher PRO_1/3/5 no Checkout. A tabela de preços permite somente um preço aberto por plano/mercado/provedor; a sincronização de assinatura e a resolução de permissões usam PRO. Trocar apenas o preço de R$ 99,99 para R$ 199,99 NÃO concede três empresas. Não usar BUSINESS/ADVISORY como atalhos nem alterar o PRO global para dar cinco empresas a todos.

A preparação de ativação deve acrescentar uma oferta versionada associada ao preço e à assinatura, preservando PRO como família de recursos e os contratos antigos. Preço, limite de empresas e franquia precisam ser resolvidos pelo servidor a partir da mesma oferta; evento verificado vincula essa oferta ao usuário. Navegador/metadata não são autoridade para conceder limites. Essa migração e implementação ainda exigem validação antes de qualquer ativação.

## Sequência de liberação

1. Implementar a associação das três ofertas no banco, Checkout, webhook e resolução de limites; testar os três valores e empresas com usuários fictícios. Preservar assinaturas antigas e histórico. Não aplicar migração de billing para simular conclusão nesta etapa.
2. Definir mudança de plano: data efetiva, proporcionalidade, saldo consumido no ciclo e tratamento de empresas excedentes no downgrade. Não anunciar botão de upgrade antes do fluxo testado; nunca recriar saldo no mesmo ciclo por reenvio de evento.
3. Conferir aprovação da conta Stripe para receber pagamentos, titularidade, moeda/liquidação, obrigações fiscais, termos finais, suporte, recibos e política de reembolso. Dados bancários/documentos são preenchidos no provedor, sem passar pelo repositório ou chat.
4. Preparar produtos e preços imutáveis por oferta no ambiente apropriado. Test e live possuem objetos/credenciais distintos. Obter uma chave de servidor com permissões mínimas e segredo do endpoint live; guardar somente em secrets. Não basta trocar uma variável: cliente, validação de preço, evento, portal e ambiente recusam live hoje.
5. Conferir URL de retorno oficial, webhook HTTPS assinado e portal. O retorno do Checkout nunca concede acesso; tratar duplicação, ordem, falha, cancelamento e recuperação. Evitar duas assinaturas por usuário entre canais.
6. Validar reembolso/arrependimento e comunicação de falha, além dos ensaios Stripe de renovação/cancelamento já executados. Test mode não certifica liquidação real nem regras das lojas.
7. Gerar candidato revisável com checks e plano de retorno. Somente após autorização explícita, habilitar um mercado/uma coorte e acompanhar. O bloqueio público e a landing só mudam por decisão expressa.

## Verificação sem alterações

`npm run typecheck` e `npm test` compilam a proposta. Depois, `node scripts/check-stripe-preparation.mjs --run` lê exclusivamente a chave Stripe de teste do arquivo local e consulta somente preços/estado de teste. Recusa chaves live, não cria produtos/sessões, não lê clientes ou pagamentos e não modifica Supabase. Escreve resumo em `.test-build/stripe-preparation.json`.

Resultado de rede PASS significa que a consulta de preparação funcionou; `readyForActivation` permanece falso enquanto existem bloqueadores. Preço de teste encontrado não é produto live configurado. Valores 49,90/99,90 de discussões antigas não são mais a proposta vigente.

## Lojas

App Store e Google Play exigem integração e teste próprios de compra/restauração conforme o mercado e canal. Stripe web não implementa essas compras. Os planos permanecem desativados até que o canal utilizado esteja pronto; não iniciar implementação móvel por inferência.

Fontes oficiais consultadas em 17/10/2026: [ambientes e chaves](https://docs.stripe.com/keys), [Checkout recorrente](https://docs.stripe.com/payments/checkout/build-subscriptions), [portal](https://docs.stripe.com/customer-management), [webhooks](https://docs.stripe.com/webhooks). Plano histórico: [STRIPE_INTEGRATION_PLAN](STRIPE_INTEGRATION_PLAN.md).
