# SeedAI — metas operacionais adotadas

Versão 1 · 17/10/2026. O titular aprovou estas metas nesta conversa. São objetivos internos de operação; não constituem SLA vendido nem declaração de desempenho já alcançado. Planos continuam desativados, aplicativo fechado e landing preservada.

## Responsabilidade e cobertura

Responsável: João Gabriel S. Carvalho, pela Seed Tecnologias LTDA. Alertas internos: seedtecnologias.suporte@gmail.com. Atendimento: suporte@appseedai.com; privacidade mantém seedtecnologias.suporte@gmail.com. Cobertura humana: segunda a sexta, 9h–18h, America/Sao_Paulo, exceto feriados locais. Fora dessa cobertura os controles automáticos continuam funcionando; não há plantão 24 horas comprovado. Um substituto ainda deve ser designado antes de anunciar cobertura ampliada.

| Indicador | Meta e forma de medir | Evidência e limite atual |
| --- | --- | --- |
| Disponibilidade | Pelo menos 99,5% em janela móvel de 30 dias; até 216 minutos indisponíveis em 30 dias. Medir login, leitura/gravação autorizada e análise, separadamente da landing. Contar falhas de fornecedores e manutenção com impacto. | O monitor de saúde não testa toda a jornada. App deliberadamente fechado: disponibilidade comercial ainda não mensurável. Não declarar a meta atingida sem a janela e cobertura de medição. |
| Suporte | Primeira resposta humana em até 1 dia útil, na cobertura definida. Registrar recebimento, responsável, categoria, prazo aplicável e resposta. | Canal disponível; ensaiar processo e confirmar recebimento das demandas. Resposta inicial não significa resolução. Prazos legais específicos prevalecem, inclusive confirmação imediata quando exigida. |
| Incidente crítico | Avaliação em até 1 hora após entrega do alerta dentro da cobertura; recuperação em até 4 horas após diagnóstico e decisão de recuperar. Medir também tempo total desde início do impacto, sem esconder atraso de detecção. | Não há certificação de atendimento fora do horário. P0: conter exposição/cobrança indevida imediatamente ao tomar ciência; não aguardar o prazo da meta. |
| Backup/RPO | Conferência diária da execução e idade do último backup válido. Objetivo de perda máxima de 24 horas; falta/idade superior exige incidente. | Backup diário confirmado e restauração fictícia ensaiada; não há garantia de RPO de 24 horas em toda falha, nem PITR contratado por esta aprovação. |
| Recuperação/RTO | Objetivo de 4 horas, com validação de Auth, isolamento, dados e exclusões antes de reabrir. Exercício mensal nos três primeiros meses; trimestral depois se aprovado. | Ensaio de 14/10: 9min34s numa cópia pequena de staging. Não extrapolar duração ou cobertura para produção/Storage. Próximos exercícios: novembro, dezembro/2026 e janeiro/2027, sob responsabilidade operacional; nenhum projeto pago ou agendamento externo criado neste documento. |
| IA | Pelo menos 95% das solicitações válidas concluídas em até 45 segundos. Denominador inclui timeout e erro do provedor; excluir somente entrada inválida, bloqueio legítimo de acesso/franquia e cancelamento anterior à execução. Medir taxa de recusa à parte. | Avaliações anteriores comprovam casos específicos, não este percentil com usuários reais. Registrar duração de ponta a ponta, tamanho da amostra e janela. |
| Custos | PRO 1: US$ 4; PRO 3: US$ 8; PRO 5: US$ 16 por conta/ciclo. Compartilhados entre empresas e tarefas, inclusive automáticas. Aviso preventivo até 80%; reservar custo antes da chamada e recusar excedente. | Oferta candidata já avisa a partir de 70%, portanto antes de 80%. Custo desconhecido mantém reserva. As novas franquias não foram ativadas. Não pressupor cobrança exata do provedor. |
| Conciliação | Semanal: consumo/reservas/faturas, eventos Stripe e concessões. Mensal: receita líquida, IA, hospedagem, banco, e-mail, taxas, impostos, suporte e reembolsos. | Estimativa do aplicativo não é fatura nem lucro garantido. Custos desconhecidos são pendências, nunca zero. |

## Orçamento e resposta

Os limites US$ 4/8/16 são de IA por conta/ciclo, não crédito monetário do cliente. FREE conserva a proteção existente de US$ 0,25 e até três análises no total, sem reinício mensal. Não se vende excedente automaticamente, nem se exige compra de créditos fora da SeedAI.

Para previsão, somar franquias dos ciclos atendidos e orçamento FREE à infraestrutura e despesas reais; não confundir calendário mensal com ciclos individuais. Não aumentar limite global automaticamente a partir de assinaturas, projeções ou deste documento. A política existente determina a reserva/limite efetivo; habilitar novos planos exige conferir a capacidade e o orçamento agregado. Revisar semanalmente e antes de expandir a coorte.

## Alertas e comprovação

Monitor GitHub solicitado a cada dez minutos, com atrasos do provedor. Execuções periódicas de 17/10 confirmaram funcionamento; não prometem detecção em dez minutos. Lacunas e indisponibilidade do próprio monitor devem constar da medição. Revisão diária: último sucesso, atraso de cron/filas, entregas e backup. Revisão semanal: incidentes, atendimento, conciliação e exceções de privacidade. Não marcar ausência de dados como cumprimento de meta.

Guardar evidência mínima: janela, contagem, duração, identificadores técnicos, responsável, resultado e ação corretiva, sem mensagens empresariais ou secrets. Alertas detectam amostras da saúde; não substituem jornada sintética, faturas ou teste de recuperação.

## Critério de liberação

Metas adotadas não abrem o produto. Para lançamento pago, confirmar documentos vigentes e procedimentos de privacidade, medição inicial, responsável na cobertura, catálogo versionado por oferta, cobrança live, reembolso e teste do canal. Zero P0/P1 sem tratamento. Uma avaliação NOT READY é resultado válido da Fase 13; não encerrar pendências por alterar o rótulo.

Referências: [operação](PHASE_13_OPERATIONS.md), [estado](PHASE_13_STATUS.md), [monitor](INDEPENDENT_MONITOR.md), [preparação Stripe](STRIPE_ACTIVATION.md). Atendimento eletrônico: [Decreto 7.962/2013, art. 4º](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm).
