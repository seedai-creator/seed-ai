begin;

-- Internal outbox. No business content, email body, credentials or user identifiers.
create table public.operational_alerts (
 id uuid primary key default gen_random_uuid(),
 severity text not null check (severity in ('P1','P2')),
 window_start timestamptz not null,
 metrics jsonb not null check (jsonb_typeof(metrics)='object'),
 status text not null default 'QUEUED' check (status in ('QUEUED','SENDING','ACCEPTED','FAILED')),
 attempts integer not null default 0 check (attempts between 0 and 6),
 available_at timestamptz not null default now(),
 lease_token uuid, lease_until timestamptz,
 sender text, recipient text, environment text,
 provider_id uuid, failure_code text check (failure_code ~ '^[A-Z_]{1,50}$'),
 created_at timestamptz not null default now(), accepted_at timestamptz,
 unique(window_start,severity)
);
alter table public.operational_alerts enable row level security;
revoke all on public.operational_alerts from public,anon,authenticated;
grant select on public.operational_alerts to service_role;
create index operational_alerts_pending on public.operational_alerts(available_at,created_at)
 where status in ('QUEUED','SENDING');
create index if not exists ai_requests_created_at on public.ai_requests(created_at);
create index if not exists usage_logs_created_at on public.usage_logs(created_at);

create function public.queue_operational_alerts() returns integer
language plpgsql security definer set search_path='' as $$
declare errors bigint; ai_failures bigint; webhooks bigint; auth_failures bigint;
 backlog bigint; unknown_cost bigint; spend numeric; budget numeric; metrics jsonb; inserted integer;
begin
 select count(*) filter(where level='ERROR'),
   count(*) filter(where code='AI_FAILED' and created_at>=now()-interval '2 minutes'),
   count(*) filter(where code='WEBHOOK_PROCESSING_FAILED'),
   count(*) filter(where feature='auth' and level in ('WARN','ERROR'))
 into errors,ai_failures,webhooks,auth_failures
 from public.operational_events where created_at>=now()-interval '15 minutes';
 select count(*) into backlog from public.journal_jobs
 where status in ('QUEUED','RUNNING') and available_at<now()-interval '15 minutes';
 select coalesce(sum(coalesce(accounted_usd,reserved_usd)),0) into spend from public.ai_requests
 where created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 -- Conservative reference: the lowest available plan limit; temporary overrides may differ.
 select min((policy->>'global_day_usd')::numeric) into budget from public.commercial_plans
 where available and jsonb_typeof(policy->'global_day_usd')='number' and (policy->>'global_day_usd')::numeric>0;
 select count(*) into unknown_cost from public.usage_logs
 where created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'
 and (cost_status='UNKNOWN' or (cost_status='PENDING' and created_at<now()-interval '15 minutes'));
 if errors<5 and ai_failures<5 and webhooks=0 and auth_failures<10 and backlog=0
   and unknown_cost=0 and (budget is null or spend<budget*0.8) then return 0; end if;
 metrics:=jsonb_build_object('errors_15m',errors,'ai_failures_2m',ai_failures,
   'webhook_failures_15m',webhooks,'auth_failures_15m',auth_failures,'journal_overdue',backlog,
   'cost_unknown_today',unknown_cost,'accounted_or_reserved_usd_today',spend,'budget_reference_usd',budget);
 insert into public.operational_alerts(severity,window_start,metrics)
 values(case when errors>=5 or ai_failures>=5 or webhooks>0 then 'P1' else 'P2' end,
   date_trunc('hour',now() at time zone 'UTC') at time zone 'UTC',metrics)
 on conflict(window_start,severity) do nothing;
 get diagnostics inserted=row_count;
 return inserted;
end $$;

create function public.claim_operational_alert(p_sender text,p_recipient text,p_environment text)
returns setof public.operational_alerts language plpgsql security definer set search_path='' as $$
begin
 if p_sender is null or p_recipient is null or p_environment is null
 or p_environment not in ('development','staging','production')
 or length(p_sender)>254 or length(p_recipient)>254
 or p_sender !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
 or p_recipient !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
  raise exception 'Invalid delivery configuration';
 end if;
 -- Stop well inside the provider's 24-hour idempotency window, even after a long outage.
 update public.operational_alerts set status='FAILED',failure_code='RETRY_EXHAUSTED',lease_token=null,lease_until=null
 where status in ('QUEUED','SENDING') and (lease_until is null or lease_until<=now())
 and (attempts>=6 or created_at<now()-interval '23 hours');
 return query update public.operational_alerts a set status='SENDING',attempts=a.attempts+1,
 lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',
 sender=coalesce(a.sender,p_sender),recipient=coalesce(a.recipient,p_recipient),environment=coalesce(a.environment,p_environment)
 where a.id=(select q.id from public.operational_alerts q
 where q.status in ('QUEUED','SENDING') and q.available_at<=now()
 and (q.lease_until is null or q.lease_until<=now())
 and q.attempts<6 and q.created_at>=now()-interval '23 hours'
 order by q.created_at limit 1 for update skip locked)
 returning a.*;
end $$;

create function public.finish_operational_alert(p_id uuid,p_lease uuid,p_provider_id uuid,p_retry boolean,p_code text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_retry is null or (p_provider_id is null and (p_code is null or p_code not in
 ('PROVIDER_TRANSIENT','PROVIDER_REJECTED','NETWORK_FAILURE','INVALID_RESPONSE','INVALID_ALERT'))) then
 raise exception 'Invalid delivery result'; end if;
 update public.operational_alerts set
 status=case when p_provider_id is not null then 'ACCEPTED' when p_retry and attempts<6 then 'QUEUED' else 'FAILED' end,
 provider_id=p_provider_id,accepted_at=case when p_provider_id is not null then now() else null end,
 failure_code=case when p_provider_id is null then p_code else null end,
 available_at=now()+make_interval(secs=>least(3600,30*power(2,attempts)::integer)+floor(random()*15)::integer),
 lease_token=null,lease_until=null
 where id=p_id and lease_token=p_lease and status='SENDING' and lease_until>now();
 return found;
end $$;

revoke all on function public.queue_operational_alerts() from public,anon,authenticated;
revoke all on function public.claim_operational_alert(text,text,text) from public,anon,authenticated;
revoke all on function public.finish_operational_alert(uuid,uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.queue_operational_alerts() to service_role;
grant execute on function public.claim_operational_alert(text,text,text) to service_role;
grant execute on function public.finish_operational_alert(uuid,uuid,uuid,boolean,text) to service_role;
commit;
