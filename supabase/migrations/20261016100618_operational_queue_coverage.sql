begin;

-- Reuse the durable alert outbox. No new queue, customer payload or client access.
create index journal_overdue_time on public.journal_jobs(available_at)
 where status in ('QUEUED','RUNNING');
create index radar_overdue_time on public.radar_company_state(next_scan_at)
 where generation>processed_generation;
create index external_overdue_time on public.external_research_runs(created_at)
 where status in ('QUEUED','RUNNING');

create function public.operational_queue_health() returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'journal_overdue',(select count(*) from public.journal_jobs where status in ('QUEUED','RUNNING') and available_at<now()-interval '15 minutes'),
  'business_model_overdue',(select count(*) from public.business_model_jobs where status='QUEUED' and available_at<now()-interval '15 minutes'),
  'radar_overdue',(select count(*) from public.radar_company_state where generation>processed_generation and next_scan_at<now()-interval '15 minutes'),
  'external_overdue',(select count(*) from public.external_research_runs where status in ('QUEUED','RUNNING') and created_at<now()-interval '15 minutes'),
  'growth_overdue',(select count(*) from public.growth_map_requests where status in ('QUEUED','RUNNING') and next_at<now()-interval '15 minutes')
 );
$$;
revoke all on function public.operational_queue_health() from public,anon,authenticated;
grant execute on function public.operational_queue_health() to service_role;

-- CREATE OR REPLACE preserves the existing owner and execution grants.
create or replace function public.queue_operational_alerts() returns integer
language plpgsql security definer set search_path='' as $$
declare errors bigint; ai_failures bigint; webhooks bigint; auth_failures bigint;
 backlog bigint; unknown_cost bigint; spend numeric; budget numeric; metrics jsonb; inserted integer; queues jsonb;
begin
 select count(*) filter(where level='ERROR'),
   count(*) filter(where code='AI_FAILED' and created_at>=now()-interval '2 minutes'),
   count(*) filter(where code='WEBHOOK_PROCESSING_FAILED'),
   count(*) filter(where feature='auth' and level in ('WARN','ERROR'))
 into errors,ai_failures,webhooks,auth_failures
 from public.operational_events where created_at>=now()-interval '15 minutes';
 queues:=public.operational_queue_health();
 select sum(value::bigint) into backlog from jsonb_each_text(queues);
 select coalesce(sum(coalesce(accounted_usd,reserved_usd)),0) into spend from public.ai_requests
 where created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 select min((policy->>'global_day_usd')::numeric) into budget from public.commercial_plans
 where available and jsonb_typeof(policy->'global_day_usd')='number' and (policy->>'global_day_usd')::numeric>0;
 select count(*) into unknown_cost from public.usage_logs
 where created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'
 and (cost_status='UNKNOWN' or (cost_status='PENDING' and created_at<now()-interval '15 minutes'));
 if errors<5 and ai_failures<5 and webhooks=0 and auth_failures<10 and backlog=0
   and unknown_cost=0 and (budget is null or spend<budget*0.8) then return 0; end if;
 metrics:=jsonb_build_object('errors_15m',errors,'ai_failures_2m',ai_failures,
   'webhook_failures_15m',webhooks,'auth_failures_15m',auth_failures,
   'cost_unknown_today',unknown_cost,'accounted_or_reserved_usd_today',spend,'budget_reference_usd',budget)||queues;
 insert into public.operational_alerts(severity,window_start,metrics)
 values(case when errors>=5 or ai_failures>=5 or webhooks>0 then 'P1' else 'P2' end,
   date_trunc('hour',now() at time zone 'UTC') at time zone 'UTC',metrics)
 on conflict(window_start,severity) do nothing;
 get diagnostics inserted=row_count;
 return inserted;
end $$;
commit;
