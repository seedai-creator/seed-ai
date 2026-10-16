-- Fictional, transaction-only exercise, shared by local and staging checks.
-- No worker can see these uncommitted rows; rollback also removes Auth fixtures.
begin;
set local statement_timeout='8s';
do $$
declare u uuid:=gen_random_uuid(); c uuid; conv uuid:=gen_random_uuid(); msg uuid:=gen_random_uuid();
 j uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); e uuid:=gen_random_uuid(); g uuid:=gen_random_uuid();
 baseline jsonb; observed jsonb; spec jsonb; n integer:=0;
begin
 insert into public.beta_invitations(email,cohort,expires_at) values('queue-fixture-'||u||'@example.invalid','QUEUE_FIXTURE',now()+interval '1 hour');
 insert into auth.users(id,email,raw_user_meta_data) values(u,'queue-fixture-'||u||'@example.invalid','{}');
 select company_id into strict c from public.company_members where user_id=u;
 insert into public.conversations(id,company_id,user_id,title) values(conv,c,u,'Fictional queue exercise');
 insert into public.messages(id,conversation_id,request_id,role,content) values(msg,conv,gen_random_uuid(),'user','Fictional input');
 insert into public.journal_jobs(id,company_id,user_id,kind,dedupe_key) values(j,c,u,'EXTRACTION','fixture:'||j);
 insert into public.business_model_jobs(id,company_id,user_id,source_message_id,payload) values(b,c,u,msg,'{}');
 insert into public.radar_company_state(company_id) values(c) on conflict(company_id) do nothing;
 insert into public.external_research_runs(id,company_id,user_id,request_id,trigger_type,depth,sanitized_query,cache_key,locale)
 values(e,c,u,gen_random_uuid(),'USER','QUICK','Fictional query',e::text,'pt-BR');
 insert into public.growth_map_requests(id,company_id,context_key,requested_by) values(g,c,'fixture',u);
 baseline:=public.operational_queue_health();
 for spec in select value from jsonb_array_elements(jsonb_build_array(
  jsonb_build_object('key','journal_overdue','table','journal_jobs','time','available_at','id',j,'pk','id','terminal','READY'),
  jsonb_build_object('key','business_model_overdue','table','business_model_jobs','time','available_at','id',b,'pk','id','terminal','COMPLETED'),
  jsonb_build_object('key','radar_overdue','table','radar_company_state','time','next_scan_at','id',c,'pk','company_id'),
  jsonb_build_object('key','external_overdue','table','external_research_runs','time','created_at','id',e,'pk','id','terminal','COMPLETED'),
  jsonb_build_object('key','growth_overdue','table','growth_map_requests','time','next_at','id',g,'pk','id','terminal','COMPLETED')
 )) loop
  execute format('update public.%I set %I=now()-interval ''15 minutes'' where %I=$1',spec->>'table',spec->>'time',spec->>'pk') using (spec->>'id')::uuid;
  if public.operational_queue_health()<>baseline then raise exception 'QUEUE_THRESHOLD_FAILED: %',spec->>'key'; end if;
  execute format('update public.%I set %I=now()-interval ''16 minutes'' where %I=$1',spec->>'table',spec->>'time',spec->>'pk') using (spec->>'id')::uuid;
  observed:=jsonb_set(baseline,array[spec->>'key'],to_jsonb((baseline->>(spec->>'key'))::bigint+1));
  if public.operational_queue_health()<>observed then raise exception 'QUEUE_OVERDUE_FAILED: %',spec->>'key'; end if;
  if spec->>'key' in ('journal_overdue','external_overdue','growth_overdue') then
   execute format('update public.%I set status=''RUNNING'' where id=$1',spec->>'table') using (spec->>'id')::uuid;
   if public.operational_queue_health()<>observed then raise exception 'QUEUE_RUNNING_FAILED'; end if;
  end if;
  execute format('update public.%I set %I=now()+interval ''1 hour'' where %I=$1',spec->>'table',spec->>'time',spec->>'pk') using (spec->>'id')::uuid;
  if public.operational_queue_health()<>baseline then raise exception 'QUEUE_BACKOFF_FAILED: %',spec->>'key'; end if;
  execute format('update public.%I set %I=now()-interval ''16 minutes'' where %I=$1',spec->>'table',spec->>'time',spec->>'pk') using (spec->>'id')::uuid;
  if spec->>'key'='radar_overdue' then
   update public.radar_company_state set processed_generation=generation where company_id=c;
  else
   execute format('update public.%I set status=$1 where id=$2',spec->>'table') using spec->>'terminal',(spec->>'id')::uuid;
  end if;
  if public.operational_queue_health()<>baseline then raise exception 'QUEUE_RESOLUTION_FAILED: %',spec->>'key'; end if;
  n:=n+1;
 end loop;
 if n<>5 then raise exception 'QUEUE_COVERAGE_INCOMPLETE'; end if;
end $$;
select 'all_five_queue_families_passed' as result;
rollback;
