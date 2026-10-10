# Fase 12 — SEED Business Cockpit

Estado: Fase 12 concluída e publicada na Vercel em 10/10/2026, após aprovação visual da Home local e autorização explícita do titular para publicar. Nenhuma fase seguinte foi iniciada. A ferramenta de navegador falhou ao iniciar o sandbox do Windows; a aprovação do titular não substitui a matriz completa de dispositivos e acessibilidade. Especificação integral: PHASE_12_SPEC.md.

## Publicação e verificação em produção

- Endereço: https://seed-ai-ashy.vercel.app/.
- Deployment: dpl_2d66KWybZboa2MJVgQfrKARVS3kD, estado READY, target production, alias principal confirmado pela Vercel.
- Versão imutável: https://seed-bqru43rpr-joao13jgc-5689.vercel.app.
- SEED_COCKPIT_ENABLED=true configurada em Production. Nenhuma migração, alteração de plano, orçamento ou credencial foi necessária.
- Build da Vercel aprovado, incluindo TypeScript. Onze verificações HTTP e treze arquivos estáticos aprovados; estilos do Cockpit confirmados no endereço público.
- Login responde normalmente. Rotas privadas redirecionam ao login diretamente ou por /companies; /admin retorna 404 para visitantes não autorizados; /api/chat recusa requisição sem sessão com 401.
- O primeiro roteiro HTTP esperava redirecionamento direto ao login em todas as páginas. Após conferir o código existente, o roteiro passou a verificar também a cadeia /companies → /login e o 404 administrativo. Não houve alteração de código de produção para ajustar esses resultados.
- Evidência local: .test-build/phase-12-production.json. Zero chamadas à OpenAI nesta publicação e verificação.
- A interação autenticada no site publicado não foi automatizada; a inspeção visual aprovada pelo titular ocorreu na versão local. Não foram executadas a matriz completa de dispositivos nem a avaliação real por leitor de tela.

## Resumo e arquitetura encontrada

A Home em src/components/seed-workspace.tsx já tinha hero, metas, Radar, conversa, Composer, atalhos, retomada e semanal. Os blocos eram independentes, sem prioridade ou deduplicação comum; metas e Radar precediam o Composer.

O Cockpit agora apresenta até três informações atuais abaixo do Composer. A conversa permanece central, com marca, cores, tipografia, sidebar e drawer preservados. Não há menu novo, dashboard paralelo, gráfico/indicador fictício ou geração de IA no carregamento/clique.

## UX, Home e componentes

Novo usuário: frase oficial, Composer e atalhos, sem cartões vazios. Pouco contexto: orientação curta, sem questionário. Usuário recorrente: foco, meta, atenção, revisão ou resultado, conforme os registros disponíveis. Conversa selecionada preserva o fluxo de chat; o logo retorna à Home, mantendo texto ainda não enviado e conversas no servidor.

CockpitView usa uma coluna, destaque discreto no primeiro bloco e divisórias nos demais. Cada bloco apresenta um resumo, poucos fatos, data, qualificação e CTA. Não representa toda a empresa como um painel de KPIs.

Componentes criados: src/components/cockpit.tsx e cockpit-view.tsx.
Alterados: seed-workspace.tsx, brand.tsx, src/app/page.tsx e globals.css.

O CTA de conversa prepara um rascunho, preserva texto já digitado e mostra o contexto selecionado. O envio continua explícito. Marca pode voltar à Home sem apagar conversas. Seleções de plano/pesquisa/Growth são limpas ao abrir outra conversa.

## Serviços e fontes canônicas

| Responsabilidade | Arquivo em src/lib/cockpit | Função |
|---|---|---|
| Aggregation | server.ts | Autoriza membership; lê fontes limitadas/paralelas; isola falhas |
| Adaptadores | aggregate.ts | Reutiliza goalProgress, nextStep, Radar e snapshots Growth |
| Priority Resolver | priority.ts | Ordem central configurável por argumento, desempate estável, três blocos |
| Freshness | domain.ts | Referências, timestamps, TTL, estados, feature flag |
| Invalidation | identity.ts | Hash do conteúdo e versões; reconhecimento privado por referência |
| Action Resolver | server.ts | Relê e revalida no clique e envio |
| Narrative Formatter | format.ts | Templates e formatação existente, sem LLM |

Ordem inicial: atenção alta validada → bloqueio → próximo passo → meta em risco → revisão relevante → atenção → meta → semanal → crescimento → resultado → oportunidade → retomada. É prioridade de exibição, não nota de saúde.

Deduplicação por origem, plano, meta, indicador/escopo e evidências. Diagnóstico/Radar/Growth compartilham uma categoria de atenção para não ocupar todos os lugares com interpretações concorrentes. Plano e meta podem coexistir quando trazem informações diferentes. Deduplicação é conservadora, sem equivalência semântica por IA.

### Foco, plano e próxima ação

Somente plano aceito/ativo. Reutiliza nextStep, ordem e dependências já existentes. Conta ações concluídas sem peso inventado. O nextStep foi corrigido para marcar como bloqueada uma ação TODO cuja dependência ainda não terminou; não sugere executá-la como se estivesse livre. Mais de 100 ações provoca leitura parcial e revisão no plano completo, sem sugerir próximo passo baseado em lista truncada. Sem atualização por 45 dias, pede revisão.

### Meta

Prioriza meta principal ativa, vínculo com plano, prazo e ID estável. Atual, meta, escopo, período, trajetória e percentual vêm de goalProgress. Ausência não vira zero; intervalos não viram médias; aproximações não recebem barra exata. Trajetória é referência matemática, não previsão. Moedas/períodos/escopos incompatíveis não são mesclados.

### Diagnóstico e Growth

Diagnóstico lê mensagem da conversa privada do usuário na empresa ativa. Exige evidência e gargalo, permanece provisório, expira em 14 dias e abre a conversa original. Memória alterada após o diagnóstico suprime esse resumo; essa regra pode ser conservadora demais em mudanças não relacionadas.

Growth lê snapshot atual, geração processada e dimensão principal com dados e confiança suficiente. Mostra uma dimensão, sem recalcular o mapa ou criar score. O mapa completo continua em Diagnóstico.

### Radar e fontes externas

Respeita preferência, mute, relevância, versão, geração, orçamento e cooldown. Apenas um insight realmente selecionado consome entrega. Dispensa usa radar_feedback; a Home não dispara varredura.

Sinal externo exige pesquisa concluída e ainda válida, com fontes, sem parcialidade/conflitos e com preferência externa habilitada. Referência externa é identificada como tal, com link/data; não vira desempenho interno. Não há feed de notícias ou pesquisa no carregamento.

### Semanal, resultados/aprendizados e decisões

Último relatório disponível no idioma da interface, com fontes e até nove dias. Abrir/dispensar reconhece a versão para aquele usuário/empresa. O relatório permanece no Diagnóstico; não há geração automática.

Resultado recente usa registro existente e aprendizado ativo associado. RESULT e LEARNING seguem separados no contexto; não se atribui causalidade à ação automaticamente.

Revisão de decisão exige prazo vencido, ausência de revisão e vínculo com plano ativo ou materialidade HIGH/CRITICAL de simulação aceita do próprio usuário. Não estima materialidade a partir de números inventados. Decisões antigas sem esse vínculo continuam em suas telas próprias.

## ViewModel, API e conversa

ViewModel: companyId, generatedAt, refreshAfterMs, states, items, partial e canConverse. Item: referência tipada/id/versão, título, resumo, observação, data, destino, CTA, fatos formatados, fontes públicas opcionais e progresso opcional. Contexto bruto não acompanha o ViewModel enviado ao browser.

Server Actions em src/app/cockpit/actions.ts: readHome, openHomeItem, dismissHomeItem e homeEvent. Todas validam sessão e empresa ativa; o serviço verifica membership antes de consultas privilegiadas. Conversas/diagnósticos também são filtrados por usuário.

O clique relê as fontes e compara a referência. No envio explícito, o Orchestrator revalida cockpitContext antes de pesquisa ou OpenAI. Correção, remoção, expiração ou perda de acesso rejeitam o contexto antigo. O prompt visível é curto; os registros tipados atuais são montados no servidor.

Meta, plano em revisão, Growth e semanal abrem as telas existentes. Diagnóstico/retomada abrem conversa original. Continuidade/resultado/decisão/Radar podem preparar conversa. Clique nunca aceita estratégia, decisão ou experimento automaticamente.

## Cache, invalidation e performance

Sem nova tabela, snapshot persistido, dependência, worker ou cache compartilhado. Nenhuma migração adicional foi necessária. Toda persistência empresarial continua nas fontes canônicas.

ViewModel local isolado por empresa/idioma e geração; descarta respostas de gerações anteriores. Releitura no retorno à Home, mudanças locais, idioma, foco da janela após 60 segundos e a cada 60 segundos enquanto visível. Clique/envio sempre revalidam. Não há N+1 por item.

Limites: um plano; 101 ações para detectar truncamento; seis conversas recentes para diagnóstico; um semanal; oito insights; seis resultados, aprendizados e decisões. Goals reutiliza a consulta limitada existente (até 300 observações Journal e 200 estruturais). Fontes independentes têm timeout de oito segundos; a falha não impede outras fontes ou Composer. Consultas já enviadas podem terminar depois do timeout.

Teste real somente de leitura na empresa fictícia já existente, quatro idiomas: 1.799 / 334 / 673 / 354 ms, mais releitura de contexto; 131 requisições GET/HEAD/SELECT no total. Zero chamadas de provedor, zero gravações e zero mudanças de plano. Não é SLA nem teste de concorrência em produção.

## FREE / PRO, custos e analytics

Sem nova política comercial, preço, limite ou paywall. FREE lê dados existentes; geração e envio continuam com entitlements/limites anteriores. Não foi concedido PRO temporário ou aumentado orçamento na Fase 12.

Templates e prioridade são determinísticos. No envio com contexto, a chamada Responses existente recebe cockpit_feature=COCKPIT_CONTEXT_SUMMARY e o registro de uso preserva essa identificação em router_decision. Nenhuma chamada adicional. [Referência oficial de metadata](https://developers.openai.com/api/reference/go/resources/responses/methods/retrieve).

Eventos: home_viewed, composer_started, quick_action_clicked, continue_plan_clicked, goal_opened, diagnosis_opened, radar_insight_opened, weekly_intelligence_opened, growth_map_opened, cockpit_item_dismissed. Reutilizam commercial_events com hash por usuário/empresa/referência, sem conteúdo empresarial. Eventos de navegação são deduplicados por hora; reconhecimento semanal é estável por referência. Logs técnicos usam fonte, código, quantidade e latência, nunca textos ou credenciais.

## Segurança / RLS, idiomas, mobile e acessibilidade

Grants/RLS existentes preservados. Autorização do serviço é obrigatória mesmo com service role. Referências de outra empresa/usuário são rejeitadas; não há cache global ou segredo exposto.

Analytics não recebe nomes, conteúdo de conversa ou anexos. commercial_events não tem FK de empresa; reconhecimentos opacos não constituem memória empresarial, mas sua retenção precisa acompanhar a política operacional dessa tabela.

Quatro idiomas: pt-BR, pt-PT, en-US, es-ES. Datas, moedas, números e textos auxiliares usam os formatadores existentes. Troca de idioma não converte dinheiro nem altera mercado. Conteúdo do usuário fica no idioma original; semanal de outro idioma é omitido, não traduzido por IA.

Layout em uma coluna com quebra de texto, área segura e alvos de pelo menos 44 px. Títulos, labels, dl, time, progress nativo, estado de carregamento/erro e foco após navegação. Não depende apenas de cor. Links externos usam noopener noreferrer. Sem animação obrigatória.

A estrutura/SSR foi testada e a Home local foi aprovada visualmente pelo titular em 10/10/2026. Navegação real por teclado, leitor de tela e a matriz completa desktop/tablet/mobile não foram executadas devido à falha da ferramenta do navegador. Não se afirma certificação de acessibilidade.

## Testes e verificações

Suíte completa: 438 testes aprovados, zero falhas, sem skips, em 441,3 segundos. Abrange regras, integrações, cálculos, banco/RLS, i18n e regressões anteriores. Após os ajustes finais, 45 testes focados de Cockpit/servidor/Execution foram recompilados e aprovados, incluindo dois novos casos de borda. Essas contagens se sobrepõem; não representam 483 casos distintos.

Novos testes: estados vazios, prioridade/limite/deduplicação, plano/bloqueio/truncamento, Goals e métricas, aproximações/intervalos, moeda/escopo/período incompatíveis, diagnóstico, Radar/semanal, Growth, resultado/aprendizado, revisão, referências corrigidas/expiradas, acesso entre empresas, analytics, SSR em quatro idiomas, texto longo/escape e 10 mil candidatos.

Servidor testado com adaptador controlado para falhas parciais, revalidação, cliques, reconhecimento e limites de consultas. PostgreSQL PGlite aplica todas as migrações e verifica RLS/privacidade das fontes e eventos. Verificação real inclui quatro idiomas, contexto revalidado e não membro recusado, protegida por guarda GET/HEAD contra gravações e OpenAI.

Evidências em .test-build: phase-12-tests.log, phase-12-lint.log, phase-12-build.log, phase-12-readonly.json. Lint completo aprovado, seguido de lint nos últimos arquivos alterados, sem avisos. Typecheck aprovado. Build final de produção aprovado (compilação em 22,5 s e TypeScript em 46 s). HTTP local aprovado: login 200, rotas protegidas redirecionam para login e chat sem sessão retorna 401. Vinte e seis bundles JavaScript do cliente foram verificados contra os valores reais dos quatro secrets configurados, sem nenhuma exposição; os valores não foram registrados.

## Tabela de capacidades

| Capability | Source | Status | Tested | Notes |
|---|---|---|---|---|
| Hero / Composer | Workspace | Implementado | Integração de código e aceite visual do titular | Matriz completa de dispositivos não executada |
| Primary Focus | Prioridade/fontes | Implementado | Unitário/integração | Sem score |
| Next Step | Execution | Implementado | Unitário/servidor | Plano ativo |
| Goal Summary | Goals | Implementado | Cálculos/real | Mantém incerteza |
| Plan Summary | Strategies/Actions | Implementado | Unitário/servidor | Truncamento pede revisão |
| Diagnosis Summary | Messages privadas | Implementado | Unitário/consultas | Provisório, 14 dias |
| Growth Summary | Snapshot canônico | Implementado | Unitário/motor | Não recalcula |
| Radar Insight | Insights/entregas | Implementado | Unitário/infra anterior | Preferências e cooldown |
| Weekly Summary | Relatório persistido | Implementado | Unitário/servidor | Reconhecimento por versão |
| Recent Result | Results/Learnings | Implementado | Unitário | Sem causalidade automática |
| External Insight | Radar/Research | Implementado | Adaptação/validação | Sem nova pesquisa |
| Priority Resolver | Cockpit | Implementado | Unitário | Ordem central |
| Deduplication | Origens/histórias | Implementado | Unitário | Conservadora |
| Freshness | Versão/TTL/geração | Implementado | Unitário/servidor | Sem snapshot transacional |
| Action Resolver | Actions/Orchestrator | Implementado | Integração/real | Zero IA no clique |
| Cache | ViewModel local | Implementado | Isolamento/geração | Sem cache compartilhado |
| API | Server Actions | Implementado | Integração | Sessão/empresa ativa |
| RLS | Políticas anteriores | Preservado | PGlite/suíte | Serviço reautoriza |
| FREE/PRO | Entitlements | Preservado | Servidor/real | Sem orçamento novo |
| I18N | Dicionários | Implementado | Quatro idiomas/SSR/real | Sem tradução paga |
| Mobile | CSS | Implementado | Estrutura/SSR | Matriz completa de dispositivos não executada |
| Accessibility | HTML/foco/labels | Implementado | SSR/estrutura | Teclado/leitor pendentes |
| Performance | Consultas limitadas | Implementado | Sintético/real | Sem teste de carga |
| Analytics | Commercial Events | Implementado | Unitário/servidor/RLS | Dados opacos |

## Riscos, limitações e dívida técnica

| Risco | Mitigação | Limitação aberta |
|---|---|---|
| Excesso de informação | Três blocos, poucos fatos | Qualidade depende dos registros |
| Duplicação | Chaves e categoria de atenção | Pode omitir relatos distintos do mesmo indicador |
| Conteúdo antigo | TTL, versões, geração e revalidação | Mudança imediatamente após leitura; múltiplas tabelas não transacionais |
| Falsa precisão | Cálculos canônicos e qualificadores | Dado declarado incorretamente ainda pode ser numericamente válido |
| Cache antigo | Sem cache compartilhado; 60 s | Pode exibir última leitura até atualização; clique revalida |
| Page load caro | Composer antes, limites/paralelismo | Goals ainda consulta várias tabelas |
| IA involuntária | Nenhum provedor no load/CTA | Envio explícito segue pipeline existente |
| Vazamento entre empresas | Membership, filtros, RLS e referências | Manter testes é essencial ao usar service role |
| Paywall agressivo | Leitura FREE preservada | Conversa pode atingir limite anterior |
| Interface genérica | Composer e destaque editorial; Home aprovada pelo titular | Matriz completa de dispositivos não executada |
| Dashboard complexo | Sem nova navegação/gráficos | Detalhes exigem abrir telas existentes |
| Performance | Limites e timeout por fonte | Queries em voo não são canceladas; sem carga concorrente |
| Acessibilidade | HTML, foco, alvos de toque | Sem avaliação real de leitor/teclado nesta sessão |
| Overengineering | Sem tabela/dependência/job novos | Workspace ainda concentra vários painéis |

Limitações adicionais: anexos binários não são processados pelo Composer anterior (TXT/CSV/Markdown até 20 KB preservados); diagnóstico considera seis conversas; uma meta principal é destacada; dados fracos são omitidos; relatório em outro idioma pode não aparecer; falha de analytics pode reapresentar semanal. Não houve nova chamada real de IA nesta fase; foram testados contexto, request e zero provedor no carregamento.

## Operação e roteiro manual

1. Na pasta do projeto, instalar dependências se necessário e manter as variáveis existentes em .env.local; SEED_COCKPIT_ENABLED=true ativa o Cockpit local. Não compartilhar chaves. Nenhuma migração adicional é necessária.
2. A versão de produção local está iniciada na porta 3001. Para reiniciar em desenvolvimento, executar npm run dev -- --port 3001 e abrir http://127.0.0.1:3001. Entrar com a conta existente.
3. Clicar no logo. Conferir hero e Composer antes dos blocos, sidebar simples e ausência de item principal novo.
4. Empresa nova: nenhum número/cartão fictício. Pouco contexto: orientação curta. Empresa existente: até três blocos.
5. Comparar meta, prazo, período, escopo, aproximações e próximo passo com as telas de origem. FREE continua lendo registros.
6. Clicar em continuar: rascunho/contexto sem envio automático. Texto previamente digitado deve permanecer. Enviar somente se desejar consumir o limite existente da conversa.
7. Corrigir/remover a fonte em outra aba e voltar; referência antiga deve ser recusada ao abrir/enviar.
8. Abrir semanal/Growth/meta; conferir foco na seção. Abrir/dispensar semanal deve retirá-lo da Home sem apagá-lo do Diagnóstico. Radar respeita preferência/cooldown.
9. Em empresa fictícia, conferir bloqueio, meta em risco, resultado, oportunidade, intervalo, dados antigos/conflitantes e moedas/períodos diferentes.
10. Alternar empresa e quatro idiomas; nenhum texto de outra empresa pode permanecer. Testar nomes e textos longos.
11. Conferir desktop, laptop, tablet, celular (inclusive 320 px), drawer, Tab/Enter, foco visível, zoom, quebra de texto e botões.
12. Em ambiente de teste, indisponibilidade de fonte não deve impedir conversa. Reabrir Home não deve criar ai_requests.

Rollback: SEED_COCKPIT_ENABLED=false e reiniciar localmente ou republicar na Vercel para recuperar a Home anterior. A publicação de 10/10/2026 foi autorizada explicitamente. Não iniciar outra fase sem nova autorização.

## Arquivos principais alterados

- src/lib/cockpit/*: contratos, adaptação, prioridade, formatação, identidade, serviço e contexto.
- src/app/cockpit/actions.ts: autorização e Server Actions.
- src/components/cockpit.tsx, cockpit-view.tsx, seed-workspace.tsx, brand.tsx: Home e navegação.
- src/app/page.tsx e globals.css: feature flag e estilos.
- src/lib/seed/orchestrator.ts: revalidação antes de IA; src/lib/execution/domain.ts: bloqueio por dependência.
- src/lib/openai/request.ts e src/lib/commercial/metering.ts: identificação na chamada e medição existentes.
- src/lib/i18n/locales/*.json: quatro idiomas.
- tests/cockpit.test.ts, cockpit-server.test.mjs, cockpit-database.test.mjs e tsconfig.test.json.
- scripts/verify-cockpit-readonly.mjs, .env.example, README.md e documentação desta fase.

Não foram adicionadas dependências nem migrações. .env.local permanece ignorado pelo Git. A flag foi habilitada localmente e em Production; a versão publicada inclui o Cockpit.
