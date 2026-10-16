# Candidato operacional da Fase 13

Preparado em 16/10/2026 na revisão `phase13-admin-privacy-validation`, PR #1. **Não é uma autorização de publicação ou abertura comercial.** O código dessa revisão ainda não é a versão que atende `appseedai.com`.

## Escopo para aprovação

Publicar os controles operacionais já testados: acesso administrativo com MFA, suporte e solicitações/exportação de privacidade, controles de pausa e acesso, observabilidade de falhas/custos/filas, verificador de saúde, correções de medição e limites. Preservar a experiência FREE já publicada, os preços/franquias combinados, o bloqueio de novas assinaturas, a landing e o bloqueio público do aplicativo. Nenhuma oferta candidata será ativada. Documentos jurídicos finais não serão publicados por inferência.

Aplicar exclusivamente estas oito migrações pendentes em produção, após conferir backup, fontes, catálogo e histórico:

1. `202610100001_production_readiness.sql`
2. `202610100002_admin_mfa.sql`
3. `202610100003_privacy_export.sql`
4. `20261014211433_operational_alerts.sql`
5. `20261014213558_privacy_dependency_inventory.sql`
6. `20261015165036_domain_conflict_status.sql`
7. `20261016100618_operational_queue_coverage.sql`
8. `20261016133617_allowance_guards.sql`

As migrações já existem e foram instaladas no staging, com comparação estrita de 81 tabelas/106 funções e dez grupos de integração comercial/RLS aprovados após a última alteração. A última corrige a medição/reserva de custos; não aplica as políticas dos novos planos. Não reaplicar as quatro migrações históricas da landing nem o bootstrap. Registrar as oito fontes corretas no histórico após conferir o resultado de cada instalação; não inventar registros para SQL não executado.

## Sequência de liberação

1. Exigir CI verde no commit exato, preservar manifestos/evidências e reler os bloqueios comerciais, configurações do domínio/landing e backup recente. Nenhum deploy automático está autorizado pelo simples merge.
2. Aplicar as oito migrações revisadas, respeitando a ordem/dependências e as guardas; falha interrompe a sequência. Conferir a diferença esperada e ausência de alteração nos preços/planos. Não relaxar acesso público como solução de erro.
3. Preparar deploy com ambiente explícito de produção, variáveis somente de servidor e provedor Stripe no modo já validado. Preservar chaves/endpoints funcionais. Conferir controles operacionais antes de habilitá-los, sem publicar minutas jurídicas ou convites para usuários.
4. Publicar o candidato e conferir domínio, landing, redirecionamentos do app, cron, autenticação do webhook, isolamento e ausência de novas ofertas. A promoção não ativa cobrança live.
5. Configurar o [monitor independente](INDEPENDENT_MONITOR.md), sua exceção exata no firewall e envio ao responsável. Validar aviso e recuperação autorizados. Agendamento só depois do ensaio.
6. Registrar release/horário, resultado e rollback; manter Fase 14 parada. A abertura comercial depende também da oferta/documentos finais e dos testes de pagamento próprios dessa etapa.

## Reversão e limites

A versão atual de produção é `dpl_8KbUX5kd9oZJ2y1DDiagPCfEekzS`; reconfirmar disponibilidade antes da promoção. Em problema de aplicação, retornar ao deployment preservado e verificar a landing/bloqueio novamente. Banco é aditivo, mas altera funções: rollback de interface não reverte permissões, filas ou cálculo. Preferir correção aditiva revisada; não executar DROP nem restauração sobre dados novos para desfazer uma tela.

O novo monitor ainda não enviou e-mails nem executou no GitHub. Sua preparação local não conclui a validação operacional. Os testes de Stripe usaram exclusivamente pagamentos fictícios e provam webhook/reenvio/cancelamento, não cobrança live, calendário de cobrança automática, reembolso ou compras Apple/Google. Os ensaios não estabelecem SLA ou capacidade para número ilimitado de usuários.

A especificação do titular determina: “NÃO fazer deploy de produção sem minha autorização explícita.” Esta publicação operacional e os novos avisos precisam de aprovação específica. A reconciliação do histórico já concluída não foi uma publicação de schema ou app.
