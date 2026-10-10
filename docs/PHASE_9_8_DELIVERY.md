# Fase 9.8 — SEED External Intelligence

## Resumo

Pesquisa pública contextual no chat, com fontes rastreáveis, controle de custo e isolamento por empresa. Não adiciona item à sidebar. Estado em 08/10/2026: implementação, migração remota, 320 testes, lint, typecheck, build e testes reais verificados. Publicação autorizada e concluída em 08/10/2026. Aceite visual autenticado permanece pendente; a fase não está declarada integralmente concluída.

## Arquitetura encontrada

Next.js App Router, React, TypeScript, Supabase Auth/PostgreSQL, Responses API, Business Context Resolver, modelo comercial com reservas de custo, Simulator, Journal/Weekly, Execution Loop e Radar. A arquitetura continua monolítica e usa o cron já existente.

## Decisões arquiteturais

`src/lib/external` separa planejamento, provider, evidência, validação, medição e execução. A pesquisa produz dados externos próprios; não escreve fatos confirmados, decisões ou ações automaticamente. A continuação da análise usa o fluxo existente. Nenhum fornecedor, crawler, vector store ou dependência npm adicional.

## Migrations

`202610080002_external_intelligence.sql`, aplicada pelo titular e confirmada por consulta remota em 08/10/2026.

| Tabela | Conteúdo e relações |
|---|---|
| external_preferences | Empresa + membro, pesquisa habilitada e modo restrito |
| external_research_runs | Empresa, membro, conversa, request único, trigger, profundidade, consulta pública, cache, locale/mercado, estado, relatório, feedback, custo e tempos |
| external_sources | URL e metadados por pesquisa/empresa |
| external_claims | Afirmações estruturadas por pesquisa/empresa |
| external_claim_sources | Relação entre afirmações e fontes; referências compostas |
| external_research_jobs | Plano, contexto temporário privado, lease, resposta do provider e evidência; acesso exclusivo do servidor |
| external_competitors | Domínio por empresa; SUGGESTED, CONFIRMED ou REJECTED |
| external_watchlist | Tema opt-in com razão estratégica, frequência de 7–90 dias, pesquisa atual e anterior |
| external_events | Eventos técnicos mínimos, exclusivos do servidor |

Índices de contexto e cache incluem company_id. Chaves únicas impedem request e vínculo duplicados. FKs compostas impedem vincular fonte/claim/run de outra empresa. RLS permite leitura apenas a membros; clientes não escrevem diretamente. RPCs de fila, reserva, lease, conclusão e watch são restritas ao service_role com validação de vínculo. O ledger comercial existente é reutilizado, sem apagar custos anteriores.

Compatibilidade: aditiva; `SEED_EXTERNAL_MODE=DISABLED` preserva o produto anterior. Rollback operacional: desativar a flag e desabilitar acompanhamentos, concluir/cancelar trabalho em voo, restaurar o deployment anterior. Não apagar tabelas ou ledger para fazer rollback. Uma remoção física exige migração separada com análise de dependências das funções Radar/comerciais. Não foi executado rollback destrutivo.

## Provider abstraction

`ExternalResearchProvider` define start/retrieve/cancel. `OpenAIWebSearchProvider` usa o SDK oficial já instalado. Nenhum acesso ao banco é concedido ao modelo. A aplicação valida e persiste.

## OpenAI web search

Ferramenta atual `web_search`, `tool_choice=required`, `max_tool_calls` limitado, `search_context_size` por profundidade e `include=['web_search_call.action.sources']`. Filtros de domínios são enviados somente quando presentes. `return_token_budget=unlimited` é suportado pelo builder apenas para DEEP e não ativado por padrão. `web_search_preview` não é usado.

Referências verificadas durante a implementação: [web search](https://developers.openai.com/api/docs/guides/tools-web-search), [background](https://developers.openai.com/api/docs/guides/background) e [preços](https://developers.openai.com/api/docs/pricing). O campo documentado max_tool_calls usa uma extensão de tipo porque o SDK instalado não o expõe no tipo de criação.

## Research triggers

Heurística conservadora e planejador estruturado: pedido explícito, informação atual, concorrentes, mercado, preços públicos, regulação e expansão. Conversa pessoal, dados internos suficientes, anexos e pedido de não pesquisar seguem sem busca. A classificação não é universal: há falso negativo possível em linguagem ambígua.

## Query planner

Planejamento sem ferramentas. Recebe a pergunta e apenas descritores públicos permitidos do contexto: segmento/setor/cidade/país. Produz campos estruturados, necessidade de busca, profundidade, assunto, mercado, URLs explícitas e lacunas. Descritores precisam ser literais; não inventa local ou empresa. Contexto insuficiente pede esclarecimento.

## Query sanitizer

Consulta pública não recebe receita, caixa, margem, clientes, funcionários, contratos, objetivos privados ou identidade da empresa. Descritores são curtos, literais e sem números/PII/secrets. URLs rejeitam credenciais, parâmetros de autenticação, portas não usuais e endereços locais/IPs. O backend não faz fetch arbitrário: usa a busca hospedada.

## Privacy

Busca recebe somente consulta minimizada. Síntese recebe contexto empresarial relevante em chamada separada, sem ferramentas. `store=false` em todas as chamadas; background usa a retenção temporária de execução documentada pelo provider, portanto não promete retenção zero. Contexto do job é apagado ao concluir/falhar/cancelar. Logs não registram prompts ou chaves. A preferência desativa novas pesquisas e acompanhamentos. Uma requisição já enviada pode ter custo e processamento residual durante cancelamento.

## Research depths

| Profundidade | Chamadas máximas | Saída máxima | Contexto | Tempo de busca |
|---|---:|---:|---|---:|
| QUICK | 1 | 1800 tokens | low | 60s |
| STANDARD | 3 | 3500 tokens | medium | 100s |
| DEEP | 6 | 6000 tokens | high | 480s |

SEED_EXTERNAL_MAX_TOOL_CALLS (1–6, padrão 6) pode somente reduzir o teto de cada profundidade. O teste DEEP utilizou teto de 2; a configuração padrão de 6 foi validada localmente e seu bloqueio financeiro foi observado ao vivo. A síntese tem limite separado de 6000 tokens e prioriza 3–5 afirmações. Há margem operacional adicional de 60s para retomada; os limites não são SLA. FREE permite QUICK por padrão; PRO permite as três. Configuração operacional no banco, sem alterar preços de assinatura. STANDARD/DEEP continuam sujeitos aos limites financeiros existentes e podem ser recusados mesmo num plano PRO.

## Background mode

Todos os níveis usam execução em segundo plano, polling e cancelamento oficiais. Fila durável, lease de 110s e estados QUEUED/RUNNING/COMPLETED/PARTIAL/FAILED/CANCELLED. Browser consulta a cada 4s enquanto pendente; cron existente também retoma jobs. A intenção de submissão é persistida antes da chamada. Submissão incerta não é repetida cegamente. Evidência e candidato validado permitem retomada; custo desconhecido mantém reserva. Nenhum timer de navegador é fonte de verdade.

## Sources

Metadados de URLs reais do provider: domínio, título, data de coleta, publicação quando provada, idioma/país, papel CITED ou CONSULTED, frescor, viés e autoridade. No máximo 80 fontes e 24 mil caracteres de evidência por job. Fonte consultada não é automaticamente citada.

## Source evaluation

Taxonomia inclui governo/regulador, empresa, pesquisa primária, academia, associação, imprensa, base pública, marketplace, reviews, social, blog, fórum e OTHER. Lista explícita de domínios oficiais por BR/PT/ES/US; classificação do modelo não confere autoridade oficial. Domínios oficiais fora do país ficam marcados como incompatíveis. Disponibilidade da página permanece UNKNOWN: não há verificador próprio de links vivos.

## Claims

Structured Outputs seguido de validação determinística e preservação parcial das afirmações válidas: IDs únicos, fonte existente, trecho literal, citação próxima, número literal, moeda/dimensões ancoradas e limites de tamanho. EXTERNAL_FACT, EXTERNAL_OBSERVATION e EXTERNAL_HYPOTHESIS são distintos. A validação prova rastreabilidade, não verdade nem equivalência semântica perfeita.

## Citations

Links próximos às afirmações e lista completa expansível. Datas e papel da fonte visíveis. Mapeamento persistido em external_claim_sources; referências órfãs anulam a transação. Sem HTML externo. Limite de 25 palavras citadas por fonte; pesquisa privilegia paráfrases. Não armazena cópia de páginas.

## Conflicts

Seção própria vinculada às afirmações. Período, definição, unidade, geografia, condições e moeda não são combinados silenciosamente. Conflito impede alerta externo confiante. Detecção semântica ainda depende do modelo e da informação disponível.

## Freshness

Publicação só aceita com data ISO literal na evidência. Ausência não vira data atual. Janelas operacionais de 1 dia para regulação, 3 para atualidade, 7 para preço e 90 para outros temas. Isso é triagem, não validação de vigência. Afirmações sem evidência atual passam a QUALIFIED/LOW.

## Cache

Isolado por empresa, usuário, plano da pesquisa e fingerprint do contexto. Exige mesmas fontes/data de origem, fontes citadas atuais, sem parcialidade ou refresh explícito. Regulação/preços sempre revalidam; atualidade até 1h; outros até 24h. Feedback STALE/WRONG_MARKET expira o resultado e invalida sinais derivados. Reutilização não renova artificialmente a data. O planejamento continua sendo medido mesmo quando a busca usa cache.

## Competitors

Sugestões de concorrentes com domínio e afirmações rastreáveis. Confirmar/rejeitar é ação explícita. Nenhuma lista se torna cadastro verdadeiro automaticamente. Marketplaces permanecem fontes de ofertas, não domínios próprios do estabelecimento listado. Comparação não presume participação de mercado, faturamento ou demanda a partir de presença digital.

## Market analysis

Pesquisa por setor/local/mercado público; resposta separa observações, inferências, implicações internas e próximos passos. Não gera benchmarks privados, aprende entre empresas ou estima demanda garantida.

## Regulatory research

Domínios oficiais configurados por jurisdição, validade conservadora e orientação para interpretação profissional. País não suportado pede informação, sem pesquisar irrestritamente. Listas são iniciais e podem não conter todo órgão competente; texto legal antigo pode continuar vigente, mas a aplicação não presume isso.

## Business Model integration

Resolver existente é fonte de contexto interno. Perfil público minimizado orienta busca; contexto completo relevante só entra na síntese sem ferramentas. Nenhum claim externo vira fato empresarial confirmado. Resumos internos reescritos sem trecho literal são omitidos e o relatório é marcado como parcial.

## Decision Simulator integration

“Analisar na conversa” leva o ID da pesquisa ao fluxo existente. Dados externos entram como EXTERNAL_DATA; premissas precisam continuar condicionais e não substituem baseline interno. Resultados externos expirados são históricos e exigem revalidação antes de decisão atual.

## Radar integration

Acompanhamento opt-in, somente PRO, exige razão estratégica. Scheduler compara a pesquisa anterior com a nova. Apenas valores compatíveis da mesma fonte, atuais, sem conflito, oficiais ou concorrentes confirmados produzem sinal. Usa gate, agrupamento, limites e card do Radar existentes. Links externos aparecem na evidência. Não monitora toda a web nem alerta sobre qualquer notícia.

## Weekly Intelligence

Contexto externo relevante e fresco entra separado no prompt e nas fontes do relatório semanal. Não fabrica eventos do Journal e não altera contagens internas. Continua com o limite PRO e o processamento existente.

## Execution Loop

Pesquisa pode ser discutida no fluxo de planejamento/simulação/execução já existente. Não cria nem executa plano, experimento ou decisão sem a aceitação prevista naquele fluxo. A atribuição de resultado e aprendizado continua interna; correlação pública não vira causa comprovada.

## Source of truth report

| Objeto | Fonte de verdade |
|---|---|
| Business Model | Estado empresarial interno com proveniência existente |
| External Source | Metadados de evidência pública |
| External Claim | Afirmação pública rastreável, qualificável e contestável |
| Research Report | Síntese contextual versionada pela pesquisa |
| Radar Signal | Mudança relevante filtrada, não fato interno |
| Decision Simulation | Cenário condicional, não previsão nem resultado |

## UI/UX

Card no chat, progresso, cancelar, fontes, limitações, feedback, atualizar e continuar análise. Configurações permitem desligar pesquisa e restringir a empresa. Sem nova navegação ou termos de modelo/tokens na experiência. Confirmação de concorrentes e acompanhamento ficam secundários. Layout usa controles flexíveis e links quebráveis.

## APIs/services

Server Actions em src/app/external/actions.ts revalidam sessão/empresa ativa/vínculo e ownership. Orquestrador usa externalTurn; cron /api/internal/journal usa processExternalJob e queueExternalWatches. Observabilidade em /admin resume estados, fontes, chamadas, custos conhecidos/desconhecidos e feedback (amostra recente de 500).

## RLS/security

Nenhum cliente recebe service role ou OpenAI key. RLS, FKs compostas e RPCs restritas cobrem multi-tenancy. Páginas são dados não confiáveis; ferramentas de busca não executam código da página. Testes de prompt injection cobrem padrões conhecidos, não provam proteção semântica absoluta. Não houve teste remoto entre duas sessões autenticadas; isolamento entre tenants foi executado em PostgreSQL local e leitura anônima é verificada remotamente.

## Model router

Modelos configuráveis, reuso do router comercial. OPENAI_WEB_ECONOMY_MODEL e OPENAI_WEB_STRATEGIC_MODEL opcionais; fallback aos modelos existentes. Planejamento e QUICK usam economy; síntese e pesquisa complexa usam strategic. Preço do modelo precisa estar cadastrado antes da chamada. Não há fallback silencioso para modelo barato numa decisão material.

## Usage/cost

Cada estágio reserva orçamento no mesmo ledger: EXTERNAL_RESEARCH_PLANNING, WEB_SEARCH_QUICK/STANDARD/DEEP e EXTERNAL_SYNTHESIS. Reserva conservadora de 128k tokens de busca por chamada permitida, saída máxima e custo da ferramenta; reconciliação com usage real. A reserva pode bloquear pesquisas que custariam menos, mas evita tratar conteúdo de busca como gratuito. Não é garantia de preço fixo do provider.

Configuração inicial adicional: até 10 pesquisas/dia por usuário, refresh mínimo 300s, 1 DEEP global concorrente, US$2/dia por usuário para pesquisa, US$10/mês por empresa. Esses tetos se somam às verificações comerciais e nunca aumentam o orçamento atual. Tarifa registrada da busca: US$0,01/chamada, mais tokens conforme a tabela do modelo, referência oficial em 08/10/2026. Custo ausente não é zero. O usuário da SEED não cadastra chave nem paga a OpenAI separadamente.

Teste real autorizado: empresa fictícia, PRO até 2h, US$2 adicionais no total entre tentativas, restauração ao terminar. Não há alteração de assinatura Stripe nem mudança global de mercado. Empresas fictícias com lançamentos financeiros ficam identificadas e preservadas para auditoria, pois o ledger não deve ser apagado.

## I18n

PT-BR, PT-PT, EN-US e ES-ES na UI. Locale de resposta separado do mercado pesquisado e do idioma de busca. Datas formatadas por locale. Cobertura automatizada e inspeção de código; revisão visual dos quatro idiomas ainda pendente.

## Tests

Suíte completa final: **320 testes aprovados, zero falhas ou skips**. Nova suíte: **34 verificações** de triggers, privacidade, fontes/citações, cache, conflitos, RLS, FKs, orçamento, fila, lease, cancelamento, proveniência e deleção; reexecutada com sucesso após ajustes. PGlite executa todas as migrações e privilégios reais de PostgreSQL. IA real e evidência remota: resultados consolidados abaixo. Erros encontrados no teste real (número sem trecho literal, resumo interno reescrito, síntese interrompida e descritor inventado) levaram a correções, novas verificações e nova execução.

## Lint

ESLint aprovado sem avisos na verificação final local.

## Typecheck

TypeScript aprovado. Tipos do provider isolados; dados críticos validados no runtime.

## Build

Build final de produção aprovado com todas as alterações de código. Logs em .test-build/phase-9-8-build.log.

## Performance

UI não bloqueia durante pesquisa. Consultas delimitadas, cache, leases, fila e concorrência limitada. Um job externo por tick do cron; polling de quem aguarda também retoma sua pesquisa. Não há teste de carga nem garantia de latência. Background do provider tem retenção transitória; interrupções longas podem impedir recuperação e exigir reconciliação de custo.

## Limitações e riscos

| Risco | Mitigação implementada | Limitação aberta |
|---|---|---|
| Fonte desatualizada | Datas, freshness, TTL e revalidação | Data ausente ou vigência legal não inferidas |
| Fonte tendenciosa | Taxonomia, viés, primárias preferidas | Modelo pode não detectar viés |
| Fonte incorreta | Proveniência e comparação | Citação válida não prova verdade |
| Conflito | Seção explícita e bloqueio de alerta | Nem todo conflito será detectado |
| Citação inválida | IDs, quote, posição, URL e FKs | Proximidade não prova suporte semântico perfeito |
| Pesquisa incompleta | PARTIAL, lacunas, limites | Paywall, sites ausentes e cobertura do provider |
| Geografia inadequada | Mercado separado, flags e feedback | Localização descritiva pode ser ambígua |
| Vazamento privado | Allowlist pública, RLS e separação de chamadas | Pergunta original chega ao planejador OpenAI sem ferramentas; service role exige proteção operacional |
| Prompt injection | Dados não confiáveis, nenhuma ferramenta de escrita, filtro e schema | Filtros/prompt não são prova formal |
| Copyright | Paráfrases, trechos curtos e fontes | Sem auditoria semântica universal de similaridade |
| Custo excessivo | Reserva atômica, limites de chamadas e ledger | Preços/capacidades podem mudar; custo incerto retém reserva |
| Latência | Background, polling, cancelar e timeout | Provider/Vercel podem interromper execução |
| Alert fatigue | Opt-in, razão estratégica e gate Radar | Mudanças qualitativas não são monitoradas |
| Causalidade indevida | Inferências separadas, cenários condicionais | Interpretação ainda exige revisão humana |
| Dependência da web | Internal-first e busca seletiva | Heurística pode omitir uma necessidade de pesquisa |
| Overengineering | Provider único, cron e fluxos reutilizados | Taxonomia/regras e tabelas exigem manutenção |
| Cross-tenant leakage | Membership, RLS e FKs | Sem teste remoto de duas sessões nesta rodada |
| Performance | Limites e cache | Escala e concorrência elevada não ensaiadas |

## Technical debt

Melhorar avaliações semânticas de citações, abrangência de domínios oficiais, reconciliação de submissões incertas e retenção técnica. Consolidação do cache com enqueue não é uma transação única; uma corrida rara com cron pode executar busca em vez de reutilizar cache, sempre sujeita à reserva de orçamento. Preferências/competidores poderiam ter feedback visual mais rico; o servidor já valida a ação. Não adicionar escopo novo sem autorização.

## Capability table

| Capability | Status | Provider/Source | Tested | Notes |
|---|---|---|---|---|
| Search Trigger | Implementado | Regras + planner | Local | Conservador |
| Quick Research | Implementado | OpenAI | Local + real aprovado | Fonte e claims persistidos |
| Standard Research | Implementado | OpenAI | Local + real aprovado | 8 fontes, 5 claims; parcial |
| Deep Research | Implementado | OpenAI | Local + real com teto 2 | Padrão de 6 não executado por orçamento |
| Background Mode | Implementado | Responses + jobs | Local + real QUICK | Retomada com lease |
| Query Sanitization | Implementado | Allowlist + validação | Local | Pode rejeitar dados públicos numéricos |
| Domain Filters | Implementado | Web search + validação | Local + real DEEP | Jurisdições configuradas |
| Source Collection | Implementado | Annotations + sources | Local + real | CITED/CONSULTED |
| Source Evaluation | Implementado | Regras + síntese | Local + real | Sem prova absoluta |
| Claim Extraction | Implementado | Structured Outputs | Local + real | Fonte rastreável |
| Citation Rendering | Implementado | React | Build; visual pendente | Links adjacentes |
| Conflict Handling | Implementado | Síntese + gates | Local | Cobertura semântica limitada |
| Freshness | Implementado | Datas + TTL | Local | Desconhecido explícito |
| Cache | Implementado | Supabase | Local | Isolado e conservador |
| Competitor Analysis | Implementado | Público + confirmação | Local + real | Sem confirmação automática |
| Market Analysis | Implementado | Público contextual | Local | Sem previsão de demanda |
| Regulatory Research | Implementado | Domínios oficiais | Local + real | Parcial; sem parecer definitivo |
| Business Model Integration | Implementado | Resolver existente | Local + real | Interno separado |
| Decision Simulator Integration | Implementado | Contexto EXTERNAL_DATA | Suíte local | E2E visual pendente |
| Radar Integration | Implementado | Watches + regras | Local | PRO opt-in |
| Weekly Intelligence Integration | Implementado | Pipeline existente | Suíte local | Sem novo disparo pago |
| RLS | Implementado | PostgreSQL | PGlite + remoto anônimo | Duas sessões remotas pendentes |
| I18n | Implementado | 4 locales | Código/testes | Visual pendente |
| Usage/Cost | Implementado | Ledger comercial | Local + real | Orçamento preservado |

## Fase 10 readiness

Fonte de verdade externa isolada e rastreável preparada. Não há autorização para iniciar Fase 10 ou inteligência coletiva. Nenhum dado privado é compartilhado entre empresas.

## Manual validation

Ferramenta de navegador falhou nesta sessão; não foi contornada por Playwright, cookies ou protocolo privado. Testes reais do backend não equivalem à revisão visual.

Roteiro na empresa fictícia, com plano/orçamento válido:

1. Configurações → Pesquisa na internet: desligar, perguntar sobre mercado, conferir mensagem; religar.
2. Pedir pesquisa de pizzarias em Leiria. Conferir progresso, concorrentes sugeridos, fontes clicáveis e data; confirmar/rejeitar um concorrente.
3. Pedir preço público com oferta/unidade/moeda/condições; conferir lacunas e proibição de comparação incompatível.
4. Pedir regulação/expansão com produto e país; conferir fontes oficiais e limite profissional.
5. Abrir fontes em desktop e mobile; conferir links e controles sem transbordamento.
6. Enviar “Analisar na conversa”, discutir implicação com números fictícios internos e aceitar um plano apenas pelo fluxo existente.
7. Fonte antiga/conflitante/sem resultados deve ser qualificada, não virar fato interno; testar feedback e atualização.
8. Ativar acompanhamento com razão concreta, verificar PRO e consentimento; desativá-lo. Radar só deve surgir com mudança compatível verificada.
9. Repetir idioma de resposta diferente do país alvo; conferir quatro locales.
10. Conferir regressões: chat, Minha Empresa, memória, diagnóstico, plano, Simulator, Execution Loop, Weekly e Radar. Journal continua invisível na navegação.

## Publicação e evidências reais

Rollout autorizado explicitamente pelo titular após a revisão automática solicitar confirmação específica para produção. SEED_EXTERNAL_MODE=LIVE_WEB_ENABLED configurado na Vercel; limites financeiros e planos preservados. Deploy READY em 08/10/2026, às 16h37 (America/Sao_Paulo).

- Endereço: https://seed-ai-ashy.vercel.app/
- Deployment: dpl_9odVCpuYJezSt4Pzt1rYwpuUNwrE.
- URL imutável: https://seed-1e2oqrvzv-joao13jgc-5689.vercel.app.
- Recuperação anterior: dpl_JBnGRGwPAmtoupfAwjtkLftYzqrF.
- Dez verificações HTTP aprovadas após publicação: login 200, páginas privadas redirecionam para login (diretamente ou por /companies), /admin retorna 404 para visitante e APIs de chat/cron retornam 401. Zero chamadas de IA nessas verificações.
- Evidências: .test-build/phase-9-8-deploy.log e .test-build/phase-9-8-production-smoke.json.
- A ferramenta de navegador foi tentada novamente e falhou na inicialização do sandbox Windows. Não houve validação visual autenticada; as verificações HTTP não a substituem.

Auditoria final em 08/10/2026, 19:28 UTC: **US$ 0,7723252** de custo adicional estimado acumulado, incluindo todas as tentativas, dentro dos US$ 2 autorizados. Todas as chamadas ocorreram em empresas fictícias. **PRO temporário revogado**, sem reservas pendentes ou custos desconhecidos. 24 bundles de navegador verificados sem secrets.

| Caso real | Estado observado | Fontes / claims | Chamadas web | Custo estimado do caso |
|---|---|---|---:|---:|
| QUICK com fonte INE | COMPLETED | 1 / 3 | 1 | US$ 0,027078975 |
| STANDARD concorrentes, código final | PARTIAL | 8 / 5 | 3 | US$ 0,1124879 |
| DEEP regulatório, teto de teste 2 | PARTIAL | 1 / 1 | 2 | US$ 0,0798135 |
| QUICK sem evidência pública suficiente | PARTIAL | 0 / 0 | 1 | US$ 0,010719525 |

O último caso não cumpriu a expectativa do script de obter fonte citada (assertion sinalizada), mas a auditoria confirmou o comportamento de insuficiência: zero claims inventados, aviso parcial e custo medido. A primeira pesquisa QUICK citada comprova o fluxo positivo; resultados do provider variam. PARTIAL não equivale a pesquisa completa ou aconselhamento regulatório seguro.

Evidência consolidada: .test-build/phase-9-8-final-audit.json. Execuções anteriores permanecem em phase-9-8-live-*.json; arquivos ignorados no Git e no deploy, sem chaves. As empresas de teste são mantidas porque o histórico de custos as referencia. Não houve cobrança Stripe nem alteração permanente de plano.

### Como reproduzir

- npm run lint; npm run typecheck; npm test; npm run build.
- node scripts/verify-external-live.mjs: somente disponibilidade da migração, sem IA ou alteração comercial.
- npx tsc -p tsconfig.external-live.json: compila o worker para o harness.
- O modo --live-authorized exige autorização humana vigente e o arquivo original de orçamento; o script não o cria nem renova. Não repetir depois da expiração ou reutilizar esta autorização em outra fase.
- Para execução local: configurar SEED_EXTERNAL_MODE=LIVE_WEB_ENABLED em .env.local, mantendo os secrets existentes, e reiniciar npm run dev -- --port 3001. Em produção, essa flag já foi ativada no rollout autorizado; atualizar o navegador para carregar a nova versão.

Aceite pendente: navegador autenticado desktop/mobile, quatro idiomas, encadeamento visual de Simulator/Execution/Weekly e observação de watch real ao longo do tempo. Testes determinísticos dessas fronteiras passaram; não foram substituídos por declarações de validação visual.
