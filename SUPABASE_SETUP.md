# Conectar a SEED ao Supabase
Esta etapa exige um projeto Supabase do proprietário. Não compartilhe a senha do banco,
service_role, secret key ou chave OpenAI em comentários ou conversas.

## 1. Criar projeto
Acesse https://supabase.com/dashboard e crie um projeto chamado SEED AI.
Guarde a senha do banco. Escolha a região conforme seu público e requisitos de privacidade.
Aguarde a criação.

## 2. Preparar banco
No painel, abra SQL Editor → New query.
Copie TODO o conteúdo de supabase/migrations/202609230001_foundation.sql e execute uma vez.
Isso cria profiles, companies, company_members, políticas RLS e o cadastro automático.
Não execute novamente sobre tabelas existentes. Futuras mudanças devem usar novas migrações.
Não desative RLS para resolver erros.

## 3. Conectar aplicação
Abra Connect no painel Supabase e encontre Project URL e Publishable key.
Preencha no .env.local existente, preservando as variáveis OpenAI:
```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUA_CHAVE_PUBLICA
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3001
```
A publishable key é pública por definição. Nunca use secret ou service_role aqui.
O backend usa a sessão do usuário e RLS; nenhuma chave administrativa é necessária.

## 4. Configurar Auth
Em Authentication → URL Configuration:
- Site URL: http://127.0.0.1:3001
- Redirect URLs: http://127.0.0.1:3001/auth/callback
Use o mesmo hostname e porta no navegador e no .env.local.
Mantenha confirmação de e-mail ativada. Configure SMTP próprio antes de disponibilizar
cadastro para o público; o envio padrão do Supabase é restrito e tem limites.
O link de confirmação deve ser aberto no navegador onde o cadastro foi iniciado (PKCE).
Se o link for aberto em outro navegador, após confirmar tente entrar com e-mail e senha.
Para produção, configure seu domínio HTTPS nestes campos e nas variáveis de ambiente.

## 5. Testar
Reinicie a aplicação: npm run dev -- --port 3001.
Abra http://127.0.0.1:3001 e crie sua conta; confirme o e-mail e entre.
Você deve ver Minha empresa. Edite o nome e acesse a empresa.
Atualize a página: a sessão e a empresa ativa devem continuar disponíveis.
Adicione uma segunda empresa: selecione-a e confirme que o chat começa vazio.
Use outra janela privada para criar outra conta: ela não deve ver as empresas anteriores.
Tente chamar /api/chat sem sessão: deve ser rejeitado antes de chamar OpenAI.
Saia da conta: a home passa a exigir login.

## Testes automatizados
npm test executa testes HTTP/autorização e a migração real num PostgreSQL PGlite
em memória. O esquema auth e as identidades são fixtures dos testes, sem usuários reais.
Os testes exercitam RLS, leitura e escrita entre contas, criação atômica,
bloqueio de anônimos, membros sem privilégio e tentativas de forjar vínculos.
Esses testes não substituem o teste ponta a ponta do serviço Supabase Auth hospedado.

## Escopo
Empresas podem ter vários membros no banco; convites não estão implementados nesta fase.
Cada novo usuário recebe uma empresa inicial. Empresas extras são criadas explicitamente.
Planos, cobrança, franquias, limites comerciais e coleta de uso continuam pendentes.
A conversa é transitória; os fatos confirmados persistem na memória empresarial.

## Atualização para Fase 3
Após a foundation, execute uma única vez a migração
supabase/migrations/202609240001_business_memory.sql.
Ela cria company_facts, RLS e a função de confirmação/correção com controle de versão.
As duas migrações já foram aplicadas no projeto Supabase atual; não reaplique.
Em um novo projeto, aplique os arquivos na ordem dos nomes.
Testes automatizados executam ambas as migrações e cobrem isolamento, confirmação,
correção, conflito de versões e rejeição de escritas diretas/anônimas.

## Migração da Fase 5.1
Depois das migrações de autenticação e memória, execute no SQL Editor:
supabase/migrations/202609260001_internationalization.sql.
Foi aplicada no projeto da SEED AI em 26/09/2026 com autorização do proprietário.
Ela adiciona profiles.locale e companies.preferred_language/locale/timezone;
país e moeda continuam em company_facts. Não concede escrita direta nas novas
colunas da empresa. A função save_company_market exige proprietário autenticado,
valida fuso horário, enumerações e versões, e grava atomicamente.
A permissão UPDATE(locale) do perfil continua limitada pela RLS ao próprio usuário.
Países legados reconhecidos são normalizados; nomes desconhecidos são preservados.
Para novos ambientes, execute as três migrações em ordem cronológica.

## Migração da Fase 7
Aplicar 202609260002_strategies_actions.sql após as três migrações anteriores.
Cria strategies/actions e funções save_strategy, set_strategy_status e set_action_status.
Todas as funções validam associação à empresa; tabelas só permitem SELECT com RLS.
Membros podem colaborar nos planos da própria empresa. Nenhum acesso anônimo ou
escrita direta é concedido. A aplicação também confere a empresa ativa em cada escrita.
A aplicação remota exige confirmação específica das permissões antes da execução.

Migração da Fase 7 aplicada com sucesso no Supabase em 27/09/2026, após autorização
do usuário. Estratégia fictícia salva pela interface com três ações na empresa de teste.

## Migração da Fase 8
202609270001_decision_journal.sql cria decisions com RLS e funções save_decision e
review_decision. Executar após as quatro migrações anteriores. A gravação valida
membership e preserva as premissas originais durante a revisão. Não concede acesso
anônimo ou escrita direta. Migração aplicada com sucesso. Registro e revisão validados pela aplicação, com persistência após recarregar a página.


## Migração da Fase 9
202609270002_experiments.sql cria experiments e as funções save_experiment,
start_experiment e finish_experiment. Aplicar após as cinco migrações anteriores.
RLS por membership, sem acesso anônimo nem escrita direta; transições e versões
são validadas no banco. Aplicada em 28/09/2026 após confirmação. Ciclo completo validado pela interface na empresa fictícia, com persistência de plano e aprendizado após recarregar.
