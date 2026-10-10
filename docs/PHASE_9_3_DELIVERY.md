# Fase 9.3 — Histórico empresarial e inteligência semanal

Estado em 02/10/2026: Fase 9.3 concluída e validada no ambiente de teste autorizado. Migração aplicada no Supabase após aprovação, recursos habilitados, processamento integrado com OpenAI e exibição no navegador verificados. Nenhuma Fase 9.4 ou 10 foi iniciada.

## 1. Resumo

Acontecimentos relatados no chat passam por uma fila persistente, sem interromper a resposta com confirmações de registro. Uma leitura semanal pode usar acontecimentos, métricas e experimentos, separando hipóteses de fatos e limitando conclusões quando a cobertura é parcial. Não há nova entrada de navegação principal.

## 2. Migração

`supabase/migrations/202610010001_business_journal.sql`, transacional e incremental. Não reaplicar cegamente: confirmar previamente a existência das tabelas e funções. Arquivo validado em PostgreSQL local via PGlite e aplicado no projeto Supabase gqumxaapjyujrpqggnon após aprovação explícita. Não altera os planos, preços, flags comerciais ou dados existentes.

## 3. Estruturas

- `business_journal_entries`: acontecimentos tipados, autoria, mensagem de origem, datas/períodos, métrica/valor/unidade/moeda, canal/produto/local, confiança, identidade de deduplicação, versão e metadados.
- `business_journal_history`: versões anteriores para auditoria; exclusão remove o conteúdo dos snapshots do registro.
- `journal_jobs`: outbox, contexto temporal, payload validado, tentativas, disponibilidade, lease e erro sem conteúdo sensível.
- `weekly_intelligence_reports`: períodos, idioma/fuso, fontes e versões, leitura estruturada, modelo e versão de geração. Não sobrescreve relatórios ao mudar o Brain.

## 4–5. Extração e classificação

Uma chamada ECONOMY combina relevância, extração e classificação. Structured Outputs e validação local compartilham o contrato. Somente evidência literal da mensagem atual e da empresa ativa é elegível. Exemplos, outras empresas e informações ambíguas são descartados. O prompt minimiza dados pessoais; isso não constitui um mecanismo completo de DLP. Arquivos anexados não alimentam o histórico.

FACT, METRIC, PROBLEM, OPPORTUNITY, DECISION, HYPOTHESIS, EXPERIMENT e RESULT implementados; LEARNING preparado. POSSIBLE nunca vira fato. A decisão concreta de testar é REPORTED, embora o resultado esperado permaneça hipótese.

## 6. Deduplicação

Identidade por empresa, tipo/métrica, período e escopo. Enriquecimento usa ID e versão de uma fonte conhecida; não soma novamente o valor. Repetição de métrica já existente não cria uma segunda observação. Uma mudança não explicitamente classificada como correção não substitui silenciosamente o valor anterior. Sem data, a identidade inclui a mensagem de origem: informações ambíguas não são mescladas apenas por terem o mesmo número.

## 7. Correções e exclusões

Correção explícita preserva snapshots e exige versão corrente. Correção manual prevalece sobre futuras extrações automáticas. A área secundária Configurações → Memória → Histórico usado pela SEED permite visualizar, corrigir e excluir, com paginação. Relatórios afetados são invalidados; a interface deixa de utilizá-los. Exclusão preserva somente o marcador do evento e metadados mínimos de auditoria; não apaga a mensagem original da conversa, conforme aviso na interface.

## 8. Temporalidade

Hoje, ontem, esta/última semana e este/último mês são normalizados pelo software com o instante da mensagem e o fuso IANA da empresa. Semana começa na segunda-feira. Período corrente termina na data local observada. Sem fuso, datas relativas ficam desconhecidas; não há fallback silencioso para o servidor. Datas explícitas inválidas são rejeitadas.

## 9. Memória

`business_memories` continua representando o estado atual. As instruções excluem acontecimentos pontuais de `memory_detected`; equipe atual, perfil, metas e restrições continuam elegíveis para memória. O worker de eventos não escreve na memória. Não houve remoção retroativa dos fatos anteriormente salvos.

## 10. Autoridade de métricas

Nesta fase ainda não existe uma tabela geral de métricas da Fase 10. **As observações históricas extraídas de conversa têm autoridade em `business_journal_entries` (METRIC)**. A memória representa estado atual; não é somada novamente. Baselines/resultados dos experimentos formais continuam em sua entidade original e podem ser vinculados, não duplicados automaticamente. Conversão e comparações são calculadas por software. Não somar períodos sobrepostos, misturar moedas ou comparar escopos/coberturas incompatíveis. Moeda desconhecida impede agregação monetária. Zero denominador não produz conversão. Percentual de mudança e pontos percentuais são distintos.

## 11–13. Decisões, experimentos e resultados

Compromissos e testes naturais são eventos estruturados, inclusive quando parciais. Metadados acomodam hipótese, ação, indicador, baseline, meta e revisão. Isso evita exigir prematuramente os campos obrigatórios das telas formais anteriores. `related_ids` permite a cadeia problema → hipótese → decisão/teste → resultado → aprendizado. `entity_refs` vincula estratégias, ações, decisões, experimentos e diagnósticos existentes quando houver referência clara; o backend e o banco verificam a empresa de cada destino. Associação não implica causalidade. Não foram criados novos módulos visíveis.

## 14. Inteligência semanal

Elegibilidade padrão: pelo menos três eventos em dois dias diferentes, configurável. Sem fuso/dados suficientes não se gera relatório. Síntese STRATEGIC com evidências verificadas, cobertura explicitamente parcial, hipóteses separadas, aprendizagem preliminar e confiança limitada. Suporta resumo, métricas, mudanças, acontecimentos, ações, decisões, testes, resultados, diagnóstico, alertas, aprendizados, prioridade, próximos passos, indicador e revisão. Seções vazias não aparecem. Home/Plano mostram a leitura existente; Diagnóstico permite solicitar a revisão da semana corrente. Histórico anterior disponível na área de revisão.

A comparação com a semana anterior usa somente a mesma cobertura relativa, unidade, moeda e escopo. Os cálculos são fornecidos à síntese; não se delega a aritmética ao modelo. O endpoint agendável prepara a última semana completa; a revisão manual marca o período como parcial.

## 15. Context Engine

Consulta até 40 acontecimentos recentes da empresa e seleciona até seis relevantes ao texto atual, com limite de 90 dias. Inclui período, categoria e versão. Não envia o histórico inteiro nem dados de outra empresa. A síntese semanal tem limite de 200 eventos por período; acima disso falha de forma explícita em vez de chamar uma amostra incompleta de relatório integral.

## 16–17. Modelos e custos

Modelos por `OPENAI_ECONOMY_MODEL` e `OPENAI_STRATEGIC_MODEL`, com fallback configurado. A produção usa a mesma reserva, preços, limites e finalização da Fase 9.1, inclusive no worker autenticado por job durável/membership. Features `BUSINESS_JOURNAL_EXTRACTION` e `WEEKLY_INTELLIGENCE_GENERATION`; `BUSINESS_JOURNAL_CLASSIFICATION` preparado no allowlist. Classificação é combinada com extração, sem uma chamada extra. Síntese conta no limite de diagnósticos. Chamadas secundárias também consomem orçamento de IA e interações.

O avaliador `npm run eval:journal` usa exclusivamente fixtures locais, gera chamadas reais pagas e registra tokens/modelos em `.test-build/journal-live/`; não escreve fixtures no banco nem no orçamento de um cliente. `npm test` não chama APIs. Preços não são inventados: os `usage_logs` reais do worker registraram extração (US$ 0,0012308) e síntese (US$ 0,019511), ambas com custo ESTIMATED; total US$ 0,0207418.

## 18. RLS e execução

Leitura restrita aos membros da empresa. Clientes não inserem eventos ou jobs diretamente. Correções passam por RPC autenticada; gravação de extrações e publicação de leituras são exclusivas do servidor. O commit da conversa e o enfileiramento pertencem à mesma transação. `after()` aguarda um worker após a resposta; não há promise abandonada.

Jobs têm exclusão mútua por empresa, lease, até quatro tentativas e espera progressiva. Payload já persistido pode ser reaplicado sem nova chamada. Lease expirado sem resultado conhecido vai para UNKNOWN, sem repetir automaticamente uma cobrança incerta. Logs contêm ID, tipo, estado e código, nunca texto da conversa ou segredo.

## 19. Testes e avaliação real

Testes de domínio: categorias, fontes, hipóteses, datas/fusos, moeda, correção, escopo, períodos sobrepostos, comparações, evidências, cobertura, confiança e contexto limitado.

PostgreSQL/PGlite: outbox atômico, anexos, RLS, escrita protegida, idempotência, enriquecimento sem duplicação, histórico de correção, prioridade manual, exclusão, publicação semanal versionada, fonte alterada, invalidação, lease incerto e reservas/custos das três novas features.

Semana sintética enviada à OpenAI: 20/3, 25/3, decisão de parcelamento, 30/6 durante teste, 28/6. Resultado: 103 interessados, 18 vendas, conversão 17,475728% (exibição 17,48%) e BRL 300 de mídia registrada. Decisão, experimento e resultado reconhecidos. A síntese final separou hipótese, reconheceu cobertura parcial e recomendou avaliar conversão e custo/margem antes de manter o parcelamento, sem atribuir causalidade.

Falhas intermediárias não mascaradas: referências inválidas na primeira síntese, experimento marcado como possibilidade e resultado marcado apenas como fato. As validações rejeitaram as saídas indevidas; as instruções foram corrigidas e os casos relevantes reavaliados. Os artefatos são explicitamente fictícios.

## 20–22. Verificações

Comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. Lint, typecheck, 138 testes (zero falhas) e build aprovados em 02/10/2026. Migração remota, fila, extração, síntese, custo e exibição no navegador validados. Acesso anônimo às três estruturas principais foi rejeitado (42501); o endpoint sem credencial retornou 401.

## 23. Limitações e operação

Migração aplicada e SEED_JOURNAL_ENABLED=true no ambiente local. A IA BR continua pausada pelo controle administrativo anterior. O usuário autorizou explicitamente um teste de até 15 minutos com PRO temporário e liberação BR; ambos foram restaurados no finally do teste e confirmados por leitura do banco. A execução foi registrada em admin_audit_log. Agendamento de produção é preparado, não instalado automaticamente. Antes de deploy, configurar `SEED_JOURNAL_ENABLED=true` após migração e `CRON_SECRET` aleatório somente no servidor. Agendador chama GET `/api/internal/journal` com `Authorization: Bearer <CRON_SECRET>`. Seguir o cursor `next` para organizações acima de 25 empresas e repetir invocações para drenar um job por chamada. Durante desenvolvimento, novas conversas acordam o worker; não há garantia de execução sem tráfego/agendador.

Inspecionar administrativamente `journal_jobs` por status/erro e idade. FAILED/UNKNOWN exigem revisão: não resetar indiscriminadamente um job que possa ter cobrado a API. Antes de retentar uma falha anterior à chamada, verificar ausência da reserva correspondente. UNKNOWN preserva reserva até reconciliação. Não há painel de operação ou emails nesta fase. Limites de duração da hospedagem devem comportar 120 segundos; configurar o ambiente antes de publicar.

Processamento assíncrono significa que a conversa imediatamente seguinte pode anteceder a extração anterior. Relatórios do modelo ainda exigem avaliação contínua: JSON/evidência válida não prova a verdade de uma afirmação. Não se promete causalidade ou completude dos dados empresariais.

## 24. Validação manual

1. Em empresa de teste com fuso definido e IA liberada para teste, relatar acontecimentos sem anexos. A resposta permanece natural.
2. Abrir Configurações → Memória → Histórico usado pela SEED; verificar datas, valores e acontecimentos.
3. Enviar “esses mesmos interessados vieram do Meta”, depois uma correção explícita. Confirmar que o total não duplica.
4. Corrigir/excluir na área de histórico, recarregar e verificar a prioridade manual.
5. Relatar decisão e teste, depois resultado observado. Verificar vinculações e hipótese separada.
6. Com eventos em dias diferentes, abrir Diagnóstico → Revisar esta semana e atualizar após processamento. Verificar resumo, números, cobertura, prioridade e ausência de causalidade indevida.
7. Verificar no servidor features, modelos, tokens/custos e status da fila; conferir RLS com outra empresa.
8. Corrigir uma fonte do resumo e confirmar sua invalidação. Regerar com nova versão sem sobrescrever silenciosamente o histórico.

Arquivos principais: `src/lib/journal/{domain,weekly,requests,server}.ts`, `src/app/journal/actions.ts`, `src/app/api/internal/journal/route.ts`, `src/components/journal-insights.tsx`, orquestrador, instruções SEED, metering comercial, tipos Supabase, quatro catálogos de idioma, testes e migração mencionada acima.

### Evidência do teste integrado

Empresa isolada e identificada: **TESTE FICTÍCIO — Fase 9.3** (d6d2fd1f-72e7-419c-95ab-4f8f6bdc337e). Permanece identificada como fixture para revisão e rastreabilidade das duas cobranças de API; não representa uma empresa real. Não foram alterados os fatos de Minha empresa. A empresa original foi restaurada como ativa ao finalizar.

O commit de uma conversa de teste enfileirou extração; o endpoint protegido processou 12 eventos e a leitura da semana 21–27/09. Jobs EXTRACTION e WEEKLY chegaram a COMPLETED sem erros. Valores calculados: 103 interessados, 18 vendas, R$ 300 de mídia observada, 17,4757281553% de conversão. Confiança LOW e aviso expresso de que o resultado não pode ser atribuído ao parcelamento.

Na interface foram abertos Configurações → Memória → Histórico usado pela SEED e Diagnóstico → Entender esta leitura. Dados e controles carregaram; nenhuma nova entrada Diário/Decisões/Experimentos foi adicionada. Correção e invalidação foram verificadas pelos testes PostgreSQL, sem modificar os números do relatório fictício exibido.

Artefatos locais ignorados pelo Git: `.test-build/phase-9-3-migration.png`, `.test-build/phase-9-3-weekly.png`, `.test-build/journal-integration-result.json`. Script de avaliação reproduzível: `scripts/eval-journal.mjs`. O teste integrado usou a fila e o medidor reais; não houve transação Stripe nem assinatura paga.
