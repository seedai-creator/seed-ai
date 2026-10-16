-- Bounded database rehearsal: 4,001 pending items, 20 aggregate reads.
-- No provider/worker runs; every fixture is rolled back. Not a user-capacity claim.
begin;
set local statement_timeout='15s';
do $$
declare u uuid:=gen_random_uuid(); c uuid; conv uuid:=gen_random_uuid(); baseline jsonb; expected jsonb;
 at_time timestamptz; i integer;
begin
 baseline:=public.operational_queue_health();
 insert into public.beta_invitations(email,cohort,expires_at) values('queue-load-'||u||'@example.invalid','QUEUE_LOAD_FIXTURE',now()+interval '1 hour');
 insert into auth.users(id,email,raw_user_meta_data) values(u,'queue-load-'||u||'@example.invalid','{}');
 select company_id into strict c from public.company_members where user_id=u;
 insert into public.conversations(id,company_id,user_id,title) values(conv,c,u,'Fictional bounded queue load');
 insert into public.messages(conversation_id,request_id,role,content) select conv,gen_random_uuid(),'user','Fictional load input' from generate_series(1,1000);
 insert into public.journal_jobs(company_id,user_id,kind,dedupe_key,available_at)
 select c,u,'EXTRACTION','fixture-load:'||gen_random_uuid(),now()-interval '16 minutes' from generate_series(1,1000);
 insert into public.business_model_jobs(company_id,user_id,source_message_id,payload,available_at)
 select c,u,id,'{}',now()-interval '16 minutes' from public.messages where conversation_id=conv;
 insert into public.radar_company_state(company_id,next_scan_at) values(c,now()-interval '16 minutes')
 on conflict(company_id) do update set generation=public.radar_company_state.processed_generation+1,next_scan_at=excluded.next_scan_at;
 insert into public.external_research_runs(company_id,user_id,request_id,trigger_type,depth,sanitized_query,cache_key,locale,created_at)
 select c,u,gen_random_uuid(),'USER','QUICK','Fictional load query',gen_random_uuid()::text,'pt-BR',now()-interval '16 minutes' from generate_series(1,1000);
 insert into public.growth_map_requests(company_id,context_key,requested_by,next_at)
 select c,'fixture-load-'||n,u,now()-interval '16 minutes' from generate_series(1,1000) n;
 expected:=jsonb_build_object('journal_overdue',(baseline->>'journal_overdue')::bigint+1000,
  'business_model_overdue',(baseline->>'business_model_overdue')::bigint+1000,
  'radar_overdue',(baseline->>'radar_overdue')::bigint+1,'external_overdue',(baseline->>'external_overdue')::bigint+1000,
  'growth_overdue',(baseline->>'growth_overdue')::bigint+1000);
 for i in 1..20 loop
  at_time:=clock_timestamp();
  if public.operational_queue_health()<>expected then raise exception 'QUEUE_LOAD_COUNTS_FAILED'; end if;
  if clock_timestamp()-at_time>interval '1 second' then raise exception 'QUEUE_LOAD_QUERY_EXCEEDED_1S'; end if;
 end loop;
end $$;
rollback;
