begin;
create function public.change_commercial_catalog(p_actor uuid,p_operation text,p_value jsonb,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare old_state jsonb; new_state jsonb; market text; key text; category text;
begin
 if not exists(select 1 from public.admin_roles where user_id=p_actor and role='SUPER_ADMIN') then raise exception 'Forbidden' using errcode='42501'; end if;
 if char_length(btrim(coalesce(p_reason,''))) not between 5 and 1000 or p_value is null or jsonb_typeof(p_value)<>'object' or octet_length(p_value::text)>30000 then raise exception 'Invalid change'; end if;
 perform pg_advisory_xact_lock(9128002);
 if p_operation='PRICE_CHANGED' then
  market:=p_value->>'market_code';
  if not exists(select 1 from public.commercial_markets where code=market and currency=p_value->>'currency') then raise exception 'Currency mismatch'; end if;
  select to_jsonb(p) into old_state from public.commercial_prices p where market_code=market and plan_code='PRO' and provider='stripe' and effective_to is null;
  update public.commercial_prices set effective_to=now() where market_code=market and plan_code='PRO' and provider='stripe' and effective_to is null;
  insert into public.commercial_prices(plan_code,market_code,currency,amount_minor,provider_product_id,provider_price_id,status,is_planning_hypothesis)
  values('PRO',market,p_value->>'currency',(p_value->>'amount_minor')::bigint,p_value->>'provider_product_id',p_value->>'provider_price_id',case when market='BR' then 'ACTIVE' else 'INACTIVE' end,market<>'BR') returning to_jsonb(commercial_prices.*) into new_state;
 elsif p_operation='AI_PRICE_CHANGED' then
  key:=p_value->>'model'; if key is null or length(key) not between 1 and 150 then raise exception 'Invalid model'; end if;
  select to_jsonb(p) into old_state from public.ai_model_pricing p where provider='openai' and model=key and processing_tier='default' and context_tier='standard' and effective_to is null;
  update public.ai_model_pricing set effective_to=now() where provider='openai' and model=key and processing_tier='default' and context_tier='standard' and effective_to is null;
  insert into public.ai_model_pricing(provider,model,effective_from,input_per_million,cached_per_million,output_per_million,metadata)
  values('openai',key,now(),(p_value->>'input_per_million')::numeric,(p_value->>'cached_per_million')::numeric,(p_value->>'output_per_million')::numeric,jsonb_build_object('source',p_value->>'source','verified_by',p_actor)) returning to_jsonb(ai_model_pricing.*) into new_state;
 elsif p_operation='READINESS_CHANGED' then
  market:=p_value->>'market_code';
  foreach category in array array['configuration','localization','product','pricing','billing','legal_tax','privacy','ai_cost_protection','analytics','testing','emergency_controls'] loop
   if jsonb_typeof(p_value->'readiness'->category->'pass') is distinct from 'boolean' or (p_value->'readiness'->category->>'pass'='true' and length(btrim(coalesce(p_value->'readiness'->category->>'evidence','')))=0) then raise exception 'Evidence required'; end if;
  end loop;
  select readiness into old_state from public.commercial_markets where code=market for update;
  if not found then raise exception 'Unknown market'; end if;
  update public.commercial_markets set readiness=p_value->'readiness',version=version+1,updated_at=now() where code=market returning readiness into new_state;
 elsif p_operation='SUBSCRIPTION_OVERRIDE' then
  if (p_value->>'expires_at')::timestamptz<=now() or (p_value->>'expires_at')::timestamptz>now()+interval '180 days' then raise exception 'Invalid expiry'; end if;
  update public.commercial_overrides set revoked_at=now() where user_id=(p_value->>'user_id')::uuid and revoked_at is null;
  insert into public.commercial_overrides(user_id,kind,settings,expires_at,reason,created_by) values((p_value->>'user_id')::uuid,p_value->>'kind',p_value->'settings',(p_value->>'expires_at')::timestamptz,p_reason,p_actor) returning to_jsonb(commercial_overrides.*) into new_state;
 elsif p_operation='FLAGS_CHANGED' then
  key:=p_value->>'plan_code';select flags into old_state from public.commercial_plans where code=key for update;
  if not found or jsonb_typeof(p_value->'flags')<>'object' then raise exception 'Invalid flags'; end if;
  update public.commercial_plans set flags=p_value->'flags',version=version+1,updated_at=now() where code=key returning flags into new_state;
 else raise exception 'Unsupported operation'; end if;
 insert into public.admin_audit_log(actor,action,entity,market_code,old_state,new_state,reason) values(p_actor,p_operation,coalesce(market,key,p_value->>'user_id'),market,old_state,new_state,p_reason);
end $$;
revoke all on function public.change_commercial_catalog(uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.change_commercial_catalog(uuid,text,jsonb,text) to service_role;
commit;
