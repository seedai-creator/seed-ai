# SeedAI — preparação para ativar as assinaturas

17/10/2026. Preparação autorizada; ativação NÃO autorizada nesta etapa. Não criar cobrança, alterar planos de usuários, liberar mercados ou substituir as credenciais de produção. A landing continua disponível.

## Oferta acordada

| Identificador da oferta | Mensalidade BRL | Empresas por usuário | Orçamento interno de IA por ciclo |
| --- | --- | --- | --- |
| PRO_1 | R$ 99,99 | 1 | US$ 4 |
| PRO_3 | R$ 199,99 | 3 | US$ 8 |
| PRO_5 | R$ 399,99 | 5 | US$ 16 |

Fonte executável: `src/lib/commercial/pro-proposal.ts`. São limites compartilhados, sem adicional por empresa, sem excedente automático e sem conta OpenAI exigida ao cliente. Não anunciar quantidade ilimitada de análises. FREE: até três análises totais, limite financeiro existente, convite somente após análise útil. Relatórios automáticos permanecem PRO e consomem o orçamento de IA.

## Integração preparada, ainda sem venda

A migração `20261017190223_versioned_pro_offers.sql` está instalada em staging e produção; o candidato foi publicado com autorização em 17/10. As versões `PRO_1_V1`, `PRO_3_V1` e `PRO_5_V1` preservam PRO como família e associam contrato, preço, assinatura, limite de empresas e franquia no servidor. O Checkout exige uma oferta disponível e seu preço exato; o retorno do navegador não concede acesso. O resolvedor de permissões, a criação de empresas e a reserva de IA usam essa associação, preservando os contratos legados. Ofertas continuam indisponíveis; nenhum preço novo foi vinculado em produção.

Os três produtos e preços correspondentes foram criados no Stripe **test mode**, todos com `active:false`. As ofertas do banco têm `available:false`; os vínculos exatos dos preços estão registrados somente no staging como `INACTIVE`. Nenhum cliente, Checkout, pagamento ou assinatura foi criado nessa preparação. `scripts/prepare-stripe-test-offers.mjs --prepare-inactive`, após compilar os testes, usa identificadores estáveis e recusa objetos existentes ativos ou incompatíveis; o manifesto privado fica em `.test-build/stripe-inactive-offers.json`. O inventário somente leitura antigo consulta apenas preços ativos e não deve ser confundido com esse manifesto.

Os testes locais cobrem as três empresas máximas contratadas, franquia compartilhada, isolamento, imutabilidade, reserva desconhecida, eventos duplicados, cancelamento e preservação do histórico. As ofertas continuam indisponíveis após o ensaio. A integração ainda aceita exclusivamente test mode; produtos/preços live não existem nesta preparação. Troca de preço em assinatura existente é recusada, e o portal precisa ter alteração de assinatura desligada até um fluxo de transição próprio.

## Sequência de liberação

1. Candidato e migrações publicados com autorização. Repetir o Checkout hospedado e a entrega assinada para cada oferta antes de liberá-la, distinguindo o ensaio de banco com eventos sintéticos dos testes anteriores de rede. Preservar assinaturas antigas e histórico; publicação técnica não autoriza venda.
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
