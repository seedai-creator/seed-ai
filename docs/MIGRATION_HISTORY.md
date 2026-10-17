# Histórico compartilhado do banco

O aplicativo e a landing utilizam o mesmo banco. Desde 16/10/2026, `supabase/migrations` deste repositório é a fonte canônica para esse banco. Não executar publicações independentes de schema pelo projeto institucional.

Quatro migrações históricas da landing foram importadas sem alterar o SQL. `supabase/shared-migrations.json` registra origem e SHA256 com finais de linha LF, permitindo checkouts Windows/Linux. Os originais permanecem no projeto institucional. Mudanças futuras exigem novas migrações; não editar arquivos históricos.

## Reconciliação executada

Atualização de 17/10/2026: o titular instalou o pacote atômico de staging com `20261017190223_versioned_pro_offers.sql` e `20261017190428_access_retention.sql`. As versões canônicas foram registradas junto ao SQL na mesma transação e verificadas por leitura: **45 migrações no staging; 43 em produção**. Dois erros `Invalid or expired requestState` do conector precederam a execução manual; foi conferida ausência de alteração parcial. Não reaplicar o bundle. [Validação e estado inativo](PHASE_13_RETENTION_OFFERS.md). Os números das seções seguintes são históricos.

| Ambiente | Histórico reconhecido | Reparo | Catálogo preservado |
| --- | --- | --- | --- |
| Staging | 42 migrações | Oito identificadores alinhados; 34 instalações manuais registradas | 81 tabelas, 105 funções |
| Produção | 35 migrações | Quatro identificadores alinhados; 31 instalações manuais registradas | 73 tabelas, 90 funções |

Somente `supabase_migrations.schema_migrations` foi alterada. Não houve reaplicação de SQL, mudança de RLS, expurgo ou ativação de planos. Entradas antigas conservaram comandos/autoria; instalações manuais foram registradas sem inventar comandos históricos.

Staging corresponde exatamente às fontes. Em produção, 11 corpos de função têm diferenças antigas de espaços/comentários. Os mesmos pares de hashes já revisados por tokens foram reconferidos, preservando valores entre aspas. O relatório estrito conserva essas diferenças; não se afirma igualdade byte a byte nem equivalência genérica de SQL.

As transações verificaram o histórico completo anterior e a impressão digital do catálogo. Cópias anteriores, fontes, comparação, reparo e inversão estão em `.test-build/migration-ledger/`, fora do Git público. Testes locais comprovaram atomicidade, rollback, preservação de dados e recusa de repetição/schema/histórico divergentes. As impressões digitais dos catálogos hospedados ficaram idênticas após os reparos.

## Validação posterior no staging

Após o reparo de histórico, `20261016133617_allowance_guards.sql` foi aplicada **somente no staging**. O identificador gerado pelo provedor foi alinhado ao arquivo local depois de comparar integralmente o SQL, sem reaplicá-lo. São agora 43 migrações, 81 tabelas e 106 funções, com comparação estrita sem diferenças. Dez grupos de integração comercial/RLS passaram; fixtures removidas. Planos, preços, mercados e controles ficaram idênticos antes/depois; limite global vigente continua US$ 10, sem ativar as franquias candidatas. A nova função de orçamento não é executável por `anon` ou `authenticated`.

O advisor de segurança mantém 13 avisos informativos de tabelas fechadas por RLS sem políticas de cliente e 19 avisos sobre RPCs `SECURITY DEFINER` acessíveis a usuários autenticados. Esses contratos já fazem parte das fontes/testes de autorização; não são 19 novas concessões dessa migração. Não retirar as verificações de identidade nem abrir políticas para silenciar o advisor. [Explicação do aviso de RPC](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## Publicação autorizada — 16/10/2026

As oito migrações operacionais foram aplicadas em produção após autorização explícita, conferência do backup físico de 16/10/2026 às 09:05:10 UTC e comparação do catálogo anterior. Cada instalação foi conferida; os identificadores gerados foram alinhados às versões locais numa transação de metadados com guardas e comparação integral dos comandos. Não houve reaplicação do SQL. Ambos os ambientes têm agora **43 migrações, 81 tabelas e 106 funções**. Nenhuma migração local pendente nesta conferência.

Produção instalou a migração de controles depois das tabelas da landing já existentes. Por isso, seu laço cria oito políticas restritivas adicionais nessas tabelas, ausentes numa instalação em ordem cronológica. A ordem real foi reproduzida em banco local: o catálogo corresponde a essa instalação, conservando apenas três pares de hashes históricos de corpos já revisados. As oito tabelas continuam sem privilégios de cliente ou políticas permissivas; o acesso de servidor da landing permanece intacto. Não se afirma igualdade estrita entre ambientes nem se removem políticas para ocultar essa diferença.

Planos, preços e mercados foram comparados integralmente com a cópia anterior, sem alterações. Novas assinaturas continuam bloqueadas e ofertas/franquias candidatas não foram ativadas. O controle `closed_beta` foi habilitado em produção, conforme o fechamento público autorizado, sem publicar convites ou documentos legais. Evidências privadas em `.test-build/releases/operations-2026-10-16/`.

O advisor de produção mantém cinco avisos informativos de tabelas internas sem políticas de cliente e 19 avisos dos contratos RPC autenticados conhecidos. A proteção contra senhas vazadas foi habilitada no Auth e seu aviso deixou de aparecer. [Proteção de senhas do Supabase](https://supabase.com/docs/guides/auth/password-security). Outros requisitos de senha não foram alterados.

## Procedimento futuro

Conferir projeto e histórico; criar novas migrações pela CLI; validar primeiro no staging com os testes de RLS/integração afetados. Usar uma lista explícita das migrações autorizadas. Não reaplicar bootstrap em banco instalado. Algumas migrações pendentes de produção antecedem as da landing: não executar `db push --include-all` sem revisar tudo que será incluído.

`scripts/migration-history.mjs` apenas prepara SQL revisável, exige uma lista explícita das fontes instaladas e recusa conteúdo remoto diferente. Não abre conexão nem repara automaticamente. O comparador de schema, isoladamente, não constitui autorização para reparar histórico.

A [documentação do Supabase](https://supabase.com/docs/guides/deployment/database-migrations) distingue histórico e schema. Nesta operação, uma transação autenticada de metadados realizou o reparo com pré-condições e inversão preparada. Não foi executado `db push` remoto.
