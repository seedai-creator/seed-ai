begin;
create or replace function public.commit_seed_turn_v94(p_user uuid,p_company uuid,p_conversation uuid,p_request uuid,p_version integer,p_message text,p_answer text,p_diagnosis jsonb,p_memories jsonb,p_skip_journal boolean,p_recommendation jsonb,p_commands jsonb) returns void language plpgsql security definer set search_path='' as $$
declare cmd jsonb;mid uuid;aid uuid;eid uuid;sid uuid;rid uuid;old jsonb;target_table text;expected integer;new_status text;result_row public.execution_results%rowtype; seen_versions jsonb:='{}';
begin
 if not exists(select 1 from public.company_members where company_id=p_company and user_id=p_user) then raise exception 'Access denied';end if;
 -- The trusted server already authorized this actor; preserve existing commercial guards.
 perform set_config('request.jwt.claim.sub',p_user::text,true);
 perform 1 from public.companies where id=p_company for update;
 if exists(select 1 from public.messages m join public.conversations c on c.id=m.conversation_id where m.request_id=p_request and c.user_id=p_user and c.company_id=p_company) then return;end if;
 if p_commands is null or jsonb_typeof(p_commands)<>'array' or jsonb_array_length(p_commands)>3 or octet_length(p_commands::text)>30000 then raise exception 'Invalid commands';end if;
 if p_skip_journal and jsonb_array_length(p_commands)>0 then raise exception 'Attachment cannot authorize execution';end if;
 perform public.commit_seed_turn_v93(p_user,p_company,p_conversation,p_request,p_version,p_message,p_answer,p_diagnosis,p_memories,p_skip_journal);
 select id into mid from public.messages where request_id=p_request and role='user';
 select id into aid from public.messages where request_id=p_request and role='assistant';
 if p_diagnosis is not null and p_diagnosis<>'null'::jsonb then update public.messages set diagnosis_status='ACTIVE' where id=aid;end if;
 for cmd in select * from jsonb_array_elements(p_commands) loop
  if cmd->>'scope' is distinct from 'CURRENT_COMPANY' or cmd->>'assertion' is distinct from 'EXPLICIT' or length(coalesce(cmd->>'quote',''))<1 or strpos(p_message,cmd->>'quote')=0 then raise exception 'Invalid execution evidence';end if;
  eid:=(cmd->>'target_id')::uuid;expected:=(cmd->>'version')::integer;sid:=null;rid:=null;old:=null;
  target_table:=case cmd->>'target_type' when 'RECOMMENDATION' then 'recommendations' when 'PLAN' then 'strategies' when 'ACTION' then 'actions' when 'DECISION' then 'decisions' when 'EXPERIMENT' then 'experiments' end;
  if target_table is null then raise exception 'Invalid target type';end if;
  if eid is not null then
   execute format('select to_jsonb(t) from public.%I t where id=$1 and company_id=$2 for update',target_table) into old using eid,p_company;
   if old is null or coalesce((seen_versions->>eid::text)::integer,(old->>'version')::integer) is distinct from expected then raise exception 'Execution changed' using errcode='40001';end if;
   if not (seen_versions ? eid::text) then seen_versions:=seen_versions||jsonb_build_object(eid::text,(old->>'version')::integer);end if;
   sid:=case when target_table='strategies' then eid else coalesce(old->>'strategy_id',old->>'plan_id')::uuid end;
  elsif cmd->>'kind' not in ('DECISION','EXPERIMENT') then raise exception 'Missing target';end if;
  new_status:=cmd->>'status';
  case cmd->>'kind'
  when 'ACCEPT' then
   if target_table<>'recommendations' then raise exception 'Invalid acceptance';end if;
   sid:=public.accept_execution_recommendation(p_user,p_company,eid,expected);
  when 'ACTION' then
   if target_table<>'actions' or new_status not in ('TODO','IN_PROGRESS','BLOCKED','COMPLETED','CANCELLED') or (new_status='BLOCKED' and length(coalesce(cmd->>'reason',''))=0) then raise exception 'Invalid action';end if;
   if old->>'status' in ('COMPLETED','CANCELLED') and new_status<>old->>'status' then raise exception 'Finished action cannot be silently reopened';end if;
   update public.actions set status=new_status,deadline=coalesce((cmd->>'end')::date,deadline),block_reason=case when new_status='BLOCKED' then cmd->>'reason' end,started_at=case when new_status='IN_PROGRESS' then coalesce(started_at,now()) else started_at end,completed_at=case when new_status='COMPLETED' then now() else completed_at end,version=version+1 where id=eid;
   update public.recommendations set status='IN_EXECUTION',version=version+1,updated_at=now() where id=(select recommendation_id from public.strategies where id=sid) and status='ACCEPTED';
  when 'DECISION' then
   if eid is not null and target_table<>'strategies' then raise exception 'Invalid decision relation';end if;
   eid:=gen_random_uuid();
   insert into public.decisions(id,company_id,created_by,decision,context,reason,hypothesis,baseline,decision_date,request_hash,plan_id,source_message_id)
   values(eid,p_company,p_user,cmd->>'description',p_message,cmd->>'reason',coalesce(cmd->>'hypothesis',''),coalesce(cmd->>'baseline',''),current_date,md5(cmd::text),sid,mid);
  when 'DECISION_STATUS' then
   if target_table<>'decisions' or new_status not in ('IMPLEMENTED','ABANDONED','REVERSED','SUPERSEDED') then raise exception 'Invalid decision status';end if;
   update public.decisions set execution_status=new_status,implemented_at=case when new_status='IMPLEMENTED' then now() else implemented_at end,version=version+1 where id=eid;
  when 'EXPERIMENT' then
   if eid is not null and target_table<>'strategies' then raise exception 'Invalid experiment relation';end if;
   eid:=gen_random_uuid();
   insert into public.experiments(id,company_id,created_by,name,problem,hypothesis,action,baseline,target,metric,start_date,end_date,request_hash,plan_id,source_message_id,evaluation_criteria)
   values(eid,p_company,p_user,left(cmd->>'description',120),coalesce(cmd->>'reason',cmd->>'description'),cmd->>'hypothesis',cmd->>'description',cmd->>'baseline',cmd->>'target',cmd->>'indicator',(cmd->>'start')::date,(cmd->>'end')::date,md5(cmd::text),sid,mid,cmd->>'reason');
  when 'EXPERIMENT_STATUS' then
   if target_table<>'experiments' then raise exception 'Invalid test target';end if;
   if new_status='RUNNING' and old->>'execution_status'='READY' then
    update public.experiments set status='RUNNING',execution_status='RUNNING',started_at=now(),version=version+1 where id=eid;
   elsif new_status='COMPLETED' and old->>'execution_status'='RUNNING' then
    update public.experiments set execution_status='COMPLETED',version=version+1 where id=eid;
   elsif new_status='CANCELLED' and old->>'execution_status' in ('READY','RUNNING','COMPLETED') then
    update public.experiments set execution_status='CANCELLED',version=version+1 where id=eid;
   else raise exception 'Invalid test transition';end if;
  when 'RESULT' then
   if target_table='recommendations' or new_status not in ('PARTIAL','COLLECTED') then raise exception 'Invalid result';end if;
   insert into public.execution_results(company_id,plan_id,action_id,decision_id,experiment_id,description,metric_type,baseline_value,observed_value,unit,currency_code,period_start,period_end,status,source_message_id,evidence)
   values(p_company,sid,case when target_table='actions' then eid end,case when target_table='decisions' then eid end,case when target_table='experiments' then eid end,cmd->>'description',cmd->>'indicator',(cmd->>'baseline')::numeric,(cmd->>'observed')::numeric,cmd->>'unit',cmd->>'currency',(cmd->>'start')::date,(cmd->>'end')::date,new_status,mid,cmd->>'quote') returning id into rid;
   if target_table='actions' then update public.actions set result_summary=cmd->>'description',version=version+1 where id=eid;end if;
  when 'REVIEW' then
   if target_table not in ('strategies','recommendations') or new_status not in ('ACTIVE','RESOLVED','SUPERSEDED') or nullif(p_diagnosis#>>'{reliability,revision}','') is null or jsonb_array_length(coalesce(p_diagnosis#>'{reliability,evidence}','[]'))=0 then raise exception 'Invalid review';end if;
   if target_table='recommendations' then select id into sid from public.strategies where recommendation_id=eid and company_id=p_company;end if;
   select * into result_row from public.execution_results where company_id=p_company and plan_id=sid and status in ('PARTIAL','COLLECTED','VALIDATED') order by created_at desc limit 1 for update;
   if not found then raise exception 'Review needs a related result';end if;
   -- Incomplete reports may revise a hypothesis, but cannot resolve a problem.
   if new_status='RESOLVED' and (result_row.status='PARTIAL' or p_diagnosis#>>'{reliability,sufficiency}'<>'SUFFICIENT' or exists(select 1 from public.actions where strategy_id=sid and status not in ('COMPLETED','CANCELLED'))) then raise exception 'Resolution needs evidence and finished execution';end if;
   insert into public.execution_learnings(company_id,result_id,plan_id,recommendation_id,diagnosis_id,statement,evidence_summary,evidence_level)
   values(p_company,result_row.id,sid,(select recommendation_id from public.strategies where id=sid),aid,p_diagnosis#>>'{reliability,revision}',result_row.description,case when result_row.status='PARTIAL' then 'INCONCLUSIVE' else 'PRELIMINARY' end) on conflict(result_id) do nothing;
   update public.execution_results set status='ANALYZED',version=version+1,updated_at=now() where id=result_row.id;
   if result_row.experiment_id is not null then update public.experiments set execution_status='ANALYZED',analytical_outcome='INCONCLUSIVE',version=version+1 where id=result_row.experiment_id and execution_status='COMPLETED';end if;
   if result_row.decision_id is not null then update public.decisions set execution_status='REVIEWED',version=version+1 where id=result_row.decision_id;end if;
   if new_status<>'ACTIVE' then
    update public.messages set diagnosis_status=new_status where id=(select diagnosis_id from public.strategies where id=sid);
    update public.recommendations set status=case new_status when 'RESOLVED' then 'COMPLETED' else 'SUPERSEDED' end,completed_at=case when new_status='RESOLVED' then now() end,version=version+1,updated_at=now() where id=(select recommendation_id from public.strategies where id=sid);
    update public.strategies set status=case new_status when 'RESOLVED' then 'COMPLETED' else 'CANCELLED' end,completed_at=case when new_status='RESOLVED' then now() end,version=version+1 where id=sid;
   end if;
  else raise exception 'Unknown execution operation';end case;
  insert into public.execution_events(company_id,user_id,source_message_id,entity_id,operation,before_state,after_state) values(p_company,p_user,mid,eid,cmd->>'kind',old,cmd);
  if cmd->>'kind' in ('ACTION','DECISION','EXPERIMENT','RESULT','REVIEW') then
   insert into public.business_journal_entries(company_id,user_id,conversation_id,source_message_id,entry_type,description,evidence,confidence,source_type,identity_key,metadata)
   values(p_company,p_user,p_conversation,mid,case cmd->>'kind' when 'ACTION' then 'FACT' when 'REVIEW' then 'LEARNING' else cmd->>'kind' end,left(coalesce(cmd->>'description',cmd->>'quote'),600),cmd->>'quote','LOW','SYSTEM','execution:'||mid||':'||eid||':'||(cmd->>'kind'),jsonb_build_object('execution',true,'entity_refs',jsonb_build_array(jsonb_build_object('type',case when target_table='strategies' then 'STRATEGY' when cmd->>'kind'='DECISION' then 'DECISION' when cmd->>'kind'='EXPERIMENT' then 'EXPERIMENT' else cmd->>'target_type' end,'id',eid)))) on conflict(company_id,identity_key) do nothing;
  end if;
 end loop;
 -- Only a recommendation already accepted by the existing reliability gate may persist.
 if p_recommendation is not null and p_recommendation<>'null'::jsonb then
  if p_diagnosis#>'{reliability,recommendation}' is null or p_diagnosis#>'{reliability,recommendation}'='null'::jsonb or p_recommendation->>'recommendation' is distinct from p_diagnosis#>>'{reliability,recommendation,action}' then raise exception 'Ungated recommendation';end if;
  if not exists(select 1 from public.recommendations where company_id=p_company and status in ('PROPOSED','ACCEPTED','IN_EXECUTION') and recommendation=p_recommendation->>'recommendation') and not exists(select 1 from public.strategies where company_id=p_company and status='ACTIVE') then
   insert into public.recommendations(company_id,conversation_id,diagnosis_id,title,recommendation,rationale_summary,expected_outcome,primary_indicator,confidence,draft,reliability)
   values(p_company,p_conversation,aid,p_recommendation->>'title',p_recommendation->>'recommendation',p_recommendation->>'rationale_summary',p_recommendation->>'expected_outcome',p_recommendation->>'primary_indicator',p_recommendation->>'confidence',p_recommendation->'draft',p_recommendation->'reliability');
  end if;
 end if;
end $$;
create or replace function public.accept_execution_recommendation(p_user uuid,p_company uuid,p_id uuid,p_version integer) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.recommendations%rowtype;sid uuid;item jsonb;pos integer:=0;
begin
 if not exists(select 1 from public.company_members where company_id=p_company and user_id=p_user) then raise exception 'Access denied';end if;
 perform set_config('request.jwt.claim.sub',p_user::text,true);
 perform 1 from public.companies where id=p_company for update;
 select * into r from public.recommendations where id=p_id and company_id=p_company for update;
 if not found then raise exception 'Recommendation unavailable';end if;
 select id into sid from public.strategies where recommendation_id=r.id and company_id=p_company;
 if found then return sid;end if;
 if r.version<>p_version or r.status<>'PROPOSED' then raise exception 'Recommendation changed' using errcode='40001';end if;
 if jsonb_array_length(r.draft->'actions') not between 1 and 3 then raise exception 'Invalid plan';end if;
 sid:=gen_random_uuid();
 insert into public.strategies(id,company_id,created_by,name,objective,situation,bottleneck,hypothesis,strategy,review_date,status,request_hash,recommendation_id,diagnosis_id,current_focus,primary_indicator)
 values(sid,p_company,p_user,r.draft->>'name',r.draft->>'objective',r.draft->>'situation',r.draft->>'bottleneck',r.draft->>'hypothesis',r.draft->>'strategy',(r.draft->>'review_date')::date,'ACTIVE',md5(r.draft::text),r.id,r.diagnosis_id,r.recommendation,r.primary_indicator);
 for item in select * from jsonb_array_elements(r.draft->'actions') loop pos:=pos+1;
 insert into public.actions(company_id,strategy_id,position,title,description,reason,responsible,deadline,metric,target)
 values(p_company,sid,pos,item->>'title',item->>'description',item->>'reason',item->>'responsible',(item->>'deadline')::date,item->>'metric',item->>'target');end loop;
 update public.recommendations set status='ACCEPTED',accepted_at=now(),version=version+1,updated_at=now() where id=r.id;
 insert into public.execution_events(company_id,user_id,entity_id,operation,before_state,after_state) values(p_company,p_user,r.id,'ACCEPT',to_jsonb(r),jsonb_build_object('plan_id',sid));
 return sid;
end $$;

commit;

