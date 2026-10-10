# Fase 9.5 — Modelo Vivo da Empresa

Estado em 06/10/2026: fase 9.5 publicada e fluxo principal validado com IA real, após correções encontradas no teste. Migração aplicada, 195 testes automatizados aprovados e acesso temporário restaurado. As limitações e a abrangência dos testes estão registradas abaixo. Fases 9.6–10 não iniciadas.

## Resumo e arquitetura encontrada

O projeto já usava Next.js App Router, autenticação/membership Supabase, `business_memories`, diário com outbox `journal_jobs`, Weekly Intelligence, Reliability, roteamento Economy/Strategic e medição financeira. O Execution Loop da 9.4 usa as tabelas existentes de estratégias, ações, decisões e experimentos, mais recomendações, resultados e aprendizados. Não existiam cadastros de produtos, ofertas ou canais. Goals e Metrics ainda são conhecimentos tipados da memória/diário; esta fase não antecipa o módulo de metas da fase 10.

Memory registra conhecimento; Journal registra eventos; Execution Loop acompanha tentativas/resultados; Business Model conecta a estrutura do negócio. O modelo é parcial e não substitui nenhuma dessas camadas.

## Decisões arquiteturais

- PostgreSQL, sem banco de grafos, dependências novas ou infraestrutura externa.
- Entidades estruturais tipadas e relações validadas. Company, metas e métricas existentes são referenciadas, não recadastradas.
- A extração do modelo compartilha a chamada do diário. Não há chamada por entidade ou chamada ao abrir Minha Empresa.
- Observações novas formam histórico; estado atual tem unicidade. Correção e mudança real têm operações diferentes.
- Modelos só propõem estruturas. Código valida números, fontes, tipos, relações, limites, escopo e persistência.
- Fluxos de venda/entrega são relações `NEXT` e `PARTICIPATES_IN`, sem funil obrigatório nem CRM.

## Migration report

`202610060001_business_model.sql`, aplicada no projeto Supabase da SEED em 06/10/2026.

Cria:

| Tabela | Responsabilidade |
|---|---|
| `business_entities` | Identidade canônica por empresa/tipo/nome; referência opcional à fonte existente; situação, versão e origem |
| `business_observations` | Atributos tipados, valores/ranges/moeda, origem, fonte, período, confiança, atual/histórico |
| `business_relationships` | Ligações validadas, evidência, confiança, situação e validade temporal |
| `business_model_events` | Auditoria de mudanças, conflitos, correções e merges |
| `business_model_jobs` | Aplicação idempotente do payload validado, tentativas e falhas |

Acrescenta a `journal_jobs`: `model_payload`, `model_candidate`, `model_error`, `model_attempts`. A migração é transacional e não reseta nem reescreve dados empresariais anteriores.

Índices: identidade canônica, referência única, lookup por empresa/tipo/situação, observação atual única, observações por entidade/tempo, relação atual única, alvo de relação, histórico de eventos e fila pendente.

RLS: leitura por membership nas quatro tabelas de conhecimento/auditoria; fila exclusiva do servidor. `anon` e `authenticated` não têm INSERT/UPDATE direto. RPCs de persistência, processamento e merge são exclusivas de `service_role`; verificam usuário/empresa/fonte. Correção exige versão atual; merge exige proprietário.

Verificação no Supabase: as cinco tabelas retornaram `rls=true`, `client_insert=false`, `client_update=false`.

Compatibilidade: tabelas antigas e `commit_seed_turn_v94` permanecem disponíveis. `commit_seed_turn_v95` delega à 9.4 e acrescenta outbox transacional para documento. Para reverter o aplicativo, publicar a versão anterior e preservar as tabelas novas; não executar DROP como rollback de rotina. Remover dados exige avaliação específica.

## Data model e sources of truth

```text
companies (existente)
  └─ business_entities (identidades por tenant)
       ├─ produto/serviço, oferta, segmento, canal
       ├─ processo/etapa/jornada, equipe/papel
       ├─ operação/capacidade/custo/receita
       ├─ local/fornecedor/mercado/restrição
       ├─ referência a GOAL/METRIC existente
       ├─ business_observations (atual + histórico)
       └─ business_relationships (relações + histórico)
```

| Informação | Fonte autoritativa |
|---|---|
| Company e preferências de mercado | `companies`; fatos empresariais existentes em `business_memories` |
| Produtos, ofertas, canais e demais entidades novas | `business_entities` + `business_observations` |
| Goals | `business_memories` de tipo GOAL |
| Metrics informadas | `business_memories` / `business_journal_entries`; atributos numéricos estruturais novos em `business_observations` |
| Planos e ações | `strategies`, `actions` |
| Decisões e experimentos | `decisions`, `experiments` |
| Resultados e aprendizados | `execution_results`, `execution_learnings` |
| Relações estruturais | `business_relationships`; FKs de execução continuam autoritativas |
| Estado atual | Observação `is_current`; identidade/situação da entidade; fontes externas referenciadas lidas novamente |
| Histórico | Observações anteriores, validade das relações, eventos e históricos já existentes |

Um atributo com `memory_id` é projeção tipada da memória, não autoridade independente: alteração da fonte invalida a projeção; correção pela nova interface atualiza memória e projeção atomicamente. A recuperação omite a cópia textual já coberta por uma projeção confirmada. Referências a Company/Goal/Metric não aceitam novas observações copiadas.

## Entidades e relações

Taxonomia inicial: COMPANY, PRODUCT_SERVICE, OFFER, CUSTOMER_SEGMENT, CHANNEL, SALES_PROCESS, SALES_STAGE, TEAM, TEAM_ROLE, OPERATION, CAPACITY, COST_STRUCTURE, REVENUE_STREAM, LOCATION, SUPPLIER, GOAL, CONSTRAINT, METRIC, MARKET, CUSTOMER_JOURNEY.

Tipos opcionais como BRAND/ASSET não foram criados sem necessidade. Relações: SELLS, TARGETS, PROMOTES, GENERATES, USES, OPERATES, CONSUMES, DELIVERS, DEPENDS_ON, LIMITS, SERVES, PARTICIPATES_IN, NEXT, HAS, MEASURES. A matriz fica em `domain.ts` e é repetida por guarda SQL; pares semanticamente inválidos são rejeitados. FKs compostas impedem ligações entre tenants. Dependência estrutural não é prova causal.

## Current state, history, fontes e confiança

Cada observação inclui origem, mensagem ou memória, evidência literal, conhecimento, confiança LOW/MEDIUM/HIGH, escopo da entidade, período quando conhecido, observação/validade e operação NEW/CHANGE/CORRECTION. Nomes de entidades e relações também preservam evidência e mensagem de origem.

Mudança explícita mais recente pode encerrar a versão atual e criar outra. Uma asserção NEW conflitante fica registrada e marca conflito, sem substituir silenciosamente o valor. Informação mais antiga não vence a atual; inferência não vence fato confirmado. Correção manual usa MANUAL_EDIT, guarda o anterior e exige versão atual.

Documentos suportados pelo app (TXT/Markdown/CSV) usam DOCUMENT, ficam provisórios e não substituem observações atuais confirmadas. PDF/imagens/Office continuam fora das capacidades existentes. Referências a importação/integração/EXTERNAL estão preparadas na origem; nenhuma pesquisa externa é executada.

## Approximation / range

Valores têm número ou limites mínimo/máximo, unidade, moeda ISO quando monetários e indicação de aproximação. Não existe midpoint automático. Zero precisa ser informado; desconhecido permanece null. Valores e datas precisam de suporte na evidência. A interface mantém ≈ e intervalos. Cálculos da Reliability preservam a aproximação; uma faixa não se transforma em operando pontual.

## Entity resolution, conflitos e consistência

Chave por empresa/tipo/nome normalizado, ou referência canônica à entidade existente. Aliases explícitos Meta Ads/Facebook Ads/Anúncios da Meta e Whats/WhatsApp são normalizados; Meta sem contexto e Instagram orgânico não são fundidos em anúncios.

Merge interno, exclusivo do proprietário, mantém IDs antigos, histórico, evidências e audit trail, redirecionando relações. Conflitos de atributos permanecem visíveis internamente. Split não é automático: novas identidades podem coexistir e a antiga permanece histórica; não há interface de ontologia.

Consistência numérica compara somente escopo, empresa, período e unidades compatíveis. Conversão, ticket e utilização são derivados por código, com inputs/versões/fórmula/data. Uma conversão informada de 35% não é reescrita para 20%: a contradição é identificada. O restante de uma partição explícita na mesma mensagem pode ser calculado (100 − 40 − 35 = 25), preservando aproximação e SYSTEM_DERIVED. Resultados derivados são calculados na leitura; não são uma segunda série de métricas persistidas.

## Coverage e staleness

Domínios: COMPANY, OFFER, CUSTOMERS, ACQUISITION, SALES, OPERATIONS, FINANCE, TEAM, GOALS. Estados UNKNOWN/LIMITED/PARTIAL/SUFFICIENT/STRONG, sem porcentagem ou nota de maturidade.

Regras em `context.ts`: ausência de dados é UNKNOWN; dados insuficientes ou sem observações confirmadas são LIMITED; requisitos incompletos ou aproximados são PARTIAL; requisitos confirmados da classe de análise são SUFFICIENT. STRONG exige também pelo menos duas observações históricas comparáveis de alta confiança. Finance sem custo ou margem permanece LIMITED, mesmo conhecendo receita. Cobertura sempre descreve o recorte recuperado, não toda a empresa.

Atualidade: preço/custo/margem/métricas comerciais 90 dias, caixa 30, capacidade/equipe 180; descrições estáveis não expiram automaticamente. STALE solicita cuidado/atualização; não apaga o dado. Reliability desconsidera provisórios, conflitantes, históricos e desatualizados como fatos atuais suficientes. Custos/margem/preço sem número não satisfazem decisões financeiras materiais.

## Builder, filas e idempotência

```text
mensagem → transação de chat/memória/outbox
 → extração agrupada do diário + modelo (uma chamada Economy)
 → validação de schemas/fontes/escopo/números/relações
 → payload durável → diário confirmado → fila do modelo
 → transação de entidades/observações/relações/histórico
```

Reprocessamento usa mensagem + versão do schema, identidades canônicas, unicidade de atuais e transação. Fonte ou relação inválida desfaz toda a aplicação daquele payload. Erro de validação do modelo não descarta extração válida do diário: candidato e erro ficam guardados para até quatro revalidações sem nova chamada paga. Chamadas incertas de provider mantêm a política anterior de não repetir cobrança automaticamente.

`after()` aguarda o worker inicial; o cron autenticado existente drena filas e retries. Não há fire-and-forget. Logs técnicos usam códigos/IDs, não texto empresarial. Eventos estruturais existem para auditoria, sem Radar ou notificações novas.

## Context Resolver e integrações

`resolveBusinessContext` autentica membership no servidor, identifica domínios por pergunta e busca entidades mencionadas, objetivos/restrições e dados estruturais relevantes. Consultas são filtradas/paginadas, não carregam o grafo inteiro. O prompt recebe no máximo 16 identidades selecionadas, observações/relações cabíveis em 10.000 caracteres e histórico curto. O resolver retorna cobertura, lacunas e conflitos.

Company/Goals são lidos novamente da fonte; métricas do diário viram projeções de leitura preservando canal/produto/local/período. Planos/resultados/learnings continuam sendo recuperados pelo contexto de execução da 9.4. Não há cópia de recomendações para fatos estruturais nem promoção automática de um único resultado em verdade causal.

A memória, o diário e o contexto de execução continuam acompanhando o subgrafo no Orchestrator. SEED Brain interpreta; Reliability valida evidência/suficiência; o modelo empresarial não decide, cria planos ou substitui o ciclo de execução.

Exemplo interno para “Vale aumentar anúncios?”:

```text
canal: Instagram (se informado)
fluxo: Instagram → WhatsApp (se informado)
operação: cozinha
capacidade: aproximadamente 80 encomendas/dia
margem: desconhecida
meta: fonte GOAL existente, se houver
limites: somente os efetivamente informados
missingInformation: custo/margem e demais lacunas do recorte
```

Nenhum histórico privado de outra empresa contribui para essa resposta. Não há chain-of-thought armazenado/exibido.

## Minha Empresa e APIs

`BusinessModelPanel` organiza as seções úteis: negócio, produtos/ofertas, clientes, aquisição, vendas, entrega, equipe, números, objetivos/limites. Não mostra IDs, grafo, ontologia ou score. Memória textual existente fica acessível em detalhes. Não há item novo na sidebar.

Server Actions: `readBusinessModel` (20 entidades/página, resposta sanitizada), `correctBusinessObservation` (campos tipados/versão/membership) e `businessHistory` (20 registros/página). Serviços internos: builder, normalizador, resolução, cobertura, consistência e worker. Nenhum endpoint público adicional para resolver contexto.

## RLS, segurança e privacidade

Membership é verificado em cada action/service; dados do frontend não determinam acesso. Constraints e FKs compostas impedem vínculos entre empresas. Chaves continuam exclusivamente no servidor. IA não recebe acesso ao banco. Não é construída base de indivíduos/clientes/funcionários.

Descontinuação encerra relações atuais sem apagar história. Remoção de memória invalida/retira a projeção atual. Exclusão definitiva de empresa usa cascatas existentes; não foi acrescentada uma nova política jurídica de retenção nem uma interface de exclusão em massa. A necessidade de exclusão definitiva não deve ser substituída por soft delete indiscriminado.

## Internationalization

Interface pt-BR, pt-PT, en-US e es-ES. Números/moedas/datas formatados com Intl. Valores monetários usam número + código ISO; não há câmbio automático. Fontes e escopos permanecem separados. Datas de documento desconhecidas não viram atuais; o processamento do diário continua usando timezone da empresa.

## Model Router, AI usage e custo

A extração simples usa o roteamento Economy já existente. Análise estratégica continua no fluxo Strategic/por materialidade existente. Inferência estrutural fica provisória, sem uma chamada Strategic separada apenas para “completar” o modelo.

Custo da chamada compartilhada permanece em BUSINESS_JOURNAL_EXTRACTION e é identificado também por `router_decision.business_model_feature=BUSINESS_MODEL_EXTRACTION`. Não há dupla cobrança fictícia da mesma resposta. Entity resolution, context resolution e consistency determinísticos não geram chamadas de IA nem custo de provider. O teste ao vivo consumiu US$ 0,300145925 estimados, incluindo tentativas rejeitadas: 9 classificações, 8 análises e 5 extrações compartilhadas (22 chamadas). Não é uma estimativa de custo mensal por usuário.

## Testes e validação técnica

- Última suíte completa: 195 testes aprovados, incluindo regressões anteriores.
- Testes dedicados PostgreSQL/PGlite: aplicação, idempotência, histórico 4→5→7, correção, inferência, documentos antigos, descontinuação, merge e RLS.
- Unitários: taxonomia/relações, aliases, evidência literal, aproximações/faixas, moedas, atualidade, cobertura, conversão, restante de receita, diferentes negócios e orçamento de contexto com 240 registros.
- Lint: aprovado na última execução.
- Typecheck/build: aprovados; o build do estado final também passou na Vercel.
- Supabase: migração aplicada e permissões efetivas auditadas.
- Interface publicada e fluxo principal com IA real: aprovados nos cenários descritos em “Teste real”.

## Performance

Sem chamada de IA em abertura de tela. Consultas em lote, paginação de 20 entidades e teto de observações; sem consulta individual por entidade. Recuperação estruturada limitada e índices alinhados a tenant/tipo/situação/relação. O teste com 240 registros valida orçamento e filtro, não é benchmark de carga de produção nem promessa de latência.

## Exemplo fictício

Padaria de teste: salão, balcão e encomendas como fontes de receita; participações aproximadas 40%, 35% e restante derivado 25%; Instagram e WhatsApp em etapas diferentes; cozinha como operação; capacidade observada aproximada de 80 encomendas/dia; restrição operacional como hipótese. A margem desconhecida permanece desconhecida. Esse exemplo está nos testes, não é dado de cliente real.

## Capability table

| Capability | Status | Source of Truth | Tested | Notes |
|---|---|---|---|---|
| Company | Reutilizada | companies | Banco | Referência, não cópia de perfil |
| Products/Services | Implementada | entities/observations | Banco | Preço, situação, histórico |
| Offers | Representável | entities/observations | Contrato | Separada do produto |
| Customer Segments | Representável | entities | Contrato | Sem cadastro de indivíduos |
| Channels | Implementada | entities | Unitário/banco | Aliases conservadores |
| Sales Process | Representável | entities/relationships | Matriz | Sem CRM obrigatório |
| Team | Implementada | entities/observations | Banco | Correção e mudança distintas |
| Operations | Representável | entities/relationships | Contrato/matriz | Não é ERP |
| Capacity | Implementada | observations | Unitário | Aproximação preservada |
| Costs | Implementada | observations/fontes existentes | Contrato | Moeda explícita |
| Revenue Streams | Implementada | entities/observations | Unitário | Restante derivado |
| Goals | Reutilizada | business_memories | Referências | Sem antecipar fase 10 |
| Constraints | Representável | memória/entidades | Matriz | Inferência provisória |
| Metrics | Reutilizada/estruturada | diário/memória/observações | Unitário/banco | Escopo e período |
| Relationships | Implementada | relationships | Banco | Matriz + FKs compostas |
| Current State | Implementada | observations | Banco | Unicidade |
| History | Implementada | observations/events | Banco | Sem cópia diária do banco |
| Sources | Implementada | mensagens/memória/documento | Banco | Proveniência |
| Confidence | Implementada | LOW/MEDIUM/HIGH | Unitário | Não é chance de sucesso |
| Coverage | Implementada | regras determinísticas | Unitário | Contextual |
| Context Resolver | Implementado | consultas filtradas | Unitário + IA real | Conversa nova recuperou preço, equipe e capacidade |
| RLS | Implementada | membership/policies | Banco + Supabase | Escrita direta negada |
| Internationalization | Implementada | locale/Intl | Compilação | Revisão visual pendente |

## Limitações, riscos e dívida técnica

- Extração semântica pode omitir estrutura ou produzir registros inválidos. Identidade/schema inválidos rejeitam o lote; observações/relações inválidas são isoladas, mantendo o candidato original e BUSINESS_PARTIAL_REVIEW_REQUIRED para auditoria. Registros independentes válidos são persistidos atomicamente. Não há garantia de compreensão perfeita nem tela administrativa de revisão desses candidatos nesta fase.
- Não há backfill pago automático de todas as conversas anteriores. O modelo cresce com novas interações e referências já disponíveis.
- Aliases ambíguos e distinções entre contas/campanhas exigem nomes contextualizados; não existe fusão por similaridade livre.
- Não há split automático, visualizador de grafo, importador de ERP, CRM, simulador ou radar.
- A seleção multilíngue de domínios é determinística e limitada; perguntas vagas podem exigir recorte mais amplo e deixar itens fora do orçamento.
- Regras TS/SQL de relações precisam evoluir juntas. A matriz é pequena, explícita e testada.
- Alguns atributos estruturais são novos; projeções ligadas à memória ficam desatualizadas após edição textual até nova interpretação/validação. Nunca são apresentadas como certeza atual durante esse intervalo.
- O recurso depende do processamento do diário habilitado (`SEED_JOURNAL_ENABLED=true`), como o ciclo anterior. Falhas/limites financeiros podem atrasar o enriquecimento secundário.
- Maior schema/contexto de extração aumenta tokens por chamada compartilhada; limites comerciais permanecem aplicados. Custo por feature combinada não é decomposição exata entre diário e modelo.
- Consultas limitadas protegem custo/memória, mas não substituem um teste de carga com milhares de entidades reais.
- Privacidade exige operação cuidadosa de exportação/exclusão/retenção; esta fase não certifica conformidade jurídica.

## Readiness 9.6 / 9.7 / 9.8

9.6: entidades, dependências, restrições, capacidade, custos e lacunas são consultáveis; ainda não existe motor de cenários. Validar o fluxo real da 9.5 antes de liberar.

9.7: eventos/histórico permitem detectar mudanças futuramente; não há alertas autônomos.

9.8: tipos de origem permitem separar conhecimento interno e externo; não há pesquisa web ou aprendizado entre empresas.

## Manual validation

Em empresa claramente fictícia, conversar sobre negócio, produtos, canais e capacidade. Aguardar o processamento secundário e abrir Minha Empresa. Conferir se apenas informações relatadas aparecem. Corrigir um número e confirmar preservação do histórico. Informar produto descontinuado e conferir relações atuais. Abrir nova conversa e perguntar sobre anúncios: dados de capacidade devem ser recuperados; custo/margem ausentes devem motivar esclarecimento. Trocar de empresa e confirmar isolamento. Reabrir a tela sem conversar e verificar que nenhum novo uso de IA foi criado.

O teste real foi autorizado expressamente para até 2 horas, 15 análises e US$1 adicional. Usou 8 análises e aproximadamente US$0,30. A concessão temporária foi revogada ao terminar; a conta voltou ao FREE e à concessão anterior, com contador anterior de 2 análises preservado. Os custos não foram apagados. Não iniciar a próxima fase.

### Verificação operacional em 06/10/2026

- Migração aplicada no Supabase; RLS confirmado nas cinco tabelas novas, sem INSERT/UPDATE direto para authenticated.
- Interface autenticada local e publicada verificadas: estado vazio, modelo preenchido, edição e recuperação em conversa nova.
- Evidência visual local: `.test-build/phase-9-5-company.png`.
- Publicação final com correções: `dpl_HZidFZYXwNsxuvKRt34FQt4CZEJb`, READY, URL de deployment https://seed-aunoefi6f-joao13jgc-5689.vercel.app.
- Endereço público atualizado: https://seed-ai-ashy.vercel.app. Build de produção aprovado na Vercel.
- Fluxo principal da fase validado em produção com fixture identificada; nenhum avanço para outra fase.

## Teste real em 06/10/2026

Foi reutilizada a empresa já identificada como TESTE FICTÍCIO — Fase 9.3. O limite comercial impediu criar outra empresa e foi respeitado. Ela não possuía memória/modelo estrutural, mas mantinha um plano fictício anterior; esse plano continuou sendo recuperado, como esperado. Nenhum dado da empresa real foi enviado neste teste.

Resultados verificados pela interface e por consultas ao banco:

- Produto Caixa Aurora a R$199, equipe de 4 pessoas e capacidade aproximada de 80 caixas/dia extraídos.
- Correção manual 4→5 preservou histórico, sem chamada de IA. Mudança relatada 5→7 e preço 199→249 mantiveram versões anteriores.
- Conversa nova recuperou R$249, 7 pessoas e aproximadamente 80 caixas/dia; margem permaneceu desconhecida.
- Catálogo histórico/fictício a R$100 não substituiu o preço atual. A resposta explicitou a diferença de fonte; o documento não foi tratado como nova afirmação confirmada. A regra SQL de documento antigo foi testada separadamente em PostgreSQL.
- Nova atualização pela conversa foi processada automaticamente: Caixa Aurora descontinuada, relações atuais encerradas, Caixa Horizonte a R$259 e capacidade como intervalo 90–100, sem ponto médio inventado.
- Dez entidades, nove observações (incluindo histórico) e cinco jobs do modelo concluídos.
- Empresa real permaneceu sem entidades do teste; leitura anônima negada. Isolamento entre usuários também coberto nos testes de RLS em PostgreSQL.
- Abrir/editar Minha Empresa não gerou chamadas de IA. Custos de todas as chamadas ficaram associados somente à empresa fictícia.

### Falhas encontradas e correções

1. Uma observação sobre referência de Company e duas relações inválidas rejeitavam dados independentes válidos. Adicionado processamento parcial conservador, com retenção integral do candidato para auditoria; nenhum vínculo inválido foi aceito.
2. O modelo omitiu versões de entidades existentes. Versão ausente agora é vinculada pelo servidor à identidade exata do snapshot; versão explicitamente desatualizada ou identidade externa continuam rejeitadas.
3. Três tentativas do documento foram rejeitadas pela validação do diagnóstico, sem persistência. Adicionado estágio seguro aos logs e tratamento conservador de confiança excessiva em consulta factual; o diagnóstico não precisa inventar gargalo para uma consulta de preço. A confiança é reduzida; evidência, schema e permissões continuam obrigatórios. O teste passou após a correção.
4. Texto vazio da memória antiga aparecia sob modelo preenchido. Texto movido para dentro da seção de memória correspondente.
5. O teto temporário inicialmente somava custos anteriores ao limite de US$1. Corrigido exclusivamente o baseline da concessão temporária para exatamente US$1 adicional autorizado, sem ampliar prazo nem quantidade. Houve um bloqueio preventivo antes de nova análise.

Os dois primeiros payloads foram reprocessados com o mesmo validador corrigido, sem novas chamadas pagas. Os turnos posteriores percorreram o worker automaticamente. As falhas iniciais e seus custos fazem parte do resultado; não foi uma execução sem erros.

Evidências locais ignoradas pelo Git: business-model-live-result.json, business-model-live-evidence.json, business-model-live-allowance.json e phase-9-5-live-company.png em .test-build. A screenshot contém exclusivamente a empresa fictícia.

### Limites desta validação

IA real exercitada em pt-BR e BRL, na empresa de teste da conta autorizada. Outros idiomas, moedas, tipos de negócio, conflitos, merge e regras matemáticas foram cobertos por contratos/testes automatizados; não foram todos repetidos com chamadas reais. A revisão linguística profissional e teste de carga permanecem fora desta validação.

## Arquivos principais desta conclusão

- src/lib/business-model/domain.ts e server.ts: validação conservadora por registro e vínculo de versão controlado pelo servidor.
- src/lib/journal/server.ts: persistência dos registros aceitos e candidatos rejeitados, sem repetir chamadas pagas.
- src/lib/diagnosis/contracts.ts e src/lib/openai/pipeline.ts: redução de confiança excessiva e logs por etapa sem conteúdo privado.
- src/components/seed-workspace.tsx: mensagem de estado vazio restrita à seção correspondente.
- tests/business-model-partial.test.ts e tests/diagnosis.test.ts: regressões das falhas encontradas.
- README.md e este relatório: estado final e evidências.

## Como conferir sem consumir IA

Abra /companies na aplicação publicada, selecione TESTE FICTÍCIO — Fase 9.3 e abra Minha Empresa. Confira Caixa Aurora descontinuada, Caixa Horizonte a R$259, capacidade 90–100 e equipe de 7 pessoas. Ao terminar, volte à empresa original. As conversas de validação ficam no histórico da empresa fictícia; abrir essas telas não gera novas chamadas. A conta voltou às permissões anteriores, portanto o PRO de teste não permanece liberado.
