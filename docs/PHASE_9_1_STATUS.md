> HISTÓRICO: substituído em 30/09/2026 pelo [relatório de entrega](PHASE_9_1_DELIVERY.md). As pendências abaixo descrevem o estado anterior.

# Fase 9.1 — estado de implementação

Atualizado em 29/09/2026. **Em andamento; não declarar concluída.** Fase 10 não iniciada. Não foram realizadas cobranças reais nem ativados Portugal, Espanha ou Estados Unidos.

## Implementado localmente

- `src/lib/commercial`: planos por usuário, permissões, políticas, estados de limite, mercados e readiness.
- Custos calculados com tokens reais, cache separado e sem duplicar raciocínio. Custos desconhecidos não são tratados como zero. Preços de modelos versionados, sem valores inventados.
- Reserva atômica de orçamento antes da chamada paga, concorrência, duplicação, limites individuais e globais. Reserva de chamada com custo desconhecido não é liberada como gratuita.
- Seleção central de modelo econômico/estratégico e orçamento de saída configurável. Aplicação anterior preservada enquanto o rollout está desligado.
- Stripe SDK oficial: Checkout de assinatura em teste, Portal, verificação de webhook, eventos idempotentes e validação de preço/moeda. Retorno do Checkout não concede PRO.
- Administração protegida: planos, políticas, preços, readiness, acessos temporários, auditoria e previews.
- Página Assinatura nos quatro idiomas, avisos de limite quando a medição está ativa e Portal acessível também após cancelamento ou pagamento pendente. Downgrade não remove registros empresariais.

## Banco e ativação

As oito migrações `202609280001` a `202609280008` foram aplicadas no projeto `gqumxaapjyujrpqggnon`, expressamente confirmado pelo usuário como ambiente de teste. O painel identifica a branch padrão como `main PRODUCTION`; a execução ocorreu somente após autorização específica para esse projeto. O SQL Editor confirmou sucesso em todos os lotes. Verificação remota: 15 tabelas comerciais com RLS habilitado, 14 funções comerciais esperadas, rollout desligado, nenhum mercado com billing habilitado e PT/ES/US em DRAFT. Não reaplicar esses arquivos ao mesmo banco.

Bootstrap concluído em 29/09/2026, após o cadastro: consulta confirmou uma conta com e-mail verificado para `seedtecnologias.suporte@gmail.com`. O acesso `SUPER_ADMIN` foi concedido somente a essa conta, com registro de auditoria e verificação posterior. A primeira tentativa anterior havia sido revertida por ausência do cadastro. Não reaplicar o bootstrap. Painel `/admin` validado no navegador após o usuário entrar: papel SUPER_ADMIN, mercados, políticas e auditoria carregados. Acesso sem sessão não expõe o painel.

Rollout e billing BR começam desligados. Limites PRO são hipóteses de teste, não promessa de margem. FREE: uma empresa, primeira estratégia e diagnósticos limitados. PRO: uma empresa e uso sujeito à política. O contador atual considera cada chamada IA; uma análise normalmente utiliza duas chamadas (classificação e diagnóstico).

## Credenciais

Manter configurações existentes de `.env.local` e preencher somente no servidor:

```dotenv
SUPABASE_SECRET_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PORTAL_CONFIGURATION_ID=
OPENAI_ECONOMY_MODEL=
OPENAI_STRATEGIC_MODEL=
```

A chave Supabase é secreta/service-role, diferente da publishable. Stripe usa somente `sk_test_` ou `rk_test_`; webhook usa `whsec_`. Nunca compartilhar esses valores na conversa ou no Git. Modelos opcionais usam `OPENAI_MODEL` como fallback. IDs de preço Stripe são mapeados no catálogo administrativo, sem variável de preço por país.

Credenciais de teste Stripe e de servidor Supabase verificadas por consultas reais em 28/09/2026. Stripe CLI 1.52.0 instalado como ferramenta de desenvolvimento em `../.stripe-tools` pelo pacote oficial `@stripe/cli`, fora das dependências da aplicação. O script `npm run stripe:listen` conecta somente eventos da própria conta em teste, encaminha para a porta 3001 e salva o segredo atual em `.env.local` sem exibi-lo. Requer Stripe CLI no PATH, em `STRIPE_CLI_PATH`, ou na instalação local Windows citada. Manter o processo aberto durante os testes; uma nova sessão pode exigir iniciá-lo novamente.

Teste local de verificação de assinatura: evento sintético sem efeito comercial com assinatura válida retornou HTTP 200; assinatura inválida retornou HTTP 400. Isso confirma o uso do segredo pelo endpoint, não confirma o ciclo de compra/ativação. Nenhum evento de assinatura real foi simulado como pagamento concluído.

Catálogo Stripe de teste configurado em 29/09/2026: PRO BR mensal de 9999 centavos, lookup key `seed_pro_br_monthly_test_v1`, preço `price_1UL097B4p9sokTYRr76xxQVc`. Vínculo persistido por função administrativa com auditoria. O administrador habilitou billing BR, mantendo novas assinaturas bloqueadas. Portal de teste criado com histórico de faturas, atualização do meio de pagamento e cancelamento ao fim do período; seu ID foi salvo no ambiente. O backend exige essa configuração explícita e verifica que está ativa e em teste antes de abrir o Portal.

## Testar localmente

Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`. Testes cobrem isolamento RLS, orçamento, custos desconhecidos, expiração, assinatura de webhook, replay, eventos antigos, preços e preservação de dados.

Última execução local em 28/09/2026: lint, typecheck, 90 testes e build aprovados. Isso não substitui o teste remoto de assinatura e webhook, ainda pendente.

Nova execução completa em 29/09/2026, após vincular o Portal explícito e filtrar preços históricos no painel: lint, typecheck, 90 testes e build aprovados. Preço BR configurado e evento PRICE_CHANGED verificados na interface administrativa.

Em 29/09/2026, os sete testes do conjunto de migrações comerciais passaram novamente, incluindo isolamento, orçamento, idempotência, auditoria e preservação de empresas.

Iniciar com `npm run dev -- --port 3001`, abrir `http://127.0.0.1:3001`. Assinatura: `/billing`; administração: `/admin`; preview: `/admin/preview/PT` (também ES e US). Sem configuração comercial a tela informa indisponibilidade, sem permitir cobranças.

## Pendências para concluir

1. Painel administrativo, bootstrap, migrações e credenciais já validados; manter registro das verificações.
2. Cadastrar preços verificados dos modelos IA e manter o encaminhamento de webhook ativo durante os testes. Preço PRO BR e configuração do Portal Stripe de teste já preparados.
3. Ciclo sandbox FREE → Checkout → webhook → PRO → cancelamento validado; ainda verificar pagamentos pendentes, nova contratação após cancelamento, retries e reconciliação de custos desconhecidos.
4. Completar experiência de limites, eventos comerciais, relatórios de contribuição, exceções de uso e acesso beta por mercado. Não apresentar custos parciais como total conhecido.
5. Finalizar simulações internacionais e readiness com evidências. Validações legais/fiscais não recebem aprovação fictícia. Ativação internacional está bloqueada na implementação atual; exige evolução controlada antes de lançamento.
6. Entregar relatório completo do item 82 da especificação e tabelas de mercados/unit economics, identificando simulações.

## Mercados preparados — configuração local, não lançamento

| Mercado | Locale | Moeda | Preço PRO mensal | Billing | Estado |
| --- | --- | --- | --- | --- | --- |
| Brasil | pt-BR | BRL | 99,99 | Habilitado em teste; novas assinaturas bloqueadas | ACTIVE no catálogo |
| Portugal | pt-PT | EUR | 19,99 — hipótese | Desligado | DRAFT |
| Espanha | es-ES | EUR | 19,99 — hipótese | Desligado | DRAFT |
| Estados Unidos | en-US | USD | 19,99 — hipótese | Desligado | DRAFT |

Não há integração Apple/Google nem aplicativo nativo. Receita recorrente contratada não equivale a caixa recebido. Custos de pagamentos, impostos e câmbio não verificados impedem declarar lucro ou contribuição real.

## Teste integrado Stripe — 29/09/2026

Checkout sandbox concluído pela interface com cartão de teste oficial, sem dinheiro real. Eventos Stripe chegaram ao endpoint com HTTP 200 e o plano PRO foi confirmado na interface. Portal abriu e agendou cancelamento para 29/10/2026 mantendo PRO. A API retornou cancel_at igual ao fim do período, com cancel_at_period_end falso; o mapeamento foi corrigido e um novo evento Stripe confirmou cancel_at_period_end verdadeiro no banco. Adicionado teste de regressão.

A assinatura fictícia sub_1UL0QPB4p9sokTYRhEBaZkE9 foi então encerrada imediatamente pela API de sandbox, sem fatura adicional ou rateio, para verificar downgrade (não houve avanço de relógio). O banco confirmou canceled. Contagens antes/depois preservadas: 3 empresas, 9 fatos, 2 estratégias, 5 ações, 1 decisão e 1 experimento. Essa comparação confirma contagens, não uma comparação integral de conteúdo.

Restaurado com auditoria o bloqueio de novas assinaturas BR (disable_new_subscriptions=true), preservando billing_enabled=true escolhido anteriormente pelo administrador. PT/ES/US não foram ativados. A tela de retorno agora atualiza automaticamente por até 30 segundos e deixa de mostrar espera quando PRO foi confirmado.

Permanece pendente verificar a renovação de uma tentativa de checkout já concluída: begin_checkout reutiliza tentativas por 24 horas. Não declarar a fase 9.1 concluída enquanto as pendências acima existirem.

Validação visual final: /billing exibiu FREE após cancelamento e não exibiu botão de nova assinatura, respeitando o bloqueio restaurado. Evidência: billing-free-after-test.png. Lint, typecheck e 91 testes aprovados após a correção do cancelamento.

