# Operação da Fase 13 — procedimento de liberação

Estado: implementação local; beta fechado ainda não liberado. Este documento é um procedimento técnico, não uma política jurídica aprovada. Não contém credenciais.

## Primeiro ambiente de testes

1. No Supabase, criar `seed-ai-staging` vazio, preferencialmente na mesma região da produção. Não clonar dados pessoais ou empresariais da produção.
2. Guardar a senha do banco e a chave de servidor no gerenciador de senhas. Informar à equipe somente a URL pública para identificar o projeto; nunca colar secrets no chat.
3. Configurar o ambiente local com `SEED_ENV=development`, `SEED_PRODUCTION_SUPABASE_REF=gqumxaapjyujrpqggnon`, URL/chaves do **novo** projeto e endereço local. No Preview da Vercel, usar `SEED_ENV=staging`, o novo banco e URL HTTPS própria.
4. A configuração local antiga aponta para produção. O novo validador a recusará até a separação ser feita. Não contornar essa proteção definindo o ambiente local como produção.
5. Aplicar as migrações, em ordem, somente no novo banco. A migração `202610100001_production_readiness.sql` ainda não está aprovada para produção. Testar primeiro com dois usuários e duas empresas fictícias.
6. Usar Stripe test mode e um projeto/chave OpenAI de teste com orçamento próprio. Desligar cron e chamadas de IA até a revisão dos limites. Nenhuma autorização temporária de fases anteriores se estende a esta fase.
7. Configurar os retornos de login do novo projeto, validar confirmação de e-mail e recuperação. A URL de recuperação termina em `/auth/callback?recovery=1`. Verificar expiração e reutilização do link.
8. Criar o administrador de staging por procedimento controlado. Ativar `SEED_OPERATIONS_ENABLED=true` somente após a migração. Publicar documentos jurídicos aprovados antes de liberar participantes; conteúdo fictício só em staging.
9. Em `/admin/operations`, ativar acesso apenas por convite, cadastrar uma coorte fictícia e testar convite, expiração, revogação, aceite e suporte. Os convites são permissões de cadastro; esta versão não envia convites por e-mail automaticamente.

O build `npm run build:verify` usa fixtures e não comprova conexão com staging, SMTP, Stripe ou OpenAI. Não deve ser publicado nem usado para atender usuários.

### Recuperação de senha

- O callback PKCE `/auth/callback?recovery=1` continua compatível com mensagens padrão solicitadas pela aplicação no mesmo navegador.
- Para o fluxo recomendado, inclusive links gerados pelo painel e abertos em outro navegador, o template `supabase/templates/password-recovery.html` aponta para `{{ .SiteURL }}/auth/recovery?token_hash={{ .TokenHash }}&type=recovery`. A tela GET não consome o token; o botão confirma via POST, valida origem e usa exclusivamente `verifyOtp` com tipo `recovery`. A senha é alterada apenas depois de uma sessão validada pelo Supabase.
- Publicar as rotas antes de ativar o template no ambiente correspondente. Nunca alterar o template de produção enquanto a aplicação publicada não possuir essas rotas. Definir Site URL para o endereço correto de cada ambiente. O template incluído está em português; as telas da aplicação cobrem os quatro locales.
- Links inválidos, expirados ou reutilizados oferecem nova solicitação. Após a troca, o login informa a atualização e a aplicação solicita revogação global das sessões de refresh. JWTs de acesso previamente emitidos podem permanecer válidos até expirarem; não prometer invalidação instantânea de todo JWT.
- Para validar sem e-mails ou IA: executar `npm run staging:build` e depois `npm run staging:recovery`. O teste cria somente uma conta fictícia no staging validado, usa o Auth real e as rotas HTTP locais, testa acesso anônimo/origem/reutilização, executa a mesma função usada pela ação de senha e verifica senha antiga/nova e refresh revogado. Apaga somente suas fixtures e preserva controles. A porta 3002 deve estar livre. O relatório privado fica em `.test-build/staging-recovery-report.json`.
- Esse teste de integração não substitui o teste manual do formulário, uma entrega real no ambiente publicado nem a expiração por tempo decorrido. Nenhuma credencial, hash de token ou link ativo deve ser anexado a evidências. Um status SMTP `delivered` comprova entrega ao servidor, não conclusão da recuperação.

### Configuração inicial recebida

O titular informou o projeto de staging `dgqvcvebydjxxkuvrgkl`, distinto da produção `gqumxaapjyujrpqggnon`. As chaves devem permanecer somente em `.env.staging.local`, ignorado pelo Git. Esse arquivo é lido explicitamente pelos scripts abaixo e **não é carregado automaticamente pelo Next.js**. A configuração da aplicação e dos demais provedores ainda precisa ser concluída antes de executar o app contra staging.

- `npm run staging:prepare`: reúne as migrações em `.test-build/staging-bootstrap.sql`, com hashes das fontes, sem acessar serviços externos. Esse SQL destina-se apenas à instalação inicial no projeto vazio. Exige ausência de tabelas públicas e usuários Auth, aplica tudo numa transação e deixa beta fechado, IA e uploads pausados. Não clona dados, cria usuários ou concede acesso administrativo.
- `npm run staging:check`: lê somente o arquivo privado de staging, valida projeto/URL e verifica a chave pública e a tabela de controles no projeto informado. Não imprime credenciais e não altera o banco.
- `npm run staging:test`: teste remoto explícito de Auth/PostgREST/RLS, usando contas e empresas fictícias temporárias. Exige beta fechado, IA e uploads pausados. Não altera esses controles nem usa OpenAI/Stripe. Apaga somente as fixtures identificadas pelo manifesto da execução; rejeita empresas compartilhadas com outros usuários. Não executar simultaneamente. Se a limpeza falhar, revisar `.test-build/staging-integration-state.json` antes de repetir; o script recusa um manifesto anterior ainda pendente. Relatório em `.test-build/staging-integration-report.json`, sem senhas ou tokens. Esse teste não valida e-mail, navegador ou todos os módulos do produto.

Revisar o projeto selecionado no SQL Editor antes de instalar o bootstrap. Se houver erro, a transação inteira deve ser revertida; não executar trechos isolados nem retirar a proteção de banco vazio. O bootstrap manual não registra histórico na tabela de migrações da CLI do Supabase; reconciliar esse histórico antes de adotar `supabase db push`, sem reaplicar migrações já instaladas.

## GitHub e publicação

- Remoto informado: `https://github.com/seedai-creator/seed-ai.git`. Titular autorizou expressamente o envio do código ao repositório público em 10/10/2026. Essa autorização não inclui credenciais, dados privados, publicação da aplicação ou alterações no banco de produção.
- Executar scanner de secrets e revisar os arquivos do primeiro commit; `.env*`, `.vercel`, `.test-build`, dependências e artefatos de build ficam fora do Git. Somente `.env.example` é versionável.
- O workflow `SEED quality gates` instala dependências, verifica secrets, auditoria de produção, lint, tipos, testes/migrações locais e build isolado. Actions fixadas por SHA; permissões de leitura; nenhum secret de produção e nenhum deploy.
- Após o primeiro envio, confirmar o workflow verde e configurar proteção da branch exigindo o job `quality`. A existência do arquivo YAML não comprova execução nem bloqueio de merge.
- Vercel deve ter projeto/ambiente Preview apontando exclusivamente para staging. Não vincular produção com publicação automática sem confirmar os controles de branch, aprovação e deploy.
- Liberação exige: CI verde, staging validado, backup recente verificável, restore drill, plano de rollback, revisão dos documentos, orçamento, monitoramento e autorização explícita do titular.

## Rollback

1. Identificar release, incidente e alteração causadora; pausar a função afetada ou IA. Não apagar evidências.
2. Para falha de aplicação, promover o deployment anterior previamente verificado. A última referência conhecida antes da Fase 13 é `dpl_2d66KWybZboa2MJVgQfrKARVS3kD`; confirmar disponibilidade no Vercel antes da liberação.
3. As tabelas da Fase 13 são aditivas. Preferir manter o esquema e corrigir para frente. Não executar DROP ou restaurar banco sobre dados recentes como rollback de interface.
4. Restrição de beta e revogação vivem no banco, inclusive nas funções existentes. Voltar o código não remove essas proteções. Desativar uma restrição só com decisão documentada; não reabrir cadastro para corrigir indisponibilidade.
5. Validar login, leitura de dados próprios, isolamento, chat, jobs, cobrança test e saúde. Registrar horário, responsável e resultado. Rollback de aplicação não substitui recuperação de banco.

## Backups e exercício de recuperação

Confirmar plano do Supabase, frequência, retenção, região, acesso e eventual PITR no painel do titular. Não assumir que estão disponíveis. Definir e aprovar RPO/RTO antes do beta.

Executar primeiro um exercício com dados fictícios em staging: criar duas empresas, registrar contagens e hashes sem conteúdo, produzir backup suportado pelo provedor, restaurar em destino vazio isolado, reaplicar configuração/roles quando necessário e medir o tempo. Conferir esquema, relações, RLS, funções, permissões, integridade, usuário A sem acesso ao B e capacidade de login. Não usar backup de produção nesse exercício sem autorização e minimização específica.

Registrar origem/destino, intervalo coberto, duração, diferença de registros, falhas e responsável. Uma restauração de arquivo sem teste de Auth/RLS não conta como sucesso. Não há Storage de arquivos neste produto; se for adicionado, os objetos precisam de backup próprio, pois backup de banco não os recupera.

Preparação reproduzível: `node scripts/prepare-backup-drill.mjs prepare --run`, exclusivamente com `.env.staging.local` e staging sem contas/empresas. O roteiro cria duas contas sintéticas e exemplos de memória, Journal, planos/ações, metas/métricas, assinatura manual cancelada e logs de uso de custo zero. Mantém IA e uploads pausados, não envia e-mails, não chama provedores pagos e testa o isolamento nas duas direções. As fixtures ficam retidas por necessidade do backup; os convites expiram em sete dias.

O manifesto privado em `.test-build/backup-drill/manifest.json` contém identidades exatas, controles, contagens e hashes, sem senhas. Um manifesto existente impede nova preparação. Em falha parcial, reconciliar somente essas identidades antes de qualquer repetição; não apagar registros por prefixo. A remoção posterior deve conferir ausência de membros externos e tratar primeiro as dependências comerciais sem cascade. Não limpar fixtures antes da restauração e da preservação do relatório.

`node scripts/prepare-backup-drill.mjs verify --run` relê e compara o conteúdo no staging original. Esse comando apenas comprova a estabilidade da referência; **não atesta restauração**. Esperar um backup posterior a `lastWriteBeforeBackup`, registrar sua data, revisar o destino isolado e os custos e então executar o restore real. A restauração exige novas verificações de Auth/RLS e configuração do destino; jamais apontar estes comandos para produção. Tabelas de outros projetos presentes no staging devem ser preservadas e incluídas na avaliação de privacidade antes de clonar.

Ensaio executado em 14/10/2026: backup físico restaurado em novo projeto autorizado, 21 conjuntos comparados sem divergências, catálogo/permissões conferidos e Auth/PostgREST/RLS reais aprovados com duas empresas fictícias. A origem permaneceu intacta. As sessões foram encerradas e as credenciais temporárias locais removidas. Evidências e identificadores ficam no relatório privado `RESTORE_AND_KEY_RELEASE_2026_10_14.md`; não publicar esses arquivos no repositório.

O intervalo observado entre início do restore e conclusão dos testes de Auth/APIs foi 9min34s. A cópia tinha 12h33min39s no início. Esses números descrevem um ensaio pequeno, sem Storage; não garantem RPO/RTO de produção. Login foi validado por token único sem envio de e-mail; a igualdade dos verificadores das senhas originais foi conferida separadamente. URLs, SMTP, secrets e roteamento da aplicação não são recuperados automaticamente junto com o banco.

Ao terminar um ensaio, preservar o relatório, confirmar que nenhum sistema depende do destino e solicitar a exclusão do projeto temporário para encerrar seu custo. Nunca remover a origem ou seus backups como limpeza do teste.

## Incidentes

| Severidade | Exemplos | Resposta |
| --- | --- | --- |
| P0 | Vazamento entre empresas, secret exposto, cobrança indevida generalizada | Suspender função/IA e acesso comprometido, preservar evidência mínima, acionar titular e responsável por privacidade, rotacionar credencial, avaliar comunicação apropriada |
| P1 | Login indisponível, perda de gravações, estouro de orçamento | Pausar jobs afetados, verificar dependências/custos, decidir rollback, informar participantes pelo canal aprovado |
| P2 | Falha localizada, latência, resposta de IA inadequada sem impacto crítico | Registrar identificador e versão, reproduzir com fixture, corrigir, validar regressão |
| P3 | Ajuste visual, sugestão | Registrar feedback e priorizar |

Definir plantonista e substituto, horários e metas de resposta antes do beta. Não há compromisso de atendimento 24/7 configurado. Canal de alerta externo e entrega ainda não foram validados.

Para incidente de IA: guardar identificadores da requisição, empresa, modelo e versão da regra; recuperar apenas os dados necessários mediante autorização, separar fato/hipótese, corrigir memória incorreta pelo fluxo existente, pausar modelo/função quando necessário, acrescentar caso anonimizado ao conjunto de avaliações. Não reproduzir dados reais em logs ou tickets externos.

O painel mostra amostra limitada de eventos, suporte, participantes e jobs. Não calcular SLA ou taxa global a partir dessa amostra. Logs estruturados usam lista de campos permitidos. O circuito de IA abre após cinco falhas registradas na janela de dois minutos; pedidos já em andamento podem terminar. Não há meia abertura coordenada entre instâncias nem garantia de prevenção de todas as chamadas concorrentes. Os limites financeiros atômicos existentes continuam sendo o controle de custo.

## Exportação, exclusão e solicitações de privacidade

Preparação de exclusão: `node scripts/prepare-privacy-review.mjs <id-da-solicitação>` lê apenas staging, exige um pedido `DELETE_ACCOUNT` aberto e grava um inventário privado em `.test-build/privacy-review/`. Não agenda nem executa exclusão. Falha de consulta, contagem ausente ou mais de 25 empresas exigem revisão manual; não são tratados como zero.

O inventário distingue empresa exclusiva, empresa compartilhada, último proprietário e empresa sem proprietário. Uma empresa compartilhada nunca entra automaticamente no escopo de remoção; o último proprietário precisa combinar e confirmar a transferência antes de sair. Assinaturas (inclusive históricas), custos, jobs, autoria de registros, sessões Auth e retenções precisam ser conciliados. O relatório não contém textos de conversas nem nomes dos demais membros.

Solicitações autenticadas entram em `/support`, inclusive com acesso ao beta revogado. O usuário não informa o ID de outra conta. O suporte limita envios e isola a leitura pelo titular. Marcar como resolvido não exporta nem apaga dados.

Procedimento manual obrigatório:

1. Confirmar identidade por sessão/reautenticação, escopo e autoridade sobre cada empresa; não pedir senha no suporte.
2. Listar memberships, empresas compartilhadas, assinaturas e retenções aplicáveis. Exclusão da conta não autoriza apagar dados de outros membros.
3. Para exportação, usar o download autenticado de JSON em `/support`, validado em staging. O endpoint limita os dados ao titular e às empresas autorizadas, excluindo secrets, controles administrativos e conteúdo de outras empresas. Conferir o manifesto e tenant em cada conjunto. Esse fluxo ainda depende da publicação aprovada da Fase 13 para estar disponível na produção.
4. Para exclusão, explicar impacto, resolver assinatura pelo gateway correto, obter confirmação final, preservar apenas retenções justificadas e executar procedimento revisado. **Não há exclusão automática nesta fase da implementação.**
5. Registrar IDs, escopo, datas e resultado sem copiar conteúdo empresarial. Encerrar solicitação apenas após comprovar atendimento. Falha parcial permanece aberta.

O gerador de exportação está validado em staging. O inventário `prepare-privacy-review.mjs` exige uma solicitação aberta e consulta a função restrita `privacy_deletion_dependencies`: contabiliza vínculos diretos com o titular e cinco famílias de trabalho pendente, sem copiar conteúdo empresarial. Uma tabela nova sem permissão suficiente interrompe o inventário; não produz uma autorização parcial. Dados embutidos em JSON, texto, trabalhos de toda a empresa, Storage, fornecedores e backups precisam de análise separada.

O ensaio real `node scripts/test-staging-privacy.mjs --run` passou em 15/10 com duas contas fictícias: identifica impedimentos financeiros/autoria, confirma que exclusão direta falha, revoga refresh e acesso de negócio, remove explicitamente a conversa privada da fixture e preserva o fato empresarial compartilhado com autoria nula e a conversa do outro membro. Não há reassociação falsa de autoria. O teste não decide retenção real: somente suas linhas financeiras fictícias são descartadas. Revisar e preservar a auditoria necessária antes de atender um pedido real; não usar esse roteiro como apagador genérico.

Manifesto e evidências ficam em `.test-build/privacy-drill/`. Falha de limpeza bloqueia nova execução; identidades aleatórias e verificação de membros impedem remoção de uma empresa com participantes externos à fixture. Controles de staging permanecem fechados, IA/uploads pausados, sem envio de e-mail ou chamadas de pagamento. JWTs antigos podem continuar criptograficamente válidos: memberships/RLS e bloqueio operacional também precisam impedir o acesso aos dados.

## Retenção e fornecedores

Não existe política jurídica final aprovada nem expurgo automático validado. A tabela abaixo é uma proposta para decisão, não compromisso público nem autorização de apagar dados.

| Categoria | Proposta operacional | Pendente |
| --- | --- | --- |
| Conversas, memória, planos e resultados | Enquanto conta ativa e necessários ao serviço; exclusão/exportação a pedido conforme direitos e vínculos | Prazo pós-encerramento e efeitos em empresas compartilhadas |
| Anexos de texto | Tratados como parte da conversa; sem repositório binário separado | Confirmar informação ao usuário e exclusão correlacionada |
| Eventos operacionais sem conteúdo | Janela curta de 30 dias sugerida | Aprovação, expurgo e teste de índices |
| Uso/custos | Detalhe por período necessário à conciliação; agregados quando possível | Prazo, anonimização e separação do histórico empresarial |
| Billing e auditoria | Somente dados necessários à prestação de contas | Validação de obrigações e prazo por mercado |
| Solicitações de suporte/privacidade | Durante tratamento e prazo justificado de comprovação | Prazo, expurgo de texto livre e acesso do operador |
| Backups | Retenção do plano contratado; acesso restrito | Confirmar duração e propagação de exclusões após restauração |

Fornecedores existentes: Supabase (Auth/banco), Vercel (hospedagem/logs), OpenAI (inferência), Stripe (pagamento em teste). Não foram adicionados analytics de terceiros, cookies de marketing, ferramenta externa de monitoramento ou envio automático de relatórios de erro. Avaliar contratos, regiões e minimização antes de ativá-los.

## Ensaio de beta e critérios de saída

Começar com pequena coorte convidada, um mercado, Stripe test e limites explícitos. Antes: executar E2E de cadastro/aceite/empresa/conversa/diagnóstico/plano/ação/resultado, quatro locales, correções, anexos suportados, timeout, limite de uso, mudança de empresa, revoke e recuperação. Usar fixtures de varejo/serviços/consultoria, dados ausentes, contraditórios e de períodos/moedas distintos.

Carga: definir concorrência/volume e orçamento de staging, medir p50/p95, erros, consultas, filas e custos; combinar requests negados, leituras, jobs e poucas chamadas reais previamente autorizadas. Nunca bombardear produção ou executar chamadas pagas com autorização antiga. Carga sintética de função isolada não comprova capacidade do produto.

Saída proposta: nenhum P0/P1 aberto, isolamento e recuperação comprovados, erros de IA reproduzíveis/corrigíveis, orçamento respeitado, suporte atendido, restauração dentro do RTO acordado e aceite explícito do titular. Critérios numéricos de disponibilidade, latência e retenção de usuários ainda precisam ser acordados e medidos.

Não iniciar Fase 14, abrir beta público ou fazer deploy com base apenas neste procedimento.


## Alertas operacionais — implementação de 14/10/2026

A migração `20261014211433_operational_alerts.sql` e o trabalhador `src/lib/operations/alert-worker.ts` mantêm uma fila interna com RLS e funções restritas ao servidor. A migração foi aplicada somente no staging. Não foi ativado envio automático em produção.

O trabalhador roda no agendamento autenticado já existente `/api/internal/journal`, mesmo com os recursos de IA desligados. Cada execução tenta no máximo um envio, com limites de tempo para banco e Resend. A falha do canal fica nos logs sem gerar alertas recursivos. A tela administrativa exige autorização e MFA para mostrar os estados da fila.

Gatilhos implementados:

- P1: pelo menos cinco erros registrados em 15 minutos, cinco falhas de IA em dois minutos ou uma falha de processamento de webhook assinado.
- P2: falhas de autenticação registradas, tarefas do Journal vencidas há mais de 15 minutos, custos desconhecidos/pendentes ou 80% do menor limite diário global dos planos disponíveis.
- Custo soma valores contabilizados ou reservados do dia UTC. Não é fatura e o limite de referência pode diferir de uma exceção administrativa temporária.
- Pausas administrativas voluntárias, isoladamente, não indicam indisponibilidade.

No máximo um aviso por prioridade por hora UTC. A primeira amostra e o remetente/destinatário são congelados; a chave de idempotência do Resend continua a mesma nas tentativas. Há lease exclusivo de dois minutos, até seis tentativas e encerramento em menos de 23 horas. HTTP 429, 5xx e falhas de rede podem repetir; rejeições permanentes encerram a tentativa. Alterar o destinatário não altera mensagens já enfileiradas: revê-las antes de trocar o responsável.

Variáveis somente de servidor: `SEED_ALERTS_ENABLED`, `RESEND_API_KEY`, `SEED_ALERT_FROM` e `SEED_ALERT_TO`. Usar chave de envio restrita ao domínio verificado. O modo core de staging e o build de verificação impedem envios. O arquivo privado `.env.alerts.staging.local` é exclusivo do teste manual, não é carregado automaticamente pelo Next.

Validação: testes PostgreSQL locais e reais em staging cobriram permissões, deduplicação, lease, repetição limitada e confirmação do provedor. Em 14/10/2026, um único alerta fictício autorizado foi enviado pela fila; Resend informou `delivered`. Eventos fictícios removidos, recibo preservado. Esse status confirma entrega ao servidor destinatário, não a posição na caixa de entrada. Responsável/canal confirmados pelo titular e evidências ficam no relatório privado.

Preparação de novo teste: compilar os testes e executar `node scripts/test-operational-alert-delivery.mjs` para gerar a prévia sem rede. O argumento `--send` só pode ser usado após autorização específica de envio, em staging fechado, com destinatário revisado. Um manifesto anterior impede repetição acidental; não apagá-lo para forçar reenvio.

Limites abertos: o canal depende do banco e do cron; não detecta a própria indisponibilidade total. Alertas externos de backup, quota de infraestrutura, ausência do cron e falha da entrega ainda precisam ser configurados. A fila monitorada é a do Journal; as demais filas não estão integralmente cobertas. Erros capturados pelo Next e falhas de provedor Auth 5xx são registrados, mas isso não constitui detecção completa de ataques de autenticação. Testes cross-tenant continuam no CI; nenhuma integração de notificação de falha do CI foi comprovada. Métricas por usuário/plano/recurso e falha de pagamento do cliente precisam de regras adicionais; não confundir webhook com pagamento recusado. Retenção/expurgo dos recibos depende da política aprovada.

Fontes: [envio Resend](https://resend.com/docs/api-reference/emails/send-email), [idempotência Resend](https://resend.com/docs/dashboard/emails/idempotency-keys). A fila não substitui os limites financeiros atômicos da aplicação.

## Concorrência e ensaio limitado — 15/10/2026

`npm run staging:test -- --load` usa duas identidades Auth reais, até quatro leituras simultâneas e quatro inícios por segundo, 96 consultas totais. Prepara 500 mensagens e 100 eventos por empresa, verifica paginação e tentativas entre tenants, e envia duas alterações com a mesma versão. No resultado esperado, uma alteração é aplicada e outra retorna HTTP 409; o dado não é sobrescrito. Métricas incluem a rede do computador até o staging. Um smoke adicional de Cockpit hospedado passou com 12 leituras e concorrência três. Ainda faltam cargas representativas de uploads, filas, webhooks e batches de Radar/Weekly.

O ensaio detectou que o uso manual de `40001` para conflito permanente provocava milhares de tentativas no PostgREST. A migração `20261015165036_domain_conflict_status.sql` muda somente o código para `PT409` em uma lista explícita de 19 funções. Teste compara corpos, owners, grants e configurações antes/depois; falha se uma função esperada não existir. Erros de serialização gerados realmente pelo PostgreSQL não são interceptados. As telas continuam aceitando o código legado na implantação gradual.

Aplicar as migrações em ordem, primeiro no staging. Não alterar migrações antigas nem reaplicá-las para obter a correção. O código e o banco publicados ainda precisam de uma liberação aprovada da Fase 13. Fonte: [orientação oficial do Supabase para SQLSTATE 40001 em RPC](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b).

Ensaio de incidente de 15/10: funções reais de pausa por recurso/modelo, circuito após cinco falhas de IA, criação de alerta P1, recuperação após envelhecimento dos eventos fictícios e manutenção da pausa manual. Tudo ocorreu em uma transação revertida; controles e fila publicados para outras sessões não mudaram. Não é ensaio de perda do banco, indisponibilidade de provedor nem rollback de deployment.

## Simulação de orçamento por coorte

`node scripts/simulate-cost-cohorts.mjs <snapshot.json>` recebe configuração revisada, sem conectar provedores. Produz 12 cenários (100/1.000 FREE e PRO, demanda alvo/mista/máxima) em relatórios privados. Usa unidades inteiras para orçamento, limita por dia/mês/ciclo e destaca a capacidade compartilhada do orçamento global. Média e p95 de demanda simulada são distintos dos custos históricos agregados; não inventar comportamento real de clientes a partir da distribuição escolhida.

Não somar tetos globais dos cenários, renovar a franquia FREE por engano ou tratar custos desconhecidos como zero. Reservas não garantem o valor final da fatura. Preços, reservas, tokens, retries, cache e conciliação precisam permanecer verificáveis. Não há estimativa comprovada de infraestrutura, taxas de pagamento, CAC, impostos ou contribuição financeira; não misturar BRL e USD sem câmbio explícito. O roteiro não aumenta orçamento e não consome IA.

## Preview hospedado e reversão de versão

Usar projeto Vercel exclusivo de staging, sem domínio de produção ou vínculo Git que publique automaticamente. Proteger todos os deployments por autenticação Vercel antes do primeiro envio. As variáveis são exclusivas de Preview; `hostedStagingEnvironment` importa somente as chaves do banco de testes e flags explicitamente permitidas. Não copiar `.env.local`, chaves de provedores, histórico Git, relatórios privados ou o agendamento da aplicação publicada. A validação rejeita esse modo em Vercel Production.

`hostedSourceFile` delimita os arquivos de aplicação enviados. A preparação local conserva hashes em manifesto privado. O pacote do ensaio adiciona um marcador estático sem dados pessoais e remove cron. Não usar esse pacote como release de produção. O ambiente hospedado ainda não valida callbacks de e-mail, pagamentos, IA ou workers.

Para o ensaio de reversão, preparar duas versões READY, confirmar o mesmo projeto de staging, verificar o alias permitido e então alternar baseline → candidata → baseline. Conferir o marcador servido após cada alteração, títulos dos painéis após carregamento, sessão e recusa de acesso entre empresas. Preservar a tentativa falha se houver. O retorno do alias não reverte banco, chaves, eventos, objetos Storage nem cobranças. Um release com alteração incompatível de schema exige correção aditiva ou plano específico; não inferir compatibilidade de versões arbitrárias deste ensaio.

O acesso automatizado deve ser temporário, enviado por cabeçalho somente à origem de staging e revogado em `finally`. Não colocá-lo na URL ou em logs, nem enviar esse cabeçalho a Supabase/outros destinos. Criar apenas fixtures com identificadores próprios, remover somente essas fixtures e verificar os controles e os usuários preexistentes ao terminar. O teste não deve enviar e-mails nem consumir IA. Confirmar anonimamente a proteção e a landing oficial depois do ensaio.

Em novos projetos, a Vercel pode classificar o primeiro envio como Production mesmo quando solicitado Preview. Se isso ocorrer, deixar o validador falhar; não copiar as credenciais de teste para Production como atalho. Inspecionar o target retornado antes de atribuir o alias. Fonte: [ambientes da Vercel](https://vercel.com/docs/deployments/environments) e [controle de acesso Vercel](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication).
