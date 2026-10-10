# Fase 11 — SEED Growth Map

Status: Fase 11 concluída, publicada e aceita pelo titular em 09/10/2026 após a conferência visual (“perfeito, vamos continuar”). Duas migrações e verificações técnicas aprovadas. Especificação integral lida em 09/10/2026: `SEED_AI_FASE_11_COMPLETA.md`, 193 seções. Limitações de cobertura visual documentadas abaixo. Fase 12 fora do escopo desta entrega.

## Arquitetura inspecionada e decisões

| Responsabilidade | Fonte existente / integração |
|---|---|
| Goals/Metrics e cálculos | `lib/goals`: identidade da memória, Journal e adapters; nenhuma tabela de métricas nova |
| Estrutura, grafo e cobertura | `lib/business-model`: entidades, observações, relações, `budgetContext`, `coverage` e `consistency` |
| Confiabilidade | `lib/reliability`: Evidence/KnowledgeType, Confidence e Sufficiency compartilhados |
| Diagnóstico e recomendações | `lib/diagnosis`, `lib/openai/request`, orquestrador e `recommendationFromDiagnosis`; mapa fornece evidência derivada, não cria outro diagnóstico |
| Execução | `lib/execution`, strategies/actions/decisions/experiments/results/learnings; leitura de referências, sem criação automática |
| Weekly Intelligence | `lib/journal`: contexto do foco e mudança, sem repetir as seis dimensões |
| Simulador | `lib/simulation`: contexto recebido pelo fluxo estratégico existente |
| Radar | `lib/radar`: reutilizar sinais e fontes; nenhum alerta duplicado por snapshot |
| Pesquisa externa | `lib/external`: evidência externa identificada; não vira métrica interna nem benchmark universal |
| Memória e histórico empresarial | `business_memories`, `business_journal_entries`; correção/exclusão invalida derivados |
| Router/custo | `commercial/model-router` e `metering`: interpretação na conversa existente; abrir/calcular mapa não chama IA |
| Auth/RLS | `companyContext`, membership no serviço e RLS em snapshots/fila/eventos |
| Idioma, moeda e fuso | i18n existente, valores canônicos, `businessDay`; sem FX implícito |
| UI | seção em Diagnóstico, foco compacto opcional na Home/Plano, sidebar preservada |
| Jobs/eventos | mesmo agendador `/api/internal/journal` e `after()`; fila derivada com lease/idempotência; eventos técnicos sem payload empresarial |

O mapa usa regras versionadas de suficiência, tendência e comparação com metas/histórico. Snapshot representa uma avaliação, não uma nova fonte de fatos. Estados, tendência, confiança, aplicabilidade e oportunidade são independentes. Capacidade, caixa, equipe, qualidade e dependência do proprietário são proteções contextuais.

Testes determinísticos e de isolamento passaram antes da aplicação das migrações. O resultado foi publicado com autorização explícita do titular. O aceite visual foi fornecido pelo titular; não representa inspeção automatizada de todos os dispositivos.

## RESUMO

Growth Map integrado ao Diagnóstico, com seis dimensões, regras determinísticas, histórico, evidências, filtros, atualização protegida e continuação na conversa. Sem novas dependências ou serviços. A interpretação real foi validada em 09/10/2026: US$0,02731805, nenhuma cobrança desconhecida e PRO temporário revogado. Fase12 não iniciada.

## ARQUIVOS PRINCIPAIS

- `src/lib/growth/{domain,registry,engine,context,radar,labels,server}.ts`: contratos, regras, avaliações, contexto e persistência.
- `src/components/growth-map.tsx`, `src/components/seed-workspace.tsx`, `src/app/globals.css` e `src/app/page.tsx`: mapa, detalhes e integração na interface.
- `src/app/growth/actions.ts`: operações autenticadas do mapa e histórico.
- `src/lib/seed/orchestrator.ts`, módulos existentes de Journal, Radar, OpenAI e metering, e `src/app/api/internal/journal/route.ts`: contexto, interpretação medida e atualização automática.
- `src/lib/goals/{calculation,ingestion,labels}.ts`: catálogo e preservação da qualidade das métricas derivadas.
- `supabase/migrations/202610090003_growth_map.sql` e `202610090004_growth_privacy_integrity.sql`: armazenamento derivado, isolamento e integridade.
- `tests/growth.test.ts`, `tests/growth-integration.test.ts`, `tests/growth-database.test.mjs`, `tests/goals.test.ts` e `scripts/verify-growth-live.mjs`: regras, regressões, banco e validação real.
- `.env.example`, `README.md` e este relatório: configuração, execução e estado de entrega.

## ARQUITETURA ENCONTRADA

A tabela inicial registra os componentes reutilizados. Dados numéricos continuam vindo de Goals/Metrics, Journal, Business Model e adapters de resultados. O mapa não contém um novo livro de métricas, motor de diagnóstico, motor de planos ou sistema de alertas.

## DECISÕES ARQUITETURAIS

Módulo lib/growth separado em domain, registry, engine, context, radar, labels e server. Motor puro testa apenas regras. Serviços autenticados consultam fontes, executam o motor e persistem seu resultado. UI recebe um snapshot armazenado. Interpretação usa a chamada estratégica existente. Eventos numéricos são o motivo de reavaliação; uma saudação não chama outro modelo nem gera nova pontuação.

## MIGRATIONS

| Migração | Finalidade | Estado |
|---|---|---|
| 202610090003_growth_map.sql | snapshots, solicitações com lease, eventos técnicos, view das dimensões, índices, RLS, invalidação e direito growth_map nos planos pagos | Aplicada pelo titular e verificada via API real |
| 202610090004_growth_privacy_integrity.sql | Corrige duas FKs anteriores que bloqueavam a exclusão de empresas com metas/indicadores | Aplicada pelo titular; exclusão e cascatas verificadas no Supabase real |

Nenhum preço, assinatura, orçamento ou chave foi alterado. A segunda migração permite remover links derivados ao excluir sua definição, e preserva o registro canônico de uma observação quando apenas sua definição é removida. Ao excluir a empresa, o conjunto de dados da empresa é removido pelas cascatas existentes. Não há nova permissão de escrita para clientes.

Após a aplicação, duas empresas fictícias das tentativas sem consumo de IA foram removidas; ausência de registros dependentes confirmada nas sete tabelas verificadas. A empresa fictícia do teste pago permanece para auditoria financeira. A revogação do PRO temporário foi reconfirmada diretamente no banco.

Rollback funcional: desligar SEED_GROWTH_MAP_ENABLED. Preservar tabelas e histórico; não é necessário apagar dados para voltar à experiência anterior.

## DATA MODEL

- growth_map_requests: empresa, solicitante, contexto de objetivo/escopo, geração pendente/processada, estado, lease, tentativas, próxima execução e limite de atualização manual.
- growth_map_snapshots: avaliação derivada, escopo, objetivo, período, versões de schema/regras, hash da entrada/avaliação, fontes e data. O payload de cada avaliação não é reescrito; o estado de validade pode mudar.
- growth_dimension_assessments: view security_invoker sobre o JSON, não outra cópia das dimensões.
- growth_map_events: latência, código de falha/reuso/conclusão, versão de regras e número de chamadas de IA. Sem textos de conversa ou secrets.

Índices incluem histórico por empresa/objetivo/escopo/data, fontes JSON e solicitações pendentes. O serviço usa limites de leitura e sinaliza histórico parcial.

## DIMENSIONS

| Dimensão | Definições principais disponíveis |
|---|---|
| Acquisition | leads, oportunidades qualificadas, visitantes, novos clientes |
| Conversion | vendas/leads, propostas fechadas, visitantes que compram, agendamentos |
| Ticket | receita/venda, valor por contrato, receita por usuário ativo |
| Frequency | transações por cliente ativo, com período definido |
| Retention | retenção, churn, renovação, recompra com população elegível |
| Margin | bruta, contribuição, operacional ou líquida, sem misturar conceitos |

## APPLICABILITY

Declarações confirmadas do modelo e escopo informado orientam a aplicabilidade. Compra única explicitamente sem recorrência pode tornar frequência/retenção não aplicáveis. Ausência de registro não significa não aplicável. Descrições de um único produto não são automaticamente atribuídas à empresa inteira. Modelos mistos ou conflitantes mantêm incerteza. Sem extração adicional pela OpenAI.

## STATUS

Estados separados de tendência: UNKNOWN, NOT_APPLICABLE, INSUFFICIENT_DATA, STABLE, HEALTHY, ATTENTION, CONSTRAINING, OPPORTUNITY. O estado geral é READY ou LIMITED; SUPERSEDED identifica snapshot antigo. HEALTHY precisa de referência ao objetivo; um valor isolado não ganha essa classificação.

## TRENDS

IMPROVING, STABLE, DETERIORATING, VOLATILE e UNKNOWN. Exige dois períodos completos adjacentes; três podem revelar inversão de direção. Unidade, definição, moeda e escopo precisam coincidir. Tolerâncias de comparação: 5% relativo ou1ponto percentual para taxas. Essas tolerâncias são regras internas versionadas, não ideais de mercado ou significância estatística. Direção explicitamente definida na meta prevalece sobre a direção padrão do indicador.

## SUFFICIENCY

SUFFICIENT, PARTIALLY_SUFFICIENT ou INSUFFICIENT, reutilizando o contrato de confiabilidade. História insuficiente, dados antigos, baixa confiança, observação parcial, conflito e limites de consulta reduzem a suficiência. Taxas de conversão/retenção precisam da população de referência apropriada; 30 casos é um limiar cautelar explícito, não uma garantia estatística.

## CONFIDENCE

LOW, MEDIUM, HIGH. Confiança de uma métrica derivada não promove um insumo LOW. Aproximação e intervalos reduzem a confiança; nenhum ponto médio é criado. Confiança expressa suporte dentro das informações disponíveis, não auditoria contábil, significância estatística ou probabilidade de sucesso.

## METRIC MAPPING

Registry separa PRIMARY, SUPPORTING, GUARDRAIL e CONTEXT. Acrescentadas definições e nomes localizados ao catálogo existente de Goals/Metrics. Fórmulas continuam no módulo de cálculos existente, com as mesmas fontes canônicas e rastreabilidade.

## PRIMARY METRIC RESOLUTION

Primeiro, métrica explícita do objetivo selecionado; depois, vínculo primário ou objetivo único compatível; definição coerente com assinatura; por fim, uma única definição disponível. Havendo mais de uma definição possível, a interface pede esclarecimento em vez de escolher arbitrariamente. Margens nunca são intercambiáveis.

## RULE ENGINE

Datas usam o dia da empresa. Valores externos não entram como desempenho interno. Valores ausentes não são zero. Períodos incompletos, moedas diferentes e unidades incompatíveis não são somados. Aritmética permanece no software; a IA interpreta. Uma correção numérica também eliminou ruído binário em casos como21/150×100, sem alterar a fórmula de conversão.

## RULE REGISTRY

Versão11.0.0; schema1 e summary1. Regras rastreáveis: disponibilidade, aplicabilidade, períodos comparáveis, tendência interna, comparação com objetivo, foco relacionado ao objetivo e capacidade informada. Sem thresholds universais de conversão/margem, ranking0–100 ou previsão de faturamento.

## SNAPSHOTS

Hash determinístico identifica o resultado/contexto de entrada e versões. Repetição no mesmo contexto reutiliza o payload. Mudanças relevantes nas fontes invalidam o mapa. Lease de90segundos, até4tentativas, backoff e controle de geração impedem publicar cálculo baseado em leitura que mudou durante o processamento. Revisão diária trata envelhecimento dos dados. O worker existente drena os trabalhos; não foi criado outro agendador.

## EVIDENCE

Cada dimensão mantém fontes com tabela, identificador, versão e categoria; valores têm período, unidade, moeda e intervalo. Referências a entidades e memórias de origem permitem invalidar/remover derivados após exclusão. Histórico de correção é diferente de exclusão por privacidade. O usuário corrige a origem em Minha Empresa; não pode editar um estado do mapa diretamente.

## BOTTLENECK RESOLVER

Só promove um foco sustentado por informações comparáveis e objetivo. Empates não são resolvidos com pontuação inventada. Sem objetivo, o mapa ainda mostra tendências e lacunas, mas não força prioridade única. Objetivos em conflito, períodos diferentes, volatilidade ou consulta limitada impedem uma conclusão forte. O foco é uma inferência para investigação, nunca causalidade demonstrada.

## GUARDRAILS

Capacidade declarada, margem, limites explícitos de objetivos, caixa, equipe, qualidade, restrições e dependência do proprietário. Uma restrição relatada mantém categoria contextual; não vira um número calculado. Proteções do objetivo são verificadas mesmo sem o resultado do indicador principal. Pressão posterior conhecida impede promover aquisição como oportunidade/prioridade automática.

## GOAL INTEGRATION

Mesmo id da meta, mesmo escopo, alvo, prazos e cálculo da Fase10. Aprendizado não altera um alvo automaticamente. Objetivos futuros não são classificados como problema apenas porque o alvo ainda não foi atingido. Uma referência de trajetória exige dados comparáveis e continua sendo referência, não previsão.

## BUSINESS MODEL INTEGRATION

Observações confirmadas e entidades ativas sustentam aplicabilidade e restrições estruturais. Relações e contexto permanecem nas fontes existentes. Não há propagação causal automática de um grafo ou resolução universal de modelos de negócio; casos ambíguos solicitam definição explícita.

## DIAGNOSIS INTEGRATION

Seção após o diagnóstico, sem outra página principal. Continuar na conversa envia apenas o id do snapshot e a dimensão; o servidor valida empresa, validade e versões antes de carregar contexto. Uma conclusão do mapa chega como INFERENCE; métricas originais/derivadas têm linhas separadas METRIC/DERIVED_METRIC. A validação existente rejeita promoção da interpretação para fato.

## EXECUTION LOOP INTEGRATION

Resultados da execução usam o adapter existente de observações, preservando escopo de plano/experimento. Alterações de planos, ações, resultados e decisões invalidam a avaliação. A conversa pode continuar para os mecanismos atuais de estratégia, decisão e experimento; o clique no mapa não aceita nem executa ações automaticamente. Aprendizados continuam na memória e no contexto estratégico existente.

## RADAR INTEGRATION

O mapa anota os sinais existentes quando encontra a mesma métrica e as mesmas versões das evidências. Fingerprint, volume de alertas, cooldown e critérios de relevância são preservados. Não cria um alerta paralelo para cada snapshot, nem um ciclo de invalidação entre dois derivados. Foco novo pode ser discutido na conversa; regras novas de alerta fora das existentes ficam fora deste MVP.

## WEEKLY INTELLIGENCE INTEGRATION

Contexto compacto do mapa entra na síntese existente. A instrução limita a um foco curto e exige fontes originais presentes no relatório; não permite repetir um sinal equivalente do Radar. A chamada compartilhada recebe GROWTH_MAP_SUMMARY na medição quando esse contexto é usado.

## EXTERNAL INTELLIGENCE INTEGRATION

Referências atuais relevantes são consultadas no livro de pesquisas existente, respeitando preferência e modo sensível. Não são copiadas para snapshots nem usadas para calcular desempenho. Sua expiração/exclusão é verificada na leitura; não há nova pesquisa ao abrir o mapa.

## UI / UX

Seis cartões, foco para investigar, restrições, filtros de objetivo/escopo, evidências progressivas e histórico paginado. Loading, erro, atualização pendente, mapa antigo e limite manual têm mensagens específicas. Sidebar preservada. Sem dashboard complexo, gráficos obrigatórios, gamificação ou nota global.

## MOBILE

Grade vira coluna abaixo de 640px; controles com área mínima de 44px e textos quebram sem largura fixa. Captura em largura estreita enviada pelo titular permitiu verificar a seção e o estado de plano sem acesso. Após a liberação temporária, o titular confirmou o visual. O runtime de navegador desta sessão falhou; não alegamos inspeção automatizada ou cobertura de todos os dispositivos.

## DESKTOP

Grade de duas colunas, filtros flexíveis e detalhes nativos. Foco visível, labels, estado de processamento e erros anunciáveis. Build compilado e aceite visual do titular registrado; não foi executada uma matriz manual independente de resoluções desktop.

## APIs / SERVICES

Server Actions readGrowth, refreshGrowth, readGrowthHistory e readGrowthDimension exigem companyContext. Serviços repetem membership, UUIDs e filtros. Histórico: páginas de20, objetivo, escopo e intervalo de datas. Refresh: entitlement growth_map e limite de60segundos por empresa, inclusive entre usuários/contextos. Worker valida novamente membership e entitlement.

## RLS / SECURITY

RLS de leitura nas três tabelas novas e view security_invoker. Escrita/RPCs somente service_role; autorização também no backend. FKs compostas para empresa, objetivo e solicitação. Testes comprovam: cliente comum não grava estado, outro tenant não lê, token de lease errado não conclui, remoção do membro bloqueia commit e alteração concorrente descarta avaliação. Credenciais ficam no servidor.

## I18N

pt-BR, pt-PT, en-US, es-ES, incluindo erros, estados e nomes de métricas. Intl formata números, datas e moeda; o armazenamento continua canônico. Não converte moeda conforme idioma nem mistura valores em moedas diferentes. Fuso da empresa determina o dia de avaliação.

## MODEL ROUTER

Nenhuma categoria de agente nova. Router existente faz classificação da conversa; a interpretação do mapa usa a resposta estratégica já medida. Applicability, cálculos, estados e desempate conservador são determinísticos. Não há chamadas independentes GROWTH_MAP_APPLICABILITY ou GROWTH_MAP_BOTTLENECK_RESOLUTION.

## AI USAGE / COST

Abrir, calcular, consultar histórico e corrigir o mapa: zero chamadas OpenAI. Perguntar à SEED usa os limites e preços internos existentes. Interpretação marcada GROWTH_MAP_SUMMARY em usage_logs, sem duplicar cobrança. Teste real: US$0,02731805 de gasto adicional; limite autorizado US$2 por até2h; nenhuma cobrança UNKNOWN. Plano temporário revogado ao final e saldo original preservado. Empresa fictícia com custo retida para auditoria.

## TESTS

Suíte completa inicial: 387 aprovados. Após os ajustes finais: 249 testes de regras/integrações aprovados; 9 verificações da migração/mapa/isolamento aprovadas, incluindo exclusão da empresa; 12 verificações de regressão do banco de metas aprovadas; 55 testes focados de metas e Growth Map aprovados. Dez verificações reais no Supabase/IA passaram. Os números se sobrepõem; não devem ser somados como testes distintos.

Cenários cobertos: seis dimensões, varejo, restaurante, consultoria/B2B, assinatura, agência, indústria, compra única, origem de produto, sem meta, empate, meta conflitante/ direção explícita, diferentes moedas/períodos/escopos, stale, valores conflitantes, aproximações, intervalos, amostras pequenas, baixa confiança, capacidade, oportunidade, reuso, concorrência, RLS, versões, correção, exclusão e custos.

## LINT

Aprovado. Nenhuma dependência ou regra de lint desabilitada.

## TYPECHECK

Aprovado. Compilações de teste e runtime da integração real também passaram.

## BUILD

Build final de produção aprovado após todos os ajustes. Compilação local em 30,4 segundos e checagem TypeScript em 34,3 segundos, com todas as rotas geradas. Inspeção de 27 arquivos estáticos comparados com cinco credenciais do servidor: nenhuma exposição encontrada. A compilação na Vercel também passou e o deployment está READY.

Versão compilada executada localmente: dez verificações HTTP aprovadas, sem chamadas de IA. Login responde normalmente; Home, empresas, estratégias, decisões, experimentos e cobrança encaminham visitantes ao login; administração retorna 404 para visitante; conversa e agendador retornam 401 sem autenticação.

Após a publicação: onze verificações HTTP aprovadas no domínio público, incluindo o endereço do Diagnóstico; treze arquivos estáticos carregados com sucesso. Os mesmos controles de acesso foram preservados. Essas verificações não substituem a inspeção visual com login e não consumiram IA.

## PERFORMANCE

Leituras limitadas:40metas,300registros do Journal,200observações estruturais e100resultados; exceder limites reduz a confiança. Uma avaliação por lease e cron existente. Busca de contexto evita carregar dados de controles da UI. Hash/reuso evita repetir snapshots sem mudança. Eventos registram latência; testes de carga com muitos tenants ainda não realizados. A interpretação real terminou em cerca17,4segundos, incluindo classificação/validação; não é SLA.

## LIMITAÇÕES

Não existe inferência universal do modelo de negócio. Estados dependem de registros explícitos, suas definições e comparabilidade. O mapa pode permanecer parcial. O limiar de 30 casos não substitui análise estatística. Duas observações não demonstram causalidade. Seleção de métricas é conservadora diante de ambiguidade. Sem agregação ponderada de múltiplas unidades, câmbio, forecasting avançado ou benchmark externo automático. O navegador de automação não inicializou; aceite visual fornecido pelo titular, sem alegação de inspeção automatizada da tela autenticada.

## TECHNICAL DEBT

Calibrar regras com uso real; medir distribuição de latência e volume de snapshots; definir retenção de eventos técnicos; ampliar testes visuais quando o runtime estiver disponível. História tem paginação por offset; não oferece exportação BI ou cursor estável sob inserções concorrentes. Mudanças de interpretação sem alteração factual não forçam um novo estado numérico. Mapa é apoio à decisão, não confirmação de resultado empresarial.

## FASE 12 READINESS

Snapshots, fontes e contexto podem alimentar uma futura home/cockpit. Nenhum componente de cockpit, nova métrica comercial ou feature da Fase12 foi criado. A evolução depende de autorização explícita.

## MANUAL VALIDATION

Revisada a resposta real: conversão de20% para14% citada como DERIVED_METRIC; foco do mapa como INFERENCE; causa desconhecida; uma pergunta sobre motivos de perda; nenhum aumento automático de anúncios. Serviço real validou leitura sem IA, limite de atualização, correção com reconstrução, histórico, custos e acesso anônimo.

A matriz de negócios/idiomas foi exercitada nos testes de regras, não por navegação manual em todos os dispositivos. O titular confirmou o visual da seção publicada após a liberação temporária. Roteiro disponível para regressão: entrar, abrir Diagnóstico, conferir seis cartões e detalhes, escolher objetivo/escopo, consultar histórico, corrigir origem em Minha Empresa e verificar atualização; conferir larguras de celular e desktop. O aceite do titular não comprova execução de todos esses passos. Em plano sem direito growth_map, registros existentes continuam legíveis e a geração informa a exigência do plano.

## TABELA FINAL DE CAPACIDADES

| Capacidade | Implementação | Validação / limite |
|---|---|---|
| Acquisition | Regras e definições distintas | Tendência, conflitos, proteção posterior |
| Conversion | Taxa específica + população | Cálculo e interpretação real |
| Ticket | Venda/contrato/usuário separados | Moeda, escopo, direção do objetivo |
| Frequency | Métrica por período | Unknown e modelo sem recorrência |
| Retention | Retenção/churn/renovação/recompra | Direção, população, assinatura |
| Margin | Quatro definições separadas | Guardrail mesmo sem resultado principal |
| Applicability | Conservadora, explícita | Não atribui produto à empresa inteira |
| Status/trend | Separados e versionados | Sem scores, empates não forçados |
| Sufficiency/confidence | Contrato existente | Amostra, atualidade e qualidade |
| Metric mapping | Catálogo existente ampliado | Ambiguidade pede definição |
| Bottleneck | Inferência ligada ao objetivo | Sem causalidade automática |
| Guardrails | Capacidade/margem/limites/contexto | Não inventa número de caixa/equipe |
| Goals | Identidade e cálculos da Fase10 | Testes antigos preservados |
| Snapshots/history | Cache imutável + estado de validade | Lease, reuso, correção, exclusão |
| Evidence | Referências versionadas | Distinção METRIC/DERIVED/INFERENCE |
| Diagnosis | Seção e continuação da conversa | Resposta real aprovada |
| Plan/Execution/Simulator | Contexto nos fluxos existentes | Nenhuma aceitação automática |
| Radar | Anota sinais existentes | Sem contagem/alerta duplicado |
| Weekly | Um foco na síntese compartilhada | Fontes originais, sem nova chamada |
| External | Referências atuais separadas | Não compõe desempenho ou score |
| UI | Cartões e detalhes progressivos | Build aprovado; visual aceito pelo titular |
| Mobile/desktop | CSS responsivo e semântica acessível | Sem alegação de inspeção não executada |
| API/services | Server Actions autenticadas | Empresa, versão, filtro e cooldown |
| RLS | Leitura por membership, escrita servidor | Banco local + anonimato real |
| I18n | Quatro idiomas | Labels e valores canônicos |
| Router/usage | Fluxo existente + GROWTH_MAP_SUMMARY | US$0,02731805 no teste real |
| Automatic refresh | Worker existente | Sem novo agendador/serviço |
| Privacy | Invalidação e cascatas | Correção complementar aplicada e validada no banco real |

## RISCOS

| Risco | Mitigação existente | Limitação aberta |
|---|---|---|
| Cálculo | Fórmulas determinísticas e testes, insumos rastreáveis | Aritmética de ponto flutuante e definições precisam de revisão contínua |
| Dados incompletos | Mapa parcial e campos ausentes explícitos | Nenhum sistema recupera dados que não foram registrados |
| Dados desatualizados | Janelas de atualidade, atualização diária, bloqueio de contexto antigo | Janelas devem ser calibradas por negócio |
| Premissas frágeis | Hipótese não vira fato; contexto identifica categoria | Declaração explícita pode estar errada |
| Falsa precisão | Sem score/probabilidade; intervalos preservados | Formatação arredonda apresentação, não elimina incerteza |
| Interpretação incorreta | Validação de evidência e pergunta focada | IA pode interpretar mal um contexto incompleto |
| Contexto insuficiente | Limites de consulta e confiança reduzida | Históricos extensos não são carregados integralmente |
| Scope mismatch | Comparação por tipo/id de escopo | Nomes legados sem id podem exigir correção |
| Period mismatch | Período completo e adjacente | Sem normalização automática de sazonalidade |
| Currency mismatch | Sem soma/conversão implícita | Sem serviço de câmbio |
| Dependências desconhecidas | Guardrails explícitos e cautela | Grafo parcial não prova capacidade disponível |
| Causalidade indevida | Status como inferência, linguagem de investigação | Testes controlados ainda são necessários |
| Excesso de confiança | Aproximação/baixa qualidade reduzem suporte | Confiança não é significância estatística |
| Custo de IA | Zero IA ao abrir; conversa medida e limitada | Uso repetido de conversa continua consumindo orçamento |
| Performance | Cache, limites, leases e backoff | Sem ensaio de carga de produção em grande escala |
| Privacidade | Referências externas sem cópia e exclusão de derivados | Política de retenção de eventos técnicos ainda precisa ser definida |
| Cross-tenant leakage | Membership, RLS, FKs e testes reais/locais | Manter revisão em mudanças futuras |
| Overengineering | Reuso da stack, worker, cálculo e protocolo | Módulos e adapters exigem manutenção conforme o catálogo cresce |

## PUBLICAÇÃO E STOP CONDITION

Publicação da Fase 11 autorizada explicitamente pelo titular em 09/10/2026 e concluída na mesma data. SEED_GROWTH_MAP_ENABLED=true em Production; preços, planos e limites atuais preservados.

- Endereço público: https://seed-ai-ashy.vercel.app
- Diagnóstico: https://seed-ai-ashy.vercel.app/?view=diagnosis
- Deployment: `dpl_5Szo6KjkQ6Jt2Euc7PxaeDedF7Bt`, estado READY, target production.
- Versão imutável: https://seed-h52zqbkwy-joao13jgc-5689.vercel.app
- Evidências locais: `.test-build/phase-11-deployment.json`, `phase-11-http-production.json`, `phase-11-cleanup.json`, `phase-11-client-secrets.json` e relatórios de testes. Diretório excluído da publicação.

Aceite visual fornecido pelo titular em 09/10/2026 após abrir Diagnóstico e receber acesso temporário para gerar/visualizar o mapa. A aplicação sinaliza falta de informações quando não há dados suficientes; não mostra métricas fictícias. Fase 11 encerrada com as limitações de cobertura descritas neste relatório. Fase 12 não implementada nesta entrega.

Conferência visual assistida em 09/10/2026: captura enviada pelo titular confirmou o estado vazio e o bloqueio por plano, sem evidência de falha de renderização. Com autorização específica, concedido PRO temporário para geração/visualização do mapa das 15:29:39 às 15:44:39 (America/Sao_Paulo). Acesso growth_map verificado; limite de IA já esgotado na exceção temporária impediu novos gastos, e relatórios automáticos foram desabilitados durante esse intervalo. Após a confirmação do titular, encerramento reconfirmado às 15:47:24: plano FREE restaurado, liberação anterior preservada e zero solicitações de IA durante o teste visual (US$ 0). Eventos PHASE_11_VISUAL_ACCESS_GRANTED e PHASE_11_VISUAL_ACCESS_CLOSED registrados em auditoria; evidência em `.test-build/phase-11-visual-close.json`.
