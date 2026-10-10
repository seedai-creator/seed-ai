# Fase 9.2 — experiência central da SEED

Entrega validada em 01/10/2026 no ambiente de teste autorizado. Fases 9.3, 9.4 e 10 não iniciadas.

## 1. Resumo

Interface organizada em conversa, empresa, diagnóstico e plano. Conversas passam a persistir no banco; memória empresarial recebe categorias, origem, histórico temporal e correção manual. Chat mostra somente mensagens, sem os antigos cards de memória, decisão ou experimento.

## 2. Arquivos criados

- `src/lib/memory/automatic.ts`: contratos, elegibilidade e seleção de contexto.
- `src/lib/chat/attachments.ts`: capacidades e validação de arquivos de texto.
- `src/app/workspace/actions.ts`: leitura autorizada de conversas e memória e correção de memória.
- `src/components/region-flag.tsx` e `secondary-language.tsx`: bandeiras e seletor nas páginas secundárias.
- `supabase/migrations/202609300001_core_experience.sql`.
- `tests/core.test.ts` e `tests/core-database.test.mjs`.
- Este relatório e capturas `docs/phase92-desktop.png`, `phase92-mobile.png` e `phase92-mobile-menu.png`.

## 3. Arquivos alterados

Principais: `src/components/seed-workspace.tsx`, `language-switcher.tsx`; `src/app/page.tsx`, `layout.tsx`, `globals.css`; quatro catálogos de idioma; `src/lib/memory/contracts.ts`, `openai/request.ts`, `seed/instructions.ts`, `seed/orchestrator.ts`, `diagnosis/contracts.ts`, `diagnosis/instructions.ts`, `supabase/database.types.ts`; README. Nenhuma dependência nova.

## 4. Migração

`202609300001_core_experience.sql` aplicada com sucesso no Supabase `gqumxaapjyujrpqggnon`, sem reset. Cria conversas, mensagens, memórias e histórico, com RLS e autorização por vínculo empresarial. Conversas são privadas ao usuário criador. Importa fatos existentes como registros protegidos por prioridade manual.

Gravação de turnos é atômica, restrita ao servidor, com controle de versão e idempotência. Correção exige sessão, vínculo e versão atual. Um gatilho mantém compatibilidade com os fatos legados. Não reaplicar a migração como procedimento de teste.

## 5. Navegação

Sidebar: Nova conversa, Conversas, Minha empresa, Diagnóstico, Meu plano estratégico e Configurações. As rotas anteriores continuam disponíveis, mas Decisões e Experimentos não aparecem na navegação principal. Navegar entre painéis preserva conversa, rascunho e posição de leitura.

## 6. Chat

Frase oficial em pt-BR: “O que você precisa resolver no seu negócio hoje?”. Quatro atalhos preenchem o campo; o usuário decide enviar. Mensagens ficam no centro, com carregamento e erros simples. Conversas concluídas persistem e podem ser reabertas. O servidor recupera o histórico autorizado, sem confiar em mensagens de assistente enviadas pelo navegador.

## 7. Composer

Campo central com envio e menu de anexos. Rascunho em sessionStorage separado por usuário e empresa. Falha mantém o conteúdo para nova tentativa. Anexo pode ser removido antes do envio.

## 8. Anexos

Suporte atual: TXT, CSV e MD, até 20 KB e 2.000 caracteres. O conteúdo textual acompanha a mensagem; o arquivo binário não é armazenado. Turnos com anexos não alimentam automaticamente a memória.

Imagem/câmera, PDF e Office têm entradas preparadas e retorno explícito de formato ainda não suportado. Não há interpretação visual, extração de PDF, áudio ou geração de imagens nesta entrega. Seleção e remoção de TXT foram verificadas na interface; análise real de anexo pela OpenAI não foi executada.

## 9. Memória automática

Categorias: fato, indicador, objetivo, preferência empresarial, restrição, decisão, hipótese, resultado e aprendizado. Extração estruturada exige informação explícita sobre a empresa atual e evidência literal da mensagem. Simulações, ambiguidades e outras empresas são excluídas. Hipóteses permanecem identificadas e não podem ser usadas como evidência confirmada do diagnóstico.

Substituições automáticas exigem indicação de atualização, protegem informações mais recentes e preservam histórico. Correções manuais têm prioridade. Contexto busca até 40 candidatos recentes e seleciona até oito registros relevantes; não envia toda a memória.

Teste real autorizado: a OpenAI respondeu à mensagem fictícia; os dois registros empresariais anteriores permaneceram, sem salvar os números da simulação. Inserção automática não vazia, atualização temporal, concorrência e proteção manual foram verificadas em testes locais com PostgreSQL/PGlite, não por uma nova conversa real com dados empresariais.

## 10. Configurações → Memória

Permite consultar, corrigir e remover registros com textos compreensíveis. Remoção é lógica: exclui o registro da interface e do contexto e impede reaprendizado automático daquela chave. Histórico e valor anterior permanecem internamente; não representa exclusão definitiva de dados pessoais. Abrir estes painéis não chama a OpenAI.

## 11. Idioma e região

Seletor compacto com bandeira vetorial e nomes acessíveis. pt-BR, pt-PT, es-ES e en-US verificados. Alteração preserva rascunho e conversa e não muda mercado de cobrança ou moeda. Mensagens já escritas não são retraduzidas.

## 12. Mobile e acessibilidade

Desktop e tablet usam sidebar. Mobile usa diálogo lateral com itens de navegação e fechamento, preservando o estado. Inspeções em 390×844 e 820×1180, além de desktop. Controles possuem nomes acessíveis; não foi feita auditoria completa com leitor de tela.

## 13. Testes

106 testes passaram, zero falhas. Incluem isolamento entre empresas, propriedade da conversa, escrita somente pelo servidor, versões, histórico, correção/exclusão protegida, evidência de hipóteses, limites de contexto e anexos. Pela interface: resposta real, persistência após recarregar, navegação, rascunho, idiomas, memória, anexo TXT e drawer. A suíte existente de cobrança foi preservada.

## 14. Lint

`npm run lint`: aprovado.

## 15. Typecheck

`npm run typecheck`: aprovado.

## 16. Build

`npm run build`: aprovado; compilação, TypeScript e geração de páginas concluídos. `npm test`: 106 aprovados.

## 17. Limitações e estado operacional

- Listagens limitadas a 100 conversas e 200 memórias, sem paginação nesta fase.
- Classificação semântica depende do modelo; filtros determinísticos reduzem erros, mas não garantem interpretação perfeita.
- Fatos importados e correções manuais não são sobrescritos automaticamente; ajuste-os na interface.
- Exclusão lógica não substitui um fluxo futuro de eliminação definitiva e retenção.
- Anexos restritos a texto; formatos visuais e documentos complexos aguardam integração.
- Diagnóstico exibido corresponde à conversa carregada; plano reutiliza estratégias e ações existentes. Sem Execution Loop completo.
- Bloqueios administrativos BR anteriores foram restaurados: IA, novos cadastros e novas assinaturas pausados. Leitura permanece disponível. PT/ES/US continuam DRAFT. Não houve ativação comercial nem cobrança real.

## 18. Como validar manualmente

1. Abra `http://127.0.0.1:3001/`. Para iniciar localmente, use `npm run dev -- --port 3001` se não houver servidor nessa porta.
2. Confira a frase oficial, os quatro atalhos e a sidebar. Escreva um rascunho, abra Configurações e volte: o texto deve permanecer.
3. Para uma nova resposta real, libere somente o controle de IA no painel administrativo, com motivo. Os testes desta entrega restauraram a pausa anterior.
4. Envie um problema, recarregue e reabra em Conversas. Confira a resposta persistida e Diagnóstico separado do chat.
5. Em uma empresa de teste, informe um dado explícito próprio, como número de funcionários, sem classificá-lo como simulação. Confira Minha empresa/Memória; depois informe uma atualização explícita. Não use dados reais desnecessários.
6. Corrija esse registro manualmente e confirme sua prioridade. Remova apenas o registro de teste, usando a confirmação da interface.
7. Escolha TXT/CSV/MD pequeno no menu de anexo; confira o nome e a remoção. PDF ou imagem deve informar que o formato ainda não é suportado.
8. Troque entre os quatro idiomas; moeda e empresa devem permanecer. Em tela pequena, abra e feche o menu e confira rascunho e conversa.

Parar nesta fase e aguardar autorização para a próxima.
