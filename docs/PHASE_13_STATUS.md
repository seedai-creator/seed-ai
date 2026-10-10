# Fase 13 — preparação para beta fechado

Em implementação desde 10/10/2026. **NOT READY FOR CLOSED BETA.** A aprovação visual e a publicação da Fase 12 não significam que os controles operacionais desta fase estejam concluídos.

## Inspeção inicial

- Aplicação Next.js App Router com Supabase Auth/PostgreSQL, Responses API, Stripe em modo de teste e Vercel Pro; sem microserviços.
- Fase 12 publicada no deployment dpl_2d66KWybZboa2MJVgQfrKARVS3kD.
- Git local na branch master, sem commits e sem remoto. Todos os arquivos do produto estão fora do histórico, embora secrets e artefatos temporários estejam ignorados.
- Desenvolvimento usa o mesmo projeto Supabase da aplicação publicada. Não há staging separado identificado. Isso precisa mudar antes de testes destrutivos, carga, recuperação ou novas migrações remotas.
- Trinta e uma migrações anteriores, testes PostgreSQL/PGlite, regras determinísticas e avaliações de IA já existentes serão aproveitados.
- Anexos atuais: somente TXT, CSV e Markdown; sem bucket de uploads, processamento binário ou geração de imagens. Não será adicionado suporte a novos formatos nesta fase.
- Há reservas de custo atômicas, limite global, limites por usuário, isolamento por empresa, webhook assinado, idempotência, jobs persistidos e versões de registros. Esses módulos não serão substituídos.
- Observabilidade parcial em logs e tabelas de uso/jobs; faltam confirmação de alertas operacionais e exercício de recuperação.
- Não foram identificados documentos jurídicos finais nem configuração confirmada de backups, SMTP próprio ou restore drill.

## Alterações locais em preparação

- Validação explícita de ambiente e bloqueio de banco de produção em development/staging.
- Scanner que verifica arquivos versionáveis sem imprimir possíveis credenciais.
- Pipeline de qualidade com build isolado, sem dependências de credenciais reais e sem deploy automático.
- CSP com nonce, proteção contra framing, cabeçalhos de segurança e proteção de origem sem confiar no Host enviado pelo cliente.
- Leitura de corpo com limite real de bytes, timeout e UTF-8 válido, inclusive no webhook.
- Logs permitidos por lista de campos, identificador de requisição e exclusão de mensagens brutas de erros/dados rejeitados.
- Flags de ambiente centralizadas; controles comerciais existentes continuam restringindo o acesso.
- Migração aditiva local para beta, documentos/aceites, suporte e eventos operacionais, ainda não aplicada remotamente e ainda em validação.

## Bloqueadores externos e decisões

| Item | Situação | Responsável / próximo passo |
| --- | --- | --- |
| Staging isolado | Projeto `dgqvcvebydjxxkuvrgkl` conectado, schema instalado pelo titular e nove verificações de integração aprovadas | Configurar aplicação e provedores de testes; validar navegador, e-mail, integrações e recuperação |
| Versionamento remoto | `origin` vinculado a `seedai-creator/seed-ai`; titular autorizou expressamente o envio público em 10/10/2026 | Enviar histórico local revisado e confirmar execução do CI; proteção de branch ainda pendente |
| Backups e plano de banco | Não confirmados | Titular confirma plano, frequência e retenção no Supabase; não contratar automaticamente |
| Restore em staging | Não executado | Realizar com fixtures e backup, medir tempo, conferir dados e permissões |
| Credenciais já expostas anteriormente | Rotação não comprovada | Rotacionar no provider e substituir no ambiente; não basta remover uma mensagem ou arquivo |
| Termos e privacidade | Revisão final não confirmada | Titular e profissional responsável aprovam documentos, versões e contato |
| E-mail transacional | Sender e entregabilidade não confirmados | Configurar/verificar SMTP, domínio e recuperação de senha |
| Monitoramento e alertas | Não confirmados | Definir canal, responsáveis e testar entrega sem incluir conteúdo empresarial |
| Beta comercial | Não autorizado | Stripe permanece em test mode; nenhum usuário será cobrado automaticamente |
| Publicação da Fase 13 | Não autorizada | Somente após staging, evidências, backup, rollback e autorização específica |

## Auditoria de dependências

Auditoria inicial: oito alertas de alta severidade, nenhum crítico. Next.js 16.3.8 corrige a faixa afetada da linha usada; sharp e source-map-js possuem patches. A cadeia de ferramentas de lint envolvendo braces não possui versão corrigida publicada no momento da consulta; não aplicar downgrade automático de Next 16 para 14 sugerido pelo npm. O relatório final distinguirá dependências executadas em produção das utilizadas somente em desenvolvimento.

Fontes primárias consultadas: [Next.js advisory](https://github.com/advisories/GHSA-39w2-rjm5-chcv), [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), [backups Supabase](https://supabase.com/docs/guides/platform/backups). Backups do banco não incluem os objetos de Storage; se uploads forem adicionados no futuro, também precisarão de recuperação própria.

## Próximas validações

Executar testes das alterações, regressões existentes, lint, typecheck, auditoria após patches e build isolado. Depois configurar staging e validar cadastro/login/reset, beta, aceite, suporte, privacidade, RLS real, E2E, carga controlada e recuperação. Testes com IA real exigem orçamento específico desta fase; não reutilizar concessões temporárias de fases anteriores.

Não iniciar Fase 14. Não abrir inscrições públicas, ativar Stripe live, mercados internacionais ou publicar esta fase sem autorização.

## Procedimentos e limites

[Procedimento operacional](PHASE_13_OPERATIONS.md): staging, GitHub, release, rollback, backup/restore, incidentes, suporte/privacidade, retenção proposta e ensaio de beta. A preparação do procedimento não comprova sua execução.

Implementados localmente também: recuperação de senha, suporte autenticado, documentos jurídicos versionados/aceite, painel operacional com auditoria e controles de beta, bloqueio imediato de IA/funções/modelos e circuito compartilhado de falhas. A revogação foi adicionada a 13 funções autenticadas existentes para impedir que `SECURITY DEFINER` contorne o bloqueio das tabelas. Os contratos de tenant, validação e versão foram preservados.

Não foram publicados documentos jurídicos finais, enviados e-mails, concedidas assinaturas temporárias, feitas chamadas pagas ou aplicadas migrações remotas nesta etapa. Não há monitoramento externo ou canal de alertas ativo, MFA administrativo comprovado, política de retenção/expurgo aprovada ou exportação/exclusão operacional ensaiada. Essas pendências impedem concluir a fase.

## Matriz dos 64 critérios da especificação

Legenda: **local** = código/testes locais, ainda sujeito a staging; **parcial** = parte existente/preparada; **pendente** = sem evidência de conclusão. Nenhum desses termos significa aprovação para produção.

| Critério | Estado / evidência e pendência |
| --- | --- |
| 1. Ambientes separados | Parcial: banco staging `dgqvcvebydjxxkuvrgkl` instalado e testado; validador bloqueia produção; aplicação e Preview ainda pendentes |
| 2. Secrets | Parcial: servidor, arquivos ignorados, logs filtrados; rotação histórica não comprovada |
| 3. Secret scanning | Local: scanner de arquivos versionáveis; não substitui análise de histórico/ferramenta especializada |
| 4. CI/CD | Parcial: workflow sem secrets/deploy; execução remota e proteção de branch pendentes |
| 5. Migrações | Bootstrap das 32 migrações aplicado pelo titular em staging; controles e contratos de acesso validados via API; ensaio de upgrade/rollback e histórico CLI pendentes |
| 6. Rollback | Procedimento escrito; ensaio pendente |
| 7–8. Flags e kill switches | Local: flags centralizadas e controles no banco; ensaio em múltiplas instâncias pendente |
| 9. Checklist Supabase | Procedimento escrito; configuração do titular pendente |
| 10–11. Backup/restore | Pendentes: contratação/configuração não presumidas, nenhum restore drill realizado |
| 12–13. RLS/cross-tenant | Local e staging: Auth/PostgREST reais validaram perfis, memberships, empresas, fatos, suporte, revogação e RPCs críticos; cobertura das demais entidades e E2E ainda pendente |
| 14. Auth | Parcial: duas contas fictícias convidadas e login por senha validados no Auth real, registro sem convite rejeitado; SMTP, links e navegador ainda pendentes |
| 15–16. RBAC/admin | Parcial: papéis, auditoria, confirmação e versões; MFA e recuperação administrativa pendentes |
| 17–18. Inputs/Structured Outputs | Local: contratos existentes e limite de corpo por bytes/tempo; testes adversariais remotos pendentes |
| 19. XSS/CSRF/CORS/headers | Local: origem sem confiar em Host, CSP nonce, headers; navegador/produção pendentes |
| 20. Uploads | Parcial: apenas texto e limites existentes, kill switch; não há suporte binário ou varredura antivírus |
| 21–23. Injection/tools/high impact | Parcial: regras existentes e execução explícita pelo backend; avaliação adversarial completa pendente |
| 24–25. Retry/idempotência/timeout | Local: mecanismos existentes e corpo com timeout; falhas distribuídas reais pendentes |
| 26. Circuit breaker | Local: cinco falhas consecutivas em dois minutos; sem meia abertura coordenada |
| 27. Degraded mode | Parcial: pausa de IA preserva leitura; indisponibilidade do banco continua impedindo operações que dele dependem |
| 28–29. Jobs/logs | Local: painel e logs filtrados; cobertura/correlação de todos os jobs ainda precisa de ensaio |
| 30. Error monitoring | Pendente: logs não equivalem a ferramenta externa com alertas testados |
| 31–32. Métricas operação/IA | Parcial: eventos, custos/tokens e painel existentes; amostragem não comprova taxa global de erros |
| 33. Alertas de custo | Parcial: limites existentes; entrega de alerta externo pendente |
| 34. Admin Operations | Local: controles, participantes, suporte, eventos e jobs; teste autenticado em staging pendente |
| 35. FREE/PRO | Local: proteções comerciais existentes; regressão real de planos em staging pendente |
| 36. Stripe | Parcial: test mode exigido, webhook preservado; reconciliação/entrega de eventos no novo ambiente pendentes |
| 37. Legal/privacy | Checklist escrito; textos finais, contato e revisão profissional pendentes |
| 38. Aceite | Local: versões aprovadas, timestamp, mercado e isolamento; nenhum documento real publicado |
| 39. Privacy requests | Local: solicitação/triagem com identidade da sessão; atendimento operacional pendente |
| 40. Export/delete | Parcial: procedimento de escopo/identidade/empresas compartilhadas; gerador, canal seguro e ensaio pendentes |
| 41–42. Closed beta/onboarding | Local: convite, expiração, revogação e aceite; convite não envia e-mail automaticamente |
| 43–44. Suporte/feedback | Local: formulário e triagem; responsável, canal externo e SLA pendentes |
| 45–46. Runbooks/incidente de IA | Procedimento escrito; responsáveis e exercício pendentes |
| 47. QA strategy | Escrita no procedimento; execução completa depende de staging |
| 48. E2E críticos | Pendente nesta fase: não há evidência do navegador autenticado no novo ambiente |
| 49–52. Evals/dados/idiomas/arquivos/segurança | Parcial: aproveitar conjuntos anteriores; executar suíte completa e revisar casos da fase em staging |
| 53–54. Carga/custo | Pendente: sem carga real ou gasto de IA autorizado para esta fase |
| 55. Activation/retention | Parcial: dados de produto existentes; métricas de coorte sem instrumentação/validação completa |
| 56. Saída do beta | Proposta escrita; metas numéricas e aprovação pendentes |
| 57–58. Go/no-go e tarefas manuais | Esta matriz e procedimento; decisão atual NOT READY |
| 59–60. Domínio/e-mail | Pendentes: domínio definitivo, DNS, sender e entregabilidade não comprovados |
| 61. Auditoria | Local: alterações administrativas/suporte auditadas; retenção e revisão operacional pendentes |
| 62. Dependências | Produção sem alertas na auditoria executada; cinco alertas altos na cadeia dev de lint sem patch publicado |
| 63. Build | Build isolado aprovado; build de staging depende da configuração real |
| 64. Regressões anteriores | Testes locais aprovados após correção e reexecução dos afetados; E2E em staging pendente |

## Riscos remanescentes

- **Disponibilidade:** circuito e timeouts reduzem repetição de falhas, mas não fornecem SLA, monitor externo, alertas ou recuperação do banco.
- **Custos/performance:** reservas atômicas existentes protegem orçamento; testes de carga e consumo por coorte ainda não executados.
- **Privacidade/isolation:** RLS, guardas de backend/RPC e logs sem conteúdo reduzem exposição; validar Auth/PostgREST reais, exportação/exclusão e rotação antes de liberar dados reais.
- **Segurança:** patches de runtime aplicados e scanner local; alertas de ferramentas de desenvolvimento continuam registrados, sem downgrade incompatível para ocultá-los.
- **Legal/retenção:** fluxo permite registrar aceite, mas não aprova termos nem implementa prazos legais automaticamente. Nenhuma alegação de conformidade concluída.
- **Operação:** CI ainda não executa no GitHub; rollback/backup, atendimento e restauração sem ensaio. Publicar agora deixaria controles importantes sem comprovação.

## Evidências locais em 10/10/2026

| Verificação | Resultado |
| --- | --- |
| Lint | Aprovado após corrigir leitura do relógio no componente administrativo |
| Typecheck | Aprovado; validação TypeScript do build também aprovada |
| Regressão inicial | 359 aprovados e 11 falhas; dez suítes não carregaram o SQL novo por delimitadores incorretos, e um teste de tempo do Radar excedeu o limite sob carga concorrente |
| Reexecução após corrigir SQL | Todas as dez suítes afetadas passaram: 96 testes, zero falhas, incluindo seus testes internos antes não executados |
| Radar em execução isolada | Aprovado em 1.434 ms, mantendo o limite original de 3.000 ms; concorrência da suíte reduzida para dois arquivos |
| Migração operacional focada | Sete testes aprovados de RLS, convite, acesso direto/RPC revogado, suporte, versões de aceite, deduplicação e circuito de IA |
| Build | Next.js 16.3.8, compilação, tipos e geração de rotas aprovados; ambiente com fixtures, sem deploy |
| Smoke HTTP do build | Nove verificações aprovadas: páginas públicas, redirecionamentos de sessão, rejeição de origem externa/anônimo, cron protegido; 20 scripts do login com nonce compatível com CSP |
| Scanner de secrets | 386 arquivos versionáveis, nenhum achado na execução registrada; não inclui credenciais ignoradas nem comprova rotação |
| Dependências de produção | Auditoria executada com zero vulnerabilidades conhecidas; cinco alertas altos permanecem na cadeia dev de lint |

A regressão foi fechada por reexecução direcionada de todos os casos afetados, não por ocultação das falhas iniciais. Evidências locais em `.test-build/phase-13-*.log/json` (ignoradas no Git, sem inclusão de credenciais). O servidor temporário da porta 3002 foi encerrado depois dos testes. Nenhum desses testes substitui navegador autenticado, integrações reais, carga/restore em staging ou avaliação de IA desta fase.

## Preparação do staging em 10/10/2026

- Criado `.env.staging.local` privado, ignorado pelo Git, sem copiar credenciais da produção. O titular salvou as chaves do novo projeto diretamente no arquivo.
- Verificação inicial detectou schema ausente (`PGRST205`). Após o titular aplicar o bootstrap, a consulta confirmou a instalação com beta fechado, IA e uploads pausados. Nenhuma migração foi aplicada em produção.
- Instalador inicial gerado a partir das 32 migrações, com transação única e proteção contra banco preenchido. O titular executou o SQL no projeto de staging porque o controle do navegador está indisponível.
- Dois testes locais aprovados: configuração rejeita produção/hosts inválidos/chaves ausentes; bootstrap verifica rollback integral, instalação completa, RLS em todas as tabelas públicas, bloqueio de segunda instalação e IA/uploads pausados.
- Lint dos scripts aprovado. Scanner executado em 392 arquivos versionáveis, sem achados. A instalação inicial manual não registra histórico da CLI do Supabase; reconciliar antes de adotar `db push`.
- A aplicação ainda não foi iniciada usando staging. `.env.staging.local` é carregado somente pelos scripts de preparação/verificação; SMTP, provedores externos e administrador de testes ainda precisam de configuração e validação. As contas fictícias da integração foram temporárias e já removidas.

### Integração real no novo Supabase

`npm run staging:test` aprovado em 10/10/2026, com nove grupos de verificações: controles fechados/IA pausada; cadastro exige convite; dois logins reais com perfis e empresas independentes; negação de leitura anônima e de leitura/alteração de outra empresa; memória confirmada e isolamento da RPC; usuário sem acesso para alterar controles administrativos; suporte isolado; revogação bloqueia dados/RPCs mas preserva pedidos de privacidade; expiração bloqueia acesso.

Contas criadas somente pela API administrativa para fixtures, com e-mails fictícios e confirmação administrativa. Isso **não valida entrega de e-mail, confirmação pelo usuário, recuperação de senha nem fluxos de navegador**. Nenhuma conta recebeu papel administrativo, PRO ou orçamento adicional. Controles operacionais preservados; nenhuma chamada a OpenAI/Stripe. Limpeza confirmada de usuários, empresas, convites e registros associados ao teste. Relatório em `.test-build/staging-integration-report.json`; manifesto privado em `.test-build/staging-integration-state.json` com estado `cleaned`.
