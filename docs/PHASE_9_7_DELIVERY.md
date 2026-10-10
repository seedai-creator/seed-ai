# Fase 9.7 — SEED Radar / Proactive Business Intelligence

Atualizado em 08/10/2026. Especificação de referência: `PHASE_9_7_SPEC.md`.

## Resumo e estado da entrega

Implementação local do Radar interno, com detecção determinística, persistência derivada, controle de repetição e integração à experiência atual. **Implementação publicada; a declaração de fase totalmente concluída aguarda as verificações manuais pendentes.** Migração aplicada e sete verificações remotas aprovadas. Radar ativado localmente e publicado em produção. **Aceite visual autenticado ainda pendente**, pois a ferramenta de navegador está indisponível nesta sessão. Não iniciar 9.8, 9.9 ou 10 por causa deste documento.

Não há novos pacotes, microserviços, menu principal, feed, push, e-mail, WhatsApp, pesquisa externa ou ações comerciais autônomas. As contas, planos, créditos e limites comerciais existentes não foram alterados.

## Arquivos principais

- `src/lib/radar/domain.ts`, `rules.ts`, `normalize.ts`: tipos, regras e adaptação das fontes canônicas.
- `src/lib/radar/relevance.ts`, `context.ts`, `narrative.ts`, `watches.ts`: relevância, contexto limitado, idiomas e limites explícitos.
- `src/lib/radar/server.ts` e `src/app/radar/actions.ts`: persistência, autorização, jobs e feedback.
- `src/components/radar-insight.tsx`, `seed-workspace.tsx`, `src/app/page.tsx`, `globals.css`: Home e preferência sem novo menu.
- `src/lib/journal/server.ts`, `requests.ts`, `src/lib/seed/orchestrator.ts`, `src/lib/brain/modules/reliability.ts` e `src/app/api/internal/journal/route.ts`: integração com extração, chat e cron existentes.
- `supabase/migrations/202610080001_seed_radar.sql`: estruturas, RLS, funções e invalidação.
- `tests/radar.test.ts`, `radar-integration.test.ts`, `radar-database.test.mjs` e `scripts/verify-radar-live.mjs`: verificações locais/remotas.
- `.env.example`, `README.md`, `docs/PHASE_9_7_SPEC.md` e este relatório: configuração e documentação.

## Arquitetura encontrada

Next.js App Router, Server Actions e componentes React; Supabase Auth e PostgreSQL com RLS; Orchestrator, roteamento comercial e chamadas OpenAI medidas; Business Journal, memória canônica, Business Model, Execution Loop e Decision Simulator existentes. A rota protegida `/api/internal/journal` e o cron atual já processam tarefas assíncronas. Journal e Memory continuam sendo as fontes; Radar não cria um segundo livro de indicadores.

## Decisões arquiteturais

`src/lib/radar` separa domínio, normalização de fontes, regras, relevância, seleção de contexto, textos, configuração de limites e persistência. Comparações e narrativa curta são determinísticas. A interpretação estratégica continua no pipeline existente, após escolha do usuário ou quando um sinal é relevante à pergunta. Erros acessórios do Radar não impedem a conversa.

## Migrations

`supabase/migrations/202610080001_seed_radar.sql`, transacional e aditiva:

- `radar_signals`: condição derivada, regra/versão, evidência, qualidade e estado.
- `radar_insights`: agrupamento e versão para apresentação.
- `radar_deliveries`: exposição e feedback por usuário/empresa.
- `radar_preferences`: proatividade e campo de silenciamento por usuário/empresa.
- `radar_company_state`: geração, lease, retomada e próxima avaliação.
- `radar_events`: observabilidade técnica, sem textos de conversas.
- `radar_watches`: configuração que referencia uma versão da memória canônica.
- `journal_jobs.radar_payload`: configurações extraídas na chamada já existente.
- Funções restritas a `service_role`, triggers de alteração das fontes e atualização de `apply_journal_extraction` para preservar o tipo do período no metadata.

A migração foi aplicada com sucesso no PostgreSQL local PGlite por toda a suíte. Aplicação no Supabase confirmada pelo usuário em 08/10/2026 e validada posteriormente pelas tabelas, RPCs e sete testes reais. Uma consulta HEAD inicial foi inconclusiva e foi corrigida pela verificação GET/RPC antes de prosseguir. Não repetir a migração já aplicada. Não remover dados de fases anteriores para fazer rollback: desativar `SEED_RADAR_ENABLED`.

## Signal model, tipos e fontes

Onze tipos: CHANGE, TREND, ANOMALY, THRESHOLD, REPETITION, GOAL_DEVIATION, CAPACITY_PRESSURE, EXECUTION_RISK, OPPORTUNITY, RISK e ASSUMPTION_DEVIATION. Domínios: vendas, marketing, finanças, clientes, operação, capacidade, metas e execução. Toda evidência mantém tabela, ID e versão; escopo, valores e períodos permanecem no payload. `knowledge_source_scope` é exclusivamente INTERNAL. Sinal não é promovido a fato, causa, diagnóstico ou recomendação.

## Rule Engine / Registry / Versioning

`rules.ts` contém o registro `RULES`, com versões explícitas e funções puras. `RADAR_CONFIG` centraliza janelas e limites operacionais. Alterar uma versão de regra não basta para justificar nova interrupção. Mudanças da versão continuam auditáveis no registro persistido.

Limites atuais: três períodos para tendência; três relatos independentes em pelo menos duas datas para repetição; histórico máximo de 120 dias; último dado no máximo 45 dias atrás; seis períodos anteriores para faixa histórica; até 80 sinais por avaliação; uma Home Insight; até três itens/16.000 caracteres de contexto; duas novas exposições por dia local; intervalo mínimo de 72 horas; descarte respeitado por 14 dias, sem reapresentação por mero decurso de tempo. São limites de processamento/evidência, não benchmarks empresariais.

## Trend detection / baseline / anomaly

Tendência exige sequência contígua de períodos completos e compatíveis, com movimento persistente de intervalos não sobrepostos. Dias, semanas alinhadas, meses e anos completos têm cadência própria. Moeda, unidade, produto, canal, local e entidade fazem parte da compatibilidade. Dois pontos geram observação, sem alerta na Home. Lacunas e períodos arbitrários/parciais não são interpolados.

Anomalia compara o ponto atual à faixa observada nos seis períodos anteriores. Um ponto isolado permanece OBSERVE. Não há z-score universal, sazonalidade estimada, causalidade ou benchmark inventado. A baseline inclui os valores e fontes originais. Aproximações são propagadas; ranges não viram média pontual.

## Thresholds

A extração de regras de acompanhamento reutiliza a chamada estruturada do Journal. Só considera GOAL, BUSINESS_PREFERENCE ou CONSTRAINT da memória atual, com ID/versão e trecho literal. Números, escopo, datas e moeda devem constar da fonte. Percentuais exigem indicação percentual; limites aproximados não viram constantes exatas. Limites agregados exigem cadência. Dados ambíguos são omitidos, sem preencher por suposição. Correção da memória invalida a configuração anterior.

## Repetition

Famílias controladas em português, inglês e espanhol reconhecem atrasos de entrega, problemas de qualidade e objeções de preço. Mensagens distintas e datas diferentes são necessárias; duplicatas da mesma mensagem contam uma vez. Não se usa coincidência de uma palavra genérica. A cobertura semântica é limitada e explicitamente não equivale a entendimento universal de reclamações.

## Goal deviation / trajectory

Reutiliza GOAL canônica com baseline, alvo, unidade/moeda, escopo, cadência e datas explícitas. Trajetória linear somente quando informada expressamente pelo usuário. Fora disso, o prazo e a janela completa precisam permitir comparação. Uma sequência confirmada atingindo o alvo resolve o desvio. Metas vagas ou sem comparabilidade ficam silenciosas; não foi criado CRUD paralelo de metas.

## Capacity pressure / constraints

Capacidade precisa de observação confirmada e relação FACT/CONSUMES explícita com produto/operação. Dias não são convertidos em semanas. Capacidade aproximada exige excedência repetida acima do limite superior. Relações e entidades também são evidências, permitindo invalidação após correção. Dependências/limitações conhecidas elevam relevância, sem inventar dependências ausentes. Unidades de capacidade fora do vocabulário conhecido são omitidas.

## Execution risk

Ações críticas bloqueadas/atrasadas, experimentos chegando ao horizonte, resultados ausentes e decisões com revisão vencida geram sinais ligados aos objetos existentes. Uma tarefa atrasada sem ligação estratégica não basta. Experimentos não são julgados antes do prazo. Conclusão, resultado ou revisão podem resolver a condição; não se muda o estado dos objetos automaticamente. A narrativa identifica a ação/plano quando existe rótulo seguro.

## Opportunity / Risk

Oportunidade de vendas requer tendências compatíveis de vendas e recorrência, além de margem superior a uma condição saudável definida explicitamente pelo usuário. Ausência de margem não significa margem boa. Concentração/riscos usam limites informados; o Radar não inventa uma porcentagem aceitável de concentração. Sinais de oportunidade pedem análise e não mandam escalar a operação.

## Assumption watch

Compara resultados com premissas de uma simulação aceita e de seu cenário selecionado. Reutiliza avaliações cuja comparabilidade foi confirmada no Simulator; mudanças posteriores no resultado invalidam a avaliação. Moeda, aceitação e horizonte continuam protegidos. O caminho automático só usa resultados com escopo explícito compatível; o esquema legado normalmente requer a confirmação de comparabilidade no Simulator. Premissas desconhecidas ou não comparáveis ficam silenciosas. Nenhuma causalidade é inferida.

## Business Model / changes / coverage

Mudanças estruturais confirmadas, recentes e ligadas por relações FACT entram como contexto OBSERVE. Correções não são tratadas como mudança do negócio. Referências do grafo a métricas canônicas não duplicam valores. Fontes históricas substituídas por correção são excluídas da avaliação. Dados conflitantes não permitem usar outra versão do mesmo período como se fosse consenso. Capacidade atual respeita a política de validade do Business Model.

Consultas são paginadas/limitadas por fonte e conferem a contagem total para detectar truncamento pelo serviço. Uma avaliação incompleta não gera novas afirmações fortes. O histórico observado não demonstra cobertura de toda a empresa; ausência de registro não é zero.

## Deduplication / merging / clustering

Fingerprint inclui domínio, tipo, métrica, escopo e, quando há valores, unidade, moeda e cadência. Janelas sucessivas não criam identidades novas só por mudar a data. Fontes idênticas se fundem; dados contraditórios não. Agrupamento comercial/delivery exige mesmo escopo e mesma janela atual; agrupamento não afirma causalidade. O hash do payload evita subir versão em reprocessamento idêntico. Um agrupamento que perde evidência é retirado integralmente e reconstruído.

## Relevance gate / impact / confidence / urgency

Critérios explícitos de qualidade, persistência, ligação estratégica e possibilidade de investigar substituem scores numéricos inventados. OBSERVE permanece silencioso na Home. Um bloqueio crítico com prazo ou capacidade reiteradamente pressionada com dependência conhecida pode receber atenção alta. Dados limitados, conflitantes ou confiança baixa suprimem a exposição.

## Alert fatigue / cooldown / resurface

Preferências, feedback, versão vista, orçamento diário e cooldown são verificados atomicamente por usuário/empresa, com lock. A mesma card pode continuar durante o dia sem contar nova exposição. Nova evidência material é necessária para reaparecer; o tempo sozinho não basta. Dismiss, resolução e informação já conhecida ficam persistidos. A incerteza sobre um limite não é registrada como recuperação.

## Insight generation / Home

Textos determinísticos e curtos nos quatro idiomas, uma card discreta na Home vazia, detalhes com datas/valores/escopo e “Analisar comigo”. Menus oferecem não relevante, já conhecido, correção e resolução. Correção abre a memória ou Minha Empresa conforme a fonte. Não há item Radar na sidebar, badge de urgência artificial ou feed. A escolha de analisar preenche a conversa; o usuário decide enviar.

## Chat / diagnosis / plan / simulator

Contexto relevante é rotulado INFERENCE e limitado por volume, sem enviar o banco inteiro. A seleção respeita preferências e descarte; observações ainda não fortes podem ajudar uma pergunta pertinente. Quando há histórico de descarte, a inclusão automática de observações é conservadoramente reduzida. A flag pode falhar fechada; erro do Radar deixa o chat seguir. A partir da conversa, diagnóstico, plano, experimento e simulação seguem os mecanismos e permissões existentes. Nenhum desses objetos é criado automaticamente pelo Radar.

## Weekly Intelligence

Até dois sinais podem entrar na chamada semanal já existente se todas as suas fontes originais forem eventos válidos da janela enviada. A validação semanal continua exigindo os IDs desses eventos. Preferência desligada também suprime esse contexto. PRO e cotas continuam obrigatórios para gerar relatórios; não foi criada uma chamada semanal extra.

## Jobs / scheduler / failure recovery

Triggers marcam a geração da empresa como alterada. O cron existente e o `after()` do chat podem reivindicar trabalho. Lease de 90 segundos, exclusão concorrente, aplicação atômica e verificação da geração impedem gravação baseada em snapshot vencido. Reprocessamento não duplica. Erros retornam à fila com atraso limitado; lease expirado permite retomada. Varredura estável a cada seis horas. No MVP o cron trata uma empresa por execução; não há promessa de tempo real em grande escala.

## APIs / services

`src/app/radar/actions.ts`: leitura da Home/preferência, alteração de preferência, feedback e observabilidade restrita a administrador. Autorização verifica sessão, empresa ativa e membership no servidor. O cliente não recebe credencial privilegiada nem escreve diretamente nas tabelas. `server.ts` concentra leitura/worker e integração. `context.ts` contém seletores puros e testáveis.

## RLS / security / privacy / auditability

RLS limita sinais e insights aos membros da empresa; preferência e entregas são do próprio usuário. Estado de fila e eventos técnicos não são legíveis pelo cliente. Escritas e RPCs exigem `service_role`; ações públicas ainda fazem autorização explícita. Chaves compostas impedem entrega ligada a insight de outra empresa.

Exclusão lógica de fonte ou exclusão física elimina seus sinais e cópias em insights/entregas. Correção retira os derivados imediatamente e exige recomputação. Exclusão da empresa propaga por cascade. Eventos técnicos não guardam conversa, valores empresariais ou chain-of-thought. Históricos canônicos já existentes continuam sujeitos às políticas das fases anteriores; isto não altera sozinho toda a política de retenção do produto.

## Admin / rule control / feature flags

`readRadarAdmin` exige administrador e devolve eventos técnicos recentes: processamento, contagens/supressões, feedback, falhas, latência e custo determinístico zero. Não existe edição livre de código no Admin. Parâmetros/versionamento ficam no repositório. Ativação: `SEED_RADAR_ENABLED=true`, somente depois da migração e testes remotos. Desativação: false/remover variável; o restante do produto segue funcionando.

## Model router / structured outputs / AI usage / cost

Detecção, cálculos, relevância, agrupamento e narrativa curta usam zero chamadas OpenAI. A extração opcional de limites amplia o Structured Output do Journal existente; essa chamada já passa pelo roteador e medição de uso, e pode consumir mais tokens. Analisar um sinal usa o chat e os limites normais; não é uma análise gratuita ilimitada. Weekly continua com o consumo já contabilizado. Eventos SCAN_COMPLETED registram `ai_cost_usd=0` apenas para a varredura determinística, não como custo total de toda a jornada.

Nenhuma chamada paga foi feita para a validação desta fase até o estado deste relatório. Nenhum PRO temporário foi ativado.

## I18n / currency / timezone

pt-BR, pt-PT, en-US e es-ES nas novas interfaces e narrativas. Datas e números usam Intl. Moedas nunca são convertidas/mescladas. Orçamento diário usa timezone da empresa; timezone ausente impede avaliação segura. As capturas visuais nos quatro idiomas ainda dependem de validação autenticada.

## Tests / lint / typecheck / build / performance

Suíte final: **286 testes aprovados**, zero falhas, skips ou cancelamentos. Lint, typecheck e build final aprovados. Depois da propagação de aproximação à conversão derivada, os 40 testes afetados foram repetidos e passaram; o build de produção e typecheck passaram novamente. Logs ignorados em `.test-build/phase-9-7-*.log`. Testes incluem todas as migrations em PGlite, RLS, jobs, rollback, lease, dedup, feedback, exclusão, regras, integração de fontes e limites de contexto. `tests/radar*.test.*` cobre os cenários específicos. O cenário de 3.000 observações verifica limite de saída e determinismo, sem IA; execução isolada observada abaixo de um segundo. Não é um benchmark de tráfego concorrente em Vercel/Supabase.

No Supabase real: sete verificações aprovadas (schema/RPC, valores canônicos → insight, idempotência, bloqueio de não membro e anônimo, preferência/descarte, correção rejeitando worker antigo, exclusão apagando derivados). Empresa fictícia temporária removida com sucesso; conta proprietária, assinatura e empresas anteriores preservadas. Zero chamadas/custo de IA. Novas contas de teste não puderam ser criadas porque cadastros BR estão desativados pelo controle comercial; ele foi mantido. RLS entre dois usuários autenticados foi verificado localmente, não no ambiente remoto.

`npm test` não usa rede nem OpenAI. `scripts/verify-radar-live.mjs` sem argumento faz apenas verificação remota de esquema. `--allow-test-writes` cria duas contas fictícias e suas empresas isoladas, verifica persistência, RLS autenticado, feedback, correção e exclusão, e as remove em `finally`. Não usa dados de contas reais ou planos pagos. Executar somente após a migração. Resultado em `.test-build/phase-9-7-live.json`. Se cadastros estiverem desativados, `--fixture-owner=<UUID>` usa uma empresa temporária de uma conta já autorizada: não cria login e não apaga a conta original. Essa modalidade não atesta RLS entre duas sessões autenticadas distintas.

## Tabela de capacidades

| Capability | Status local | Deterministic/AI | Tested | Notes |
|---|---|---|---|---|
| Signal Model / Rule Engine / Registry | Implementado | Determinístico | Regras + banco | Versões e fontes rastreáveis |
| Change / Trend | Implementado | Determinístico | Unitário + integração | 3 períodos completos; mudança estrutural contextual |
| Anomaly | Implementado | Determinístico | Unitário | Histórico de 6 períodos; isolado permanece OBSERVE |
| Threshold / Risk | Implementado | Híbrido na extração | Unitário + schema | Somente limites canônicos explícitos |
| Repetition | Implementado, vocabulário limitado | Determinístico | Unitário + integração | Mensagens independentes e pelo menos 2 datas |
| Goal Deviation | Implementado | Determinístico | Unitário + integração | Datas/cadência; linearidade expressa |
| Capacity Pressure | Implementado | Determinístico | Unitário + integração | Relação/escopo/unidade explícitos |
| Execution Risk | Implementado | Determinístico | Unitário + integração | Criticidade e horizonte existentes |
| Opportunity | Implementado | Determinístico | Unitário | Vendas, recorrência e margem informada |
| Assumption Deviation | Implementado, comparabilidade restrita | Determinístico | Unitário + integração | Premissa aceita e resultado comparável |
| Deduplication / merging | Implementado | Determinístico | Unitário + banco | Hash, versão e fingerprint |
| Clustering | Implementado | Determinístico | Unitário + banco | Escopo e janela; sem causalidade |
| Relevance / fatigue | Implementado | Determinístico | Unitário + banco | Sem score arbitrário; orçamento diário |
| Insight generation | Implementado | Determinístico | Narrativas em 4 idiomas | Sem chamada LLM dedicada |
| Home surfacing | Implementado; visual pendente | Determinístico | RPC local | Uma card, nenhum menu novo |
| Conversation surfacing | Implementado | Seleção determinística; chat IA existente | Seletores + integração | Limite de contexto e INFERENCE |
| Weekly integration | Implementado | IA semanal existente | Seletores + schema | Só IDs originais da janela, PRO mantido |
| Execution Loop integration | Implementado | Regras + fluxo existente | Integração + suíte anterior | Não executa ações sozinho |
| Decision Simulator integration | Implementado | Regras + fluxo existente | Integração + suíte anterior | Não cria decisão automaticamente |
| Scheduler / jobs | Implementado | Determinístico | Banco, lease, retry | Cron existente; RPC remoto aprovado |
| RLS / multitenancy | Implementado | PostgreSQL + autorização | PGlite | RPC/anon remoto aprovado; duas sessões autenticadas pendentes |
| I18n | Implementado | Determinístico | 4 narrativas | Inspeção visual pendente |
| Usage / cost | Integrado à medição atual | Determinístico + chamadas já medidas | Suíte comercial | Zero chamadas pagas nesta validação |

## Riscos e limitações

| Risco | Mitigação existente | Limitação aberta |
|---|---|---|
| Falso positivo | Persistência, compatibilidade, qualidade, feedback e gate | Dados relatados podem estar errados; tendência não demonstra relevância causal |
| Falso negativo | Consulta incremental e regras rastreáveis | Silêncio conservador, vocabulário limitado e ausência de fontes podem ocultar oportunidade/problema |
| Dados incompletos | Janela/contagem, flag de truncamento, ausência != zero | Não estima cobertura total da empresa; limites por fonte podem suspender alertas em contas volumosas |
| Dados desatualizados | Validade por fonte, janela e retirada de sinais não reconfirmados | Sem integração automática com sistemas externos; depende de atualização do usuário |
| Períodos incompatíveis | Cadência, sequência e metadata de parcialidade | Relatos antigos sem metadata podem exigir correção; spans arbitrários são omitidos |
| Escopo incorreto | Produto/canal/local/entidade exatos; RLS | Nomes ambíguos não são associados; comparação manual de premissas depende de confirmação humana |
| Semântica incorreta | Famílias explícitas, fonte literal e Structured Outputs | Extração de uma preferência ainda pode falhar; não há compreensão semântica universal |
| Falsa precisão | Ranges e aproximações preservados; moeda não convertida | Dados originais pontuais podem já ter sido arredondados pelo usuário |
| Excesso de insights | Uma card, 2 exposições/dia, cooldown e descarte | Ajustes de cadência devem ser orientados por uso real; mudanças no agrupamento podem gerar nova identidade |
| Custo de IA | Zero LLM na varredura; contexto limitado e medição atual | Extração compartilhada pode aumentar tokens; custo de conversas depende do uso/modelo |
| Performance | Índices, consultas delimitadas/paralelas, lease e fila | Uma empresa por tick; não validado sob grande concorrência; contar linhas também tem custo |
| Privacidade | Fontes mínimas, exclusão derivada, logs sem conversa | Retenção global de históricos/backup continua dependente da política do produto |
| Cross-tenant leakage | RLS, chaves compostas, membership e filtros server-side | Credencial service_role é privilegiada e exige disciplina operacional; duas sessões autenticadas remotas não verificadas |
| Falha de processamento | Aplicação atômica, geração, lease expirável e backoff | Plataforma pode interromper execução; notificação técnica depende da observabilidade existente |
| Overengineering | Reuso de cron, chat, fontes e limites; nenhum serviço novo | Regras e filtros precisam de manutenção; não existe editor dinâmico de regras |

## Technical debt / 9.8 readiness

External/Mixed estão somente como evolução conceitual: entradas atuais aceitam INTERNAL. Pesquisa externa, conectores e monitoramento universal não foram implementados. Evoluções justificáveis: paginação incremental por fonte em empresas volumosas; escopo formal em execution_results; cobertura semântica baseada em avaliações; retenção automática de eventos técnicos. Não iniciar essas ampliações sem autorização.

## Publicação e verificação do endereço

URL: https://seed-ai-ashy.vercel.app/ — implantação final READY em 08/10/2026.

- Deployment: `dpl_JBnGRGwPAmtoupfAwjtkLftYzqrF`.
- URL imutável: https://seed-hrxe6iymj-joao13jgc-5689.vercel.app.
- Recuperação anterior à fase: `dpl_43tkTiPxSMnPrSHbJRhyMq4GxAtC`.
- Flag `SEED_RADAR_ENABLED=true` em produção. Journal e Simulator continuam habilitados.
- Oito verificações HTTP aprovadas: login 200; páginas de dados redirecionam quem não está autenticado; chat e cron devolvem 401 ao acesso anônimo. Nenhuma dessas verificações chama a IA.
- Evidência local ignorada: `.test-build/phase-9-7-production-smoke.json` e `.test-build/phase-9-7-deploy.log`.

## Manual validation / roteiro de aceite

1. Aplicar a migração no Supabase. Executar o verificador remoto e confirmar que todas as fixtures foram removidas.
2. Ativar `SEED_RADAR_ENABLED=true` localmente, reiniciar e validar; depois configurar na Vercel e publicar a versão testada.
3. Numa empresa claramente fictícia, informar três semanas completas consecutivas com leads 500/500/500 e vendas 60/50/40, com datas explícitas. Aguardar extração/cron. Verificar conversão 12% → 10% → 8% e fontes no insight. Dados de uma empresa real não devem ser usados como fixture.
4. “Analisar comigo” deve preparar a conversa; enviar conscientemente para validar IA real, usando os limites normais. O diagnóstico não deve apresentar uma causa como comprovada. Seguir plano/simulação apenas pelo fluxo existente e aceitação explícita.
5. Verificar relatos distintos de atraso, capacidade conhecida com unidade compatível, meta completa, ação crítica bloqueada, experimento no prazo, resultado faltante e premissa aceita comparada no Simulator.
6. Corrigir ou apagar uma fonte: a card antiga deve desaparecer. “Não é relevante” impede repetição; recarregar não duplica; nova evidência material respeita cooldown.
7. Em Configurações desligar insights proativos e voltar à Home. Não exibir card nem contexto proativo. Conferir Minha Empresa, Memory, chat, diagnóstico, plano e Simulator.
8. Conferir desktop/mobile e os quatro idiomas. Não mostrar códigos internos, números inventados ou item Radar na sidebar. Weekly permanece apenas no fluxo existente e com PRO.

**Não atestado ainda:** RLS entre dois usuários autenticados no ambiente remoto (cadastros desativados), revisão visual autenticada nos quatro idiomas e nova resposta de IA real com Radar. A Home foi publicada, mas publicação não prova revisão visual. A indisponibilidade da ferramenta de navegador não substitui essas verificações. Somente após resolvê-las atualizar o estado para concluído e parar na Fase 9.7.

## Confirmação do usuário e condição para novos testes — 08/10/2026

O usuário confirmou que conseguiu desligar e religar Insights proativos. Essa confirmação não atesta automaticamente a matriz visual completa nos quatro idiomas. Também relatou limite de uso. Consulta somente de leitura a commercial_usage confirmou uma liberação temporária ativa, 2 análises usadas de 10 e teto financeiro interno atingido. O desenvolvimento da próxima fase pode ser preparado após receber seu escopo; novos testes pagos precisam primeiro de orçamento válido. Nenhum limite ou plano foi alterado nesta conferência.
