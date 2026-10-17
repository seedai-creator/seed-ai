# Revisão da Política de Privacidade da SeedAI

## Retenção e fornecedores — complemento de 17/10/2026

A Política candidata 0.3 esclarece armazenamento temporário de pesquisa em segundo plano. O código atual de `src/lib/external/request.ts` utiliza `background:true`; a referência histórica abaixo a pesquisa exclusivamente em foreground não descreve mais esse caminho. [Inventário de fornecedores](FORNECEDORES_E_CONTRATOS.md) separa condições públicas, evidências da conta e pendências contratuais.

Retenção mínima de acessos implementada no candidato, desativada por padrão, com schema instalado no staging; falta validação do caminho hospedado e publicação autorizada. O novo ensaio de privacidade passou em seis grupos, incluindo reaplicação de supressão de conversa após snapshot lógico. Isso não representa expurgo universal de todas as categorias/fornecedores. [Procedimento](../ACCESS_RETENTION.md).

## Consolidação autorizada — 17/10/2026

O titular autorizou os ajustes e adotou as metas operacionais. A versão 0.2 incorpora o monitor GitHub/Resend, distingue registros legais de acesso dos demais logs e esclarece o prazo de primeira resposta. [Matriz de controles](CONTROLES_DE_PRIVACIDADE.md) preparada com responsáveis, marcos, rotinas e provas pendentes. Cinco grupos de privacidade passaram novamente no staging em 17/10; fixtures removidas, nenhuma exclusão real.

A informação de revisão profissional anterior foi preservada. Não é necessário repetir a revisão inicial. Permanecem verificações factuais: instrumentos de transferência efetivamente aplicáveis, configurações/retenção dos fornecedores, preservação legal dos registros de acesso e reaplicação de exclusões após restore. Aprovar metas não comprova essas configurações. A versão não foi publicada nem marcada como vigente no banco.

Leitura pública em 17/10: a política da landing responde 200 e ainda identifica João Gabriel Carvalho, sem menção à Seed Tecnologias LTDA. O titular confirmou em seguida que a **Seed Tecnologias LTDA é responsável por ambos**, aplicativo e lista de espera. Preparar a correção do aviso para refletir essa identificação, mantendo finalidade e escolhas de contato; não converter consentimento existente em autorização para novas finalidades nem retroagir versão. A página publicada ainda precisa receber essa correção, sem retirar a landing do ar.

Documento de preparação da Fase 13, atualizado em **15/10/2026**. A [minuta em português brasileiro](POLITICA_DE_PRIVACIDADE_PT_BR.md) não está aprovada, não foi inserida no banco e não foi publicada. A criação deste arquivo não encerra a Fase 13 nem autoriza a Fase 14.

**Atualização do titular em 15/10:** os documentos já foram revisados e os ajustes serão enviados. A pendência passa a ser receber e incorporar esses ajustes e conferir a versão final. Não pedir novamente revisão inicial nem publicar a minuta atual por inferência. O lançamento pretendido é comercial, com cobrança; o aviso final deverá corresponder aos canais e tratamentos efetivamente habilitados antes da abertura.

## Identificação confirmada pelo titular

- Responsável pelo aplicativo: **Seed Tecnologias LTDA**.
- Estabelecimento: **Itaúna, Minas Gerais, Brasil**.
- Contato de privacidade: **seedtecnologias.suporte@gmail.com**.
- Caixa empresarial adicional: **suporte@appseedai.com**, Zoho, com envio e recebimento confirmados pelo titular. Incluir esse fornecedor na revisão de contratos, regiões, acesso e retenção; não presumir que compartilhe as condições do Resend ou Gmail.
- CNPJ informado em 15/10: **61.526.298/0001-62**. Endereço informado: **Rua Cassiano Dornas, nº 175, Itaúna/MG, Brasil, CEP 35680-347**. Os dígitos verificadores passaram na conferência matemática; não houve consulta à Receita ou verificação independente do endereço. Conferir a correspondência cadastral antes da publicação; não solicitar CPF pessoal.

O endereço de suporte não foi apresentado como nomeação formal de encarregado. Avaliar essa obrigação, eventual dispensa aplicável e a identificação pública exigida, sem presumir que o porte da empresa a dispensa automaticamente.

## Decisões antes da publicação

| Ponto | Estado e ação necessária |
| --- | --- |
| Aprovação jurídica e do responsável | Revisar finalidades, bases legais, direitos, procedimentos e compromissos da minuta. Registrar a aprovação da versão exata, sem tratar a identificação da empresa como aprovação do texto. |
| Bases legais | A matriz é proposta para revisão. Validar contrato para titular contratante, legítimo interesse para representantes/segurança e as respectivas avaliações. A autorização de uso do software não é uma base legal genérica para dados de terceiros. |
| Relação com empresas clientes | Confirmar os papéis por atividade e formalizar as instruções, confidencialidade, suboperadores, incidentes, direitos e encerramento em instrumento adequado. Não afirmar que um acordo de tratamento já foi celebrado. |
| Retenção | Definir prazos máximos ou critérios verificáveis por categoria, marco de início, fundamento, responsável, rotina de revisão/expurgo e exceções. A sugestão de 30 dias para logs no procedimento operacional não é política implementada. |
| Exclusão e backups | Completar atendimento sobre texto/JSON, registros derivados, filas, dados financeiros, Gmail, fornecedores e backups. Testar reaplicação de exclusões após restore. O ensaio com fixtures não equivale a uma rotina universal de eliminação. |
| OpenAI | Conferir, sem expor credenciais, as opções de compartilhamento da organização/projeto, contratos, retenção por recurso e eventuais exceções. O padrão declarado pelo fornecedor não comprova a configuração da conta da SeedAI. Não há evidência de contrato de retenção zero. |
| Transferências internacionais | Inventariar destinatário, país/região, finalidade, categoria, papel e mecanismo efetivo para cada fluxo. Verificar instrumentos aplicáveis à LGPD e, quando pertinente, ao RGPD. Substituir a pendência explícita da seção 7 por informação verificada. |
| Fornecedores e suporte | Confirmar condições contratadas, suboperadores, acesso administrativo, configuração de rastreamento de e-mails e retenção de mensagens/logs. Documentar acesso e limpeza da caixa de suporte. Não importar para a SeedAI os prazos da conta do fornecedor. |
| Atendimento | Definir responsável, registro, confirmação proporcional de identidade, escalonamento e prazos legais por tipo de pedido. O e-mail continua sendo canal mesmo com aplicativo bloqueado; não prometer botão de exclusão instantânea. |
| União Europeia | Avaliar o alcance territorial da operação, representante/encarregado quando exigidos, transferências e avisos nos idiomas efetivamente oferecidos. A minuta pt-BR não substitui todas as versões jurídicas locais. |
| Produtos futuros | Revisar quando forem ativados pagamentos reais, lojas de aplicativos, novos formatos de anexo, ferramentas, analytics ou novos destinatários. Não descrever funcionalidades futuras como já ativas. |
| Termos de Uso | [Minuta preparada](TERMOS_DE_USO_PT_BR.md), ainda sujeita à [revisão própria](REVISAO_TERMOS_DE_USO.md) e aprovação. Política de Privacidade não é contrato completo, autorização universal ou garantia de conformidade. |

## Compatibilidade com a landing page

Leitura pública realizada em 15/10/2026: [aviso da página institucional](https://appseedai.com/seedai/pt-BR/privacy), HTTP 200, versão informada `privacy-review-2026-10-13-v2`.

O aviso existente cobre a lista de espera, identifica **João Gabriel Carvalho** como responsável e informa retenção de 30 dias/720 horas para o cadastro, canais de contato separados e uso de Vercel, Supabase, Resend e Gmail. Afirma que os cadastros dessa finalidade não são enviados à OpenAI. Essas são declarações do aviso; o ciclo de limpeza da landing não foi auditado nesta tarefa.

A minuta do aplicativo tem escopo separado. Não transferir o prazo de 30 dias para conversas e memória, nem os consentimentos de marketing para a conta do aplicativo. Confirmar se a empresa também assumirá a lista de espera e, se houver mudança de controlador, revisar a transição, transparência e registros necessários. Não sobrescrever o aviso público nem retroagir uma aprovação. A landing e sua coleta não foram alteradas.

## Correspondência com a implementação examinada

Base de leitura: branch `phase13-admin-privacy-validation`, HEAD `8f7f8180d7c345cd436b6c02c22d07e2bdd533e0`. Os recursos completos da Fase 13 estão em preparação; sua presença no código não comprova publicação em produção.

| Afirmação da minuta | Evidência no projeto e limite |
| --- | --- |
| Conta, sessões e empresa ativa | `src/app/auth/actions.ts`, `src/lib/auth/context.ts` e `src/lib/supabase/server.ts`. Cookie de empresa por 30 dias; autorização validada separadamente. |
| Idioma e rascunho | `src/lib/i18n/config.ts`, `src/app/auth/actions.ts`, `src/components/seed-workspace.tsx`. Idioma por um ano; rascunho em sessionStorage separado da persistência do servidor. |
| Conversas e memória não têm necessariamente o mesmo acesso | `src/app/workspace/actions.ts`: conversas filtradas por usuário e empresa; memória pela empresa autorizada. A correção/remoção usa `edit_business_memory`; remoção lógica não demonstra expurgo físico. |
| Registros derivados e processamento automático | `src/lib/memory/automatic.ts`, `src/lib/journal/requests.ts` e módulos de execução. Não prometer confirmação manual de cada registro nem ausência de trabalho automático após uma mensagem. |
| Texto de anexos | `src/lib/chat/attachments.ts`: TXT/MD/CSV, limite de 20.480 bytes e 2.000 caracteres. Não há suporte atual a imagem/PDF/áudio nesse fluxo. O texto participa da conversa. |
| IA e pesquisa | `src/lib/openai/request.ts`, `src/lib/journal/requests.ts`, `src/lib/simulation/requests.ts`, `src/lib/external/planner.ts`, `src/lib/external/report.ts` e `src/lib/external/meter.ts`. Pedidos com `store:false`; pesquisa efetiva em foreground. Planejamento/síntese também podem receber memória interna. |
| Pagamento | `src/app/billing/actions.ts` valida preços/sessões de teste e rejeita modo live. Não promete que cobrança real ou pagamentos de lojas estejam ativos. |
| Direitos e suporte | [Procedimento da Fase 13](../PHASE_13_OPERATIONS.md#exportação-exclusão-e-solicitações-de-privacidade). Exportação testada em staging; exclusão exige revisão manual e preservação justificada dos direitos de terceiros. |
| Segurança | Autorização no servidor/RLS, ambientes separados, HTTPS publicado e restauração ensaiada. Não alegar certificação da SeedAI, segurança absoluta, dados exclusivamente no Brasil ou criptografia ponta a ponta. |
| Ausência de anúncios no aplicativo | Inspeção do código desta versão não identificou pixels publicitários ou analytics opcionais de terceiros. Isso não audita extensões de navegador nem garante a configuração futura de provedores. |

O código de pesquisa contém instruções de minimização, mas isso não prova remoção perfeita de dados pessoais. A minuta evita essa promessa. A política de uso sem venda de dados, a destinação a adultos e o acesso limitado do suporte também precisam ser assumidos e cumpridos pelo responsável, não inferidos apenas de código.

O titular pretende lançar publicamente em 04/11/2026 com versões nas lojas. Os cadastros organizacionais foram iniciados e aguardam análise; o D-U-N-S e a caixa empresarial já foram obtidos. A política atual descreve o aplicativo web; dados de compras móveis, SDKs e fluxos de exclusão devem ser revisados quando definidos. Não declarar publicação ou conformidade das versões móveis somente pela existência desta minuta; consultar as dependências no [documento dos Termos](REVISAO_TERMOS_DE_USO.md#meta-de-lançamento-e-versões-de-loja).

## Fontes primárias consultadas em 15/10/2026

- **Transparência, bases legais, direitos e conservação:** [LGPD, texto legal](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm), especialmente arts. 7, 9, 16, 18 e 20. A matriz de bases legais é proposta específica para revisão da SeedAI, não conclusão de uma auditoria jurídica.
- **Atendimento ao titular:** [orientação da ANPD](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados/direito-dos-titulares). Preparar prazos e procedimentos por direito; não substituir todos os prazos legais por uma única promessa genérica.
- **Transferências:** [Resolução CD/ANPD nº 19/2024](https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-19-de-23-de-agosto-de-2024). A transferência precisa de hipótese de tratamento e mecanismo válidos. Não afirmar que cláusulas europeias, isoladamente, resolvem todos os fluxos brasileiros.
- **Atuação internacional:** [aplicação do RGPD](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/application-gdpr_en) e [obrigações de informação](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/obligations_en), Comissão Europeia. Avaliar a operação concreta antes de afirmar alcance ou conformidade global.
- **IA:** [OpenAI — controles de dados da API](https://developers.openai.com/api/docs/guides/your-data). O padrão de treinamento, a retenção de monitoramento de abuso e o armazenamento de respostas são questões distintas; `store:false` não equivale a Zero Data Retention.
- **Região e transferências da infraestrutura:** [Supabase — residência e transferências](https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq). A região do banco não restringe todas as atividades de suporte e operação à mesma região.
- **Referências para a conferência dos demais fornecedores:** [Vercel](https://vercel.com/legal/privacy-policy), [Resend](https://resend.com/legal/privacy-policy), [Stripe](https://stripe.com/privacy) e [Google](https://policies.google.com/privacy?hl=pt-BR). A consulta de suas políticas públicas não comprova assinatura de aditivos nem configuração específica das contas da SeedAI.

## Publicação futura

Após as decisões acima, consolidar o texto sem as notas de minuta, atribuir versão e vigência, revisar os idiomas necessários e obter aprovação da versão exata. A rota atual `src/app/legal/[kind]/page.tsx` só apresenta documentos aprovados e renderiza texto simples; preparar a apresentação adequada, sem presumir renderização Markdown.

Não inserir este rascunho com `approved=true`, não criar aceites em nome de usuários e não fazer deployment automático. Validar primeiro em staging o conteúdo, sua leitura e a diferença entre ciência da política e consentimentos opcionais. A publicação em produção permanece sujeita à autorização explícita exigida na Fase 13.

## Verificação desta entrega documental

Na criação da minuta, foram revisados o texto, a correspondência com o código, os links locais e a codificação UTF-8. Essa etapa alterou somente documentação.

Em seguida, o titular corrigiu a grafia da marca para **SeedAI**. O nome foi padronizado nesta minuta, nas referências visíveis do aplicativo, nos quatro idiomas e na instrução de identidade da IA, preservando a razão social e o acrônimo do Método SEED. Lint, typecheck e os 13 testes existentes de idiomas, composição do contexto de IA e alertas passaram. A varredura dos 438 arquivos versionáveis não encontrou credenciais. Não foram realizados build, chamadas reais de IA, alterações no banco ou publicação nesta correção de texto. Esses resultados não substituem a revisão jurídica e operacional pendente.
