# SeedAI — retenção, fornecedores e ofertas preparadas

17/10/2026. Complemento ao fechamento operacional. Após autorização explícita do titular, as duas migrações e o candidato técnico foram publicados, com retenção mínima habilitada. Aplicativo fechado, cobranças desativadas e landing preservados. Sem nova chamada OpenAI ou e-mail de teste. Documentos jurídicos não foram publicados. Fase 14 não iniciada.

## Entrega

- Duas migrações instaladas e verificadas em staging e produção: `20261017190223_versioned_pro_offers` e `20261017190428_access_retention`. Ambos os históricos têm 45 migrações e preservam as versões das fontes.
- Três contratos versionados associam preço, assinatura e permissões no servidor. PRO 1: R$ 99,99/US$ 4; PRO 3: R$ 199,99/US$ 8; PRO 5: R$ 399,99/US$ 16. Franquia compartilhada por conta/ciclo. Preços/limites legados preservados.
- Três produtos e preços Stripe de teste criados e conferidos como inativos; seus vínculos estão preparados no staging com `status=INACTIVE`, e todas as ofertas com `available=false`. Nenhuma sessão de compra, cliente ou assinatura criada pela preparação. Dados de teste não são configuração live.
- Retenção de IP/horário por seis meses de calendário, sem conteúdo ou identificação de conta, com acesso restrito, preservação e expurgo limitado. Código/schema publicados e flag de produção habilitada. O bloqueio público precede a aplicação; nenhuma coleta de usuário foi forçada para testar. [Cobertura, liberação e limites](ACCESS_RETENTION.md).
- Reaplicação de exclusão após restauração lógica ensaiada com conversa fictícia, registro externo ao banco, acesso revogado e conteúdo de outro membro preservado.
- [Registro dos fornecedores](legal/FORNECEDORES_E_CONTRATOS.md) com condições oficiais, configurações efetivamente verificadas e ações restantes. Política candidata 0.3 esclarece a retenção temporária de pesquisa OpenAI em segundo plano. Nenhum contrato foi aceito nem documento publicado por inferência.

## Verificações

| Verificação | Evidência e limite |
| --- | --- |
| Testes locais | 568 passaram, zero falhas/ignorados. Incluem banco migrado, RLS, três ofertas, saldo compartilhado, concorrência existente, duplicação/cancelamento e calendário/preservação/expurgo. |
| Lint, tipos, build | Passaram. Build isolado de staging, sem credenciais de IA ou billing no runtime. |
| Integração comercial | Dez grupos gerais e seis subgrupos comerciais passaram com Auth/PostgREST reais, incluindo cada oferta. Eventos do provedor são sintéticos neste ensaio; não substituem Checkout hospedado por oferta. |
| Configuração durante o ensaio | Fiscalização de limites temporariamente ligada apenas no staging e restaurada ao valor original. Ofertas, mercados, IA e cobranças não foram liberados. |
| Privacidade | Seis grupos passaram em staging real; limpeza confirmada. Snapshot lógico de uma conversa, não novo restore físico nem apagamento universal. |
| Navegador | Oito grupos passaram: login, telas, três preços exatos sem controles de compra, suporte/exportação, RLS, MFA, idiomas e revogação. Contas fictícias removidas. |
| Scanner | 519 arquivos conferidos, sem achados. Relatórios/segredos privados ficam fora do Git. |
| CI | Commit de aplicação `aa6a105` aprovado com lint, tipos, 568 testes, scanner, auditoria de dependências e build. [Execução](https://github.com/seedai-creator/seed-ai/actions/runs/39064789658). |
| Preview privado | Vercel de staging confirmou origem substituída, seis vencimentos corretos e saúde protegida; duas páginas finais 200 em 783/636 ms. Preview/bypass e seis registros de teste removidos. Primeira consulta não-200 sem código preservado; causa não comprovada, repetições passaram sem alterar código. Não é ensaio de carga ou certificação de disponibilidade. |
| Stripe | Três objetos de preço e seus produtos conferidos por API como test mode e inativos; valores exatos. Nenhum efeito financeiro. |
| Advisor staging | 15 avisos INFO de tabelas internas sem políticas de cliente e 19 WARN de funções autenticadas SECURITY DEFINER. Novas tabelas intencionalmente sem leitura de cliente; funções novas restritas ao serviço. Não abrir permissões para silenciar os avisos. [RLS](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [funções privilegiadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). |
| Produção, leitura | Landing e aviso respondem 200; raiz, login e billing redirecionam à landing; saúde sem token retorna 401. BR mantém novas assinaturas bloqueadas; demais mercados têm billing desligado. |

Falhas intermediárias não foram ocultadas: uma chamada do roteiro usava o parâmetro antigo `p_name` em vez de `company_name`; depois o staging revelou que a fiscalização comercial estava desativada. O roteiro foi corrigido para habilitar somente essa fiscalização durante o teste e restaurá-la na limpeza. Nova execução integral passou. Uma tentativa sem permissão de rede não chegou a criar fixtures. Não houve relaxamento dos limites para fazer o teste passar.

Evidências privadas: `.test-build/phase13-offers-all-tests.log`, `phase13-retention-*.log`, `phase13-versioned-offers-staging.log`, `staging-commercial-report.json`, `staging-browser-report.json`, `privacy-drill/report.json` e `stripe-inactive-offers.json`. Não versionar os relatórios nem o registro privado de supressões.

## O que ainda impede declarar fechamento integral

1. **Cobertura e operação da retenção:** publicação e habilitação concluídas. Cobertura fora da aplicação, primeira falha transitória do preview sem causa comprovada, impacto de volume e alerta específico de backlog continuam limitações registradas. Não há dimensionamento para milhares de usuários; validar a coleta no primeiro acesso autorizado antes de abrir o aplicativo.
2. **Documentos/fornecedores:** vincular contratos/DPA às contas da empresa, conferir as configurações restantes e instrumento de transferência aplicável; publicar a versão vigente e a correção do responsável na landing. O registro informa exatamente as provas faltantes, sem pedir novamente a revisão profissional inicial.
3. **Antes de cobrança real:** Checkout hospedado das ofertas, live, transições entre planos, reembolso e canais móveis efetivamente ofertados precisam de validação própria. Troca de preço de uma assinatura é recusada até implementação específica. Preparação inativa não é ativação.

O estado da Fase 13 permanece **NOT READY FOR CLOSED BETA**, classificação da especificação, sem autorização de lançamento comercial. Isso não altera a intenção do titular de lançar um produto pago. Os itens técnicos concluídos acima não devem ser reabertos por falta de um período artificial de observação, nem confundidos com os controles ainda pendentes.

## Publicação autorizada — 17/10, 20:23 UTC

- Candidato `246398a`, código funcional `aa6a105`; [CI aprovada](https://github.com/seedai-creator/seed-ai/actions/runs/39065567910). Build de produção aprovado, deployment `dpl_H7D3hbfSdb4KZLL512KjtULdmKdt`, promovido em `2026-10-17T20:23:14.648Z`. Manifesto de 253 arquivos permitidos; sem arquivos privados ou documentos jurídicos.
- Backup físico de `2026-10-17T09:08:14Z` conferido antes das migrações. Catálogo comparado com 83 tabelas/112 funções. Três diferenças históricas de formatação preservadas; na função de criação de empresa, a inversão da única substituição autorizada reproduziu exatamente o hash histórico revisado. Não foi ignorada diferença nova de lógica.
- O provedor registrou inicialmente timestamps de instalação; após conferir igualdade integral dos dois SQLs, somente esses identificadores foram alinhados às fontes. Planos legados, preços, assinaturas, mercados, controles e documentos mantiveram os mesmos valores/hashes. Zero oferta nova disponível; nenhum preço novo vinculado em produção.
- `SEED_ACCESS_RETENTION_ENABLED=true` adicionado, outras 27 variáveis preservadas. Firewall integralmente igual ao anterior. `/`, `/login` e `/billing`: 307 para a landing; landing e aviso: 200; saúde/cron sem token: 401; GET no webhook: 405. Saúde autenticada: banco, agendador, alertas e filas saudáveis.
- Recibo real do agendador após a promoção em `20:23:54.880627Z`; a rotina de retenção precede a conclusão desse handler. Nenhum recibo fictício ou acesso de usuário criado. Tabela de acessos vazia nas verificações públicas porque o firewall redireciona antes da aplicação; a gravação foi comprovada no preview privado, não nesta verificação pública.
- Advisor: sete avisos informativos de RLS sem políticas de cliente (as duas novas tabelas são internas) e os mesmos 19 avisos de funções autenticadas privilegiadas. Permissões conferidas, sem abertura para silenciar os avisos. [RLS](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) e [RPCs](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Evidências privadas em `.test-build/releases/retention-2026-10-17/`: backup, catálogos antes/depois, preservação, histórico instalado, manifesto, ambiente e verificação pública. Uma consulta inicial usou nome incorreto da tabela de mercados e não alterou dados; a primeira comparação de catálogo exigiu adaptar a verificação da transformação da função histórica. Ambas foram corrigidas e reexecutadas antes da promoção.

Retorno técnico disponível: deployment anterior `dpl_Be81VbTputSNzvdf7VcZZiFLEhv1`. Reverter aplicação não remove schema nem registros e não equivale a restore. A versão anterior não coleta acessos; qualquer retorno exige registrar a lacuna e manter o bloqueio público, sem apagar evidências nem desligar silenciosamente a retenção. Preferir correção direcionada; não executar rollback destrutivo de migração automaticamente.
