# SeedAI — controles para publicar a política

17/10/2026. Inventário de operação, sem segredos. A revisão profissional anterior foi informada pelo titular; esta matriz não pede repetir a revisão inicial. Complementos: [contratos e evidências dos fornecedores](FORNECEDORES_E_CONTRATOS.md) e [retenção/restore](../ACCESS_RETENTION.md). Não substitui a política nem autoriza excluir registros reais.

Responsável pela decisão de conservação: Seed Tecnologias LTDA, por João Gabriel S. Carvalho. Pedidos: seedtecnologias.suporte@gmail.com. Operação registra recebimento, confirmação proporcional de identidade, escopo, finalidade da retenção, categoria, destinatário, prazo legal aplicável, execução e revisão. Não pedir senha, documentos desnecessários ou assinatura paga.

## Conservação por categoria

| Categoria | Marco, critério e ação | Comprovação e pendência |
| --- | --- | --- |
| Conta e vínculos | Durante prestação; encerramento inicia inventário, revogação e avaliação de direitos dos demais membros. Separar cancelamento financeiro da exclusão. | Ensaio de staging em 17/10: seis grupos aprovados, incluindo reaplicação de exclusão após snapshot lógico. Fixtures removidas, empresa compartilhada preservada. Não executado sobre clientes reais. |
| Conversas, anexos de texto e memória | Enquanto necessários ao serviço. Pedido deve localizar origem, fatos, diagnósticos, estratégias, pesquisas, resultados e derivados, incluindo JSON; retirar o que não tenha fundamento para conservação. | Inventário cobre chaves estrangeiras diretas; conteúdo e derivados precisam de conferência por caso. Não há apagamento universal automático. |
| Registros de acesso | Prazo legal de seis meses a partir do acesso, conforme art. 15 do Marco Civil; guarda restrita, exceções documentadas. | IP/horário mínimo, meses de calendário, preservação e expurgo limitado implementados no candidato e schema no staging. Coleta desativada. Falta validar origem/cobertura/latência na Vercel e publicar antes de afirmar guarda efetiva em produção. Não conservar chat por esse fundamento. |
| Diagnóstico técnico e incidentes | Revisar necessidade quando o incidente for encerrado; retenção excepcional exige fundamento, responsável e data de revisão. | Proposta antiga de 30 dias para todos os logs não foi adotada. Separar registros legais, auditoria, diagnóstico e recibos de alerta. Rotina de expurgo geral não comprovada. |
| Uso e custos | Conciliação semanal; revisar detalhe após fechamento mensal, minimizando identificadores quando não necessários. Preservar o necessário a cobrança/contestação, sem incluir conteúdo empresarial. | Prazos fiscais e de prova variam por obrigação; registrar fundamento e marco no inventário antes de aprovar descarte. Não assumir cinco anos para toda a base. |
| Assinaturas e pagamentos | Vigência/encerramento da contratação e obrigação fiscal ou disputa concreta. Identificar prazo e categoria antes de reter ou eliminar. | Stripe em teste. Preparação live precisa fechar também reembolso, registro fiscal e retenção do provedor. |
| Suporte e privacidade | Conclusão do pedido inicia revisão do que comprova atendimento; remover anexos/dados desnecessários e manter prova mínima pelo fundamento registrado. | Horário e primeira resposta aprovados; retenção das caixas Gmail/Zoho e prazo de prova ainda não comprovados. |
| Monitor | Artefatos operacionais expiram em 30 dias; conservar somente estado, horário e contagens. | Workflow e expiração dos artefatos reais confirmados na API. Logs GitHub e mensagens Gmail são categorias distintas; retenção pública do Resend documentada no registro de fornecedores. |
| Backup | Rotação contratada; banco restaurado fica isolado até reaplicar bloqueios e exclusões. Recuperação fictícia não autoriza restaurar produção. | Restore físico anterior e novo ensaio real de snapshot lógico de conversa fictícia: registro externo reaplicado, token revogado, outro membro preservado. Não cobre todas as categorias/fornecedores nem promete expurgo imediato de backups. |
| Landing/lista de espera | Finalidade e aviso próprios; não transferir consentimento promocional para conta do aplicativo. | Titular confirmou em 17/10 a Seed Tecnologias LTDA como responsável também pela lista. Corrigir a identificação no aviso público; retenção e rotina da landing exigem verificação própria. |

## Fornecedores e transferências

| Fluxo | Dados mínimos/controle verificado no projeto | Prova necessária antes de declarar mecanismo validado |
| --- | --- | --- |
| Supabase | Conta, memória e banco; isolamento por empresa/ambiente; região publicada `sa-east-1` confirmada pela API. | Vinculação do DPA à conta, acesso/suporte internacional e suboperadores. Diferenciar dados ativos, logs e sete dias de backups Pro. |
| Vercel | Requisição e código executado no servidor; segredos fora do browser. | Regiões de execução/logs, DPA e instrumento para os fluxos internacionais efetivos. |
| OpenAI | Mensagem/contexto selecionado; `store:false`; pesquisa com `background:true`; sem chave no cliente. | Configuração da organização/projeto, compartilhamento e mecanismo contratual. `store:false` não elimina monitoramento de abuso nem armazenamento temporário de polling. |
| Resend | E-mails de autenticação e alertas mínimos; região de envio `sa-east-1`, abertura/cliques desligados confirmados pela API. | Vinculação do contrato e mecanismo de transferência; retenção pública de e-mails/logs registrada, sem equiparar região de envio à residência integral. |
| GitHub | Código público autorizado; saúde agregada, testes fictícios e secrets operacionais restritos. | DPA/condições do serviço, regiões/logs; nunca subir relatórios privados ou memória empresarial. |
| Gmail e Zoho | Atendimento em caixas distintas; acesso pelo responsável. | Condições efetivamente contratadas, acesso, retenção e descarte de mensagens, fluxo internacional. Não tratar conta Gmail gratuita como contrato empresarial presumido. |
| Stripe | Identificadores de assinatura, Checkout hospedado e eventos assinados de teste. | Contrato e dados do canal live, subprocessadores, retenção e obrigações fiscais antes da cobrança real. |

Uma página pública de DPA não comprova que determinado instrumento foi incorporado à relação da SeedAI nem cobre automaticamente a transferência brasileira. Guardar versão, data, partes e fundamento efetivamente aplicáveis em arquivo privado, publicando apenas a informação adequada ao titular. Não assinar contratos ou declarar países por suposição para remover uma pendência.

## Fluxo manual e validação

1. Identificar pedido e prazo; confirmar identidade sem coletar excessos. Exportar somente os dados autorizados ao titular, sem exportar a empresa inteira por padrão.
2. Inventariar vínculos, autores, jobs e obrigações. Revisar conversa e derivados além das chaves estrangeiras. Transferência da empresa compartilhada exige titular legítimo e aceite.
3. Preparar operação mínima e revisável. Revogar acesso/sessões e reconciliar tarefas pendentes antes de remover dados. Não executar exclusão cega de Auth com dependências financeiras.
4. Conferir dados de outro membro, consultas com token antigo e reautenticação. Registrar prova mínima e restrições a reaplicar se um backup for restaurado. Propagar pedido aos fornecedores quando cabível.
5. Responder o que foi feito, o que foi mantido e o fundamento/prazo de revisão. Não encerrar solicitação como apagamento completo se alguma categoria não foi verificada.

Ferramentas existentes: `scripts/privacy-review.mjs`, `scripts/prepare-privacy-review.mjs` e ensaio `scripts/test-staging-privacy.mjs --run` (somente staging fictício). O ensaio não executa uma política geral de retenção.

Fontes verificadas em 17/10/2026: [LGPD, arts. 9, 15–19, 33](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm), [Marco Civil, art. 15](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm), [ANPD — transferência internacional](https://www.gov.br/anpd/pt-br/assuntos/assuntos-internacionais/transferencia-internacional-de-dados). Observar o prazo específico de cada direito; não inventar prazo geral de 30 dias para todos os pedidos brasileiros.
