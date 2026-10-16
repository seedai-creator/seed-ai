begin;

-- Preserve all financial records. Temporary test quotas have their own counter.
alter table public.ai_requests add column allowance_id uuid references public.commercial_overrides(id);
create index ai_requests_allowance on public.ai_requests(allowance_id) where allowance_id is not null;

-- p_window is retained for backwards compatibility, never trusted as the source
-- of entitlement. The subscription and active administrative allowance decide.
create or replace function public.commercial_usage(p_user uuid,p_window text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
 sub public.subscriptions%rowtype;
 ov public.commercial_overrides%rowtype;
 plan text := 'FREE'; policy jsonb; window_start timestamptz := '-infinity';
 window_end timestamptz; window_kind text := 'lifetime'; allowance uuid;
 used numeric; conversations bigint; automatic bigint;
begin
 select * into sub from public.subscriptions where user_id=p_user
  and status in ('active','trialing') and current_period_end>now()
  order by current_period_end desc limit 1;
 if found then
  if sub.current_period_start is null or sub.current_period_start>now()
   or sub.current_period_start>=sub.current_period_end then raise exception 'Subscription period unavailable'; end if;
  plan:=sub.plan_code; window_start:=sub.current_period_start;
  window_end:=sub.current_period_end; window_kind:='subscription';
 end if;
 select * into ov from public.commercial_overrides where user_id=p_user
  and revoked_at is null and expires_at>now() order by created_at desc limit 1;
 if found then
  plan:=coalesce(ov.settings->>'plan_code',plan);
  if ov.kind='CUSTOM_ALLOWANCE' then allowance:=ov.id; end if;
 end if;
 select p.policy into policy from public.commercial_plans p where p.code=plan and available;
 policy:=coalesce(ov.settings->'policy',policy);
 if policy is null then raise exception 'Usage policy unavailable'; end if;
 if window_kind<>'subscription' and policy->>'window'='month' then
  window_start:=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
  window_end:=window_start+interval '1 month'; window_kind:='month';
 end if;
 select coalesce(sum(coalesce(accounted_usd,reserved_usd)),0) into used
  from public.ai_requests where user_id=p_user and created_at>=window_start;
 select count(*) into conversations from public.ai_requests
  where user_id=p_user and feature='diagnosis' and status<>'FAILED'
  and ((allowance is not null and allowance_id=allowance)
   or (allowance is null and allowance_id is null and created_at>=window_start));
 select count(*) into automatic from public.ai_requests
  where user_id=p_user and feature='WEEKLY_INTELLIGENCE_GENERATION'
  and status<>'FAILED' and created_at>=window_start;
 return jsonb_build_object('plan',plan,'policy',policy,'cost',used,'count',conversations,
  'diagnoses',conversations,'automatic_reports',automatic,'window',window_kind,
  'period_start',case when isfinite(window_start) then window_start else null end,
  'period_end',window_end,'allowance_id',allowance,
  'allowance_expires_at',case when allowance is not null then ov.expires_at else null end,
  'analysis_limit',least((policy->>'diagnoses')::bigint,(policy->>'interactions')::bigint));
end $$;
revoke all on function public.commercial_usage(uuid,text) from public,anon,authenticated;
grant execute on function public.commercial_usage(uuid,text) to service_role;

create or replace function public.reserve_ai_request(p_user uuid,p_company uuid,p_id uuid,p_reserve numeric,p_feature text default 'diagnosis',p_fingerprint text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare plan text:='FREE'; market text; policy jsonb; used numeric; day_used numeric; month_used numeric; global_used numeric; count_used bigint; window_start timestamptz; override_row record; snapshot jsonb; allowance uuid;
begin
 perform pg_advisory_xact_lock(9128001);
 if p_reserve is null or p_reserve<=0 or p_reserve>1000 then raise exception 'Invalid reservation'; end if;
 if not exists(select 1 from public.company_members where user_id=p_user and company_id=p_company) then raise exception 'Access denied'; end if;
 if exists(select 1 from public.ai_requests where id=p_id) then raise exception 'Duplicate request' using errcode='40001'; end if;
 select market_code into market from public.commercial_accounts where user_id=p_user;
 if market is null or not exists(select 1 from public.commercial_markets where code=market and (status in ('ACTIVE','PAUSED') or (status='READY' and exists(select 1 from public.commercial_overrides o where o.user_id=p_user and o.expires_at>now() and o.revoked_at is null and o.settings->>'market_access'='true'))) and not disable_ai_requests) then raise exception 'Market unavailable'; end if;
 snapshot:=public.commercial_usage(p_user,'lifetime');
 plan:=snapshot->>'plan'; policy:=snapshot->'policy';
 if p_feature='WEEKLY_INTELLIGENCE_GENERATION' and plan<>'PRO' then return jsonb_build_object('allowed',false,'reason','PRO_REQUIRED'); end if;
 allowance:=(snapshot->>'allowance_id')::uuid;
 used:=(snapshot->>'cost')::numeric; count_used:=(snapshot->>'count')::bigint;
 if p_feature not in ('classification','diagnosis','BUSINESS_JOURNAL_EXTRACTION','BUSINESS_JOURNAL_CLASSIFICATION','WEEKLY_INTELLIGENCE_GENERATION') then raise exception 'Invalid feature'; end if;
 if p_fingerprint is not null and exists(select 1 from public.ai_requests where user_id=p_user and fingerprint=p_fingerprint and created_at>now()-interval '30 seconds') then return jsonb_build_object('allowed',false,'reason','DUPLICATE_REQUEST'); end if;
 select coalesce(sum(coalesce(accounted_usd,reserved_usd)),0) into day_used from public.ai_requests where user_id=p_user and created_at>=(date_trunc('day',now() at time zone 'UTC') at time zone 'UTC');
 select coalesce(sum(coalesce(accounted_usd,reserved_usd)),0) into month_used from public.ai_requests where user_id=p_user and created_at>=(date_trunc('month',now() at time zone 'UTC') at time zone 'UTC');
 select coalesce(sum(coalesce(accounted_usd,reserved_usd)),0) into global_used from public.ai_requests where created_at>=(date_trunc('day',now() at time zone 'UTC') at time zone 'UTC');
 if p_feature in ('classification','diagnosis') and count_used>=(snapshot->>'analysis_limit')::bigint then return jsonb_build_object('allowed',false,'reason','DIAGNOSIS_LIMIT'); end if;
 if used+p_reserve>(policy->>'hard_usd')::numeric or day_used+p_reserve>(policy->>'user_day_usd')::numeric or month_used+p_reserve>(policy->>'user_month_usd')::numeric or global_used+p_reserve>(policy->>'global_day_usd')::numeric then
  insert into public.commercial_events(user_id,market_code,event,dedupe_key) values(p_user,market,case when plan='FREE' then 'free_hard_limit_reached' else 'pro_protection_reached' end,'hard:'||p_user||':'||current_date) on conflict(dedupe_key) do nothing;
  return jsonb_build_object('allowed',false,'reason','HARD_LIMIT');
 end if;
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
commit;
