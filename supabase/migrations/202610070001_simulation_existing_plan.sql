begin;
create or replace function public.commit_seed_turn_v96(p_user uuid,p_company uuid,p_conversation uuid,p_request uuid,p_version integer,p_message text,p_answer text,p_diagnosis jsonb,p_memories jsonb,p_skip_journal boolean,p_recommendation jsonb,p_commands jsonb,p_document boolean,p_simulation jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare cmd jsonb;sim public.decision_simulations%rowtype;linked uuid;mid uuid;
begin
 perform public.commit_seed_turn_v95(p_user,p_company,p_conversation,p_request,p_version,p_message,p_answer,p_diagnosis,p_memories,p_skip_journal,p_recommendation,p_commands,p_document);

 -- A user-selected scenario can propose its own plan even when a previous plan remains active.
 -- v95 above still validates the diagnosis/recommendation gate and commits the source atomically.
 if p_recommendation is not null and p_recommendation<>'null'::jsonb
 and exists(select 1 from public.decision_simulations where company_id=p_company and user_id=p_user and conversation_id=p_conversation and status='ACCEPTED' and plan_id is null)
 and not exists(select 1 from public.recommendations where company_id=p_company and conversation_id=p_conversation and status in ('PROPOSED','ACCEPTED','IN_EXECUTION')) then
  select id into mid from public.messages where request_id=p_request and conversation_id=p_conversation and role='assistant';
  insert into public.recommendations(company_id,conversation_id,diagnosis_id,title,recommendation,rationale_summary,expected_outcome,primary_indicator,confidence,draft,reliability)
  values(p_company,p_conversation,mid,p_recommendation->>'title',p_recommendation->>'recommendation',p_recommendation->>'rationale_summary',p_recommendation->>'expected_outcome',p_recommendation->>'primary_indicator',p_recommendation->>'confidence',p_recommendation->'draft',p_recommendation->'reliability');
 end if;
 if p_simulation is not null and p_simulation<>'null'::jsonb then perform public.save_decision_simulation(p_user,p_company,p_conversation,p_request,p_simulation,p_answer);end if;
 select id into mid from public.messages where request_id=p_request and conversation_id=p_conversation and role='user';
 for cmd in select * from jsonb_array_elements(p_commands) loop
  if cmd->>'simulation_id' is null then continue;end if;
  select * into sim from public.decision_simulations where id=(cmd->>'simulation_id')::uuid and company_id=p_company and user_id=p_user and status='ACCEPTED' for update;
  if not found then raise exception 'Simulation unavailable';end if;
  if cmd->>'kind'='ACCEPT' then
   select id into linked from public.strategies where company_id=p_company and recommendation_id=(cmd->>'target_id')::uuid;
   if linked is null or sim.plan_id is not null and sim.plan_id<>linked then raise exception 'Simulation plan conflict';end if;
   update public.decision_simulations set plan_id=linked,updated_at=now() where id=sim.id;
   update public.decisions set plan_id=linked where id=sim.decision_id and company_id=p_company;
   if not exists(select 1 from public.execution_events where source_message_id=mid and entity_id=sim.id and operation='simulation_to_plan')then
    insert into public.execution_events(company_id,user_id,source_message_id,entity_id,operation,after_state)values(p_company,p_user,mid,sim.id,'simulation_to_plan',jsonb_build_object('plan_id',linked));end if;
  elsif cmd->>'kind'='EXPERIMENT' then
   select id into linked from public.experiments where company_id=p_company and source_message_id=mid and request_hash=md5(cmd::text);
   if linked is null or sim.experiment_id is not null and sim.experiment_id<>linked then raise exception 'Simulation experiment conflict';end if;
   update public.decision_simulations set experiment_id=linked,updated_at=now() where id=sim.id;
   if not exists(select 1 from public.execution_events where source_message_id=mid and entity_id=sim.id and operation='simulation_to_experiment')then
    insert into public.execution_events(company_id,user_id,source_message_id,entity_id,operation,after_state)values(p_company,p_user,mid,sim.id,'simulation_to_experiment',jsonb_build_object('experiment_id',linked));end if;
  else raise exception 'Invalid simulation operation';end if;
 end loop;
end $$;

commit;
