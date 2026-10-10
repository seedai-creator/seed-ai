# Publicação na Vercel

## Estado em 5 de outubro de 2026

- Conta autorizada e projeto `seed-ai` vinculado pelo Vercel CLI.
- Plano Pro ativo, contratado pelo proprietário e confirmado pela API.
- Primeira publicação pronta: https://seed-ai-ashy.vercel.app (Node 24 na Vercel).
- Variáveis configuradas somente para produção; segredos armazenados como Sensitive na Vercel. O arquivo local não foi enviado.
- Supabase Auth: Site URL atualizado e callback HTTPS autorizado pelo proprietário, preservando o callback local.
- Webhook Stripe exclusivo da publicação criado em modo de teste. Assinatura inválida retorna 400; evento de verificação assinado e sem efeitos empresariais retorna 200. Isso não substitui um teste completo de compra.
- Lint, typecheck, 140 testes e build aprovados após o ajuste de paginação.
- Agendamento publicado em `vercel.json`, uma vez por minuto. Execução automática confirmada com HTTP 200 no deployment `dpl_9zwNbKg7UmeJVcyQtpWZnfZQ8nQb`, request `wt58c-1791204992961-cdb180de00f9`. Requisição sem segredo retorna 401.
- `.vercelignore` exclui arquivos de ambiente, credenciais locais da ferramenta, resultados de testes e dependências do envio.
- `.vercel/` e `.env.local` permanecem ignorados pelo Git.

## Validação após a publicação

1. Sessão de usuário, página de assinatura e acesso SUPER_ADMIN da conta administradora verificados no endereço publicado. A sessão comum anterior recebeu 404 em `/admin`, conforme a restrição de acesso. Compra completa de teste ainda pendente; novos cadastros e novas assinaturas permanecem bloqueados.
2. Monitorar fila e histórico do agendamento na Vercel.
3. IA do mercado BR liberada por autorização explícita do proprietário em 05/10/2026. Alteração salva pelo painel e auditada às 15:07:15 (America/Sao_Paulo): `disable_ai_requests=false`, mantendo `disable_new_signups=true` e `disable_new_subscriptions=true`. Limites e planos não foram alterados. Nenhuma nova resposta da OpenAI foi solicitada nesta liberação.

## Operação e limites

O cron autenticado por CRON_SECRET percorre uma página de 25 empresas por minuto, alternando a página pelo relógio e pelo total atual. Para uma lista estável, um ciclo dura `ceil(empresas / 25)` minutos. Inserções e remoções podem causar revisitas; a fila deduplica as leituras. Reavaliar essa solução se a lista passar a mudar continuamente em grande escala.

Cada execução processa no máximo um trabalho, usando o controle de custos e permissões existente. O chat também processa trabalho após a resposta. Monitorar fila e falhas conforme o uso crescer: um agendamento ativo não garante relatórios se faltarem dados, fuso horário ou autorização comercial. Jobs UNKNOWN não são cobrados novamente por retry automático.

Não enviar `.env.local` nem `VERCEL_OIDC_TOKEN` na publicação. O segredo do webhook local não deve substituir o segredo do endpoint HTTPS. As credenciais de teste do Stripe não habilitam cobranças reais.

## Referências oficiais

- https://vercel.com/docs/plans/hobby
- https://vercel.com/docs/cron-jobs/usage-and-pricing
- https://vercel.com/docs/cron-jobs/manage-cron-jobs

Não considerar o agendamento concluído até observar sua execução no ambiente publicado.

### Correção das cotas — 05/10/2026

A migração 202610050001_usage_cycles.sql foi aplicada com sucesso. Snapshot confirmado do administrador: FREE com 2 análises normais e 1 relatório histórico, custo total USD 0.0516354 preservado. Cota de teste separada: 10 análises até 12/10/2026 18:26:56 UTC, com teto FREE de USD 0.25 preservado. A liberação não concede PRO nem habilita relatórios automáticos para FREE. BR mantém IA liberada e novos cadastros/assinaturas bloqueados.

Publicação confirmada: deployment `dpl_HAqz5GAu8KVaEXHxZDaSA4D3DMw6`, alias https://seed-ai-ashy.vercel.app. Lint, typecheck e build local/Vercel aprovados; 145 testes da suíte mais 1 teste adicional de mensagens/tradução aprovados (146 total). Validação autenticada no navegador: saldo 0/10 com validade, leitura do relatório histórico e bloqueio PRO_REQUIRED ao solicitar novo relatório no FREE. O snapshot confirmado após a migração e a concessão da cota preservou custo USD 0.0516354. O teste de bloqueio encerrou antes de qualquer chamada OpenAI. Fase 9.4 não iniciada.

