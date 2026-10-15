# SEED AI
Inteligência estratégica empresarial. Next.js 16 App Router, React, TypeScript,
Tailwind, OpenAI Responses API e Supabase Auth/PostgreSQL.

## Estado das fases
- Fase 1: implementada; teste real confirmado pelo proprietário na conversa.
- Fase 2: código de autenticação, empresas e RLS implementado. Projeto Supabase conectado e migração aplicada; RLS confirmada nas três tabelas. Cadastro e login reais confirmados pelo proprietário; acesso à empresa e persistência da sessão verificados no navegador.
- Fase 3: concluída. Memória confirmada, correção e uso em nova conversa validados com Supabase e OpenAI reais em 25/09/2026.
- Fase 4: concluída em 25/09/2026. Dez categorias integradas; 32 testes locais e 26/26 exemplos reais de classificação passaram.
- Fase 5: SEED Brain implementado e validado com memória + metodologia em testes reais.
- Fases 6–9.3: implementadas; histórico e evidências nos relatórios abaixo.
- Fase 9.4: Execution Loop implementado e validado com IA real, incluindo memória em nova conversa, revisão, aprendizado e novo plano. Consulte [o relatório](docs/PHASE_9_4_DELIVERY.md).
- Fase 9.5: Modelo Vivo publicado, migração aplicada, 195 testes aprovados e fluxo principal validado com IA real; correções e limites da validação documentados. Consulte [o relatório](docs/PHASE_9_5_DELIVERY.md).
- Fase 9.6: entregue, publicada e aceita pelo titular após confirmação das telas com login no site público. 233 testes aprovados e ciclo completo com IA real validado. Limitações de cobertura visual permanecem no [relatório](docs/PHASE_9_6_DELIVERY.md).
- Fase 9.7: Radar publicado; verificações e limitações no [relatório](docs/PHASE_9_7_DELIVERY.md).
- Fase 9.8: External Intelligence implementada; migração aplicada, 320 testes e pesquisa real validados. Publicada na Vercel em 08/10/2026; titular confirmou funcionamento antes de autorizar a Fase 10. Consulte o [relatório](docs/PHASE_9_8_DELIVERY.md).
- Fase 10: Goals & Metrics concluídos, publicados e aceitos pelo titular em 09/10/2026 (“TUDO CERTO”); duas migrações aplicadas, 353 testes e fluxo com OpenAI real aprovados. Consulte o [relatório da Fase 10](docs/PHASE_10_DELIVERY.md).
- Fase 11: Growth Map concluído, publicado e aceito visualmente pelo titular em 09/10/2026. Duas migrações aplicadas; build final, regras, isolamento e interpretação com OpenAI real aprovados (US$0,02731805). Onze verificações HTTP e treze arquivos estáticos aprovados no site público. Acesso temporário encerrado; teste visual sem consumo de IA. Cobertura e limitações no [relatório da Fase 11](docs/PHASE_11_DELIVERY.md).
- Fase 12: concluída e publicada em 10/10/2026, após aprovação visual local. Consulte [o relatório](docs/PHASE_12_DELIVERY.md).
- Fase 13: em implementação; staging hospedado e protegido, MFA, exportação, recuperação, backup restaurado e troca da chave OpenAI verificados. Em 15/10, exclusão fictícia com empresa compartilhada, carga limitada, correção de conflitos e reversão do endereço Preview também passaram. A liberação do beta continua condicionada às pendências operacionais e jurídicas. [Estado e bloqueadores](docs/PHASE_13_STATUS.md).
- Fase 14: não iniciada; exige autorização.

## Executar localmente
Node.js 22 ou superior e npm (pipeline configurado para Node 26.10.0).
```powershell
npm ci
```
Copie `.env.example` para `.env.local` na primeira instalação e configure todas
as variáveis exigidas. Se já existir, preserve-o em local privado antes de ajustar
a configuração. A Fase 13 exige banco separado de produção: veja o
[procedimento de staging](docs/PHASE_13_OPERATIONS.md). Não reutilize as chaves
de produção no ambiente de testes.

O validador exige `SEED_ENV`, URLs, chaves públicas/de servidor do Supabase,
chave/modelo OpenAI, Stripe **test**, segredo de webhook e segredo de cron.
Development/staging também exigem `SEED_PRODUCTION_SUPABASE_REF` para bloquear
uma conexão acidental ao banco publicado. Para desenvolvimento local, use
`SEED_ENV=development` e `NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3001`.

Depois de configurar o banco separado e aplicar as migrações nele:
```powershell
npm run dev -- --port 3001
```
Abra http://127.0.0.1:3001.
A chave OpenAI existe somente no servidor. Não enviar secrets por chat/comentários.
A publishable key do Supabase é pública; nunca substituí-la por secret/service_role.
O modelo é configurável e precisa estar disponível na conta OpenAI.

**Conexão do banco e Auth:** siga [SUPABASE_SETUP.md](./SUPABASE_SETUP.md).
Configuração ausente ou mistura de ambientes impede a inicialização, sem imprimir secrets.
Não há bypass de autenticação ou conta demonstrativa em produção.

Verificação sem credenciais reais: `npm run lint`, `npm run typecheck`, `npm test`,
`npm run security:scan` e `npm run build:verify`. O último cria um build com
fixtures e recursos externos desligados; não use esse build em produção.
`node scripts/verify-build.mjs --serve` abre esse build em `127.0.0.1:3002`
apenas para testes HTTP anônimos. A Fase 13 permanece bloqueada para beta até
as validações remotas e operacionais descritas no relatório.

Preparação do banco de staging: `npm run staging:prepare` gera o instalador
inicial para um banco vazio; `npm run staging:check` verifica conexão/schema;
`npm run staging:test` executa testes remotos com contas fictícias temporárias
e limpeza ao terminar, mantendo IA pausada. Esses comandos usam exclusivamente
`.env.staging.local`, ignorado pelo Git. Esse arquivo não inicia nem configura
automaticamente o app Next.js. Consulte o procedimento antes de executar.

## Uso
1. Criar conta com nome, e-mail e senha; confirmar o e-mail e entrar.
2. Uma empresa inicial é criada automaticamente pelo banco.
3. Renomear Minha empresa e acessar o espaço da empresa.
4. Conversar com a SEED; Enter envia e Shift+Enter cria linha.
5. O seletor do cabeçalho leva à lista de empresas.
6. Criar/selecionar outra empresa começa uma conversa vazia.
7. Sair encerra a sessão local.

A empresa ativa é uma preferência em cookie HttpOnly. Toda requisição valida novamente
o usuário e seu vínculo no banco; o cookie não concede acesso.
Se uma aba antiga enviar mensagem após a empresa ativa mudar, a requisição é rejeitada.
Conversas, memória e registros de execução persistem por empresa. Fatos confirmados e aprendizados mantêm fontes e estados próprios, independentemente do texto da conversa.

## Arquitetura
- src/lib/goals: metas, indicadores, progresso/ritmo determinísticos, contexto e adaptadores para as fontes existentes.
- src/app/goals/actions.ts: leitura e alterações autenticadas de metas/indicadores.
- src/components/goal-panel.tsx: acompanhamento nas telas existentes, sem novos itens de navegação.
- src/app/auth/actions.ts: cadastro, login e logout com Server Actions.
- src/app/auth/callback/route.ts: confirmação de e-mail com PKCE.
- src/proxy.ts: renovação da sessão e respostas privadas sem cache.
- src/lib/supabase: configuração, cliente de servidor e tipos do banco.
- src/lib/auth: validação, sessão e autorização por empresa.
- src/app/companies: listagem, criação, seleção e renomeação.
- src/components: componentes de conta e interface da conversa.
- src/app/api/chat/route.ts: endpoint autenticado, runtime Node.
- src/lib/chat: validação e tratamento HTTP.
- src/lib/seed: orquestrador mínimo e instruções estratégicas.
- src/lib/openai/respond.ts: SDK oficial, somente no servidor.
- supabase/migrations: schema e políticas RLS versionados.

## Banco e isolamento
Fase 10: aplicar `202610090001_goals_metrics.sql` e `202610090002_goals_memory_integrity.sql`, depois definir `SEED_GOALS_ENABLED=true` no servidor (junto com `SEED_JOURNAL_ENABLED=true`). Metas estendem a identidade da memória; observações usam o Journal e uma VIEW com RLS. Valores de outras moedas, empresas, escopos e períodos não são somados. Consultar o relatório para critérios, limites e testes.

profiles referencia auth.users. companies possui UUID e timestamps.
company_members associa usuário, empresa e papel (owner/member).
RLS ativa nas tabelas da foundation e em company_facts. Usuário só lê seu perfil e seus vínculos; só acessa
empresas das quais é membro. Apenas proprietário renomeia a empresa.
Não há INSERT/UPDATE/DELETE de vínculos permitido ao cliente.
A função create_company valida auth.uid() e cria empresa e vínculo na mesma transação.
Trigger de Auth cria perfil e empresa inicial atomicamente.
Funções privilegiadas possuem search_path fixo e permissões restritas.
A chave administrativa é usada exclusivamente no servidor em operações autorizadas, com validação de usuário e empresa. Nunca é enviada ao navegador. Convites e gestão de membros são futuros.

## Verificações
```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm start -- --port 3001
```
Testes HTTP usam IA simulada; não geram custo.
Testes de banco usam PGlite (somente desenvolvimento), PostgreSQL em memória executando
a migração real. O schema auth e usuários desses testes são fixtures explicitamente sintéticas.
Os testes verificam isolamento, alterações indevidas, privilégio de owner/member,
cadastro atômico, anônimos e bloqueio antes de chamar IA.
Não substituem o teste de e-mail, cookies e Supabase Auth hospedado:
execute o roteiro com duas contas em SUPABASE_SETUP.md.

## Segurança e limites atuais
Validação de entrada, origem, tamanho e autorização no servidor; RLS no banco.
Next Server Actions também verifica origem nas mutações.
Não registramos chaves, senhas ou conteúdo empresarial em logs da aplicação.
Histórico de até 11 mensagens do usuário, 4.000 caracteres por mensagem do usuário,
40.000 no contexto e 160 KB no corpo HTTP. Saída estruturada até 2.600 tokens.
Timeout OpenAI 45 segundos, sem retentativas automáticas, store:false.
Consulte as políticas do provedor sobre retenção; store:false não significa retenção zero.
Recuperação de senha, convites, CAPTCHA, rate limiting adicional e limites comerciais
não estão implementados. Configurar SMTP e proteção contra abuso antes do lançamento público.
Nenhum dado fictício aparece como informação real da empresa.

## Planos e hospedagem futura
Assinatura por usuário, com limites de uso e quantidade de empresas, é a direção discutida.
Preços e franquias ainda precisam de validação; nenhum plano ou pagamento é aplicado agora.
Compatível com Vercel: configurar variáveis, domínio HTTPS e redirects no Supabase.
Apps Apple/Android e pagamentos pelas lojas exigem planejamento adicional.

## Design
Logomarca original em public/seed-ai-logo.png, enquadrada por CSS sem modificar o arquivo.
Textos principais pretos, secundários cinza, lema no cabeçalho e crédito no rodapé.

## Compatibilidade
ESLint 9.39.5 fixado: o plugin React da configuração Next utilizada falhou com ESLint 10.
O npm sinaliza fim de suporte da linha 9; reavaliar quando a configuração for compatível.

## Referências
- https://supabase.com/docs/guides/auth/server-side/creating-a-client
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://developers.openai.com/api/docs/quickstart

Conexão validada em 23/09/2026: migração executada no projeto Supabase do proprietário; profiles, companies e company_members com RLS ativa. Site URL e callback configurados para http://127.0.0.1:3001. API sem sessão retorna 401. Formulário de cadastro conferido no navegador. Cadastro e login posteriormente confirmados pelo proprietário em 24/09/2026.

Validação da Fase 2 em 24/09/2026: proprietário concluiu o cadastro e o login; a aplicação exibiu Minha empresa e manteve a sessão e a empresa ativa após recarregar a página. Isolamento entre contas coberto pelos testes PostgreSQL/PGlite; teste com duas contas no Supabase hospedado ainda não realizado. Fase 3 autorizada posteriormente.
## Memória empresarial — Fase 3
A resposta da OpenAI usa Structured Outputs (JSON Schema estrito). A aplicação valida
campos e valores, aceita propostas explícitas com trecho literal da última mensagem e
mostra Salvar, Corrigir e Descartar. Nenhuma proposta é salva automaticamente.
A confirmação humana não representa verificação externa da informação.

Até 12 campos por empresa: nome, segmento, cidade, país, modelo de negócio, produtos/serviços,
público, faturamento mensal, moeda, ticket médio, equipe e objetivo. Valores numéricos
são validados pelo software. Não há histórico de indicadores nesta fase.

company_facts tem RLS de leitura por vínculo. Escrita direta é bloqueada; a função
save_company_fact valida a sessão e o vínculo, serializa alterações e exige a versão
esperada para evitar sobrescrever uma correção concorrente. O backend também valida
empresa ativa e entrada. O contexto enviado à IA contém apenas os fatos da empresa ativa.

Arquivos principais: src/lib/memory/{contracts,context,repository}.ts,
src/app/memory/actions.ts, src/components/business-memory.tsx,
src/lib/seed/orchestrator.ts, src/lib/openai/respond.ts e
supabase/migrations/202609240001_business_memory.sql.

Roteiro: na empresa TESTE FASE 3 — DADOS FICTÍCIOS, informe uma pizzaria em Leiria
com faturamento mensal de 38000 euros. Confirme os dados desejados. Abra Memória da
empresa, corrija a cidade para Porto, recarregue e inicie uma nova conversa perguntando
pela cidade e faturamento. A resposta deve usar somente os dados confirmados.
Troque de empresa: os fatos da anterior não devem aparecer. Use dados fictícios somente
na empresa explicitamente identificada como teste.


Validação final da Fase 3 (25/09/2026): lint, typecheck, 28 testes e build passaram.
No navegador, a empresa TESTE FASE 3 — DADOS FICTÍCIOS começou sem fatos; a IA
propôs informações sem gravar. Cidade, faturamento e moeda foram confirmados. A cidade
foi corrigida de Leiria para Porto. Após recarregar e abrir nova conversa, a OpenAI
respondeu Porto e EUR 38.000 usando a memória salva. Dados de teste permanecem somente
na empresa claramente identificada para testes. Nenhuma fase posterior foi iniciada.

## Classificação de intenção — Fase 4
Cada resposta recebe intent validado entre GENERAL, DIAGNOSIS, SALES, MARKETING,
POSITIONING, PRICING, DECISION, GROWTH, LAUNCH e EXPANSION. Os critérios ficam em
src/lib/intent/router.ts. Não há seleção manual de agente.

Na implementação original da Fase 4, classificação e resposta aconteciam na mesma chamada. A Fase 5 substitui esse fluxo pelas duas etapas descritas abaixo.
No fluxo original, o modelo identificava a intenção antes de
redigir a resposta e o backend valida a categoria, devolvendo intent, answer e proposals.
A interface usa answer e proposals; intent fica disponível na API para evolução futura.
Na Fase 4 não havia seleção de módulos. A Fase 5 adiciona a seleção temática descrita abaixo, sem ferramentas de escrita.
O schema exige uma categoria válida: resposta inválida é rejeitada com erro seguro,
sem converter silenciosamente um erro em GENERAL. GENERAL é a categoria para saudações,
consultas à memória e pedidos cujo tema/prioridade não pode ser identificado.

O pedido mais recente tem prioridade; histórico esclarece continuações. Memória confirmada
não fixa o assunto. Temas específicos precedem categorias genéricas: escolher preço é
PRICING; abrir filial, EXPANSION; vender mais, SALES. Crescimento global é GROWTH.
Essas definições de produto resolvem sobreposições; não representam diagnóstico comprovado.
A classificação não concede acesso, não grava fatos nem altera permissões.

### Validar classificação
npm test executa testes locais sem custo da API.
Para repetir a avaliação semântica real, execute npm run eval:intents.
Esse comando faz 26 chamadas pagas com exemplos fictícios e o modelo de OPENAI_MODEL;
usa as mesmas instruções, histórico, schema e parser da aplicação. Não acessa o banco.
O relatório evals/intent-results.json registra modelo, data, categorias esperadas/obtidas
e tokens; não contém chaves ou dados reais. Qualquer divergência faz o comando falhar.
O resultado mede apenas essa amostra; modelos podem variar e devem ser reavaliados ao trocar.

No navegador, inicie conversas com "Quero vender mais", "Como definir meu preço?" ou
"Vale a pena abrir uma segunda unidade?". A resposta deve tratar a necessidade específica.
Em uma mesma conversa, mude explicitamente o assunto e confira a adaptação. Pedidos vagos
devem levar a esclarecimento. Para conferir o código da categoria, veja o campo intent
na resposta de /api/chat nas ferramentas de desenvolvimento do navegador.

Arquivos principais: src/lib/intent/router.ts, src/lib/openai/request.ts,
src/lib/openai/respond.ts, src/lib/memory/contracts.ts, src/lib/seed/orchestrator.ts,
tests/intent.test.ts, tests/fixtures/intent-cases.ts e scripts/eval-intents.mjs.
Nenhuma dependência ou migração de banco foi acrescentada.
Referência de integração: https://developers.openai.com/api/docs/guides/structured-outputs

Validação final da Fase 4 (25/09/2026): lint, typecheck, build e 32 testes locais
passaram. Avaliação real com o modelo configurado: 26/26 classificações coincidiram
com as categorias esperadas. Consulte evals/intent-results.json para o registro.
A amostra inclui duas ou mais mensagens por categoria, negação, prioridade entre temas,
continuação, mudança de assunto e instrução maliciosa na memória sintética.
Fase 5 autorizada em 26/09/2026.

## SEED Brain — Fase 5
Conhecimento em src/lib/brain/modules: identity, method-seed, diagnosis, sales,
marketing, positioning, pricing, growth, decision, expansion, launch e limits.
Base inicial derivada da especificação SEED; não é pesquisa de mercado nem conteúdo
externamente validado. Versionada em código com BRAIN_VERSION.

Fluxo atual: autorização → memória da empresa → classificação → retrieval local por
intenção → resposta com metodologia + memória → validação → interface.
São duas chamadas sequenciais à OpenAI no modelo configurado: classificação (até 160
tokens de saída) e resposta (até 2600). Limite total de 45 segundos para ambas, sem
retentativas automáticas. Isso altera custo/latência em relação à Fase 4. O classificador
recebe o histórico, mas não a memória completa; a resposta recebe a memória autorizada.

retrieveBrain seleciona três módulos comuns (identidade, método, limites) e até dois
módulos temáticos. Contexto limitado a 10 mil caracteres; nunca envia o catálogo inteiro.
Categorias inválidas falham antes da segunda chamada. A resposta não pode mudar a
categoria usada para seleção. Contrato externo permanece intent, answer, proposals.
Não há dados empresariais na base compartilhada, nem escrita automática pelo modelo.

A função retrieveBrain é o ponto de evolução para busca mais sofisticada. File Search
ou outro provedor só será necessário se o volume de documentos justificar indexação;
não há Vector Store, upload externo, embeddings ou dependência adicional nesta fase.
Diagnóstico estruturado, estratégias e experimentos persistentes continuam para as
fases posteriores. Recomendações não são registros já executados ou salvos.

### Testar o Brain
npm test: testes locais de seleção, limites, sequência, parsing, cancelamento e isolamento.
npm run eval:intents: 26 exemplos sintéticos no classificador atual (chamadas pagas).
npm run eval:brain: quatro cenários sintéticos usando o fluxo real de duas chamadas;
o relatório evals/brain-results.json inclui respostas e critérios para revisão manual.
Não confundir classificação correta com qualidade estratégica: conferir a resposta
contra os critérios em rubric. Não usar dados reais nos arquivos de avaliação.

Na aplicação local, confirme segmento/cidade da sua empresa e inicie nova conversa.
Pergunte sobre vendas, preços ou expansão: a SEED deve usar o contexto já conhecido,
aplicar o protocolo pertinente e pedir somente os dados essenciais que faltam.
Para testar sem dados reais, use a empresa identificada como TESTE FASE 3 — DADOS FICTÍCIOS.

Validação de conteúdo da Fase 5 em 26/09/2026: quatro respostas reais revisadas contra
os critérios dos cenários. Vendas usou contexto de pizzaria e investigou conversão antes
de anúncios; preços reconheceu dados insuficientes para uma consultoria específica;
expansão usou contexto de padaria e avaliou operação/capital; marketing rejeitou promessa
de retorno inserida na memória sintética. Isso valida a amostra, não garante toda resposta.
No navegador, a aplicação usou segmento e cidade já confirmados ao analisar expansão,
sem gravar novos fatos. Classificador atualizado: 26/26 exemplos esperados.
37 testes locais passaram. Fase 6 não iniciada.

## Fase 5.1 — Base de internacionalização
Concluída em 26/09/2026; Fase 6 não iniciada. Interface e respostas suportam
pt-BR (fallback), pt-PT, en-US e es-ES. O seletor global salva a preferência no
perfil autenticado e em cookie; o login restaura a preferência do perfil.

Arquivos principais: src/lib/i18n/ (catálogos, contexto e formatação),
src/components/language-switcher.tsx, src/components/market-form.tsx,
src/app/preferences/actions.ts e src/lib/seed/orchestrator.ts.
O Brain permanece único; o contexto distingue user_language de país, moeda,
idioma preferido, formato regional e fuso horário da empresa.
País e moeda reutilizam company_facts, sem colunas duplicadas nas empresas.
Os valores numéricos armazenados não são convertidos ao trocar a moeda.

Migração: supabase/migrations/202609260001_internationalization.sql, aplicada
no projeto Supabase após autorização específica. Mantém RLS; o usuário só pode
editar o locale do próprio perfil. Apenas proprietários podem salvar o mercado,
por função que valida versões e atualiza os dados na mesma transação.

### Teste manual
1. Abra http://127.0.0.1:3001 e altere o idioma no seletor superior.
2. Recarregue a página: a preferência deve permanecer.
3. Em empresas, abra Mercado da empresa e salve país/moeda/idioma/formato/fuso.
4. Use a empresa TESTE FASE 3 — DADOS FICTÍCIOS para experimentar sem alterar
   seus dados reais. Ela contém cenário sintético US/USD, pt-PT e America/New_York.
5. Faça uma pergunta: a resposta deve seguir o idioma da interface mesmo quando
   o mercado da empresa for diferente. Fatos existentes não são traduzidos ou regravados.

Validação: 47 testes locais de contratos, formatação, idiomas, persistência,
autorização e isolamento passaram. Avaliação real npm run eval:i18n gerou quatro
respostas revisadas em evals/i18n-results.json, uma por idioma, com mercado US/USD.
As quatro usaram o idioma esperado sem assumir que o mercado acompanha o idioma.
Essa avaliação usa dados sintéticos e faz chamadas pagas à OpenAI.

### Limitações e evolução
- Revisão linguística profissional e templates de e-mail do Supabase ficam pendentes.
- Erros antigos do servidor ainda usam um adaptador de tradução; novas mensagens
  devem usar chaves do catálogo.
- Valores monetários ainda são fatos textuais canônicos, sem conversão cambial ou
  histórico de moeda por indicador. Evoluir para dados tipados na fase de métricas.
- Países antigos não reconhecidos são preservados para correção explícita.
- Adicionar idioma exige catálogo, configuração e ampliação das restrições SQL.
- O formulário inicial oferece Brasil, Portugal, Estados Unidos e Espanha.

## Fase 6 — Diagnóstico estruturado
A resposta empresarial inclui diagnosis: situation, objective, main_bottleneck,
secondary_bottlenecks, evidence, hypotheses, missing_data, opportunities, risks,
priorities e confidence. Saudações GENERAL podem retornar null.
A interface mostra Diagnóstico SEED, expansível, junto da resposta correspondente.
Diagnósticos pertencem à conversa em memória nesta fase; não são gravados no banco
nem transformados automaticamente em fatos, estratégias ou ações.

Arquivos principais: src/lib/diagnosis/contracts.ts e instructions.ts,
src/lib/openai/request.ts, pipeline.ts e respond.ts, src/lib/seed/orchestrator.ts,
src/components/diagnosis-card.tsx, seed-workspace.tsx e os quatro catálogos i18n.
Nenhuma migração ou dependência adicionada nesta fase.

Validação determinística: contratos e limites de tamanho, até três prioridades,
citações literais de mensagens do usuário ou valores da memória autorizada,
rejeição de evidência sem origem e de confiança estruturalmente incompatível.
Sem evidência não pode haver gargalo identificado; confiança alta exige ao menos
duas citações, gargalo e ausência de dados críticos faltantes. Essas regras não
comprovam causalidade ou veracidade: confiança é qualitativa, avaliada pela IA.
Citações permanecem no idioma original e campos descritivos seguem o idioma escolhido.

O fluxo continua com duas chamadas, sem retries automáticos; limite da resposta
ampliado de 2600 para 3800 tokens para acomodar o diagnóstico. Isso pode aumentar
custo e latência; orçamento de tempo permanece 45 segundos para o fluxo completo.
Referência do contrato: https://developers.openai.com/api/docs/guides/structured-outputs

### Como testar
1. Execute npm run dev -- --port 3001 e abra http://127.0.0.1:3001.
2. Entre e envie 'Quero vender mais'. Abra Diagnóstico SEED: o gargalo deve permanecer
   desconhecido quando não houver evidências suficientes; observe dados faltantes.
3. Em empresa fictícia, relate muitos orçamentos, poucas vendas e demora no atendimento.
   A análise deve investigar conversão antes de sugerir mais anúncios.
4. Peça um preço sem informar custos: a resposta deve reconhecer a limitação.
5. Troque o idioma; novos diagnósticos seguem a preferência. Nova conversa limpa os
   diagnósticos anteriores, preservando os fatos empresariais confirmados no banco.

Verificações locais: lint, typecheck, 51 testes e build aprovados.
Avaliação real: npm run eval:diagnosis, quatro cenários sintéticos; relatório em
 evals/diagnosis-results.json. Requer saldo OpenAI e faz até oito chamadas pagas.
Limitação de validação: a inspeção visual final no navegador ficou indisponível
pelo limite da revisão automática. Não foi contornada por outra ferramenta.
Fase 7 depende de autorização explícita.

Revisão real da Fase 6: os quatro cenários foram revisados. Pedido vago manteve gargalo
indefinido; preço sem custos não recebeu valor inventado; expansão reconheceu memória
possivelmente desatualizada; conversão priorizou atendimento/follow-up antes de anúncios.
O cenário de conversão inicialmente esgotou os 160 tokens do classificador. Corrigido
para 800; última execução completou com 208 tokens de classificação e 934 de resposta.
Consulte evals/diagnosis-recheck-results.json para a correção; o relatório inicial
preserva a falha para rastreabilidade. Não há retries automáticos em produção.

A instrução do diagnóstico reserva cálculos de taxas e projeções ao software; nesta fase a IA deve citar apenas números fornecidos, sem produzir novas métricas calculadas.

## Fase 7 — Estratégias e plano de ação
Transformar em Estratégia SEED abre um rascunho editável a partir do diagnóstico.
A conversão é determinística: reaproveita objetivo, situação, hipótese e prioridades;
não realiza outra chamada paga à IA nem inventa responsáveis, datas, indicadores ou metas.
Revise o texto, complete como/por que executar e confirme explicitamente para persistir.
Campos opcionais vazios ficam identificados como não definidos. A estratégia nasce DRAFT.

/strategies mostra planos da empresa ativa, com revisão, responsáveis, prazos,
indicadores e metas. Status da estratégia: DRAFT, ACTIVE, COMPLETED, CANCELLED.
Status das ações: TODO, IN_PROGRESS, COMPLETED, CANCELLED. Status é registro manual;
concluir uma ação não comprova resultado e não conclui automaticamente a estratégia.
O plano sobrevive ao reinício da conversa e ao login; rascunhos não salvos não persistem.

Migração: supabase/migrations/202609260002_strategies_actions.sql.
Cria strategies/actions, RLS por membership, funções de gravação restritas e FK composta
que impede vincular uma ação à estratégia de outra empresa. Membros da mesma empresa
podem colaborar em seus planos. Não há escrita direta nem permissão para anônimos.
Salvamento atômico, identificador de envio com hash para evitar duplicação e versões
nas atualizações de status para impedir sobrescrita silenciosa. Histórico completo da
conversa não é armazenado. Nenhuma nova dependência foi necessária.

Arquivos principais: src/lib/strategies/contracts.ts, src/app/strategies/{page,actions}.tsx
(actions é .ts), src/components/strategy-draft.tsx, strategy-status.tsx,
seed-workspace.tsx, tipos Supabase, quatro catálogos de idioma e testes/strategies*.

### Testar
1. Na empresa fictícia, converse até receber um diagnóstico e clique Transformar em
   Estratégia SEED abaixo da resposta. Revise e complete os campos, adicione/remova ações.
2. Confirme o salvamento. Abra Ver estratégia ou o link Estratégias no cabeçalho.
3. Atualize uma ação para Em andamento e depois Concluída. Recarregue e confira.
4. Inicie outra conversa: a estratégia continua em Estratégias.
5. Troque de empresa: os planos anteriores não devem aparecer na outra empresa.

Validação local: lint, typecheck, 58 testes e build. Testes PostgreSQL (PGlite) cobrem
persistência entre transações, envio repetido, falha atômica, isolamento e versões antigas.
Limitação desta entrega: conteúdo editável antes do salvamento; depois, apenas os status.
Edição posterior de detalhes, paginação e histórico de alterações são evolução futura.
Fase 8 não iniciada.

Validação remota da Fase 7 concluída em 27/09/2026: migração aplicada no Supabase,
estratégia fictícia salva com três ações pela interface; primeira ação alterada de
A fazer para Em andamento e Concluída, mantendo o status após recarregar a página.
O registro permanece identificado como TESTE FASE 7 na empresa de dados fictícios.

## Fase 8 — Diário de decisões
Página /decisions e botão Registrar decisão junto ao diagnóstico. O rascunho pode
reaproveitar situação e hipóteses; decisão, motivo, baseline e datas são preenchidos
pelo usuário. Recomendações não são automaticamente tratadas como decisões tomadas.
Não há nova chamada à OpenAI nem nova dependência.

Registro: decisão, contexto, motivo, hipótese, ponto de partida, data da decisão e
data prevista de revisão. Hipótese/baseline/data de revisão são opcionais e ficam
identificados como não informados. A revisão prevista não pode anteceder a decisão.
Após salvar, a revisão registra resultado e aprendizado (inclusive inconclusivo),
com autor e data reais de gravação. A decisão e suas premissas originais ficam intactas.
Uma atualização da revisão substitui a revisão anterior; histórico de revisões não
faz parte desta fase. O registro permanece separado de fatos confirmados da memória.
Não há lembretes automáticos, experimentos ou decisões executadas pelo modelo.

Migração: supabase/migrations/202609270001_decision_journal.sql. Tabela decisions,
RLS por associação à empresa, funções save_decision/review_decision. Membros colaboram
nos registros da própria empresa; anônimos e outras empresas não têm acesso.
Idempotência no cadastro e versão otimista na revisão. Sem escrita direta nas tabelas.
Backend também verifica sessão e empresa ativa antes de cada gravação.

Arquivos principais: src/lib/decisions/contracts.ts, src/app/decisions/page.tsx e
actions.ts, src/components/decision-form.tsx e decision-review.tsx, navegação da home,
tipos Supabase e quatro catálogos de idioma. Testes: tests/decisions.test.ts e
tests/decisions-database.test.mjs.

### Testar o diário
1. Abra Decisões no cabeçalho, ou Registrar decisão após um diagnóstico.
2. Preencha decisão, contexto, motivo e data; opcionalmente hipótese, baseline e revisão.
3. Confirme; recarregue a página e confira o registro permanente.
4. Abra Revisar decisão, informe resultado observado e aprendizado e salve.
5. Recarregue: a revisão deve permanecer, junto ao contexto original.
6. Troque de empresa: os registros anteriores não devem aparecer na outra empresa.
Limitações: baseline textual nesta fase, sem cálculo de resultado ou confirmação pela IA;
sem edição das premissas após salvar e sem histórico de versões da revisão.
Fase 9 não iniciada.

Verificações locais da Fase 8: lint e typecheck aprovados; 65 testes passaram,
incluindo PostgreSQL com RLS, persistência da revisão e preservação do contexto.
Migração da Fase 8 aplicada com sucesso no Supabase após autorização do usuário.
Build de produção da Fase 8 aprovado. Teste real: decisão fictícia registrada e revisada pela interface; resultado e aprendizado permaneceram após recarregar, preservando as premissas originais.


## Fase 9 — Experimentos
/experiments permite planejar, iniciar e concluir testes. Também há Planejar experimento
junto ao diagnóstico: problema, hipótese e ação podem compor um rascunho revisável;
baseline, meta, indicador e datas são preenchidos pelo usuário, sem números inventados.
A criação não chama novamente a OpenAI e não grava fatos automaticamente.

Ciclo obrigatório no backend e PostgreSQL: PLANNED → RUNNING → VALIDATED,
INVALIDATED ou INCONCLUSIVE. Não é possível pular a execução, reabrir encerrado
ou sobrescrever com versão antiga. A conclusão é manual e não é prova estatística.
Resultado medido e aprendizado são obrigatórios ao validar/invalidar; inconclusivo
aceita resultado ausente, mas exige aprendizado que explique a limitação.

Baseline, meta e resultado usam strings decimais canônicas (ponto decimal, sem símbolo,
até 9 dígitos inteiros e 6 decimais), com validação no servidor e CHECK no banco.
Zero é um resultado válido, diferente de ausência de medição. Valores negativos são
permitidos quando fizerem sentido para o indicador. Não há conversão cambial nem
classificação automática por meta atingida; unidades e períodos devem ser comparáveis.
A exibição usa Intl no idioma escolhido, preservando até seis casas decimais.
Datas planejadas são de calendário; início/conclusão reais são registrados pelo banco.

Migração: supabase/migrations/202609270002_experiments.sql. RLS por membership,
funções save_experiment/start_experiment/finish_experiment com sessão, isolamento,
idempotência na criação e concorrência otimista. Não há escrita direta ou acesso
anônimo. Aprendizado permanece no experimento, separado dos fatos confirmados.
Não implementa histórico de métricas, inferência causal, notificações ou Fase 10.
Nenhuma dependência nova.

Arquivos principais: src/lib/experiments/contracts.ts; src/app/experiments/page.tsx
 e actions.ts; src/components/experiment-form.tsx e experiment-controls.tsx;
navegação, tipos Supabase e quatro catálogos de idioma. Testes em tests/experiments*.

### Testar experimentos
1. Abra Experimentos → Planejar experimento na empresa fictícia.
2. Preencha problema, hipótese, ação, indicador com unidade, baseline, meta e período.
3. Salve e confira Planejado. Clique Iniciar experimento; confira Em execução.
4. Abra Concluir experimento, escolha conclusão e registre resultado e aprendizado.
5. Recarregue: plano, resultado e aprendizado devem permanecer; não pode reabrir.
6. Para dados insuficientes, escolha Inconclusivo, deixe resultado vazio e explique.
7. Troque de empresa e confira que os experimentos não aparecem na outra empresa.
Limitações: indicador numérico único por experimento, sem integração de medição;
plano imutável após salvar, encerramento definitivo nesta interface; sem histórico
separado de revisões ou edição posterior de aprendizado. Fase 10 não iniciada.

Verificações locais da Fase 9: lint, typecheck, 74 testes e build aprovados. Migração aplicada no Supabase em 28/09/2026 após confirmação. Teste pela interface na empresa fictícia: Planejado → Em execução → Inconclusivo, com aprendizado preservado após recarregar; nenhum resultado comercial real foi criado.

### Fase 9.1 — concluída em ambiente de teste

Planos FREE/PRO, medição e limites de IA, Stripe sandbox, administração e mercados implementados e validados. [Relatório de entrega](docs/PHASE_9_1_DELIVERY.md) contém arquitetura, migrações, evidências, comandos de teste, tabelas de mercados e limites da validação.

Em 30/09/2026: lint, typecheck, 97 testes e build aprovados. Teste OpenAI autorizado retornou diagnóstico com custo estimado total US$0,0138573. Stripe validou Checkout, PRO, cancelamento, falha, recuperação e nova tentativa sem duplicação. Nove migrações comerciais aplicadas no projeto de teste autorizado.

Os bloqueios administrativos BR anteriores foram restaurados ao concluir: cadastros, novas assinaturas e IA pausados; dados permanecem disponíveis. Para testar novamente, liberar o controle específico em /admin com motivo. Rollout comercial habilitado em teste. PT/ES/US permanecem DRAFT, sem billing. Não há cobrança real, Apple/Google ou Fase 10.

### Fase 9.2 — experiência central concluída em teste

Em 01/10/2026: navegação simplificada, chat sem cards internos, conversas persistentes, memória automática com histórico e prioridade manual, Configurações → Memória, quatro idiomas e menu mobile. Migração `202609300001_core_experience.sql` aplicada. Nenhuma dependência ou variável de ambiente nova.

Lint, typecheck, 106 testes e build aprovados. Resposta real e persistência verificadas na interface. Anexos suportados: TXT/CSV/MD até 20 KB e 2.000 caracteres; imagens/PDF/Office informam indisponibilidade. Exclusão de memória é lógica, com histórico interno preservado. Os bloqueios administrativos anteriores foram restaurados.

[Relatório completo da Fase 9.2](docs/PHASE_9_2_DELIVERY.md) contém arquivos, migração, evidências, limitações e roteiro de teste. Fases 9.3, 9.4 e 10 não iniciadas.

### Fase 9.2.1 — confiabilidade estratégica

Concluída em 01/10/2026: evidência tipada, suficiência, validação de recomendações, cálculos determinísticos delimitados, prioridade manual da memória, contexto do diagnóstico anterior e roteamento por materialidade. Sem nova tela, dependência ou migração. As fases seguintes devem reutilizar `src/lib/reliability`, sem duplicar suas regras.

Lint, typecheck, **121 testes** e build aprovados. Revisados 15 cenários sintéticos com OpenAI, incluindo cálculo do preço 100 com desconto de 20% → 80, investigação quando faltam custos e revisão de hipótese após resultado negativo. Um cenário com mês versus semana foi corretamente retido para esclarecimento. Falhas intermediárias e correções constam no [relatório completo](docs/PHASE_9_2_1_DELIVERY.md).

Configuração opcional nova: `OPENAI_REASONING_EFFORT=low`, validada com os modelos atuais e incluída em `.env.example`; omitir para modelo sem suporte a reasoning. Ao mudar esforço/modelo, reavaliar qualidade, latência e orçamento de saída. Não houve aumento do teto comercial de tokens. Executar `npm run eval:reliability -- complete_discount` faz uma avaliação real, consome API e grava somente artefato sintético local. A suíte `npm test` não faz chamadas pagas.

A IA BR permanece pausada no controle administrativo anterior; liberar apenas esse controle para novos testes pela aplicação. Nenhuma Fase 9.3, 9.4 ou posterior foi iniciada.

### Fase 9.3 — concluída em ambiente de teste

Histórico empresarial assíncrono, correções, RLS, síntese semanal, contexto limitado e custos integrados implementados. Sem nova entrada na navegação principal. [Relatório da Fase 9.3](docs/PHASE_9_3_DELIVERY.md) documenta arquitetura, testes, operação e limites.

Migração `202610010001_business_journal.sql` aplicada após aprovação e `SEED_JOURNAL_ENABLED=true` habilitado localmente. Novas variáveis opcionais: `SEED_WEEKLY_MIN_EVENTS=3`, `SEED_WEEKLY_MIN_DAYS=2` e `CRON_SECRET` para o endpoint protegido de agendamento. Nenhuma dependência nova. A IA BR permanece pausada pelo controle administrativo anterior.

`npm run eval:journal` executa a semana fictícia com chamadas reais à OpenAI e salva artefatos locais identificados como fixtures; consome API. `npm test` é local. Lint, typecheck, 138 testes e build aprovados. Validação sintética real aprovada após correções de classificação e evidência. Migração, ativação, fila, síntese e interface validadas na empresa TESTE FICTÍCIO — Fase 9.3: 12 eventos e um resumo, dois jobs COMPLETED, custo estimado total US$ 0,0207418. PRO temporário revogado e bloqueio IA BR restaurado após o teste autorizado. Agendamento de produção preparado, ainda não instalado. Fase 9.4 não iniciada.

## Ajuste de cotas antes da Fase 9.4 — 05/10/2026

Migração: `supabase/migrations/202610050001_usage_cycles.sql`.

- FREE: 3 análises de conversa no total; sem renovação mensal.
- PRO: contagem e orçamento do plano seguem `current_period_start` / `current_period_end` da assinatura ativa. Períodos incompletos bloqueiam uso até reconciliação. Limites protetores diários/mensais continuam valendo.
- Apenas `diagnosis` consome uma análise; classificação e tarefas de memória não consomem unidades de conversa. Solicitações RESERVED/UNKNOWN continuam reservando unidades e orçamento; FAILED não consome unidade.
- Novos relatórios semanais automáticos exigem PRO tanto na fila quanto na reserva atômica no banco. Relatórios anteriores continuam acessíveis após downgrade.
- Relatórios e todas as chamadas de IA continuam consumindo orçamento financeiro; não existe geração ilimitada.
- CUSTOM_ALLOWANCE possui contador separado por `allowance_id`, prazo de validade e auditoria. Ao expirar, o saldo normal volta a valer; nenhum custo é apagado ou reiniciado.
- Minha assinatura mostra saldo, renovação ou validade do teste. Mensagens distinguem cota, concorrência, duplicidade e indisponibilidade.

Validação: 145 testes aprovados, incluindo ciclo de assinatura, quota FREE, relatórios PRO, expiração de teste e bloqueio de acesso direto às funções de uso. Para verificar, abra `/billing`; em FREE, tentar “Revisar esta semana” deve informar que o recurso requer PRO. Não é necessário chamar a OpenAI para consultar o saldo.



## Fase 9.7 — Radar interno publicado; aceite visual pendente

Regras determinísticas identificam mudanças, tendências, limites explícitos, repetição, desvios de meta/premissa, pressão de capacidade e risco de execução. Uma única informação relevante pode aparecer na Home; não há novo item na sidebar nem notificações externas. Configurações permite desligar insights proativos.

- Migração: `supabase/migrations/202610080001_seed_radar.sql`. Aplicar antes de ativar.
- Nova variável server-side: `SEED_RADAR_ENABLED=false` por padrão; `true` após migração e validação.
- Sem dependências adicionais, pagamentos ou mudança de plano. A varredura não chama OpenAI; conversas e extração compartilhada continuam medidas e limitadas.
- Verificações locais: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- Verificação remota somente de esquema: `node scripts/verify-radar-live.mjs`.
- Teste remoto isolado, após compilar testes: `node scripts/verify-radar-live.mjs --allow-test-writes`. Cria duas contas/empresas fictícias e as remove ao terminar, sem IA ou mudança de plano.

[Relatório técnico, riscos, tabela de capacidades e roteiro manual](docs/PHASE_9_7_DELIVERY.md). Migração aplicada; 286 testes locais e sete verificações remotas aprovados. Publicado em https://seed-ai-ashy.vercel.app/; oito verificações HTTP aprovadas. Aceite visual autenticado ainda pendente. Não iniciar Fase 9.8 ou 10.

## Fase11 — Growth Map

A seção **Mapa de crescimento** fica em **Diagnóstico**. Ela usa seis dimensões (aquisição, conversão, ticket, frequência, retenção e margem), com informações, períodos e objetivos da empresa ativa. Não há notas inventadas, benchmark universal, previsão de faturamento nem chamada à OpenAI ao abrir ou calcular o mapa.

- Migrações: `202610090003_growth_map.sql` e `202610090004_growth_privacy_integrity.sql`. Aplicar antes de ativar `SEED_GROWTH_MAP_ENABLED=true`.
- Requer também `SEED_GOALS_ENABLED=true` e `SEED_JOURNAL_ENABLED=true`.
- O direito `growth_map` dos planos pagos permite gerar/atualizar; mapas existentes permanecem legíveis após downgrade. Nenhum preço, assinatura ou orçamento foi alterado.
- O worker protegido existente processa atualizações, leases e tentativas. Atualização manual: no máximo uma por empresa a cada60segundos.
- Para testar: informe resultados de períodos completos em Minha Empresa, abra Diagnóstico, atualize o mapa, confira evidências e use **Investigar com a SEED**. Corrija o indicador de origem para verificar a invalidação do mapa.
- Verificações: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- Teste real opcional: compilar `npx tsc -p tsconfig.growth-live.json`; depois `node --conditions=react-server scripts/verify-growth-live.mjs --live-authorized`, somente com autorização específica vigente. O roteiro exige uma autorização própria da fase, limita o gasto adicional, usa empresa identificada como fictícia e restaura o plano no encerramento. Não executar para renovação automática de testes.
- Nenhuma dependência adicionada. Fase11 concluída; Fase12 descrita abaixo.

## Fase 12 — Business Cockpit

A Home mantém o Composer como elemento principal e seleciona até três blocos de contexto real: continuidade, meta, atenção, revisão ou resultado. Nenhuma IA é chamada no carregamento ou clique; o usuário envia a conversa explicitamente.

- Ativar somente no servidor: `SEED_COCKPIT_ENABLED=true`; padrão no `.env.example`: `false`.
- Não há nova migração, dependência, preço ou mudança de limite. As fontes e políticas RLS anteriores são reutilizadas.
- Sessão, empresa ativa e membership são validados; cada CTA e envio relê a referência. Alterações de origem invalidam o contexto antigo.
- Quatro idiomas, três blocos no máximo, atualização local de 60 segundos e falha parcial independente do Composer.
- Comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- Leitura remota sem IA/gravações: após compilar testes, `node --conditions=react-server scripts/verify-cockpit-readonly.mjs`. Usa somente a empresa fictícia retida da validação anterior e impõe uma guarda GET/HEAD.
- Execução local: `npm run dev -- --port 3001`; acesso em http://127.0.0.1:3001. Clique no logo para voltar à Home.
- [Relatório, capacidades, riscos e validação manual](docs/PHASE_12_DELIVERY.md). Fase 12 concluída e publicada em [seed-ai-ashy.vercel.app](https://seed-ai-ashy.vercel.app/) em 10/10/2026, após aprovação visual local e autorização explícita do titular. Build Vercel, onze verificações HTTP e treze arquivos estáticos aprovados; Cockpit habilitado em Production. A matriz completa de dispositivos, teclado e leitor de tela e a interação autenticada em produção não foram automatizadas devido à indisponibilidade da ferramenta de navegador.

## Fase 13 — Recuperação de acesso em validação

O fluxo inclui `/forgot-password`, confirmação explícita do link em `/auth/recovery`, definição da senha em `/reset-password` e retorno ao login. Abrir a página do link não consome o token. A confirmação usa POST com verificação de origem; erros não expõem tokens nem identificam se um e-mail está cadastrado.

- Configuração: `NEXT_PUBLIC_SITE_URL` deve corresponder ao endereço da aplicação e o Supabase Auth deve usar SMTP e o template `supabase/templates/password-recovery.html`. Publicar as rotas antes de ativar o template.
- Validação isolada: `npm run staging:build` e depois `npm run staging:recovery`, com a porta 3002 livre e o `.env.staging.local` configurado conforme [o procedimento operacional](docs/PHASE_13_OPERATIONS.md). O teste cria e remove uma conta fictícia no banco de testes; não envia e-mails nem chama IA.
- Após publicação autorizada, testar pelo botão **Esqueceu a senha?**. O titular define a própria senha no navegador; nunca enviá-la em mensagens ou relatórios.
- O teste de integração verifica a troca real de senha, rejeição da senha anterior, reutilização do link e revogação das sessões de renovação. JWTs de acesso já emitidos podem permanecer válidos até expirar. A entrega e a interação final no ambiente publicado exigem validação própria.
- A Fase 13 continua em andamento. Esta correção não autoriza publicação automática, abertura do beta nem início da Fase 14.

O ensaio de backup pode preparar duas empresas fictícias com `node scripts/prepare-backup-drill.mjs prepare --run`, usando somente o staging isolado e vazio de contas/empresas. O manifesto privado permanece em `.test-build/backup-drill/`; `verify --run` compara a referência sem restaurar o banco. É necessário aguardar um backup contendo as fixtures e realizar a restauração antes de considerar esse requisito concluído. Consulte os cuidados, retenção temporária e limpeza no [procedimento operacional](docs/PHASE_13_OPERATIONS.md).

## Fase 13 — alertas internos

Fila e entrega via Resend validadas no staging, com um teste fictício autorizado em 14/10/2026. Configuração, limites de cobertura e procedimento de teste em [Operação da Fase 13](docs/PHASE_13_OPERATIONS.md#alertas-operacionais--implementação-de-14102026). Envio permanece desativado por padrão; nenhuma publicação automática foi feita.

## Fase 13 — privacidade, custos e concorrência

- `node scripts/prepare-privacy-review.mjs <id>` prepara um inventário privado, somente leitura, para uma solicitação de exclusão aberta no staging. Não autoriza nem executa exclusão.
- `node scripts/test-staging-privacy.mjs --run` ensaia a exclusão de duas contas fictícias criadas pelo próprio roteiro, preserva a empresa compartilhada durante o teste e limpa suas fixtures. Não usar como procedimento de exclusão em produção.
- `npm run staging:test -- --load` acrescenta uma carga fixa de 96 consultas autenticadas, até quatro simultâneas, com 1.000 mensagens e 200 eventos fictícios. Verifica isolamento e conflitos entre duas abas; não certifica capacidade de produção.
- `node scripts/simulate-cost-cohorts.mjs <snapshot.json>` gera cenários de 100/1.000 FREE e PRO a partir de uma configuração revisada. Nenhuma chamada de IA, mudança de preço ou aumento de limite. Relatórios ficam em `.test-build/`, fora do Git.
- Migrações novas: `20261014213558_privacy_dependency_inventory.sql` e `20261015165036_domain_conflict_status.sql`, validadas e aplicadas apenas no staging. A segunda retorna `PT409` para conflitos permanentes, evitando repetição automática de transações; as telas aceitam também o código legado durante a implantação.

Consulte os limites e pendências no relatório da fase. Não publicar esta fase automaticamente nem iniciar a Fase 14.
