# SeedAI — retenção mínima de acessos e restauração

17/10/2026. Implementado no candidato e instalado no staging. Coleta permanece desativada; produção não recebeu a migração nem este código. Não é confirmação de cumprimento integral da obrigação legal em produção.

## Dados e limites

`application_access_logs` conserva apenas identificador aleatório, horário do servidor, endereço IP, vencimento e referência/prazo de eventual preservação. Não armazena conta, empresa, conversa, URL, query string, cookie, token ou navegador. Seis meses são calculados como meses de calendário em UTC, sem substituir por 180 dias. Campos de evidência são imutáveis. Uma preservação exige referência ao caso privado e data de revisão.

Não há acesso público, autenticado ou leitura direta pela chave de serviço. Somente funções restritas permitem gravar e expurgar lotes; leitura excepcional/preservação exigem operação privilegiada no banco, com justificativa e registro externo. Não foi criada uma tela para consultar IPs.

O servidor aceita apenas o endereço do cabeçalho confiável `x-vercel-forwarded-for`, com execução Vercel confirmada. Cabeçalhos locais/alternativos, listas e redes CIDR são recusados. [Comportamento documentado do proxy Vercel](https://vercel.com/docs/headers/request-headers). Um proxy anterior ainda pode fazer esse endereço representar o proxy, não a pessoa final; conferir a arquitetura antes de habilitar.

Landing `/seedai`, arquivos estáticos, rotas internas e webhook de cobrança são excluídos. Requisições diretas ao Supabase/Auth, bloqueadas antes da aplicação ou servidas por outros projetos não passam por este registro. A cobertura desses fluxos precisa ser inventariada; esta implementação não comprova todos os acessos possíveis.

## Liberação controlada

1. Aplicar `20261017190428_access_retention.sql` antes do código; verificar permissões e uma fixture IPv4/IPv6 em preview Vercel restrito, sem público. Não usar cabeçalho forjado como prova de origem em produção.
2. Conferir origem do IP, data/expiração, falha de banco, consulta negada aos clientes e impacto de latência. Não imprimir IPs ou chaves em logs/CI.
3. Ativar `SEED_ACCESS_RETENTION_ENABLED=true` somente no ambiente validado e após autorização de publicação. O padrão é `false`. Com coleta habilitada e gravação indisponível, o acesso ao aplicativo recebe 503; a landing e o webhook permanecem fora desse caminho.
4. O cron protegido existente chama `prune_application_access(false,1000)` antes de verificar as filas opcionais. O padrão da função chamada manualmente é simulação. Rodar simulação antes de qualquer intervenção; conferir contagens e registros preservados. Não apagar outras categorias por esse prazo.
5. Acompanhar backlog/execução. O lote é limitado a mil registros por chamada e serializado; 1.000 por minuto é teto teórico, não garantia de vazão. Falha/atraso mantém dados até recuperação. Definir alerta específico de backlog antes de ampliar volume.

Há uma gravação adicional no banco por requisição abrangida, com timeout de cinco segundos. Isso aumenta latência, armazenamento e custo; ainda falta medir tráfego real/abuso e o caminho Vercel. O desenho de falha fechada protege a coleta, mas pode reduzir disponibilidade. Não desativar silenciosamente a retenção para contornar uma falha; registrar incidente e decisão do responsável.

## Exclusão e backup

O registro de supressões deve ficar fora do banco restaurado e com acesso restrito. Ele identifica escopo, autorização, categoria, objeto, fundamento de eventual conservação, horário, execução e verificação. Não precisa duplicar o conteúdo a eliminar.

1. Restaurar em ambiente isolado, sem público, IA, e-mail, cobrança ou workers.
2. Recuperar o registro mais recente de revogações/supressões, posterior ao ponto do backup; validar ambiente, identidade e propriedade antes de cada ação.
3. Reaplicar revogações e exclusões mínimas. Inventariar também JSON, memória, anexos, derivados, fornecedores e caixas de e-mail; preservar dados de outros membros e obrigações documentadas.
4. Reexecutar o expurgo dos acessos vencidos, respeitando preservações. Verificar com token antigo e consultas cruzadas; só então avaliar reabertura.

O ensaio real de staging em 17/10 reintroduziu uma conversa fictícia de snapshot lógico anterior à exclusão e reaplicou o registro externo, mantendo a conta revogada e o conteúdo de outro membro. Seis grupos passaram e a limpeza foi confirmada. O teste local também restaurou registro de acesso vencido e confirmou novo expurgo sem remover o atual/preservado. Isso complementa o restore físico de 14/10; não foi um segundo restore físico nem prova de exclusão de todas as categorias ou fornecedores.

Ferramentas: `scripts/test-staging-privacy.mjs --run`, `tests/access-retention.test.ts`, `tests/offers-retention-database.test.mjs`. Evidências privadas em `.test-build/privacy-drill/`. Nunca usar fixtures ou o relatório como autorização para excluir dados reais. Inventário complementar: [controles](legal/CONTROLES_DE_PRIVACIDADE.md), [fornecedores](legal/FORNECEDORES_E_CONTRATOS.md).
