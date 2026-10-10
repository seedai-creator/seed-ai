# Fase 9.2.1 — Strategic Reliability Layer

01/10/2026. Camada transversal sobre a experiência 9.2. Sem novas telas, módulos visíveis, dependências, migrações ou início da Fase 9.3.

## 1. Arquitetura encontrada

Orquestrador com autenticação/vínculo empresarial → memória limitada → classificação → Brain local por intenção → Responses API → validação → gravação atômica de conversa, diagnóstico e memória. A camada comercial já selecionava modelos configuráveis, reservava orçamento e registrava tokens, custo e latência. Estratégias eram criadas a partir do diagnóstico.

## 2. Alterações realizadas

Classificação agora também identifica materialidade, tarefa social/estratégica e perfil de decisão. A mesma chamada de resposta inclui evidência tipada e suficiência; o servidor valida, calcula operações permitidas e retém recomendações incompatíveis. Não foi adicionada terceira chamada, revisão por outro modelo ou repetição automática paga.

## 3. Arquivos criados

- `src/lib/reliability/contracts.ts`, `routing.ts`, `validate.ts`, `gate.ts`.
- `src/lib/brain/modules/reliability.ts`.
- `tests/reliability.test.ts`, `tests/reliability-fixtures.ts`.
- `scripts/eval-reliability.mjs`, resultados sintéticos em `evals/reliability-*.json` e este relatório.

## 4. Arquivos alterados

`src/lib/openai/request.ts`, `pipeline.ts`, `respond.ts`; `src/lib/seed/orchestrator.ts`; `src/lib/commercial/model-router.ts`, `metering.ts`; `src/lib/diagnosis/contracts.ts`, `instructions.ts`; `src/lib/memory/automatic.ts`; `src/lib/brain/modules/limits.ts`; `src/lib/strategies/contracts.ts`; testes Brain, diagnóstico, intenção e banco; `package.json`, `.env.example`, README. No componente da interface, mudou somente o limite de espera da requisição para acomodar análises completas, sem alteração visual.

## 5. Schemas e persistência

Novo contrato de classificação `seed_route` e campo `reliability` na resposta estruturada. Diagnósticos antigos continuam válidos. O servidor acrescenta o resumo validado ao JSON de diagnóstico já persistido em `messages`; não foi necessária migração. Referências guardam índice da mensagem ou chave da memória, citação literal, categoria, período e escopo. Não há campo de chain-of-thought.

## 6. Camada de confiabilidade

Reúne contratos, regras determinísticas e instruções compartilhadas: evidência antes de recomendação, restrições, impacto, riscos, prioridade, indicador, revisão e possibilidade de mudar de hipótese. A recomendação contém resumo empresarial, não raciocínio privado. O Brain cobre causalidade, linguagem adaptativa, acolhimento, limites profissionais e autocorreção.

## 7. Suficiência

SUFFICIENT, PARTIALLY_SUFFICIENT e INSUFFICIENT. O software confere requisitos por perfil: desconto, contratação, anúncios, expansão e compromisso financeiro. Ausência de custo/margem impede compromisso com desconto. Conflitos, ausência de contexto dos indicadores e lacunas essenciais reduzem suficiência. Uma orientação de investigação pode ser mantida, mesmo com dados insuficientes. Compromisso forte exige base suficiente.

Quando a resposta não atende às regras, o servidor a substitui por esclarecimento, limpa recomendações/ações fortes e não grava candidatos de memória daquele retorno. Erros estruturais ou evidências inexistentes falham antes da gravação. Não há nova chamada automática para reparar a saída.

## 8. Tipos de conhecimento e cálculos

FACT, METRIC, DERIVED_METRIC, OBSERVATION, HYPOTHESIS, INFERENCE, ASSUMPTION, DIAGNOSIS, RECOMMENDATION, DECISION, ACTION, RESULT e LEARNING. A taxonomia de análise não substitui as categorias persistidas da memória 9.2.

Razão percentual, diferença e preço com desconto são calculados no TypeScript, com operandos rastreáveis, unidade, período e escopo compatíveis. O desconto pode ser uma premissa explícita de cenário, marcada como tal. Resultado calculado é inserido em marcadores validados no texto. Zero é aceito como dado; desconhecido permanece null; divisão por zero e números ambíguos são rejeitados. Arredondamento analítico a 14 algarismos significativos, exibição até quatro casas; não é motor contábil.

## 9. Confiança

LOW/MEDIUM/HIGH representam base qualitativa, não probabilidade de sucesso. Lacunas, conflitos, falta de evidência e métricas antigas limitam a confiança. Citações repetidas não contam como novas evidências. Um filtro complementar retém algumas formas explícitas de garantia; ele não substitui validação semântica nem promete detectar toda formulação inadequada.

## 10. Context Engine

Continua limitado a 40 candidatos e até oito memórias selecionadas da empresa autorizada, priorizando objetivo, restrição e relevância. Agora inclui identificação/versão da fonte. Diagnóstico anterior da conversa chega separadamente como interpretação revisável. Não é promovido a fato. Indicadores da memória com mais de 180 dias não sustentam automaticamente decisões atuais; esse prazo é uma heurística conservadora, não regra universal de validade.

## 11. Model Router

Mensagem curta de expansão continua estratégica. Contratação, expansão e compromisso financeiro exigem materialidade alta. Saudações/agradecimentos utilizam modelo econômico; análises empresariais utilizam estratégico. Nomes continuam em variáveis de ambiente. O roteador considera materialidade explicitamente e não reduz qualidade por proximidade do limite de uso.

`OPENAI_REASONING_EFFORT=low` foi configurado para os modelos atuais após avaliação. É opcional; omitir para modelos sem suporte. `medium`/`high` exigem reavaliar orçamento de saída e latência. O limite comercial configurado de tokens não foi aumentado. O servidor aceita até 60 segundos e a interface aguarda até 70 segundos, com cancelamento. Respostas incompletas são recusadas.

## 12. Segurança da memória

Um candidato precisa concordar com a categoria da evidência literal da última mensagem. Hipótese/inferência/premissa não vira fato ou métrica informada; recomendação não vira estado empresarial. Correções manuais e exclusões continuam protegidas no banco. Datas inexistentes são rejeitadas. Emoção não deve ser extraída como fato empresarial; a interpretação textual ainda depende do modelo.

## 13. Structured Outputs

Schema estrito na API e validação local do mesmo contrato, com listas/textos limitados. Proveniência, referências, números literais, cálculo e suficiência recebem checagens adicionais. JSON válido não prova verdade. Recusas/incompletudes não são tratadas como resposta válida. Base técnica: [documentação oficial de Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## 14. Validação e observabilidade

Logs técnicos contêm estado de suficiência, confiança, perfil, materialidade, resultado de validação e latência, sem mensagens, memória ou secrets. Custos continuam no sistema comercial existente; `router_decision` inclui tarefa e materialidade. Por compatibilidade com o orçamento existente, follow-up econômico permanece na categoria contábil `diagnosis`, distinguido por `task: followup`.

Avaliações diretas usam somente cenários sintéticos, sem gravar empresas ou contornar os controles da aplicação para um usuário. Tokens e modelos ficam nos artefatos de avaliação; seu custo não é atribuído a clientes. Falhas sem uso retornado têm custo desconhecido, não zero. Nenhum preço de API foi inventado.

## 15. Testes

Suíte inclui schema, tipos, hipótese versus fato, proveniência, unknown versus zero, cálculo/escopo/período, suficiência, conflitos, confiança, rota social/alto impacto, compatibilidade de diagnósticos, persistência da evidência e isolamento. A suíte anterior de autenticação, RLS, memória, estratégias, decisões, experimentos e cobrança continua executada.

Avaliação real cobre vender mais, desconto sem custos, contratação, anúncios com capacidade limitada, expansão, emoção, conflitos, hipótese, resultado negativo, linguagem simples/avançada, causalidade e agradecimento. O caso com mês versus semana exige esclarecimento, mesmo contendo números suficientes para uma conta; não é tratado como cenário comparável. O cenário delimitado da mesma semana retornou preço 80, calculado pelo software, e recomendação de teste com revisão, sem previsão de vendas. A revisão final de 15 cenários, combinando a bateria e rechecagens após correções, está em `evals/reliability-final-review.json`. Isso não significa 15 acertos consecutivos: falhas intermediárias foram preservadas nos arquivos de avaliação.

## 16–18. Verificações

Lint e typecheck aprovados. `npm test`: **121 testes aprovados, zero falhas**. Build de produção aprovado, incluindo TypeScript e geração de páginas. `npm run eval:reliability` é opt-in, usa a chave no servidor e consome API; um identificador pode selecionar somente um cenário. Os 15 cenários da revisão final não tiveram erro de execução pendente; o caso de períodos incompatíveis foi intencionalmente retido, pedindo esclarecimento. As respostas foram revisadas contra os critérios, sem inferir garantia de comportamento em toda conversa futura.

## 19. Regressões corrigidas

- Compatibilidade de `parseDiagnosis` com registros antigos e novo resumo.
- Diferenciação entre categoria de cobrança existente e rota econômica de follow-up.
- Precisão de ponto flutuante na conversão 21/300.
- Número literal em uma proposta não deve ser confundido com métrica observada.
- Cálculo sem escopo/período é retido sem gravar memória inválida.
- Resposta de investigação não precisa ser descartada só por uma classificação mais conservadora do servidor.
- Limite de saída atingido no cenário completo: configuração de raciocínio e concisão ajustadas, mantendo o modelo e o teto comercial.
- O teste de persistência confundia JSON null com SQL NULL; a consulta passou a selecionar o novo resumo explicitamente.
- Resultado futuro desconhecido não impede planejar um teste delimitado; premissa explícita não é promessa de resultado.
- Número escrito por extenso conserva a citação, mas fica sem operando numérico verificado, em vez de quebrar a análise.
- A mensagem de segurança usa as lacunas essenciais já identificadas, em até três pontos; problemas de cálculo pedem esclarecimento de produto/período, evitando repetir um questionário genérico.

## 20. Limitações

Evidência literal comprova origem, não veracidade, causalidade ou interpretação correta. Classificação, linguagem adaptativa, descoberta de restrições e identificação de conflitos textuais continuam dependentes do modelo. A checagem determinística de conflitos cobre valores numéricos da mesma chave/escopo/período; não resolve toda contradição semântica. Pode haver excesso de cautela e pedidos adicionais. Números com separadores ambíguos exigem esclarecimento. O histórico já limitado da conversa e a busca de memória não equivalem a busca global de todos os dados.

Não foi implementado acompanhamento automático de resultados, pesquisa externa, probabilidade de sucesso, simulador completo nem nenhuma etapa posterior. Não houve mudança de permissões ou de configuração comercial remota. A IA BR permanece pausada no controle administrativo anterior.

## 21. Dívida técnica

Evoluir avaliação semântica com conjunto maior/repetido e revisão humana; calibrar validade por tipo de indicador; representar escopo/período com IDs; ampliar cálculos com precisão decimal quando houver necessidade contábil; separar a categoria de uso de follow-up em uma futura migração comercial. A revisão atual é amostral e não mede taxa estatística de alucinação.

## 22. Como validar manualmente

1. Inicie com `npm run dev -- --port 3001`, se não houver servidor, e abra a SEED. Layout e conversas anteriores devem permanecer.
2. Para teste pela aplicação, libere apenas IA no painel administrativo, com motivo; nenhum bloqueio remoto foi alterado nesta fase.
3. Pergunte sobre desconto sem custo: deve pedir dados, não aprovar. Pergunte sobre nova unidade: deve investigar demanda, capital e operação.
4. Relate capacidade esgotada antes de dobrar anúncios: deve considerar a capacidade.
5. Informe “acho que meu preço está alto”: confira que não se torna fato confirmado.
6. Relate resultado que contradiz hipótese anterior: deve admitir revisão, sem afirmar causalidade não comprovada.
7. Compare entradas simples e com CAC/LTV: profundidade deve se adaptar.
8. Use cenários da avaliação para conferir períodos incompatíveis, dados desconhecidos e preço calculado. Nunca envie dados reais desnecessários.
9. Reabra a conversa e confira o diagnóstico; não devem aparecer códigos internos no chat. Estratégia pode aproveitar indicador validado; não há execução automática.

Parar após esta entrega. Fase 9.3 exige nova autorização e especificação própria.
