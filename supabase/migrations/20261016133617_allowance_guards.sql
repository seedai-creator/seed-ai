begin;

-- Separate long-context rate, never retroactively alter existing price records.
-- Official GPT-6 Sol page checked 2026-10-16: >272k input, 2x input/cache,
-- 1.5x output. No inferred multipliers for other models.
insert into public.ai_model_pricing(provider,model,input_per_million,cached_per_million,cache_write_per_million,output_per_million,currency,processing_tier,context_tier,effective_from)
values('openai','gpt-6-sol',4,0.4,5,15,'USD','default','long',now())
on conflict(provider,model,processing_tier,context_tier) where effective_to is null do nothing;

-- The existing catalog editor changes standard pricing only. Preserve the
-- separate long-context price when an administrator updates cache-write rates.
do $$ declare definition text; old_fragment text:= 'where model=p_value->>''model'' and provider=''openai'' and effective_to is null';
begin
 definition:=pg_get_functiondef('public.change_commercial_catalog(uuid,text,jsonb,text)'::regprocedure);
 if position(old_fragment in definition)=0 then raise exception 'Expected pricing editor unavailable'; end if;
 execute replace(definition,old_fragment,old_fragment||' and processing_tier=''default'' and context_tier=''standard''');
end $$;

-- Base operational allowance plus one funded cycle envelope per paid account.
-- Candidate policies are NOT enabled here; legacy plans keep the base guard.
-- Kill switches, reservation lock, rate limits and per-account caps still apply.
create function public.commercial_global_day_budget() returns numeric
language plpgsql stable security definer set search_path='' as $$
declare base numeric; funded numeric:=0;
begin
 select min((policy->>'global_day_usd')::numeric) into base from public.commercial_plans
 where available and jsonb_typeof(policy->'global_day_usd')='number' and (policy->>'global_day_usd')::numeric>0;
 if base is null then raise exception 'Operational budget unavailable'; end if;
 -- One aggregate over effective entitlements, not an N+1 scan of usage history.
 with subs as (
  select distinct on(user_id) user_id,plan_code from public.subscriptions
  where status in ('active','trialing') and current_period_start<=now() and current_period_end>now()
  order by user_id,current_period_end desc
 ), overrides as (
  select distinct on(user_id) user_id,settings from public.commercial_overrides
  where revoked_at is null and expires_at>now() order by user_id,created_at desc
 ), effective as (
  select coalesce(o.settings->>'plan_code',s.plan_code,'FREE') plan,
    coalesce(o.settings->'policy',p.policy) policy
  from subs s full join overrides o using(user_id)
  join public.commercial_plans p on p.code=coalesce(o.settings->>'plan_code',s.plan_code,'FREE') and p.available
 ) select coalesce(sum((policy->>'hard_usd')::numeric),0) into funded from effective
 where plan<>'FREE' and policy->>'analysis_limit_mode'='budget';
 return base+funded;
end $$;
revoke all on function public.commercial_global_day_budget() from public,anon,authenticated;
grant execute on function public.commercial_global_day_budget() to service_role;

create or replace function public.reserve_ai_request(p_user uuid,p_company uuid,p_id uuid,p_reserve numeric,p_feature text default 'diagnosis',p_fingerprint text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare plan text:='FREE'; market text; policy jsonb; used numeric; day_used numeric; month_used numeric; global_used numeric; count_used bigint; window_start timestamptz; override_row record; snapshot jsonb; allowance uuid;
begin
 perform pg_advisory_xact_lock(9128001);
 if p_reserve is null or p_reserve<=0 or p_reserve>1000 then raise exception 'Invalid reservation'; end if;
 if not exists(select 1 from public.company_members where user_id=p_user and company_id=p_company) then raise exception 'Access denied'; end if;
 if exists(select 1 from public.ai_requests where id=p_id) then raise exception 'Duplicate request' using errcode='PT409'; end if;
 select market_code into market from public.commercial_accounts where user_id=p_user;
 if market is null or not exists(select 1 from public.commercial_markets where code=market and (status in ('ACTIVE','PAUSED') or (status='READY' and exists(select 1 from public.commercial_overrides o where o.user_id=p_user and o.expires_at>now() and o.revoked_at is null and o.settings->>'market_access'='true'))) and not disable_ai_requests) then raise exception 'Market unavailable'; end if;
 snapshot:=public.commercial_usage(p_user,'lifetime');
 plan:=snapshot->>'plan'; policy:=snapshot->'policy';
 if p_feature='WEEKLY_INTELLIGENCE_GENERATION' and plan<>'PRO' then return jsonb_build_object('allowed',false,'reason','PRO_REQUIRED'); end if;
 allowance:=(snapshot->>'allowance_id')::uuid;
 used:=(snapshot->>'cost')::numeric; count_used:=(snapshot->>'count')::bigint;
 if p_feature not in ('classification','diagnosis','BUSINESS_JOURNAL_EXTRACTION','BUSINESS_JOURNAL_CLASSIFICATION','WEEKLY_INTELLIGENCE_GENERATION','EXTERNAL_RESEARCH_PLANNING','WEB_SEARCH_QUICK','WEB_SEARCH_STANDARD','WEB_SEARCH_DEEP','EXTERNAL_SYNTHESIS') then raise exception 'Invalid feature'; end if;
 if p_fingerprint is not null and exists(select 1 from public.ai_requests where user_id=p_user and fingerprint=p_fingerprint and created_at>now()-interval '30 seconds') then return jsonb_build_object('allowed',false,'reason','DUPLICATE_REQUEST'); end if;
 select coalesce(sum(coalesce(accounted_usd,reserved_usd)),0) into day_used from public.ai_requests where user_id=p_user and created_at>=(date_trunc('day',now() at time zone 'UTC') at time zone 'UTC');
 select coalesce(sum(coalesce(accounted_usd,reserved_usd)),0) into month_used from public.ai_requests where user_id=p_user and created_at>=(date_trunc('month',now() at time zone 'UTC') at time zone 'UTC');
 select coalesce(sum(coalesce(accounted_usd,reserved_usd)),0) into global_used from public.ai_requests where created_at>=(date_trunc('day',now() at time zone 'UTC') at time zone 'UTC');
 if coalesce(policy->>'analysis_limit_mode','count')<>'budget' and p_feature in ('classification','diagnosis') and count_used>=(snapshot->>'analysis_limit')::bigint then return jsonb_build_object('allowed',false,'reason','DIAGNOSIS_LIMIT'); end if;
 if used+p_reserve>(policy->>'hard_usd')::numeric then
  if used>=(policy->>'hard_usd')::numeric then
  insert into public.commercial_events(user_id,market_code,event,dedupe_key) values(p_user,market,case when plan='FREE' then 'free_hard_limit_reached' else 'pro_protection_reached' end,'hard:'||p_user||':'||current_date) on conflict(dedupe_key) do nothing;
  end if;
  return jsonb_build_object('allowed',false,'reason',case when used>=(policy->>'hard_usd')::numeric then 'HARD_LIMIT' else 'REQUEST_BUDGET' end);
 end if;
 -- Budget mode is per subscription cycle, not a second calendar-month quota.
 if coalesce(policy->>'analysis_limit_mode','count')<>'budget' then
  if day_used+p_reserve>(policy->>'user_day_usd')::numeric then return jsonb_build_object('allowed',false,'reason','DAILY_BUDGET'); end if;
  if snapshot->>'window'<>'subscription' and month_used+p_reserve>(policy->>'user_month_usd')::numeric then return jsonb_build_object('allowed',false,'reason','HARD_LIMIT'); end if;
 end if;
 if global_used+p_reserve>public.commercial_global_day_budget() then return jsonb_build_object('allowed',false,'reason','GLOBAL_BUDGET'); end if;
 if (select count(*) from public.ai_requests where user_id=p_user and status='RESERVED' and created_at>now()-interval '2 minutes')>=(policy->>'max_concurrent')::int or (select count(*) from public.ai_requests where user_id=p_user and created_at>now()-interval '1 minute')>=(policy->>'requests_per_minute')::int then
  return jsonb_build_object('allowed',false,'reason','RATE_LIMIT');
 end if;
 if plan='FREE' and used>=(policy->>'soft_usd')::numeric then
 insert into public.commercial_events(user_id,market_code,event,dedupe_key) values(p_user,market,'free_soft_limit_reached','soft:'||p_user||':'||current_date) on conflict(dedupe_key) do nothing; end if;
 insert into public.ai_requests(id,user_id,company_id,plan_code,market_code,status,reserved_usd,feature,fingerprint,allowance_id) values(p_id,p_user,p_company,plan,market,'RESERVED',p_reserve,p_feature,p_fingerprint,case when p_feature='diagnosis' then allowance else null end);
 return jsonb_build_object('allowed',true,'plan',plan,'market',market,'used_usd',used,'policy',policy);
end $$;
revoke all on function public.reserve_ai_request(uuid,uuid,uuid,numeric,text,text) from public,anon,authenticated;
grant execute on function public.reserve_ai_request(uuid,uuid,uuid,numeric,text,text) to service_role;

create or replace function public.reserve_external_ai(p_user uuid,p_company uuid,p_id uuid,p_reserve numeric,p_feature text,p_fingerprint text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg jsonb;snap jsonb;depth text;day_cost numeric;company_cost numeric;begin
 perform pg_advisory_xact_lock(9128001);
 if p_feature not in ('EXTERNAL_RESEARCH_PLANNING','WEB_SEARCH_QUICK','WEB_SEARCH_STANDARD','WEB_SEARCH_DEEP','EXTERNAL_SYNTHESIS') then raise exception 'EXTERNAL_FEATURE_INVALID';end if;
 select value into cfg from public.commercial_settings where id='external_research';
 if cfg is null or not coalesce((cfg->>'enabled')::boolean,false) or exists(select 1 from public.external_preferences where company_id=p_company and user_id=p_user and (not enabled or sensitive_mode)) then return jsonb_build_object('allowed',false,'reason','EXTERNAL_DISABLED');end if;
 snap:=public.commercial_usage(p_user,'lifetime');
 if p_feature like 'WEB_SEARCH_%' then
 depth:=replace(p_feature,'WEB_SEARCH_','');
 if not coalesce((case when snap->>'plan'='PRO' then cfg->'pro_depths' else cfg->'free_depths' end) ? depth,false) then return jsonb_build_object('allowed',false,'reason','PRO_REQUIRED');end if;
 end if;
 select coalesce(sum(coalesce(accounted_usd,reserved_usd)),0) into day_cost from public.ai_requests where user_id=p_user and feature in ('EXTERNAL_RESEARCH_PLANNING','WEB_SEARCH_QUICK','WEB_SEARCH_STANDARD','WEB_SEARCH_DEEP','EXTERNAL_SYNTHESIS') and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 select coalesce(sum(coalesce(accounted_usd,reserved_usd)),0) into company_cost from public.ai_requests where company_id=p_company and feature in ('EXTERNAL_RESEARCH_PLANNING','WEB_SEARCH_QUICK','WEB_SEARCH_STANDARD','WEB_SEARCH_DEEP','EXTERNAL_SYNTHESIS') and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
 if coalesce(snap->'policy'->>'analysis_limit_mode','count')<>'budget' and (day_cost+p_reserve>(cfg->>'max_user_day_usd')::numeric or company_cost+p_reserve>(cfg->>'max_company_month_usd')::numeric) then return jsonb_build_object('allowed',false,'reason','EXTERNAL_BUDGET');end if;
 if p_feature='WEB_SEARCH_DEEP' and (select count(*) from public.ai_requests where feature='WEB_SEARCH_DEEP' and status='RESERVED' and created_at>now()-interval '15 minutes')>=(cfg->>'max_deep_concurrency')::int then return jsonb_build_object('allowed',false,'reason','RATE_LIMIT');end if;
 return public.reserve_ai_request(p_user,p_company,p_id,p_reserve,p_feature,p_fingerprint);
end $$;

create or replace function public.queue_operational_alerts() returns integer
language plpgsql security definer set search_path='' as $$
declare errors bigint; ai_failures bigint; webhooks bigint; auth_failures bigint; tool_overruns bigint;
 backlog bigint; unknown_cost bigint; spend numeric; budget numeric; metrics jsonb; inserted integer; queues jsonb;
begin
 select count(*) filter(where level='ERROR'),
   count(*) filter(where code='AI_FAILED' and created_at>=now()-interval '2 minutes'),
   count(*) filter(where code='WEBHOOK_PROCESSING_FAILED'),
   count(*) filter(where feature='auth' and level in ('WARN','ERROR'))
 into errors,ai_failures,webhooks,auth_failures
 from public.operational_events where created_at>=now()-interval '15 minutes';
 select count(*) into tool_overruns from public.operational_events
 where code='AI_TOOL_LIMIT_EXCEEDED' and created_at>=now()-interval '15 minutes';
 queues:=public.operational_queue_health();
 select sum(value::bigint) into backlog from jsonb_each_text(queues);
 select coalesce(sum(coalesce(accounted_usd,reserved_usd)),0) into spend from public.ai_requests
 where created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 budget:=public.commercial_global_day_budget();
 select count(*) into unknown_cost from public.usage_logs
 where created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'
 and (cost_status='UNKNOWN' or (cost_status='PENDING' and created_at<now()-interval '15 minutes'));
 if errors<5 and ai_failures<5 and webhooks=0 and auth_failures<10 and backlog=0
   and unknown_cost=0 and tool_overruns=0 and (budget is null or spend<budget*0.8) then return 0; end if;
 metrics:=jsonb_build_object('errors_15m',errors,'ai_failures_2m',ai_failures,'tool_limit_exceeded_15m',tool_overruns,
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
