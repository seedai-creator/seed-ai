# Candidato operacional da Fase 13

Preparado e publicado em 16/10/2026 após autorização explícita do titular. O commit `ecf7bfe0bd20cb0b7b4ff4f7bffbb58229d0e66a` passou na CI e foi integrado pelo PR #1. A promoção na Vercel ocorreu às **22:42:29 UTC**, deployment `dpl_Be81VbTputSNzvdf7VcZZiFLEhv1`. Aplicativo fechado ao público, landing acessível e novas assinaturas bloqueadas. Esta publicação operacional não é abertura comercial nem início da Fase 14.

## Escopo autorizado e executado

Publicar os controles operacionais já testados: acesso administrativo com MFA, suporte e solicitações/exportação de privacidade, controles de pausa e acesso, observabilidade de falhas/custos/filas, verificador de saúde, correções de medição e limites. Preservar a experiência FREE já publicada, os preços/franquias combinados, o bloqueio de novas assinaturas, a landing e o bloqueio público do aplicativo. Nenhuma oferta candidata será ativada. Documentos jurídicos finais não serão publicados por inferência.

Foram aplicadas exclusivamente estas oito migrações pendentes em produção, após conferir backup, fontes, catálogo e histórico:

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

A versão de retorno preservada é `dpl_8KbUX5kd9oZJ2y1DDiagPCfEekzS`, conferida antes da promoção. Em problema de aplicação, retornar ao deployment preservado e verificar a landing/bloqueio novamente. Banco é aditivo, mas altera funções: rollback de interface não reverte permissões, filas ou cálculo. A versão antiga também não fornece o novo endpoint de saúde; o monitor deve indicar essa degradação até uma correção revisada. Não executar DROP nem restauração sobre dados novos para desfazer uma tela.

O endpoint publicado, os dois avisos reais de teste e a ativação no GitHub passaram. Duas execuções reais do workflow confirmaram saúde e persistência entre runs, sem e-mails adicionais. O cron está ativo e configurado para dez minutos; o histórico do GitHub mostra atrasos, e a primeira execução periódica pós-ativação ainda não foi observada. Os testes de Stripe usaram exclusivamente pagamentos fictícios e provam webhook/reenvio/cancelamento, não cobrança live, calendário de cobrança automática, reembolso ou compras Apple/Google. Os ensaios não estabelecem SLA ou capacidade para número ilimitado de usuários.

A especificação do titular determina: “NÃO fazer deploy de produção sem minha autorização explícita.” A autorização desta publicação, das oito migrações, periodicidade e avisos foi recebida antes da execução. A revisão automática exigiu confirmação adicional para armazenar os dois secrets no GitHub; o titular autorizou expressamente esse destino antes da gravação. A ativação não alterou aplicação, planos, landing ou controles de acesso. Novas publicações continuam sujeitas à regra da especificação.
