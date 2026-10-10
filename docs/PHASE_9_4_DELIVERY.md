# Fase 9.4 — Execution Loop

## Arquitetura e reutilização

- Brain: `src/lib/brain`; confiabilidade: `src/lib/reliability`; diagnóstico: JSON estruturado de `messages`, agora com estado de revisão.
- Contexto: orquestrador + memória relevante + diário + contexto de execução limitado. Goals/Metrics continuam representados pelas memórias GOAL/METRIC e registros temporais; não foi antecipado o módulo da fase 10.
- Planos: `strategies`; ações: `actions`; decisões: `decisions`; testes: `experiments`. Preservados os fluxos e estados legados, com adaptação de ciclo de execução.
- Novas entidades necessárias: `recommendations`, `execution_results`, `execution_learnings`, `execution_events` (auditoria).
- Journal/Weekly: reutilizados; relatórios automáticos permanecem PRO. Resultados e aprendizados podem informar revisões na conversa. Datas não concluem ações.
- Model Router e medição de custos existentes: sem chamada extra de IA para aceitar plano. A resposta estruturada existente inclui operações de execução validadas antes da persistência.

## Comportamento

Recomendação confiável e acompanhável apresenta CTA discreto na conversa. Aceite por botão ou texto claro cria estratégia e 1–3 ações a partir do diagnóstico já validado. O plano mostra objetivo, foco, etapas, próximo passo e retorno à conversa com seu contexto.

Relatos explícitos podem atualizar ações (inclusive bloqueio), registrar decisões e testes com dados suficientes, armazenar resultados parciais ou completos, e revisar o plano. Uma operação aponta para entidade/version da empresa ativa. Hipótese, outra empresa, anexo e mensagem ambígua não autorizam atualização. Todos os dados de conversa e execução são gravados na mesma transação; conflito desfaz a operação.

A ausência de resultado permanece nula, nunca zero. Concluir ação/teste não valida hipótese. Aprendizados derivados de relatos são preliminares ou inconclusivos; não há atribuição automática de causalidade. A revisão exige resultado relacionado e reutiliza a Reliability Layer. Resolver exige evidência suficiente e execução terminada. Novos dados podem substituir diagnóstico/recomendação.

## Limites explícitos

- Testes novos pela conversa exigem hipótese, mudança, indicador, baseline, meta e período explícitos; a SEED deve pedir o que faltar. Nenhum valor é inventado para preencher cadastro.
- O próximo passo respeita ordem aprovada, andamento, bloqueios e dependências; não inventa uma pontuação de impacto.
- Recuperação de aprendizados é limitada por relevância textual, até quatro itens dentre os vinte recentes; não há busca semântica de todo o histórico nesta fase.
- Revisões são produzidas ao interagir com a SEED; relatórios/prazos podem sinalizar necessidade de revisão. Não foi adicionado outro cron ou acompanhamento fora da aplicação.
- Comparações numéricas e suficiência seguem a camada existente. Evidência observacional não equivale a comprovação estatística.
- Nenhuma navegação de Decisions, Experiments, Learnings ou Execution Loop foi adicionada; interfaces legadas seguem acessíveis como registros.

## Verificação

162 testes aprovados, lint e typecheck aprovados. Build local e builds de produção Vercel aprovados. Migrações `202610050002_execution_loop.sql`, `202610050003_execution_turn_versions.sql` e `202610050004_execution_legacy_outcome.sql` aplicadas; RLS confirmada ativa nas quatro novas tabelas no Supabase, sem mudança de permissões pela correção de compatibilidade. Aplicação: https://seed-ai-ashy.vercel.app/.

Publicação final confirmada READY: `dpl_mQ6ttBS3Z8UW4JAu4tFEvw8fiuLf`. Após a publicação, o histórico mostrou resultado 14, aprendizado preservado e conclusão Inconclusivo; o plano seguinte permaneceu acessível após encerrar o PRO temporário.

A validação publicada com empresa fictícia gerou uma recomendação real pela OpenAI e exibiu o botão de criação. O teste identificou e corrigiu a identidade usada pelos gatilhos comerciais na criação do plano; a função de aceite foi validada no Supabase após a correção. Foi também corrigida a atualização de uma mesma entidade por duas operações na mesma mensagem, preservando a detecção de versões antigas.

Na versão final publicada, “Meu Plano Estratégico” mostrou objetivo, foco, ação e próximo passo após recarregar. “Continuar com a SEED” abriu uma nova conversa com o próximo passo preenchido, sem enviar ou cobrar automaticamente. Operações e botão de aceite respeitam os recursos do plano comercial. Relatórios anteriores permanecem visíveis em FREE; geração automática continua exclusiva de PRO.

### Teste completo com IA real — concluído em 05/10/2026 (São Paulo)

Empresa explicitamente fictícia: **TESTE FICTÍCIO — Fase 9.3**. Usado PRO temporário autorizado, com duração máxima de uma hora e teto financeiro total de US$1. Nenhuma assinatura Stripe foi contratada e nenhuma outra conta foi alterada.

| Cenário | Evidência verificada |
|---|---|
| Bloqueio operacional | Ação BLOCKED, motivo salvo; não tratada como concluída ou fracasso da estratégia. |
| Conclusão + resultado parcial | Mesma mensagem gravou ação COMPLETED e resultado PARTIAL; cinco clientes ouvidos, novas vendas desconhecidas, sem inventar zero. |
| Revisão e decisão | Aprendizado INCONCLUSIVE, diagnóstico/recomendação substituídos e decisão permanente; problema de vendas não declarado resolvido. |
| Aceite por texto | “Vamos fazer” criou um único novo plano e sua ação. |
| Decisão e teste planejado | Decisão IMPLEMENTED; experimento READY/PLANNED, baseline 11%, meta 15%, período explícito. |
| Início | Experimento RUNNING e ação IN_PROGRESS; nenhum resultado antecipado. |
| Encerramento | Experimento COMPLETED, ação concluída e resultado COLLECTED: 14% com baseline 11%; sem validar hipótese automaticamente. |
| Nova conversa | Recuperou referência 11%, meta 15% e resultado 14% sem o usuário repetir os números; explicou a diferença entre manhã e tarde e a limitação causal. |
| Aprendizado e novo ciclo | Resultado ANALYZED, aprendizado PRELIMINARY, experimento analisado com conclusão INCONCLUSIVE e nova recomendação de reteste. |
| Aceite pelo botão | “Criar meu plano estratégico” abriu o próximo plano, com objetivo, ação e próximo passo. |
| Registro legado | Histórico original do experimento sincronizado com resultado 14 e aprendizado, exibindo INCONCLUSIVE, sem continuar erroneamente em execução. |

O teste encontrou quatro tentativas rejeitadas antes da persistência, corrigidas e repetidas: referência de fonte em conversa com vários turnos; data de início tratada como intervalo completo; estado de ação confundido com estado de experimento; revisão sem aumento de anúncios classificada como decisão de mídia. As correções preservam as validações: fontes continuam literais; mudanças de estado não fabricam períodos; início explícito tem estado canônico; revisão retida pela confiabilidade pede esclarecimentos sem gerar erro HTTP. A descrição do aprendizado também foi alinhada ao registro feito por REVIEW.

**Custo estimado registrado:** US$0,471658135 (aproximadamente US$0,47), incluindo as tentativas rejeitadas. Foram 32 chamadas contabilizadas: 12 classificações, 12 análises e 8 extrações de histórico. Todas COMPLETED no medidor do provedor, sem reservas pendentes ou custos desconhecidos. A conclusão financeira do provedor não significa que toda resposta passou na validação da aplicação.

PRO temporário revogado antecipadamente em 05/10 às 20:59 de São Paulo. Concessão anterior restaurada: FREE, teste de 10 análises com 2 utilizadas, sem alteração do histórico. O custo acumulado da conta ficou em US$0,58046287; portanto, o teto financeiro FREE de US$0,25 está atingido e novas chamadas dependem de nova concessão ou assinatura compatível. Não foi liberado uso permanente. Controles BR preservados: IA liberada; novos cadastros e novas assinaturas continuam bloqueados.

Artefatos locais de verificação, ignorados pelo Git: `.test-build/execution-live-evidence.json`, `execution-live-cost.json`, `execution-live-tests.txt` e captura `phase-9-4-final.png`. Contêm apenas a empresa fictícia, resultados dos testes e medição; nenhum segredo.

## Como testar

1. Conversar sobre um problema com objetivo e dados concretos.
2. Usar “Criar meu plano estratégico” ou aceitar textualmente uma recomendação clara.
3. Abrir “Meu Plano Estratégico” e “Continuar com a SEED”.
4. Relatar que uma ação está bloqueada, depois que foi executada; confirmar persistência após recarregar.
5. Informar resultado parcial; verificar que dados ausentes não são preenchidos com zero.
6. Informar resultado completo e pedir revisão; conferir aprendizado e revisão de prioridade quando sustentados.

Fase 9.5 não iniciada.

## Arquivos principais

- `src/lib/execution/domain.ts`, `instructions.ts`, `server.ts`: contratos, validação, contexto e regras de execução.
- `src/app/execution/actions.ts`: leitura autorizada e aceite sem chamada adicional de IA.
- `src/components/execution-panel.tsx` e `seed-workspace.tsx`: plano e continuidade na conversa.
- `src/lib/openai/{request,pipeline,respond}.ts` e `src/lib/seed/orchestrator.ts`: saída estruturada e persistência atômica.
- Três migrações citadas acima; `tests/execution.test.ts` e `tests/execution-database.test.mjs`.
- `src/app/experiments/page.tsx` e `src/lib/experiments/contracts.ts`: compatibilidade dos estados com o histórico original.
- Quatro catálogos de idioma, estilos e README. Nenhuma dependência ou chave nova.

O funcionamento integrado pressupõe o Business Journal já habilitado (`SEED_JOURNAL_ENABLED=true`), como na implantação atual.
