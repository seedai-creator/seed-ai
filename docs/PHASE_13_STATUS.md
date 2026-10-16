# Fase 13 — preparação operacional para o lançamento

Em implementação desde 10/10/2026. **NOT READY FOR CLOSED BETA.** A aprovação visual e a publicação da Fase 12 não significam que os controles operacionais desta fase estejam concluídos.

## Diretriz atual do titular — lançamento comercial

Em 15/10/2026, o titular esclareceu que anunciará e abrirá a SeedAI como aplicativo funcional **com cobrança**, e não como beta público ou teste gratuito. As validações anteriores à abertura são internas. Não voltar a propor um lançamento gratuito por conveniência técnica. As referências a beta neste histórico e no nome dos controles de acesso não definem a oferta ao público.

A classificação `NOT READY FOR CLOSED BETA` vem da especificação original; tampouco existe aprovação para lançamento comercial. Para a abertura paga, os canais efetivamente ofertados precisam ter compras, confirmação de acesso, renovação, restauração quando aplicável, cancelamento, falhas e reembolso implementados e validados. Stripe em teste e a aprovação dos cadastros Apple/Google não comprovam cobrança de produção nem compras dentro dos aplicativos. A publicação e a ativação de cobrança continuam sujeitas aos critérios e às autorizações de liberação; esta decisão não inicia a Fase 14.

O titular também informou que **os documentos já foram revisados e enviará os ajustes**. A pendência atual é receber e incorporar essa revisão, conferir a versão final e sua correspondência com a oferta/implementação. Não solicitar novamente a contratação de um revisor. As minutas locais ainda não representam a versão revisada e não devem ser publicadas ou marcadas como aprovadas por inferência.

## Estado mais recente — reconciliação e HTTPS — 16/10/2026

Esta seção substitui as pendências equivalentes dos registros históricos abaixo. Planos continuam desativados; landing e bloqueio público preservados. Fase 14 não iniciada.

- **Histórico reconciliado:** 42 migrações no staging e 35 em produção. Reparo somente de metadados, com pré-condições, cópias e inversão; nenhum SQL de schema reaplicado. Catálogos antes/depois idênticos. Fontes agora incluem as quatro migrações da landing. [Procedimento e pendências](MIGRATION_HISTORY.md).
- **Staging atualizado depois do reparo:** correção `allowance_guards` instalada e registrada na versão canônica. Agora são 43 migrações, 81 tabelas e 106 funções, sem diferença de catálogo em relação às fontes. Dez grupos de integração comercial/RLS aprovados; preços, planos, mercados, controles e vinte conjuntos de dados do backup preservados. Produção permanece nas 35 migrações já existentes.
- **Stripe hospedado aprovado:** dez grupos de integração, incluindo seis verificações HTTPS: preview privado e assinatura inválida recusada; falha real sem concessão; reenvio pelo Stripe após corrigir somente a fixture; isolamento entre contas; repetição concorrente sem duplicação; cancelamento/evento antigo conservam FREE e memória. Catálogo, mercados, preços e franquias reais preservados. Reenvio explícito pela CLI oficial, sem certificar espera do backoff automático ou calendário live.
- **Saúde HTTPS:** acesso sem token recusado; resposta mínima e não armazenável. Banco/entrega de alertas saudáveis; ausência de cron e trabalho antigo no staging corretamente classificados como degradados. Nenhum recibo artificial ou mudança nas fixtures do backup para obter 200. Monitor periódico de produção ainda não ativado.
- **Monitor independente preparado:** estado persistido entre execuções, um aviso por falha/recuperação, repetição com mensagem/chave idênticas e recusa de estado ausente ou vindo de outra origem. Seis testes específicos aprovados. Workflow manual, sem agendamento, ativação ou envio real; [procedimento e limites](INDEPENDENT_MONITOR.md).
- **Qualidade:** suíte local completa com 554 testes aprovados; lint e scanner de 502 arquivos aprovados. Tipos e build de staging aprovados nesta rodada de trabalho. A [CI da reconciliação e Stripe](https://github.com/seedai-creator/seed-ai/actions/runs/38967087692) passou; nova CI é exigida no commit final que acrescenta o monitor, antes da publicação.

Evidências privadas: `migration-ledger/`, `hosted-stripe/health-report.json`, `staging-stripe-hosted-report.json` e `phase13-reconciliation-*.log`. Falhas intermediárias dos roteiros de Vercel/Git foram preservadas; nenhuma proteção de produção foi relaxada.

**Restante para liberação:** publicação autorizada do [candidato operacional e suas oito migrações](PHASE_13_RELEASE_CANDIDATE.md); ativação/teste de notificação e recuperação do monitor independente; incorporação dos ajustes finais dos documentos/oferta e metas operacionais. A migração de proteção de franquias está validada no staging e pendente em produção; ofertas candidatas não foram ativadas. Cobrança live, reembolsos e compras nas lojas não foram certificados por testes Stripe. Abertura continua **NOT READY FOR CLOSED BETA**, sem liberação comercial.

## Complemento técnico — Stripe, filas e anexos — 16/10/2026

Esta atualização substitui as pendências de Checkout local com entrega assinada, portal de teste e ensaios determinísticos das filas indicadas abaixo. Não encerra a Fase 13 nem autoriza produção. O titular manteve os planos desativados.

- **Stripe:** Checkout hospedado concluído no navegador com cartão fictício, recusa sem concessão de plano, confirmação assinada recebida pela rede via CLI oficial e persistida pelo handler real do candidato. Eventos adulterados recusados, reenvio concorrente idempotente e acesso de outra conta preservado. Portal hospedado agenda cancelamento sem cortar o período pago; cancelamento efetivo remove o PRO e conserva a memória. Dez grupos de integração aprovados.
- **Renovação:** relógio oficial do Stripe testou novo ciclo, falha de pagamento, retirada do acesso pago, recuperação e cancelamento, com entrega assinada de eventos e Supabase real. Dez grupos aprovados. Quando a configuração do provedor adiou a finalização/cobrança, o roteiro operou somente a fatura fictícia correspondente. Isso não certifica o calendário de tentativas nem a tolerância de produção.
- **Separação de ambientes:** metadados `seed_staging_*` são exclusivos de development/staging; produção mantém o contrato `seed_*`. Metadados mistos são ignorados. O modo local de validação de billing aceita apenas chave Stripe de teste, recusa IA/e-mail e não pode ser usado na Vercel ou em produção. Nenhum segredo foi copiado para o frontend, impresso ou sobrescrito.
- **Processadores:** quatro rodadas Journal → Modelo Vivo com quatro concorrentes, fonte exata e persistência sem duplicação; rollback/backoff/recuperação após payload inválido; execução Journal expirada vira UNKNOWN sem repetir automaticamente uma chamada de custo incerto. Três rodadas de pesquisa validaram retomada de lease, recusa de escritor antigo, rollback de citações inválidas e limpeza de contexto privado. Seis verificações específicas e dez grupos totais aprovados. Saídas de provedores eram fixtures explícitas, sem IA ou pesquisa paga.
- **Anexos:** três grupos aprovados no aplicativo compilado com Auth real: TXT/CSV/Markdown limitados; recusa de PDF/executável/binário/tamanho excessivo; controles de pausa, empresa, codificação e formato HTTP. Dezesseis corpos acima do limite, até quatro simultâneos, receberam 413. Nenhuma conversa ou custo foi registrado pelos envios recusados. PDF, Office, imagem, áudio e antivírus continuam fora das capacidades atuais.
- **Limpeza/preservação:** usuários temporários e seus dados removidos; sessões Stripe expiradas quando abertas, clientes fictícios removidos, produtos/preços arquivados e relógio de teste eliminado. O Stripe conserva parte do histórico de eventos de teste. Vinte conjuntos da referência do backup continuam idênticos. Controles e limites mantidos, nenhum e-mail ou chamada paga de IA. A leitura de produção confirmou novas assinaturas bloqueadas; a landing respondeu 200 e as entradas do aplicativo redirecionaram para ela.
- **Histórico do banco:** oito registros remotos mapeados às fontes locais: quatro do aplicativo e quatro da landing. Os oito conteúdos coincidem após normalizar apenas finais de linha/espaços externos; timestamps divergem. Fontes e comparações preservadas privadamente. As instalações antigas manuais continuam sem entradas; histórico não foi reescrito nem bootstrap reaplicado. Consolidar as duas origens antes de automatizar `db push`.
- **Qualidade:** suíte completa com 544 testes aprovada; guarda adicional de propriedade do relógio validada depois em sete testes focados. Lint completo, verificação de tipos, build com staging isolado e scanner de 486 arquivos aprovados. Este resultado é local; não substitui CI no commit final nem publica o candidato.

Falhas intermediárias preservadas: o primeiro roteiro de cartão recusado esperava uma frase diferente da exibida pelo Stripe; a asserção foi corrigida e o fluxo completo passou. O ensaio de anexos recusou inicialmente as duas identidades mantidas do backup; passou após verificar a identidade exata no manifesto do restore, preservando contas, dados e acessos. Não foi removida a recusa de participantes reais. Nenhum administrador foi concedido no ensaio de anexos.

Evidências: `.test-build/staging-stripe-webhook-report.json`, `staging-stripe-renewals-report.json`, `staging-processors-report.json`, `staging-uploads-report.json`, `stripe-e2e/` e `migration-ledger/`. Resumo privado em `.test-build/phase-13-private-reports/STRIPE_AND_PROCESSORS_2026_10_16.md`.

**Ainda aberto:** entrega/retry no destino HTTPS hospedado do candidato, reconciliação do histórico compartilhado, monitor independente/agendamento/aviso fora da aplicação, CI do candidato final, orçamento/SLO e documentos/oferta finais. Os ensaios limitados não garantem capacidade simultânea de produção. Reembolsos, compras nas lojas e cobrança live exigem validação própria antes da abertura paga. O código novo não foi publicado; nenhuma oferta, mercado, preço ou franquia foi ativada. Fase 14 não iniciada.

## Publicação específica do FREE — 16/10/2026

O titular autorizou a publicação da nova experiência FREE, mantendo os planos desativados. A versão foi publicada a partir do baseline de produção, com somente esse fluxo e patches de segurança. O restante da Fase 13 e a migração de franquias continuam separados. [CI do pacote publicado](https://github.com/seedai-creator/seed-ai/actions/runs/38948375813): lint, tipos, 453 testes, scanner, auditoria de produção e build aprovados. Onze casos de navegador locais e seis verificações com Auth/banco de staging reais passaram. Vinte e duas verificações públicas confirmaram a landing acessível, o bloqueio do aplicativo e as rotas operacionais protegidas. Nenhuma oferta, preço, franquia ou assinatura foi ativada.

A continuidade técnica acrescentou o ensaio `node scripts/test-staging.mjs --run --workers`: dez grupos de integração aprovados, incluindo oito verificações de coordenação Growth Map/Radar com quatro concorrentes e 56 tentativas de aquisição. Um trabalho teve um único dono, dados iguais reutilizaram o snapshot, leases vencidos foram retomados, escritores antigos recusados e dados permaneceram isolados. Fixtures removidas; controles preservados. Não houve IA paga. O ensaio não comprova o processamento integral do agendador/provedores nem capacidade de produção.

Continuam pendentes o Checkout completo com webhook assinado pela rede, os demais processadores/anexos, histórico de migrações, ativação do monitor independente e critérios finais operacionais/documentais. Não iniciar Fase 14. Evidências detalhadas e falhas intermediárias ficam no relatório privado `FREE_RELEASE_2026_10_16.md`, fora do GitHub público.

## Atualização técnica de 16/10/2026

O titular pediu continuidade técnica e deixou a consolidação dos documentos para depois. Nenhuma minuta foi alterada, aprovada ou publicada por inferência. A abertura continua sendo comercial; estes ensaios são internos e não iniciam a Fase 14.

- **Filas:** a migração `20261016100618_operational_queue_coverage.sql` foi aplicada somente no staging. Journal, Modelo Vivo, Radar, pesquisa externa e Growth Map agora alimentam os alertas e o indicador de saúde com contagens agregadas. Processamento futuro, espera para nova tentativa e itens resolvidos não entram como atraso. Recibos antigos conservam o mesmo texto no reenvio. Consultas incompletas falham de forma fechada; cliente autenticado/anônimo não pode acessar a RPC global.
- **Validação real das filas:** cinco famílias, limites de tempo, execução, reagendamento e resolução passaram no PostgreSQL hospedado. Um segundo ensaio inseriu **4.001 itens fictícios** e validou **20 leituras, cada uma abaixo de 1 segundo**. Ambas as transações foram revertidas; contas e convites remanescentes: zero. Isso testa a consulta agregada, não o processamento dos workers, provedores ou capacidade de usuários simultâneos.
- **Catálogo:** 38 migrações locais, 73 tabelas e 96 funções comparadas com o staging, sem divergências. Objetos da landing preservados. Os advisors continuam com 13 avisos informativos de tabelas internas fechadas e 19 avisos de funções privilegiadas já existentes; o novo endpoint SQL é invoker e exclusivo do servidor. A verificação de catálogo não repara o histórico de migrações.
- **Performance ainda aberta:** advisor do staging lista 118 referências sem índice de apoio, 40 avisos de avaliação de Auth/RLS por linha, seis combinações de políticas permissivas, 16 índices ainda sem uso observado e um aviso de configuração de conexões Auth. Não foram removidos índices nem alteradas políticas para silenciar o relatório. A carga pequena aprovada não elimina esses riscos; priorizar planos de execução dos fluxos efetivamente usados antes de aumentar a coorte. Orientações: [Auth/RLS](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan) e [índices de referências](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).
- **Stripe pela rede, em teste:** dez grupos de integração passaram com duas contas Auth fictícias e Supabase real. Checkout criado e expirado sem conceder plano; pagamento fictício confirmado pela API; aplicação idempotente da assinatura, acesso isolado, cancelamento agendado/efetivo e memória preservada. Clientes removidos, sessões abertas expiradas, assinaturas canceladas e produto/preço arquivados. Sem dinheiro real, envio de e-mails ou mudança da oferta. O Stripe conserva histórico de faturas/eventos fictícios. Nenhum metadado de roteamento da aplicação publicada foi enviado: a associação com o usuário de staging ocorreu localmente, usando identificadores sintéticos de evento. **Não comprova Checkout concluído no navegador nem entrega de webhook assinado pela rede.**
- **Qualidade:** 510 testes locais, lint, typecheck e build isolado aprovados. Carga adicional das filas reexecutada após sua inclusão. CI precisa corresponder ao commit final; o resultado anterior não valida código novo. A consulta real de saúde continua corretamente degradada pela ausência de cron no staging, sem fabricar recibos de sucesso.

As falhas iniciais dos roteiros foram preservadas: conta de fila sem convite foi recusada e preço fictício sem fim de validade colidiu com a proteção do catálogo. Os roteiros foram corrigidos; permissões e catálogo reais foram preservados. Evidências privadas em `.test-build/phase-13-private-reports/QUEUE_COVERAGE_2026_10_16.json`, `QUEUE_LOAD_2026_10_16.json`, `STRIPE_NETWORK_2026_10_16.json` e logs de verificação; nenhum segredo versionado.

**Pendências técnicas de liberação:** comprovar entrega de webhook assinado e fechamento do Checkout no ambiente candidato; completar carga/recuperação dos workers e uploads; reconciliar o histórico das instalações manuais; ativar e ensaiar monitor/aviso independente após aprovação da publicação. Orçamento operacional e metas da coorte precisam de aceite; os limites atuais não foram elevados. Produção, bloqueio público e landing não foram alterados. Os documentos finais ficam em uma frente separada, conforme solicitado.

## Histórico de 15/10/2026

Esta atualização prevalece sobre as observações históricas de 10/10 abaixo. Evidências operacionais detalhadas ficam em relatórios privados ignorados pelo Git.

### Complemento — fechamento técnico em 15/10

Este complemento também substitui as pendências antigas de cadastro nas lojas, caixa empresarial e proteção de senhas. O estado permanece **NOT READY FOR CLOSED BETA**; os itens abaixo não representam deploy nem aceite jurídico.

- **Conciliação de assinatura em staging:** Auth/PostgREST/RLS reais, dez grupos aprovados, incluindo eventos repetidos e simultâneos, preço divergente, tentativa entre contas, falha/recuperação de pagamento, evento atrasado, cancelamento e preservação de memória após downgrade. Eventos do provedor são sintéticos: Checkout, entrega pela rede Stripe, reembolso e compras móveis não estão comprovados por este ensaio. Todas as fixtures foram removidas; controles/orçamentos preservados.
- **Senhas:** proteção contra senhas vazadas habilitada somente no staging. Uma conta fictícia confirmou a rejeição real de senha comprometida; outros nove grupos de Auth/RLS passaram e a limpeza foi confirmada. O aviso correspondente deixou de aparecer no advisor. Restam 13 avisos informativos de tabelas internas fechadas e 19 de funções privilegiadas, cuja autorização continua testada. Produção não foi alterada.
- **Schema:** comparação somente de catálogo, sem ler conteúdo empresarial, confirmou as 73 tabelas e 95 funções esperadas das 37 migrações no staging. Oito tabelas e nove funções adicionais da landing foram preservadas. Produção foi comparada ao baseline anterior à Fase 13: 65 tabelas/81 funções; diferenças de hash em 11 corpos foram revisadas como formatação/comentários, sem diferenças de tokens. O comparador estrito conserva essas diferenças no relatório. O histórico de migrações permanece incompleto por instalações manuais; não reaplicar bootstrap nem executar `db push` até reconciliar o histórico separadamente.
- **Monitor externo preparado:** endpoint autenticado de leitura com token próprio, timeout, resposta mínima e não armazenável; verifica banco, recibo recente de conclusão do cron e fila de entrega dos alertas. O verificador externo recusa destinos arbitrários, redirecionamentos, HTML e respostas incompletas. Consultas reais no staging passaram; acesso anônimo foi recusado. A ausência de cron no staging protegido foi corretamente classificada como degradada. Workflow apenas manual, ainda sem token, agendamento ou notificação externa de falha comprovada. Ativação depende da liberação revisada e de exceção exata no firewall; não abrir `/api/internal/*`.
- **Suporte:** `suporte@appseedai.com` passou anteriormente no teste de envio e resposta pelo Zoho e agora aparece no candidato local em login, acesso e suporte. O Gmail continua como contato de privacidade e destinatário de alertas já escolhido pelo titular. A caixa não cria atendimento automatizado nem SLA.
- **Lojas:** D-U-N-S informado e cadastros organizacionais iniciados; Google Play pago, documentação enviada para análise e site vinculado; Apple aguardando análise. Não há pacote móvel, compras de loja ou submissão de aplicativo nesta fase. Não repetir o pedido para criar as contas nem confundir análise de cadastro com aprovação de app.

Evidências privadas: `COMMERCIAL_RECONCILIATION_2026_10_15.json`, `PASSWORD_POLICY_2026_10_15.json`, `HEALTH_READ_ONLY_2026_10_15.json` em `.test-build/phase-13-private-reports/`; catálogos e revisão de corpos em `.test-build/schema-audit/`. O primeiro teste comercial falhou porque o roteiro usou uma RPC exclusiva do servidor como cliente; o roteiro foi corrigido, a recusa foi mantida como asserção de segurança e a tentativa anterior foi preservada. Não houve relaxamento de autorização.

Validação do candidato: **504 testes locais aprovados**, lint, typecheck e build isolado aprovados; scanner de 454 arquivos sem achados, auditoria de dependências de produção sem vulnerabilidades reportadas. HTTP na aplicação compilada confirmou 401 sem token/com token inválido e contato de suporte na tela de login. O resultado do CI deve corresponder ao commit efetivamente enviado; o CI anterior não valida alterações posteriores.

**Bloqueadores de liberação ainda abertos:** documentos finais/retenções e oferta aprovados; integração real dos provedores e carga representativa dos demais fluxos; cobertura operacional das demais filas e infraestrutura; ativação e teste do monitor independente; orçamento/SLO da coorte acordados; reconciliação do histórico e liberação aprovada do candidato. A landing e o bloqueio público passaram novamente nas 22 verificações. Nenhuma chamada paga ou envio adicional de e-mail ocorreu neste complemento.

| Frente | Estado confirmado | O que falta |
| --- | --- | --- |
| Código e CI | Repositório remoto, PR de rascunho, CI do baseline e proteção de `main` confirmados | Atualizar as verificações das alterações finais antes do aceite; não publicar automaticamente |
| Staging | Banco separado e Preview Vercel protegido; testes reais de Auth/RLS, navegador, MFA e exportação aprovados; carga limitada de banco e Cockpit, troca/reversão do alias e sessão aprovadas | Integrações de provedores e carga dos demais fluxos |
| Acesso e e-mail | Domínio, SMTP e recuperação publicados; titular confirmou recuperação e login | Preservar a evidência e os procedimentos de suporte |
| Banco e backups | Pro ativo; restore real validado com 21 conjuntos, catálogo/permissões e Auth/RLS; cópia temporária excluída com autorização e evidências preservadas; origem e produção saudáveis | Recuperação de objetos Storage e cutover de produção não fizeram parte deste ensaio |
| Credenciais | Nova chave OpenAI validada localmente e ativada em Production; titular confirmou a exclusão da chave antiga em 14/10. Nenhum secret impresso | Revogação registrada por confirmação do titular; não foi consultada independentemente no provedor |
| Privacidade e Termos | Inventário de dependências restrito ao servidor; ensaio Auth real detecta impedimentos financeiros, revoga sessões e preserva dados da empresa compartilhada; fixtures removidas; minutas de Política de Privacidade e Termos preparadas com identificação e endereço informados da Seed Tecnologias LTDA | Revisão jurídica/operacional das minutas, retenção e tratamento de conteúdo/financeiro/provedores em solicitações reais; oferta e documentos finais aprovados |
| Operação | Alerta fictício entregue; pausa, circuito, fila P1 e recuperação aprovados; cenários de custo gerados; reversão de versão no endereço de staging ensaiada | Ativação aprovada em produção; cobertura externa de banco/backups/cron; liberação/rollback nativo de produção e conciliação de provedores |
| Liberação | Código completo da Fase 13 não publicado; versão anterior republicada somente para ativar a chave. Aplicativo bloqueado, landing preservada; 22 verificações HTTP aprovadas | Aceite e autorização específica após os requisitos; não iniciar Fase 14 |

O verificador da referência do backup não é um teste de restauração. A restauração efetiva foi validada separadamente em 14/10: duas identidades autenticadas, isolamento de dez tabelas nas duas direções, leitura anônima recusada, alterações entre empresas recusadas e sessões encerradas. Os verificadores das senhas foram preservados; o teste HTTP usou tokens únicos sem e-mail. Sem inferência paga ou cobrança real. A cópia temporária foi excluída após autorização; a referência no staging e as evidências permanecem preservadas.

Tempo observado até validação das APIs: **9min34s**. Idade do backup no início: **12h33min39s**. Nenhuma perda observada na referência; isso não garante RPO zero, capacidade ou SLA. Inventário de Storage vazio. Detalhes, identificadores e evidências ficam em `.test-build/phase-13-private-reports/RESTORE_AND_KEY_RELEASE_2026_10_14.md` e `.test-build/backup-drill/`, privados e ignorados pelo Git.

**Próximo trabalho técnico:** integrações e carga dos demais fluxos; cobertura externa de monitoramento; reconciliação de migrações e CI final. **Decisões do titular:** documentos/retenções aprovados, dimensionamento do orçamento para a coorte e aceite da liberação. Em 15/10 foram preparadas as minutas de [Privacidade](legal/POLITICA_DE_PRIVACIDADE_PT_BR.md) e [Termos de Uso](legal/TERMOS_DE_USO_PT_BR.md), com nome, CNPJ e endereço fornecidos pelo titular. As revisões de [Privacidade](legal/REVISAO_PRIVACIDADE.md) e [Termos](legal/REVISAO_TERMOS_DE_USO.md) registram critérios de retenção, contratos/transferências, IA, oferta e o aviso separado da landing page. Nenhum documento foi aprovado ou publicado. Responsável e destinatário dos alertas já foram confirmados; não solicitar novamente. Esses itens permanecem abertos; a aprovação dos testes acima não encerra a fase.

**Meta informada em 15/10:** abrir o aplicativo ao público em **04/11/2026**, com disponibilidade pretendida na App Store e no Google Play. O beta deve ocorrer privadamente antes dessa abertura. Os cadastros organizacionais estão em análise; o repositório atual é web e a cobrança permanece Stripe em teste. Distribuição móvel, compras, exclusão e revisão dos aplicativos são dependências adicionais documentadas nos Termos. A data não é promessa de aprovação, autorização de deploy ou substituição dos critérios da Fase 13. Nenhuma versão móvel ou funcionalidade da Fase 14 foi iniciada nesta entrega.

Verificação da entrega de alertas de 14/10: **484 testes aprovados**, lint, typecheck, build isolado e varredura de credenciais aprovados. Testes reais da fila e das restrições de acesso passaram no staging; Resend confirmou a entrega do único alerta fictício autorizado. Evidência privada: `.test-build/phase-13-private-reports/OPERATIONAL_ALERTS_2026_10_14.json`.

Em 15/10, a carga encontrou um defeito real: conflitos de versão declarados com SQLSTATE `40001` provocavam repetição de transações no PostgREST hospedado e timeout. A migração `20261015165036_domain_conflict_status.sql` troca somente esse retorno por `PT409` em 19 funções, preservando corpos restantes, permissões e autorização. O ensaio remoto passou após a correção: uma gravação aceita, outra recusada com HTTP 409, versão final correta. Evidências das tentativas com falha foram preservadas; não houve sobrescrita de dados ou alteração em produção.

O ensaio limitado usou duas contas fictícias, 1.000 mensagens, 200 eventos e 96 leituras, até quatro simultâneas. P95 por grupo entre 456 e 728 ms, incluindo rede local até o staging. Não é SLA, benchmark de produção nem validação dos workers/páginas. Contas e dados do ensaio removidos; referência anterior do backup preservada.

A simulação usa políticas reais lidas em 15/10 e hipóteses explícitas de utilização; distingue FREE vitalício de PRO por ciclo. O teto diário global pode limitar uma coorte antes das cotas individuais. O histórico inclui testes de engenharia e dois registros de custo desconhecido; não foi tratado como consumo típico nem como fatura. Nenhuma chamada paga, aumento de orçamento, envio adicional de e-mail ou publicação ocorreu nesta etapa.

Evidências privadas: `.test-build/privacy-drill/`, `.test-build/staging-load-report.json`, `COST_COHORTS.json` e `INCIDENT_DRILL_2026_10_15.json` em `.test-build/phase-13-private-reports/`. O incidente foi transacional, com rollback; não substitui ensaio externo de indisponibilidade ou rollback de deployment.

Verificação final desta etapa de 15/10: **494 testes aprovados**, lint, typecheck e build isolado aprovados; scanner de 434 arquivos sem achados de credenciais. Os avisos existentes do Supabase permanecem documentados, incluindo proteção de senhas vazadas ainda desativada no staging. O resultado técnico desta etapa não altera o estado **NOT READY FOR CLOSED BETA** da fase completa.

Avisos de segurança observados no staging, sem aumento após as migrações: 13 tabelas internas com [RLS sem política de cliente](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), 19 funções autenticadas que exigem [revisão das autorizações SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) e [proteção contra senhas vazadas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) desativada. Não abrir tabelas internas nem revogar funções de negócio indiscriminadamente para silenciar os avisos; revisar a configuração de senha antes do beta.

### Staging hospedado — complemento de 15/10

Projeto Vercel separado, protegido em todos os endereços por autenticação Vercel. Duas versões Preview concluíram o build usando somente o Supabase de testes. Nenhuma chave OpenAI, Stripe ou Resend foi enviada; não há cron nesse pacote. A lista de arquivos permitidos exclui ambientes, evidências privadas, migrações e vínculos de produção. Dois testes novos verificam essas fronteiras; lint, typecheck e scanner passaram.

O ensaio de navegador validou login, aceite de documentos explicitamente fictícios, seleção da empresa, carregamento do conteúdo específico dos seis painéis e recusa de exportação entre empresas. Também fez 12 leituras do Cockpit, até três simultâneas. Contas e documentos fictícios removidos, controles inalterados e 20 conjuntos da referência de backup preservados. O acesso temporário de automação foi revogado; visitantes anônimos voltam ao login Vercel.

Reversão comprovada: endereço estável de Preview → versão candidata → versão anterior, com marcador de versão verificado e sessão preservada. As versões tinham o mesmo código e schema, distinguindo-se apenas por um marcador de ensaio. Isso testa o retorno do tráfego à versão anterior; não equivale a downgrade de schema, recuperação de dados ou execução do comando de rollback no projeto de produção.

O primeiro envio foi automaticamente classificado como Production pela Vercel e falhou por ausência das variáveis exclusivas de Preview. A tentativa foi preservada; nenhuma proteção foi relaxada para fazê-la executar. Os dois envios seguintes foram Preview e passaram. A revisão visual também levou a reforçar o teste para esperar o título de cada painel após a hidratação, em vez de aceitar somente HTTP 200 e a estrutura inicial da página.

Produção preservada: mesmo deployment, aplicativo redirecionando à landing, operações públicas recusadas e landing respondendo 200. Evidências e identificadores ficam em `.test-build/hosted-staging/`, fora do repositório público. Nenhuma chamada paga ou mensagem adicional foi enviada.

## Histórico — inspeção inicial em 10/10/2026

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

## Histórico — bloqueadores externos e decisões da inspeção

| Item | Situação | Responsável / próximo passo |
| --- | --- | --- |
| Staging isolado | Projeto `dgqvcvebydjxxkuvrgkl` conectado, schema instalado pelo titular e nove verificações de integração aprovadas | Configurar aplicação e provedores de testes; validar navegador, e-mail, integrações e recuperação |
| Versionamento remoto | `origin` vinculado a `seedai-creator/seed-ai`; titular autorizou expressamente o envio público em 10/10/2026 | Enviar histórico local revisado e confirmar execução do CI; proteção de branch ainda pendente |
| Backups e plano de banco | Pro ativo e backups diários físicos disponíveis; retenção de sete dias conforme plano | Confirmar uma cópia posterior às fixtures e executar restauração |
| Restore em staging | Referência preparada; restauração ainda não executada | Realizar em destino isolado revisado, medir tempo, conferir dados e permissões |
| Credenciais já expostas anteriormente | Rotação não comprovada | Rotacionar no provider e substituir no ambiente; não basta remover uma mensagem ou arquivo |
| Termos e privacidade | Revisão final não confirmada | Titular e profissional responsável aprovam documentos, versões e contato |
| E-mail transacional | SMTP, entrega e recuperação confirmados pelo titular | Manter procedimento de suporte e evidências privadas |
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

## Histórico — matriz inicial dos 64 critérios

Esta matriz registra a inspeção inicial. Para o estado atual, prevalece a atualização de 14/10 acima e o relatório privado de evidências. Itens aqui marcados como ausência de domínio, SMTP, MFA, exportação, CI ou restauração já foram superados; não devem ser apresentados novamente como trabalho pendente.

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
- **Privacidade/isolation:** Auth/PostgREST e exportação já validados em staging; ensaio de exclusão e rotação continuam pendentes antes da liberação de dados reais.
- **Segurança:** patches de runtime aplicados e scanner local; alertas de ferramentas de desenvolvimento continuam registrados, sem downgrade incompatível para ocultá-los.
- **Legal/retenção:** fluxo permite registrar aceite, mas não aprova termos nem implementa prazos legais automaticamente. Nenhuma alegação de conformidade concluída.
- **Operação:** CI do baseline já executou no GitHub; restauração efetiva, alertas e ensaio operacional continuam pendentes. Publicar agora deixaria controles importantes sem comprovação.

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
