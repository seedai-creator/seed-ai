# Monitor independente da SeedAI

Publicação e periodicidade autorizadas em 16/10/2026. A rota de saúde já está publicada, com quatro verificações saudáveis e recusa de acesso sem token. Dois e-mails identificados como teste (falha e recuperação) foram entregues pelo Resend ao destinatário aprovado, sem interromper a aplicação. O workflow agora prevê execução a cada dez minutos, ainda condicionado a `SEED_MONITOR_ENABLED=true` e aos dois secrets. **Ativação no GitHub pendente da confirmação específica do destino das credenciais, exigida pela revisão automática.** Não reutilizar chaves de banco, OpenAI, Stripe ou cron.

O workflow `.github/workflows/operational-health.yml` executa fora da Vercel e do Supabase. Consulta somente `https://appseedai.com/api/internal/health`, com token próprio de leitura. Exige quatro verificações saudáveis: banco, agendador, entrega de alertas e filas de trabalho. Redirecionamento para landing/login, HTML, resposta incompleta ou timeout não contam como sucesso.

## Configuração e ativação

1. Publicar a rota e aplicar as migrações operacionais aprovadas; conferir o backup atual e o rollback. Preservar o bloqueio público, acrescentando somente a exceção exata `/api/internal/health` no firewall. A rota continua exigindo seu token.
2. Criar `SEED_HEALTH_TOKEN` aleatório exclusivo; guardar no servidor Vercel e no secret homônimo do GitHub. Não colocar em URL, logs, captura de tela ou artefato.
3. Guardar `SEED_MONITOR_RESEND_KEY` no GitHub com uma chave de envio limitada ao domínio `auth.appseedai.com`. Remetente `alertas@auth.appseedai.com`, destinatário fixo `seedtecnologias.suporte@gmail.com`, respostas para `suporte@appseedai.com`. Envio exige autorização explícita do titular.
4. Depois de integrar o candidato revisado em `main`, definir a variável de repositório `SEED_MONITOR_ENABLED=true`. Primeira execução manual: `initialize_state=true`. Nas seguintes: false. Nunca inicializar novamente para esconder uma falha; reconciliar o histórico primeiro.
5. Confirmar consulta real, um aviso de falha e um de recuperação, sem interromper o serviço real para provocar o ensaio. Esse ensaio passou em 16/10: uma resposta HTTP 503 local foi detectada pelo mesmo verificador; a recuperação consultou o endpoint publicado. O transporte real enviou os dois avisos com prefixo de teste, e o provedor confirmou duas entregas, sem falha ou rejeição. Isso ainda não comprova a execução do workflow no GitHub.

O job só roda em `main`, com a variável de ativação. Não recebe secrets de cliente nem usa ambientes de produção para criar dados. Tem permissões GitHub de leitura, execução serializada e Actions fixadas por SHA.

O cron representa a frequência solicitada, não garantia de execução pontual ou de SLA: o GitHub pode atrasar tarefas. A persistência e o envio precisam ser conferidos em execuções reais após configurar os secrets e ativar a variável; não considerar apenas o YAML como prova de monitor ativo.

## Controle de repetição e recuperação

Um aviso na mudança para falha e outro na recuperação; não há e-mail a cada consulta. O estado é preservado em artefato por 30 dias. Recupera somente a execução anterior desse workflow no repositório oficial, branch `main`, evento manual/agendado. PR, fork, outro workflow, execução ainda ativa, repetição da mesma execução, estado ausente/expirado/corrompido e histórico truncado exigem revisão. Não retorna silenciosamente a um estado saudável antigo.

O evento e a mensagem são gravados antes do envio. Após resposta incerta, a próxima tentativa conserva corpo e chave de idempotência. Retry limitado a seis tentativas, intervalos crescentes de dez a sessenta minutos e menos de 23 horas. Erro permanente exige revisão. O limite temporal respeita a [janela de idempotência do Resend](https://resend.com/docs/dashboard/emails/idempotency-keys). O estado não contém secrets ou dados empresariais; trata somente a situação do monitor e os endereços de suporte já públicos.

Se a recuperação ocorrer enquanto um aviso estiver com entrega incerta, primeiro se resolve o mesmo envio; a recuperação segue na próxima consulta. O aceite do Resend não comprova chegada à caixa de entrada. É necessário conferir o teste de entrega antes da ativação. Se o GitHub ou o Resend também falharem, não há garantia de aviso: revisar falhas do workflow, manter acesso aos painéis dos provedores e um responsável humano. Artefato ausente após interrupção exige reconciliação; não prometer entrega exatamente uma vez em todos os tipos de falha.

## Mensagens preparadas

- **SeedAI — falha detectada pelo monitor externo:** informa que uma ou mais verificações não estão saudáveis e orienta conferir aplicativo, banco, agendador e fila nos painéis. Inclui horário UTC e endereço do verificador, sem dados privados.
- **SeedAI — serviço voltou a responder:** informa que as quatro verificações voltaram a responder, com horário UTC. Não certifica cada tarefa ou pagamento individual.

Para o ensaio, usar mensagens explicitamente identificadas como teste e somente números/estados fictícios; não simular uma queda real para terceiros.

## Verificação local sem e-mails

`node --test tests/health-monitor.test.mjs tests/monitor-notifications.test.mjs tests/monitor-state.test.mjs`

Valida destino do token, recusa de respostas inválidas, transições, deduplicação, backoff, mensagem imutável, recuperação, bloqueio de erros permanentes e origem do estado. Usa transportes falsos explícitos. Não substitui a execução real no GitHub e a entrega ao destinatário. Persistência usa [artefatos do GitHub Actions](https://docs.github.com/en/actions/tutorials/store-and-share-data); retenção e disponibilidade não equivalem a um SLA.
