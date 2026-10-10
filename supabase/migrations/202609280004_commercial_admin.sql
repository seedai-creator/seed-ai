begin;
grant select on public.admin_audit_log,public.commercial_events,public.billing_events to service_role;
create function public.update_commercial_config(p_actor uuid,p_entity text,p_key text,p_version integer,p_value jsonb,p_reason text) returns void
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
   if p_key<>'BR' then raise exception 'International launch is disabled in phase 9.1'; end if;
   if old_value->>'status'<>'READY' then raise exception 'Market is not READY'; end if;
   foreach category in array array['configuration','localization','product','pricing','billing','legal_tax','privacy','ai_cost_protection','analytics','testing','emergency_controls'] loop
    if coalesce((p_value->'readiness'->category->>'pass')::boolean,false)=false or length(btrim(coalesce(p_value->'readiness'->category->>'evidence','')))=0 then raise exception 'Incomplete readiness'; end if;
   end loop;
   if not exists(select 1 from public.commercial_prices where market_code=p_key and status='ACTIVE' and provider_price_id is not null and effective_to is null) then raise exception 'Billing price missing'; end if;
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

create function public.set_commercial_country(p_user uuid,p_market text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.commercial_markets where code=p_market and status='ACTIVE' and signup_enabled and not disable_new_signups) then raise exception 'Market unavailable'; end if;
 insert into public.commercial_accounts(user_id,market_code) values(p_user,p_market) on conflict(user_id) do update set market_code=excluded.market_code where commercial_accounts.market_code is null;
 if not found then raise exception 'Market already set'; end if;
end $$;
revoke all on function public.set_commercial_country(uuid,text) from public,anon,authenticated;
grant execute on function public.set_commercial_country(uuid,text) to service_role;
commit;
