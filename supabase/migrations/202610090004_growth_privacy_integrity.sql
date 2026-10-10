-- An existing Phase 10 FK blocked company deletion when a goal referenced a metric definition.
-- Goal links are derived associations; observations keep their canonical value and metric code.
begin;
alter table public.goal_metric_links drop constraint goal_metric_links_company_id_metric_definition_id_fkey;
alter table public.goal_metric_links add constraint goal_metric_links_company_id_metric_definition_id_fkey
 foreign key(company_id,metric_definition_id) references public.metric_definitions(company_id,id) on delete cascade;
alter table public.business_journal_entries drop constraint journal_metric_definition_tenant;
alter table public.business_journal_entries add constraint journal_metric_definition_tenant
 foreign key(company_id,metric_definition_id) references public.metric_definitions(company_id,id) on delete set null(metric_definition_id);
commit;
