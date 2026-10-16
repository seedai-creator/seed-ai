begin;
-- One short transaction serializes reservations across instances. No network call holds this lock.
create function public.reserve_ai_request(p_user uuid,p_company uuid,p_id uuid,p_reserve numeric,p_feature text default 'diagnosis',p_fingerprint text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare plan text:='FREE'; market text; policy jsonb; used numeric; day_used numeric; month_used numeric; global_used numeric; count_used bigint; window_start timestamptz; override_row record;
begin
 perform pg_advisory_xact_lock(9128001);
 if p_reserve is null or p_reserve<=0 or p_reserve>1000 then raise exception 'Invalid reservation'; end if;
 if not exists(select 1 from public.company_members where user_id=p_user and company_id=p_company) then raise exception 'Access denied'; end if;
 if exists(select 1 from public.ai_requests where id=p_id) then raise exception 'Duplicate request' using errcode='40001'; end if;
 select market_code into market from public.commercial_accounts where user_id=p_user;
 if market is null or not exists(select 1 from public.commercial_markets where code=market and status in ('ACTIVE','PAUSED') and not disable_ai_requests) then raise exception 'Market unavailable'; end if;
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
  return jsonb_build_object('allowed',false,'reason','HARD_LIMIT');
 end if;
 if (select count(*) from public.ai_requests where user_id=p_user and status='RESERVED' and created_at>now()-interval '2 minutes')>=(policy->>'max_concurrent')::int or (select count(*) from public.ai_requests where user_id=p_user and created_at>now()-interval '1 minute')>=(policy->>'requests_per_minute')::int then
  return jsonb_build_object('allowed',false,'reason','RATE_LIMIT');
 end if;
 insert into public.ai_requests(id,user_id,company_id,plan_code,market_code,status,reserved_usd,feature,fingerprint) values(p_id,p_user,p_company,plan,market,'RESERVED',p_reserve,p_feature,p_fingerprint);
 return jsonb_build_object('allowed',true,'plan',plan,'market',market,'used_usd',used,'policy',policy);
end $$;
revoke all on function public.reserve_ai_request(uuid,uuid,uuid,numeric,text,text) from public,anon,authenticated;
grant execute on function public.reserve_ai_request(uuid,uuid,uuid,numeric,text,text) to service_role;
-- Unknown/timeout costs keep the reservation charged to budget until reconciled.
create function public.finish_ai_request(p_id uuid,p_status text,p_cost numeric) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_status not in ('COMPLETED','UNKNOWN','FAILED') or (p_cost is not null and p_cost<0) then raise exception 'Invalid outcome'; end if;
 update public.ai_requests set status=p_status,accounted_usd=p_cost,completed_at=now() where id=p_id and status='RESERVED';
end $$;
revoke all on function public.finish_ai_request(uuid,text,numeric) from public,anon,authenticated;
grant execute on function public.finish_ai_request(uuid,text,numeric) to service_role;
commit;
