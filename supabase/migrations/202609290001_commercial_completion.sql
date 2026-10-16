begin;
alter table public.checkout_attempts add column provider_session_id text unique, add column closed_at timestamptz;
alter table public.ai_model_pricing add column cache_write_per_million numeric(18,6) check(cache_write_per_million>=0);
alter table public.usage_logs add column cache_write_tokens bigint check(cache_write_tokens>=0), add column estimated_cache_write_cost_usd numeric(24,12), add column cache_savings_usd numeric(24,12);
insert into public.commercial_settings(id,value) values ('international_launch','{"enabled":false}'),('economics','{}');
create or replace function public.begin_checkout(p_user uuid,p_market text,p_price uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare found_row public.checkout_attempts%rowtype;
begin
 perform 1 from public.profiles where id=p_user for update;
 if not found then raise exception 'Unknown user'; end if;
 if exists(select 1 from public.subscriptions where user_id=p_user and status in ('active','trialing','past_due','unpaid','incomplete') and (current_period_end>now() or status='incomplete')) then raise exception 'Subscription exists'; end if;
 if not exists(select 1 from public.commercial_accounts a join public.commercial_markets m on a.market_code=m.code where a.user_id=p_user and m.code=p_market and m.status='ACTIVE' and m.pro_enabled and m.billing_enabled and not m.disable_new_subscriptions) then raise exception 'Market unavailable'; end if;
 if not exists(select 1 from public.commercial_prices where id=p_price and market_code=p_market and plan_code='PRO' and status='ACTIVE' and effective_from<=now() and effective_to is null) then raise exception 'Price unavailable'; end if;
 select * into found_row from public.checkout_attempts where user_id=p_user and expires_at>now() and closed_at is null and created_at>coalesce((select max(updated_at) from public.subscriptions where user_id=p_user and status in ('canceled','incomplete_expired')),'-infinity'::timestamptz) order by created_at desc limit 1;
 if found then
  if found_row.price_id<>p_price then raise exception 'Checkout already pending'; end if;
  return to_jsonb(found_row);
 end if;
 insert into public.checkout_attempts(user_id,market_code,price_id) values(p_user,p_market,p_price) returning * into found_row;
 insert into public.commercial_events(user_id,market_code,event,dedupe_key) values(p_user,p_market,'checkout_started',found_row.id::text);
 return to_jsonb(found_row);
end $$;
revoke all on function public.begin_checkout(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.begin_checkout(uuid,text,uuid) to service_role;


create function public.update_checkout_attempt(p_user uuid,p_id uuid,p_session text,p_closed boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_session !~ '^cs_test_[A-Za-z0-9]+$' then raise exception 'Test checkout required'; end if;
 update public.checkout_attempts set provider_session_id=p_session,closed_at=case when p_closed then now() else closed_at end where id=p_id and user_id=p_user and (provider_session_id is null or provider_session_id=p_session);
 if not found then raise exception 'Checkout mismatch'; end if;
end $$;
revoke all on function public.update_checkout_attempt(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.update_checkout_attempt(uuid,uuid,text,boolean) to service_role;
create or replace function public.update_commercial_config(p_actor uuid,p_entity text,p_key text,p_version integer,p_value jsonb,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare old_value jsonb; new_value jsonb; role_name text; category text;
begin
 select role into role_name from public.admin_roles where user_id=p_actor;
 if role_name is distinct from 'SUPER_ADMIN' then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_reason is null or length(btrim(p_reason)) not between 5 and 1000 or octet_length(p_value::text)>30000 then raise exception 'Invalid change'; end if;
 if p_entity='market' then
  select to_jsonb(m) into old_value from public.commercial_markets m where code=p_key and version=p_version for update;
  if old_value is null then raise exception 'Configuration changed' using errcode='40001'; end if;
  if p_value->>'status'='ACTIVE' and old_value->>'status'<>'ACTIVE' then
   if p_key<>'BR' and not coalesce((select (value->>'enabled')::boolean from public.commercial_settings where id='international_launch'),false) then raise exception 'International launch disabled by configuration'; end if;
   if old_value->>'status' not in ('READY','PAUSED') then raise exception 'Market is not READY'; end if;
   foreach category in array array['configuration','localization','product','pricing','billing','legal_tax','privacy','ai_cost_protection','analytics','testing','emergency_controls'] loop
    if coalesce((p_value->'readiness'->category->>'pass')::boolean,false)=false or length(btrim(coalesce(p_value->'readiness'->category->>'evidence','')))=0 then raise exception 'Incomplete readiness'; end if;
   end loop;
   if not coalesce((select (value->>'enabled')::boolean from public.commercial_settings where id='rollout'),false) or not exists(select 1 from public.ai_model_pricing where effective_to is null) then raise exception 'AI protection required'; end if;
   if not exists(select 1 from public.commercial_prices where market_code=p_key and provider_price_id is not null and effective_to is null) then raise exception 'Billing price missing'; end if;
   update public.commercial_prices set status='ACTIVE',is_planning_hypothesis=false where market_code=p_key and effective_to is null;
  end if;
  update public.commercial_markets set status=p_value->>'status',signup_enabled=(p_value->>'signup_enabled')::boolean,free_enabled=(p_value->>'free_enabled')::boolean,pro_enabled=(p_value->>'pro_enabled')::boolean,billing_enabled=(p_value->>'billing_enabled')::boolean,disable_new_signups=(p_value->>'disable_new_signups')::boolean,disable_new_subscriptions=(p_value->>'disable_new_subscriptions')::boolean,disable_ai_requests=(p_value->>'disable_ai_requests')::boolean,readiness=p_value->'readiness',flags=p_value->'flags',version=version+1,updated_at=now() where code=p_key returning to_jsonb(commercial_markets.*) into new_value;
 elsif p_entity='policy' then
  select to_jsonb(p) into old_value from public.commercial_plans p where code=p_key and version=p_version for update;
  if old_value is null then raise exception 'Configuration changed' using errcode='40001'; end if;
  update public.commercial_plans set policy=p_value,version=version+1,updated_at=now() where code=p_key returning to_jsonb(commercial_plans.*) into new_value;
 else raise exception 'Unsupported entity'; end if;
 insert into public.admin_audit_log(actor,action,entity,market_code,old_state,new_state,reason) values(p_actor,case when p_entity='policy' then 'USAGE_POLICY_CHANGED' when old_value->>'status'<>new_value->>'status' then 'MARKET_'||(new_value->>'status') else 'MARKET_CONFIGURATION_CHANGED' end,p_entity||':'||p_key,case when p_entity='market' then p_key end,old_value,new_value,p_reason);
end $$;
revoke all on function public.update_commercial_config(uuid,text,text,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.update_commercial_config(uuid,text,text,integer,jsonb,text) to service_role;


alter function public.change_commercial_catalog(uuid,text,jsonb,text) rename to change_commercial_catalog_base;
revoke all on function public.change_commercial_catalog_base(uuid,text,jsonb,text) from service_role;
create function public.change_commercial_catalog(p_actor uuid,p_operation text,p_value jsonb,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare old_value jsonb; key text; rate numeric;
begin
 if not exists(select 1 from public.admin_roles where user_id=p_actor and role='SUPER_ADMIN') then raise exception 'Forbidden' using errcode='42501'; end if;
 if length(btrim(coalesce(p_reason,''))) not between 5 and 1000 or p_value is null or jsonb_typeof(p_value)<>'object' or octet_length(p_value::text)>30000 then raise exception 'Invalid change'; end if;
 perform pg_advisory_xact_lock(9128002);
 if p_operation in ('ROLLOUT_CHANGED','ROUTING_CHANGED','INTERNATIONAL_LAUNCH_CHANGED','ECONOMICS_CHANGED') then
  key:=case p_operation when 'ROLLOUT_CHANGED' then 'rollout' when 'ROUTING_CHANGED' then 'model_routing' when 'INTERNATIONAL_LAUNCH_CHANGED' then 'international_launch' else 'economics' end;
  if key in ('rollout','international_launch') and jsonb_typeof(p_value->'enabled') is distinct from 'boolean' then raise exception 'Invalid switch'; end if;
  if key='rollout' and (p_value->>'enabled')::boolean and not exists(select 1 from public.ai_model_pricing where effective_to is null) then raise exception 'Pricing required'; end if;
  if key='model_routing' and ((p_value->>'classification_output_tokens')::integer not between 128 and 32768 or (p_value->>'diagnosis_output_tokens')::integer not between 128 and 32768) then raise exception 'Invalid budget'; end if;
  select value into old_value from public.commercial_settings where id=key for update;
  update public.commercial_settings set value=p_value,version=version+1,updated_at=now() where id=key;
  insert into public.admin_audit_log(actor,action,entity,old_state,new_state,reason) values(p_actor,p_operation,key,old_value,p_value,p_reason);
 else
  perform public.change_commercial_catalog_base(p_actor,p_operation,p_value,p_reason);
  if p_operation='AI_PRICE_CHANGED' and p_value ? 'cache_write_per_million' then
   rate:=(p_value->>'cache_write_per_million')::numeric;
   if rate<0 then raise exception 'Invalid price'; end if;
   update public.ai_model_pricing set cache_write_per_million=rate where model=p_value->>'model' and provider='openai' and effective_to is null;
  end if;
 end if;
end $$;
revoke all on function public.change_commercial_catalog(uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.change_commercial_catalog(uuid,text,jsonb,text) to service_role;

create function public.reconcile_ai_cost(p_actor uuid,p_request uuid,p_cost numeric,p_evidence text) returns void language plpgsql security definer set search_path='' as $$
declare old_value jsonb;
begin
 if not exists(select 1 from public.admin_roles where user_id=p_actor and role='SUPER_ADMIN') then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_cost is null or p_cost<0 or p_cost>1000 or length(btrim(coalesce(p_evidence,''))) not between 10 and 1000 then raise exception 'Evidence required'; end if;
 select to_jsonb(r) into old_value from public.ai_requests r where id=p_request and status in ('UNKNOWN','FAILED') for update;
 if old_value is null then raise exception 'Request not reconcilable'; end if;
 update public.ai_requests set accounted_usd=p_cost,status='COMPLETED',completed_at=now() where id=p_request;
 update public.usage_logs set estimated_total_cost_usd=p_cost,cost_status='ESTIMATED' where request_id=p_request;
 insert into public.admin_audit_log(actor,action,entity,old_state,new_state,reason) values(p_actor,'AI_COST_RECONCILED',p_request::text,old_value,jsonb_build_object('cost_usd',p_cost),p_evidence);
end $$;
revoke all on function public.reconcile_ai_cost(uuid,uuid,numeric,text) from public,anon,authenticated;
grant execute on function public.reconcile_ai_cost(uuid,uuid,numeric,text) to service_role;
-- One short transaction serializes reservations across instances. No network call holds this lock.
create or replace function public.reserve_ai_request(p_user uuid,p_company uuid,p_id uuid,p_reserve numeric,p_feature text default 'diagnosis',p_fingerprint text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare plan text:='FREE'; market text; policy jsonb; used numeric; day_used numeric; month_used numeric; global_used numeric; count_used bigint; window_start timestamptz; override_row record;
begin
 perform pg_advisory_xact_lock(9128001);
 if p_reserve is null or p_reserve<=0 or p_reserve>1000 then raise exception 'Invalid reservation'; end if;
 if not exists(select 1 from public.company_members where user_id=p_user and company_id=p_company) then raise exception 'Access denied'; end if;
 if exists(select 1 from public.ai_requests where id=p_id) then raise exception 'Duplicate request' using errcode='40001'; end if;
 select market_code into market from public.commercial_accounts where user_id=p_user;
 if market is null or not exists(select 1 from public.commercial_markets where code=market and (status in ('ACTIVE','PAUSED') or (status='READY' and exists(select 1 from public.commercial_overrides o where o.user_id=p_user and o.expires_at>now() and o.revoked_at is null and o.settings->>'market_access'='true'))) and not disable_ai_requests) then raise exception 'Market unavailable'; end if;
 select plan_code into plan from public.subscriptions where user_id=p_user and status in ('active','trialing') and current_period_end>now() order by current_period_end desc limit 1;
 plan:=coalesce(plan,'FREE');
 select settings into override_row from public.commercial_overrides where user_id=p_user and expires_at>now() and revoked_at is null order by created_at desc limit 1;
 if found then plan:=coalesce(override_row.settings->>'plan_code',plan); end if;
 select p.policy into policy from public.commercial_plans p where code=plan and available;
 if override_row.settings is not null and override_row.settings ? 'policy' then policy:=override_row.settings->'policy'; end if;
 if policy is null then raise exception 'Policy unavailable'; end if;
 if p_feature not in ('classification','diagnosis') then raise exception 'Invalid feature'; end if;
 if p_fingerprint is not null and exists(select 1 from public.ai_requests where user_id=p_user and fingerprint=p_fingerprint and created_at>now()-interval '30 seconds') then return jsonb_build_object('allowed',false,'reason','DUPLICATE_REQUEST'); end if;
 window_start:=case when policy->>'window'='lifetime' then '-infinity'::timestamptz else date_trunc('month',now() at time zone 'UTC') at time zone 'UTC' end;
 select coalesce(sum(coalesce(accounted_usd,reserved_usd)),0),count(*) into used,count_used from public.ai_requests where user_id=p_user and created_at>=window_start;
 select coalesce(sum(coalesce(accounted_usd,reserved_usd)),0) into day_used from public.ai_requests where user_id=p_user and created_at>=(date_trunc('day',now() at time zone 'UTC') at time zone 'UTC');
 select coalesce(sum(coalesce(accounted_usd,reserved_usd)),0) into month_used from public.ai_requests where user_id=p_user and created_at>=(date_trunc('month',now() at time zone 'UTC') at time zone 'UTC');
 select coalesce(sum(coalesce(accounted_usd,reserved_usd)),0) into global_used from public.ai_requests where created_at>=(date_trunc('day',now() at time zone 'UTC') at time zone 'UTC');
 if (select count(*) from public.ai_requests where user_id=p_user and feature='diagnosis' and created_at>=window_start)>=(policy->>'diagnoses')::bigint then return jsonb_build_object('allowed',false,'reason','DIAGNOSIS_LIMIT'); end if;
 if used+p_reserve>(policy->>'hard_usd')::numeric or count_used>=(policy->>'interactions')::bigint or day_used+p_reserve>(policy->>'user_day_usd')::numeric or month_used+p_reserve>(policy->>'user_month_usd')::numeric or global_used+p_reserve>(policy->>'global_day_usd')::numeric then
  insert into public.commercial_events(user_id,market_code,event,dedupe_key) values(p_user,market,case when plan='FREE' then 'free_hard_limit_reached' else 'pro_protection_reached' end,'hard:'||p_user||':'||current_date) on conflict(dedupe_key) do nothing;
  return jsonb_build_object('allowed',false,'reason','HARD_LIMIT');
 end if;
 if (select count(*) from public.ai_requests where user_id=p_user and status='RESERVED' and created_at>now()-interval '2 minutes')>=(policy->>'max_concurrent')::int or (select count(*) from public.ai_requests where user_id=p_user and created_at>now()-interval '1 minute')>=(policy->>'requests_per_minute')::int then
  return jsonb_build_object('allowed',false,'reason','RATE_LIMIT');
 end if;
 if plan='FREE' and used>=(policy->>'soft_usd')::numeric then
 insert into public.commercial_events(user_id,market_code,event,dedupe_key) values(p_user,market,'free_soft_limit_reached','soft:'||p_user||':'||current_date) on conflict(dedupe_key) do nothing; end if;
 insert into public.ai_requests(id,user_id,company_id,plan_code,market_code,status,reserved_usd,feature,fingerprint) values(p_id,p_user,p_company,plan,market,'RESERVED',p_reserve,p_feature,p_fingerprint);
 return jsonb_build_object('allowed',true,'plan',plan,'market',market,'used_usd',used,'policy',policy);
end $$;
revoke all on function public.reserve_ai_request(uuid,uuid,uuid,numeric,text,text) from public,anon,authenticated;
grant execute on function public.reserve_ai_request(uuid,uuid,uuid,numeric,text,text) to service_role;
-- Unknown/timeout costs keep the reservation charged to budget until reconciled.
create or replace function public.finish_ai_request(p_id uuid,p_status text,p_cost numeric) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_status not in ('COMPLETED','UNKNOWN','FAILED') or (p_cost is not null and p_cost<0) then raise exception 'Invalid outcome'; end if;
 update public.ai_requests set status=p_status,accounted_usd=p_cost,completed_at=now() where id=p_id and status='RESERVED';
end $$;
revoke all on function public.finish_ai_request(uuid,text,numeric) from public,anon,authenticated;
grant execute on function public.finish_ai_request(uuid,text,numeric) to service_role;
create or replace function public.commercial_usage(p_user uuid,p_window text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('cost',coalesce(sum(coalesce(accounted_usd,reserved_usd)),0),'count',count(*)) from public.ai_requests where user_id=p_user and (p_window='lifetime' or created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC')
$$;
revoke all on function public.commercial_usage(uuid,text) from public,anon,authenticated;
grant execute on function public.commercial_usage(uuid,text) to service_role;
create or replace function public.commercial_overview(p_actor uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare report jsonb;
begin
 if not exists(select 1 from public.admin_roles where user_id=p_actor) then raise exception 'Forbidden' using errcode='42501'; end if;
 select jsonb_build_object(
 'users',(select count(*) from public.profiles),
 'free_users',(select count(*) from public.profiles p where public.commercial_user_plan(p.id)='FREE'),
 'pro_users',(select count(*) from public.profiles p where public.commercial_user_plan(p.id)='PRO'),
 'activated_users',(select count(*) from public.commercial_accounts where activated_at is not null),
 'mrr_by_currency',(select coalesce(jsonb_agg(x),'[]') from (select currency,sum(amount_minor)/100.0 amount from public.subscriptions where status='active' and current_period_end>now() group by currency)x),
 'ai_cost_today_usd',(select case when count(*) filter(where estimated_total_cost_usd is null)>0 then null else coalesce(sum(estimated_total_cost_usd),0) end from public.usage_logs where created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'),
 'ai_cost_month_usd',(select case when count(*) filter(where estimated_total_cost_usd is null)>0 then null else coalesce(sum(estimated_total_cost_usd),0) end from public.usage_logs where created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'),
 'unknown_cost_operations',(select count(*) from public.ai_requests where accounted_usd is null),
 'cached_tokens',(select sum(cached_input_tokens) from public.usage_logs),
 'cache_savings_usd',(select case when count(*) filter(where cache_savings_usd is null)>0 then null else coalesce(sum(cache_savings_usd),0) end from public.usage_logs),
 'monthly_markets',(select coalesce(jsonb_agg(x),'[]') from (select m.code market_code,m.currency,(select count(*) from public.commercial_accounts a where a.market_code=m.code) users,(select count(*) from public.subscriptions s where s.market_code=m.code and s.status='active' and s.current_period_end>now()) pro_users,(select coalesce(sum(s.amount_minor),0) from public.subscriptions s where s.market_code=m.code and s.status='active' and s.current_period_end>now()) revenue_minor,(select case when count(*) filter(where accounted_usd is null)>0 then null else coalesce(sum(accounted_usd),0) end from public.ai_requests r where r.market_code=m.code and r.created_at>=date_trunc('month',now())) ai_cost_usd from public.commercial_markets m)x),
 'input_tokens',(select sum(input_tokens) from public.usage_logs),
 'ai_errors',(select count(*) from public.usage_logs where status<>'completed'),
 'by_plan',(select coalesce(jsonb_agg(x),'[]') from(select plan_code,case when count(*) filter(where estimated_total_cost_usd is null)>0 then null else coalesce(sum(estimated_total_cost_usd),0) end cost_usd from public.usage_logs group by plan_code)x),
 'by_market',(select coalesce(jsonb_agg(x),'[]') from(select market_code,case when count(*) filter(where estimated_total_cost_usd is null)>0 then null else coalesce(sum(estimated_total_cost_usd),0) end cost_usd from public.usage_logs group by market_code)x),
 'by_feature',(select coalesce(jsonb_agg(x),'[]') from(select feature,case when count(*) filter(where estimated_total_cost_usd is null)>0 then null else coalesce(sum(estimated_total_cost_usd),0) end cost_usd from public.usage_logs group by feature)x),
 'by_model',(select coalesce(jsonb_agg(x),'[]') from(select model,case when count(*) filter(where estimated_total_cost_usd is null)>0 then null else coalesce(sum(estimated_total_cost_usd),0) end cost_usd from public.usage_logs group by model)x),
 'top_users',(select coalesce(jsonb_agg(x),'[]') from(select user_id,case when count(*) filter(where estimated_total_cost_usd is null)>0 then null else coalesce(sum(estimated_total_cost_usd),0) end cost_usd from public.usage_logs group by user_id order by case when count(*) filter(where estimated_total_cost_usd is null)>0 then null else coalesce(sum(estimated_total_cost_usd),0) end desc nulls last limit 10)x)
 ) into report;
 return report;
end $$;
revoke all on function public.commercial_overview(uuid) from public,anon,authenticated;
grant execute on function public.commercial_overview(uuid) to service_role;

commit;
