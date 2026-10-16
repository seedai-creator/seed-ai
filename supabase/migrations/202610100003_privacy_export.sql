begin;
-- This is a user-facing export, not a database backup. No provider credentials,
-- job payloads, other people's preferences, or administrative audit are included.
create function public.export_private_data(p_company uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); item text; rows jsonb; result jsonb; dataset jsonb:='{}';
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if not exists(select 1 from jsonb_array_elements(coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->'amr','[]')) a
  where a->>'method' in ('password','totp','otp','oauth') and (a->>'timestamp')::numeric between extract(epoch from now())-900 and extract(epoch from now())+30)
 then raise exception 'Recent authentication required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('privacy-export:'||actor::text,0));
 if (select count(*) from public.operational_events where user_id=actor and code='DATA_EXPORTED' and created_at>now()-interval '1 hour')>=3
 then raise exception 'Export limit reached' using errcode='54000'; end if;
 if p_company is not null then
  -- Hold the ownership row until the export finishes; no administrator bypass.
  perform 1 from public.company_members where company_id=p_company and user_id=actor and role='owner' for share;
  if not found then raise exception 'Company owner required' using errcode='42501'; end if;
  select jsonb_build_object('company',to_jsonb(c)) into dataset from public.companies c where id=p_company;
  foreach item in array array['company_facts','business_memories','business_memory_history','conversations','strategies','actions','decisions','experiments','business_journal_entries','business_journal_history','weekly_intelligence_reports','recommendations','execution_results','execution_learnings','execution_events','business_entities','business_observations','business_relationships','business_model_events','decision_simulations','decision_simulation_versions','radar_signals','radar_insights','radar_watches','external_research_runs','external_sources','external_claims','external_claim_sources','external_competitors','metric_definitions','goals','goal_events','goal_metric_links','growth_map_snapshots'] loop
   execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from (select * from public.%I where company_id=$1 limit 2001) r',item) into rows using p_company;
   if jsonb_array_length(rows)>2000 then raise exception 'Manual export required' using errcode='54000'; end if;
   dataset:=dataset||jsonb_build_object(item,rows);
   if octet_length(dataset::text)>5000000 then raise exception 'Manual export required' using errcode='54000'; end if;
  end loop;
  select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into rows from (select m.* from public.messages m join public.conversations c on c.id=m.conversation_id where c.company_id=p_company limit 2001) r;
  if jsonb_array_length(rows)>2000 then raise exception 'Manual export required' using errcode='54000'; end if;
  dataset:=dataset||jsonb_build_object('messages',rows);
 end if;
 select jsonb_build_object('schema_version',1,'generated_at',now(),'account',to_jsonb(p),'business_data',dataset,
  'scope',case when p_company is null then 'PERSONAL_ACCOUNT' else 'PERSONAL_ACCOUNT_AND_OWNED_COMPANY' end,
  'excluded_categories',jsonb_build_array('provider_identifiers','internal_job_payloads','administrative_audit','other_user_preferences'),
  'notice','Business datasets may change during generation. This export is not a backup. Contact support for additional records or exports over the size limit.') into result
  from public.profiles p where id=actor;
 foreach item in array array['company_members','legal_acceptances','support_requests','commercial_accounts','radar_preferences','radar_deliveries','external_preferences','external_watchlist'] loop
  execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from (select * from public.%I where user_id=$1 limit 2001) r',item) into rows using actor;
  if jsonb_array_length(rows)>2000 then raise exception 'Manual export required' using errcode='54000'; end if;
  result:=result||jsonb_build_object(item,rows);
 end loop;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into rows from (select id,plan_code,market_code,provider,status,currency,amount_minor,current_period_start,current_period_end,cancel_at_period_end,canceled_at,created_at,updated_at from public.subscriptions where user_id=actor limit 2001) r;
 if jsonb_array_length(rows)>2000 then raise exception 'Manual export required' using errcode='54000'; end if;
 result:=result||jsonb_build_object('subscriptions',rows);
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into rows from (select id,company_id,feature,model,input_tokens,output_tokens,estimated_total_cost_usd,cost_status,status,created_at from public.usage_logs where user_id=actor limit 2001) r;
 if jsonb_array_length(rows)>2000 then raise exception 'Manual export required' using errcode='54000'; end if;
 result:=result||jsonb_build_object('usage_logs',rows);
 if octet_length(result::text)>5000000 then raise exception 'Manual export required' using errcode='54000'; end if;
 insert into public.operational_events(user_id,company_id,feature,code,level) values(actor,p_company,'PRIVACY','DATA_EXPORTED','INFO');
 return result;
end $$;
revoke all on function public.export_private_data(uuid) from public,anon;
grant execute on function public.export_private_data(uuid) to authenticated;
commit;
