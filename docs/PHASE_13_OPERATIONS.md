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

## Incidentes

| Severidade | Exemplos | Resposta |
| --- | --- | --- |
| P0 | Vazamento entre empresas, secret exposto, cobrança indevida generalizada | Suspender função/IA e acesso comprometido, preservar evidência mínima, acionar titular e responsável por privacidade, rotacionar credencial, avaliar comunicação apropriada |
| P1 | Login indisponível, perda de gravações, estouro de orçamento | Pausar jobs afetados, verificar dependências/custos, decidir rollback, informar participantes pelo canal aprovado |
| P2 | Falha localizada, latência, resposta de IA inadequada sem impacto crítico | Registrar identificador e versão, reproduzir com fixture, corrigir, validar regressão |
| P3 | Ajuste visual, sugestão | Registrar feedback e priorizar |

Definir plantonista e substituto, horários e metas de resposta antes do beta. Não há compromisso de atendimento 24/7 configurado. Canal de alerta externo e entrega ainda não foram validados.

Para incidente de IA: guardar identificadores da requisição, empresa, modelo e versão da regra; recuperar apenas os dados necessários mediante autorização, separar fato/hipótese, corrigir memória incorreta pelo fluxo existente, pausar modelo/função quando necessário, acrescentar caso anonimizado ao conjunto de avaliações. Não reproduzir dados reais em logs ou tickets externos.

O painel mostra amostra limitada de eventos, suporte, participantes e jobs. Não calcular SLA ou taxa global a partir dessa amostra. Logs estruturados usam lista de campos permitidos. O circuito de IA abre após cinco falhas consecutivas na janela de dois minutos; pedidos já em andamento podem terminar. Não há meia abertura coordenada entre instâncias nem garantia de prevenção de todas as chamadas concorrentes. Os limites financeiros atômicos existentes continuam sendo o controle de custo.

## Exportação, exclusão e solicitações de privacidade

Solicitações autenticadas entram em `/support`, inclusive com acesso ao beta revogado. O usuário não informa o ID de outra conta. O suporte limita envios e isola a leitura pelo titular. Marcar como resolvido não exporta nem apaga dados.

Procedimento manual obrigatório:

1. Confirmar identidade por sessão/reautenticação, escopo e autoridade sobre cada empresa; não pedir senha no suporte.
2. Listar memberships, empresas compartilhadas, assinaturas e retenções aplicáveis. Exclusão da conta não autoriza apagar dados de outros membros.
3. Para exportação, gerar JSON/CSV apenas dos registros autorizados, excluindo secrets, controles administrativos e conteúdo de outras empresas. Conferir manifesto e tenant em cada conjunto; entregar por meio privado temporário aprovado. **O gerador e o canal de entrega ainda não estão implementados/validados.**
4. Para exclusão, explicar impacto, resolver assinatura pelo gateway correto, obter confirmação final, preservar apenas retenções justificadas e executar procedimento revisado. **Não há exclusão automática nesta fase da implementação.**
5. Registrar IDs, escopo, datas e resultado sem copiar conteúdo empresarial. Encerrar solicitação apenas após comprovar atendimento. Falha parcial permanece aberta.

Sem gerador validado e ensaio de exclusão com empresa compartilhada, privacidade continua bloqueadora do beta.

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
