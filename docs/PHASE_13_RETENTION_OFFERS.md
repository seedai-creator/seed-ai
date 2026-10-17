# SeedAI — retenção, fornecedores e ofertas preparadas

17/10/2026. Complemento ao fechamento operacional; substitui as pendências equivalentes da conferência anterior do mesmo dia. Não houve deploy nem escrita em produção, cobrança, chamada OpenAI ou envio de e-mail nesta rodada. Um preview privado temporário de staging foi testado e removido. Fase 14 não iniciada.

## Entrega

- Duas migrações instaladas pelo titular no staging e verificadas: `20261017190223_versioned_pro_offers` e `20261017190428_access_retention`. Histórico preserva as versões originais: 45 migrações no staging; produção continua no catálogo anterior de 43.
- Três contratos versionados associam preço, assinatura e permissões no servidor. PRO 1: R$ 99,99/US$ 4; PRO 3: R$ 199,99/US$ 8; PRO 5: R$ 399,99/US$ 16. Franquia compartilhada por conta/ciclo. Preços/limites legados preservados.
- Três produtos e preços Stripe de teste criados e conferidos como inativos; seus vínculos estão preparados no staging com `status=INACTIVE`, e todas as ofertas com `available=false`. Nenhuma sessão de compra, cliente ou assinatura criada pela preparação. Dados de teste não são configuração live.
- Retenção de IP/horário por seis meses de calendário, sem conteúdo ou identificação de conta, com acesso restrito, preservação e expurgo limitado. Código e schema prontos; coleta desativada. [Cobertura, liberação e limites](ACCESS_RETENTION.md).
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

1. **Publicação/retenção:** o caminho privado Vercel foi ensaiado; falta aplicar/publicar o candidato com autorização e habilitar a coleta no ambiente liberado. Cobertura fora da aplicação, primeira falha transitória sem causa comprovada, impacto de volume e backlog continuam limitações registradas. Não há dimensionamento para milhares de usuários.
2. **Documentos/fornecedores:** vincular contratos/DPA às contas da empresa, conferir as configurações restantes e instrumento de transferência aplicável; publicar a versão vigente e a correção do responsável na landing. O registro informa exatamente as provas faltantes, sem pedir novamente a revisão profissional inicial.
3. **Antes de cobrança real:** Checkout hospedado das ofertas, live, transições entre planos, reembolso e canais móveis efetivamente ofertados precisam de validação própria. Troca de preço de uma assinatura é recusada até implementação específica. Preparação inativa não é ativação.

O estado da Fase 13 permanece **NOT READY FOR CLOSED BETA**, classificação da especificação, sem autorização de lançamento comercial. Isso não altera a intenção do titular de lançar um produto pago. Os itens técnicos concluídos acima não devem ser reabertos por falta de um período artificial de observação, nem confundidos com os controles ainda pendentes.
