# Phase 9.6 — Decision Simulator

Status: **Fase 9.6 entregue e aceita pelo titular após confirmação das telas autenticadas no site publicado. Limites de cobertura documentados abaixo. Nenhuma fase posterior iniciada.**

## Architecture found

The application already had a server orchestrator, semantic intent/reliability routing, strict response validation, bounded Business Model retrieval, a Decision Journal, recommendations and action plans, experiments, observed results, learnings, and metered Responses API calls. Phase 9.6 extends these paths. It does not introduce a parallel financial system, another sidebar entry, or external agents.

## Architecture decisions

- `src/lib/simulation/calculation.ts`: pure interval arithmetic, dimensional checks, explicit period normalization and a versioned formula registry. No provider calls, inferred rates or FX.
- `domain.ts`: decision types, materiality/reversibility floors, provenance checks, immutable baseline/assumption inputs, conditional scenarios and readiness. The existing reliability gate may lower readiness; successful arithmetic cannot override insufficiency.
- `requests.ts`: extends existing classification; groups all extraction in one request; provides software results to the existing strategic answer request. Strict JSON schemas and the installed official SDK are reused. [Official Structured Outputs documentation](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).
- `server.ts`: bounded simulation context and staged calculations. A fingerprint of current messages, company context, market, conversation version and calculation version allows retrying interpretation after a provider failure without repeating extraction.
- `outcomes.ts`: compares a quantified assumption against an explicitly linked observed result. Incompatible/unknown units, currency, dates or scope produce `UNKNOWN`, not an invented conclusion.
- Conversation persistence and simulation finalization share a transaction. Intermediate calculation drafts persist separately from confirmed conversation turns.
- Existing execution commands may explicitly identify an accepted simulation when creating its plan or experiment. There is no autonomous external execution.

## Source of truth

| Object | Responsibility |
|---|---|
| Business Model | Current structural company context and its provenance/history |
| Existing persisted metrics | Observed measurements |
| Decision Simulation | Versioned snapshot of evaluated conditional scenarios |
| Decision Journal | Actual user choice |
| Action Plan | Execution |
| Experiment | Structured test |
| Result | Observed outcome |
| Learning | Contextual interpretation of that outcome, never proof of causality |

## Migration

`202610060002_decision_simulator.sql` — applied to the SEED Supabase project on 2026-10-06; browser confirmed `Success. No rows returned.`

- `decision_simulations`: owner, company, conversation/request, source, decision type/materiality, status, snapshot, calculation and simulation versions, selected scenario, existing decision/plan/experiment links.
- `decision_simulation_versions`: preserved historical snapshots.
- Staging, finalization, revision, acceptance, result assessment and `commit_seed_turn_v96` functions.
- New tables use company membership RLS. Anonymous access and direct authenticated writes are revoked. Mutating functions are server-only and repeat membership/ownership checks. Cross-company links use composite keys.
- Existing `execution_events` store product events and assumption assessments. Existing `execution_learnings` store learning from comparable observed outcomes.

## Decision intent, types and materiality

Semantic routing distinguishes considering a decision from recording an event. All thirteen requested categories share one simulator: pricing, discount, marketing investment, hiring, capacity expansion, new product, product removal, new location, cost reduction, sales strategy, offer change, payment terms and general strategic decisions.

Hiring, new locations, capacity expansion, payment terms and hard-to-reverse decisions have deterministic minimum `HIGH` materiality. New locations cannot be classified as freely reversible. Criticality beyond those floors remains semantic classification; no invented financial impact threshold is imposed.

## Baseline, assumptions and scenarios

Every numerical input carries its bounds, approximation marker, unit, currency, period, scope, source reference and literal evidence. User and illustrative scenario assumptions remain separate from baseline facts. Stale/conflicting/hypothetical memory cannot become a confirmed numerical baseline. An illustrative input requires a limitation label. Every assumed operand must appear in that scenario's assumption list.

Up to four relevant scenarios are supported; three alternatives are not mandatory. Scenarios may be qualitative when defensible calculations are unavailable. Missing essential inputs and failed calculations block readiness. The system never supplies a model-generated replacement for a failed formula.

## Calculation registry

Version `1.0.0`: revenue; per-unit and total contribution; incremental contribution; volume to preserve revenue or contribution; hiring break-even sales; break-even revenue; conditional marketing leads and sales; capacity utilization/gap; simple payback; changed price; discounted price.

Inputs and unrounded outputs are retained with formula/version. Ranges use interval arithmetic, not midpoints. Approximation propagates and display rounds approximate quantities to two significant digits. Required whole-unit quantities need rounding upward for execution; continuous thresholds are retained in audit data.

Day/week and month/year normalization is explicit. Month/day conversion requires explicit durations; a month is never silently 30 days. Simple payback counts periods of positive incremental contribution and does not claim discounted cash-flow accuracy. Net/gross margins cannot substitute for contribution without evidence.

## Strategic interpretation

The strategic request considers risks, trade-offs, constrained resources, reversibility, owner dependence, goals, downstream capacity, opportunity cost, time horizons and review signals. No probability or proprietary score is generated. Advertising scaling requires explicit CPL/conversion conditions. Hiring uses fully loaded cost. New-unit analysis must ask for working capital, fixed costs, demand evidence, economics and operational readiness before recommending opening. Product launch/removal and payment terms share the general strategic path rather than new specialized subsystems.

## UI and execution

The conversation gains expandable scenario cards, input provenance/assumptions, calculated results, missing information, constraints and goals. Users can edit assumptions and recalculate without an AI call. Baseline facts are not silently overwritten. Changed assumptions invalidate the prior strategic recommendation and require a new review.

Acceptance records an existing Journal decision, idempotently. Follow-up prompts prepare a plan or experiment through the current execution flow. Quantified results can be explicitly compared to the accepted scenario's assumptions after the user confirms the metric/unit/scope. Temporal and currency checks remain enforced. A compatible observation is supporting evidence, not causal proof; an incompatible comparison remains unknown.

UI labels are supplied for pt-BR, pt-PT, en-US and es-ES. The sidebar is unchanged. Business values never undergo implicit currency conversion.

## Routing, usage and cost

Normal conversation remains two calls. A decision normally adds one grouped extraction call; there is no call per scenario, risk or assumption. Existing model routing, current configured models/pricing, reservations, account limits and financial ceilings apply. Extraction has its own idempotency key under the existing classification feature, and metadata distinguishes decision extraction/analysis. The conversational analysis remains counted once. Arithmetic and input edits are provider-free.

During the first live test, extraction exhausted its output allocation. The request now uses the configured low reasoning effort and shorter outputs. A later database transport failure interrupted usage logging; the uncertain provider cost was preserved, not released. Idempotent bookkeeping writes now retry once on transport failure without repeating the paid provider call.

User authorized fictional-company testing only, up to two hours of temporary PRO and at most US$2 additional OpenAI spend. The temporary grant expires automatically; explicit restoration is recorded in the closing test notes below.

## Verificação consolidada — 07/10/2026

- 233 testes locais aprovados; lint, typecheck e build local aprovados após as correções finais.
- Build remoto aprovado na Vercel; deployment de produção READY e simulador habilitado.
- PostgreSQL/PGlite: migrações, rollback atômico, idempotência, versões, aceite, RLS, vínculos, aprendizado e recuperação de cálculos.
- Testes de regras: dimensões, moeda, escopo, período, intervalos, aproximação, proveniência e distinção entre hipóteses e fatos contraditórios.
- OpenAI real: 20 casos concluídos cobrindo 13 tipos de decisão; casos de insuficiência, conflito, dados antigos e períodos incompatíveis tratados conservadoramente. Falhas anteriores foram preservadas como falhas, não como aceite.
- Ciclo real no Supabase: simulação → plano → experimento → resultado → aprendizado → recuperação sem histórico textual aprovado com empresa fictícia.
- Custo acumulado conservador: US$1.41927987, abaixo de US$2 autorizados; PRO temporário restaurado, nenhuma reserva em execução na conferência final.
- Site publicado: login respondeu 200; páginas protegidas redirecionaram visitantes anônimos; chat e worker responderam 401 sem credenciais.
- Titular confirmou abertura correta das telas locais e, posteriormente, respondeu “tudo certo” à conferência solicitada com login no domínio publicado. Aceite visual informado pelo titular; o navegador automatizado permaneceu indisponível.
- Percurso visual completo em quatro idiomas não foi atestado. A revisão móvel anterior a esta publicação verificou largura 390px sem overflow; não equivale a novo teste móvel de produção.

As seções datadas seguintes preservam o histórico. Pendências e números antigos devem ser interpretados pela data, usando este resumo e a última seção de publicação como estado atual.

## Risks and mitigations

| Risk | Existing mitigation | Remaining limitation |
|---|---|---|
| Calculation error | Pure versioned registry, dimensional validation, regression fixtures | IEEE-754 arithmetic; not an accounting ledger or formal interval proof |
| Incomplete data | Existing sufficiency gate; essential-input holds; bounded missing questions | Missing numbers remain unknown |
| Insufficient context | Bounded company retrieval with coverage limitations | Semantic extraction can omit a relevant dependency |
| Outdated data | Business Model state/freshness checks | User-provided current assertions still depend on user accuracy |
| Fragile assumptions | Explicit user/illustrative categories, conditional language and result comparison | Plausibility is not established by formula correctness |
| False precision | Preserved ranges/approximation and display rounding | Semantic recognition of approximations needs live evaluation |
| Incorrect interpretation | Structured outputs, provenance, reliability, uncertainty prompts | An LLM can still misinterpret a valid quotation |
| Scope mismatch | Scoped quantities and strict formula matching | Mapping natural language to the correct entity remains semantic |
| Period mismatch | Explicit period dimensions; no implicit month/day conversion | Rich fiscal calendars and seasonality are not implemented |
| Currency mismatch | Exact currency matching; no automatic FX | Cross-currency simulations require explicit compatible data |
| Unknown dependencies | Bounded dependency retrieval and limitations | Partial graph coverage is not complete business knowledge |
| Improper causality | Conditional scenarios; observed support is not causal proof | No controlled causal inference engine |
| Excess confidence | Readiness/reliability holds and deterministic materiality floors | Natural-language certainty checks are not a semantic guarantee |
| AI cost | Existing reservations/ceilings, grouped extraction, reusable staged results | Incomplete/failed provider responses may still incur cost |
| Performance | Bounded context, bulk queries, one extraction for all scenarios | Large-company live latency benchmark remains pending |
| Privacy | Tenant-scoped retrieval and no sensitive prompt logging | Stored snapshots contain private company data and follow existing retention |
| Cross-tenant leakage | Membership guards, RLS and composite foreign keys | Production RLS smoke verification remains pending |
| Overengineering | Existing Journal/execution/metering reused; two new tables | Scenario/result mappings need careful maintenance as formulas evolve |

## Technical debt and boundaries

No Monte Carlo, probability forecasts, external market search, automatic purchases/hiring/campaign edits, cross-company learning, Radar, phase 9.8 or phase 10. External dependencies are recorded for later sourced validation.

Phase 9.7 can consume simulation states, selected decisions, assumptions, linked results and assessment events once this phase passes acceptance. Phase 9.8 can enrich provenance-aware inputs later; no external benchmark is implicitly trusted today.

## Manual validation checklist (pending completion)

1. Open a fictional company's conversation; submit pricing, discount, marketing, hiring and capacity fixtures.
2. Inspect cards and compare software figures with expected fixtures. Try unknown costs, stale/conflicting memory, ranges, incompatible currency and periods.
3. Edit an assumption: calculation updates, old snapshot remains, prior recommendation requires review.
4. Accept a ready scenario: one Journal decision appears; repeated acceptance does not duplicate it.
5. Prepare and accept a plan or experiment for that choice; verify the relation and existing execution screens.
6. Record a real fixture result; compare a compatible assumption and an incompatible case. Check resulting learning and later retrieval.
7. Verify mobile/desktop and four locales; regression-check chat, company, diagnosis, plan, memory, journal, weekly intelligence and Business Model.
8. Restore temporary PRO, reconcile actual and uncertain costs, then finalize the capability table and STOP.

## Final test session notes — 2026-10-06

The temporary test ran only on `TESTE FICTÍCIO — Fase 9.3`. Successful live decision requests took approximately 26–43 seconds; historical classification without simulation took about 10 seconds. This is not a large-company performance benchmark.

Provider error `credit_balance_exhausted` blocked mixed currencies and ranges. No credits were purchased and no financial ceiling was raised. Estimated recorded provider cost: **US$0.56552395** across 41 completed calls; **US$0.01081875** retained as conservative reserves for three unknown-cost calls. No pending reservations remained when checked. These are application estimates, not an invoice.

`202610060003_simulation_plan_acceptance.sql` was also applied successfully. It fixes the validated author context needed by the existing decision trigger and adds atomic, explicitly selected simulation → plan acceptance. Local database tests cover idempotency and foreign callers.

Browser evidence: the pricing card displayed monthly revenues BRL10,000 baseline and BRL11,000 / 10,450 / 9,900 alternatives, with contributions separately shown. Selecting the 95-unit alternative persisted one decision (version 3). The result panel correctly showed no linked result instead of inventing one. At 390px viewport, content width was 390px: no horizontal overflow. Evidence images are in `.test-build/phase-9-6-choice.png` and `.test-build/phase-9-6-mobile.png`.

### Matriz histórica de 06/10 — avanços posteriores registrados abaixo

| Requirement | Implementation / evidence | Open acceptance work |
|---|---|---|
| Semantic decision recognition, 13 types | Strict route schema; all types tested with fixtures; 10 distinct decision types observed live | Live SALES_STRATEGY, OFFER_CHANGE and explicit CAPACITY_EXPANSION coverage |
| Deterministic calculations, thresholds, ranges | Versioned registry, dimension checks, whole-sale threshold display; unit tests | Live ranges and multi-currency retry after provider credits restored |
| Missing data, constraints, goals, capacity | Live insufficiency holds; pricing conditional comparison | Live stale/conflicting context, different periods, self-correction |
| Facts vs assumptions | Provenance and number guards; baseline immutable; memory quarantine | Semantic extraction can still misread a valid quote or miss approximation in user text |
| Period normalization | Tested pure helper; no implicit conversion | Not exposed as an arbitrary normalization tool; incompatible inputs remain blocked |
| Decision acceptance | Browser + actual Supabase persisted choice; replay tests | Full end-to-end lifecycle below |
| Simulation → plan | Atomic UI RPC and conversational linkage, database tests | Browser flow with a real AI-generated plan and explicit selection |
| Simulation → experiment | Existing command path with accepted simulation reference | Full live generation/confirmation and resulting link |
| Result → learning | Comparable dimensions/dates, existing result/learning tables, database tests | Live recorded result → assessment → later AI recall |
| Context dependencies | Bounded direct-neighbor retrieval, company scoped | Not an exhaustive second-order dependency graph |
| Recovery and accounting | Staged arithmetic retry, idempotent ledger retry, conservative unknown reserves | Prolonged outages still require reconciliation |
| Security / regression | 232 tests include PostgreSQL RLS, transactions, execution, memory and prior phases | Production smoke test and complete manual regression checklist still pending |
| UI / languages | Existing sidebar, four label locales; mobile width verified | Full four-language browser walkthrough pending |
| Deployment | Local simulator flag only; additive DB migrations applied | Application not published; production stays on existing phase9.5 build |

The original acceptance checklist remains authoritative. Partial coverage is explicitly not final acceptance. No phase9.7, 9.8 or10 was started.

Temporary PRO was explicitly revoked after testing on 2026-10-06 (before its two-hour expiry). Supabase confirmed the original FREE allowance restored; prior history, billing records and quota allowance were preserved. No further paid calls were made after the provider balance error.

## Como testar localmente

1. Execute `npm run dev -- --port 3001` e abra `http://127.0.0.1:3001`. A configuração local já contém `SEED_SIMULATOR_ENABLED=true`; nunca exponha secrets.
2. Entre na empresa fictícia e abra a conversa “Produto Teste Preço”. Expanda “Cenários para esta decisão” para consultar os valores e a escolha registrada. A consulta não chama a OpenAI.
3. Para novos testes com IA, primeiro regularize o saldo do provedor e use um plano/limite válido. O PRO temporário desta sessão já foi encerrado. Não use uma empresa real para reproduzir as fixtures.
4. Verificações: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

Principais arquivos: `src/lib/simulation/*`, `src/app/simulation/actions.ts`, `src/components/simulation-panel.tsx`, `src/components/simulation-outcome.tsx`, integração em `src/lib/openai/pipeline.ts`, orquestrador, medição de custos, Execution Loop e migrações `202610060002` / `202610060003`.

Additional local browser regression: Minha Empresa loaded the preserved Business Model (products, channels, team and capacity), memory controls remained available, diagnosis navigation opened, and Meu Plano Estratégico loaded the existing action plan and Weekly Intelligence report. The sidebar retained its existing items with no Business Journal navigation. This verifies reading/navigation only, not fresh generation or all mutation flows.

## Retomada em 07/10/2026

O titular confirmou reposição de créditos e solicitou continuidade. Foram concluídos oito casos reais adicionais: moedas diferentes, intervalos/valores aproximados, estratégia de vendas, mudança de oferta, expansão operacional, períodos diferentes, dados antigos e custos conflitantes. A cobertura acumulada inclui 20 casos concluídos e os 13 tipos de decisão; isso não substitui o ciclo completo de execução ainda pendente.

Duas falhas de extração foram bloqueadas e corrigidas nas instruções: premissas do usuário sem ressalva e codificação indevida de condições qualitativas como números. Os casos foram repetidos e passaram. O teste com períodos distintos retornou validação WITHHELD e nenhum compromisso estratégico, comportamento conservador esperado.

Um teste de regressão com plano já ativo reproduziu a supressão indevida da nova proposta vinculada ao cenário escolhido. A migração aditiva `202610070001_simulation_existing_plan.sql` corrige esse caso sem substituir o plano anterior; o teste de banco passou após a correção. **Aplicação confirmada pelo titular em 07/10 e validada pelo aceite real descrito abaixo.**

O controle do navegador ficou indisponível por falha de inicialização do ambiente local (helper setup refresh), mesmo após reiniciar a conexão. O terminal também falhou no ambiente isolado; execução direta autorizada permitiu continuar os testes. Não foi uma rejeição de aprovação nem falha do crédito OpenAI. Naquele momento estavam pendentes a migração, o ciclo real completo, a revisão visual e a publicação; as seções posteriores registram a resolução desses itens e as limitações restantes.

Custo estimado desta retomada: US$0.38698018. Acumulado dos testes da fase: US$0.95250413, mais US$0.01081875 de reservas incertas preservadas (total conservador US$0.96332288, abaixo de US$2). Nenhuma reserva em execução ficou aberta. O PRO temporário desta retomada foi revogado e o plano/benefício anterior restaurado.

Lint, typecheck e 232 testes passaram novamente após as correções. Build de produção também aprovado após as correções.


## Validação após a migração — 07/10/2026

**Estado atual: backend e ciclo com IA real validados; aceite visual final e publicação pendentes. A fase não está declarada concluída. Esta seção atualiza as pendências históricas acima.**

A migração `202610070001_simulation_existing_plan.sql` passou na verificação comportamental no Supabase: uma proposta gerada pela IA foi persistida e aceita mesmo existindo outro plano ativo. O aceite vinculou o plano `b1edc0d0-1350-4f0c-9df7-e26094a6e15b` à simulação `143c447b-4a59-4907-856d-f4fa28f1b431`. Apenas a empresa fictícia foi utilizada.

Fluxo real validado pelo pipeline e pelas RPCs:

1. Proposta de investigação e aceite explícito do plano para o cenário escolhido.
2. Criação e início de experimento vinculado ao plano e à simulação.
3. Resultado informado pela fixture: reajuste aplicado 0.08 RATIO versus premissa 0.1 RATIO, no mesmo produto, sem moeda, em 07/10/2026. É resultado sintético de teste, não observação comercial real.
4. Comparação determinística NOT_SUPPORTED e aprendizado persistido, sem atribuir causalidade.
5. Revisão pela IA sem confundir aplicação de preço com melhoria de demanda ou contribuição.
6. Recuperação usando contexto persistido e pergunta atual, sem histórico textual nem diagnóstico anterior. A resposta recuperou 0.08 observado versus 0.1 previsto, explicitou as lacunas e não gerou nova ação.

### Correções reveladas pelos testes

- Conflitos numéricos comparam categorias factuais entre si. Preço hipotético não contradiz o vigente; dados factuais discordantes no mesmo escopo/período continuam bloqueados. Teste de regressão adicionado.
- Roteamento distingue preparação de plano de cenário já escolhido de novo compromisso financeiro material.
- Instruções distinguem consulta retrospectiva de aprendizado de decisão futura. Lacunas da decisão futura não impedem relatar o observado. O gate determinístico continua ativo.

Respostas WITHHELD anteriores às correções foram preservadas e não contadas como sucesso. A recuperação final retornou PASSED, PARTIALLY_SUFFICIENT, MEDIUM e nenhum comando de execução.

### Custos e restauração

Acumulado da fase: 97 chamadas concluídas, estimativa US$1.40846112; três chamadas incertas preservam US$0.01081875 em reservas. Total conservador **US$1.41927987**, abaixo dos US$2 autorizados. Nenhuma chamada permaneceu pendente na conferência. Reservas iniciais de chamadas concluídas não são somadas novamente ao custo contabilizado.

O teto técnico temporário considerou US$0.880608795 de histórico anterior, preservando o máximo adicional autorizado. A expiração original não foi estendida. O override PRO foi revogado após o teste, restaurando FREE e o benefício anterior. Custos e histórico foram preservados.

### Evidências e limites

- `.test-build/simulation-flow-*.json` e `simulation-final-cost.json` guardam evidências locais ignoradas, sem chaves.
- Lint, typecheck, 233 testes (incluindo PostgreSQL/PGlite, RLS, integrações, cálculos e regressões) e build aprovados. RLS de produção não foi considerada validada por consultas administrativas.
- O fluxo real usa código e transações de produção contra a empresa fictícia; não substitui teste de cliques, cookies/sessão e renderização.
- O controle visual falhou novamente antes de abrir o navegador: `windows sandbox failed: helper_unknown_error: setup refresh had errors`. Não é erro da SEED nem rejeição de autorização.
- Pendentes: percurso visual final desktop/mobile e quatro idiomas, checklist manual completo, smoke autenticado de produção e publicação. A produção permanece na versão anterior. Nenhuma fase posterior iniciada.

Arquivos principais desta retomada: `src/lib/reliability/validate.ts`, `src/lib/openai/request.ts`, `src/lib/brain/modules/reliability.ts`, `tests/reliability.test.ts`, migração `202610070001_simulation_existing_plan.sql`, README e este relatório. Nenhuma dependência adicionada.


## Publicação após conferência do titular — 07/10/2026

O titular informou: “abriu tudo certo ao meu ver”, após ser orientado a consultar na versão local os cenários, o plano vinculado e o resultado do experimento. Essa é confirmação humana de abertura das telas, não evidência de execução individual de todo o checklist em quatro idiomas.

Publicação concluída na Vercel, estado READY:

- Produção: https://seed-ai-ashy.vercel.app
- Deployment: `dpl_43tkTiPxSMnPrSHbJRhyMq4GxAtC`.
- Build e TypeScript remotos aprovados; `SEED_SIMULATOR_ENABLED=true` em Production.
- `.env*`, `.test-build`, credenciais locais e dependências locais excluídos do envio.
- Versão anterior disponível para recuperação: `dpl_HZidFZYXwNsxuvKRt34FQt4CZEJb`. Uma reversão da aplicação não exige apagar as migrações aditivas nem os dados.

Verificação pública após publicação: `/login` retornou 200; home, empresas, estratégias, decisões e experimentos redirecionaram visitantes sem sessão; `/api/chat` e `/api/internal/journal` retornaram 401 sem credenciais. Evidência local em `.test-build/simulation-production-smoke.json`. Não houve chamada paga à IA nessa verificação.

Publicação e conferência local estão resolvidas. Limitações de aceite ainda explícitas: controle automatizado do navegador indisponível; não foi executado um novo percurso autenticado no domínio publicado nem atestado todo o checklist visual em quatro idiomas/mobile. Os 233 testes e o ciclo real no Supabase continuam válidos, mas não substituem essas verificações visuais. Não declarar a totalidade do checklist manual executada. Fases 9.7, 9.8 e 10 não iniciadas.


## Encerramento e aceite do titular

Após a solicitação explícita de conferência das telas autenticadas em https://seed-ai-ashy.vercel.app/, o titular respondeu “tudo certo”. Essa confirmação resolve a pendência de aceite humano do percurso publicado descrito na solicitação. A fase 9.6 fica entregue e aceita, com os testes, a publicação e os riscos documentados neste relatório.

A confirmação é declarada pelo titular, não observação automatizada do assistente. Não atesta individualmente todos os idiomas, dispositivos ou cada item do checklist visual. Essas limitações de cobertura permanecem registradas; não houve nova chamada de IA nem alteração de plano para este encerramento.

Aguardar autorização explícita antes de iniciar fase 9.7, 9.8 ou 10.
