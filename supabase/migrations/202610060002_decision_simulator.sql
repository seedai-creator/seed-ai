begin;
create table public.decision_simulations(
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 user_id uuid references public.profiles(id) on delete set null, conversation_id uuid not null references public.conversations(id) on delete cascade,
 request_id uuid not null unique, source_message_id uuid references public.messages(id) on delete cascade,context_fingerprint text,
 question text not null check(length(question) between 1 and 20000),
 decision_type text not null check(decision_type in ('PRICING','DISCOUNT','MARKETING_INVESTMENT','HIRING','CAPACITY_EXPANSION','NEW_PRODUCT','PRODUCT_REMOVAL','NEW_LOCATION','COST_REDUCTION','SALES_STRATEGY','OFFER_CHANGE','PAYMENT_TERMS','GENERAL_STRATEGIC_DECISION')),
 materiality text not null check(materiality in ('LOW','MEDIUM','HIGH','CRITICAL')),
 status text not null check(status in ('DRAFT','WAITING_FOR_INFORMATION','READY','COMPLETED','ACCEPTED','DISMISSED','SUPERSEDED')),
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<=100000),
 recommendation_summary text not null check(length(recommendation_summary)<=12000),
 version integer not null default 1 check(version>0), calculation_version text not null,
 decision_id uuid, plan_id uuid, experiment_id uuid, selected_scenario text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,company_id),foreign key(decision_id,company_id) references public.decisions(id,company_id),
 foreign key(plan_id,company_id) references public.strategies(id,company_id),foreign key(experiment_id,company_id) references public.experiments(id,company_id)
);
create table public.decision_simulation_versions(
 simulation_id uuid not null,company_id uuid not null,version integer not null check(version>0),
 snapshot jsonb not null,created_at timestamptz not null default now(),
 primary key(simulation_id,version),foreign key(simulation_id,company_id) references public.decision_simulations(id,company_id) on delete cascade
);
create index decision_simulations_conversation on public.decision_simulations(company_id,conversation_id,created_at desc);
do $$declare tbl text;begin foreach tbl in array array['decision_simulations','decision_simulation_versions'] loop
 execute format('alter table public.%I enable row level security',tbl);
 execute format('revoke all on public.%I from anon,authenticated',tbl);
 execute format('grant select on public.%I to authenticated',tbl);
 execute format('grant all on public.%I to service_role',tbl);
 execute format('create policy member_read on public.%I for select to authenticated using(exists(select 1 from public.company_members m where m.company_id=%I.company_id and m.user_id=auth.uid()))',tbl,tbl);
end loop;end $$;

-- Preserve completed arithmetic before strategic interpretation. Drafts are never confirmed business facts.
create function public.stage_decision_simulation(p_user uuid,p_company uuid,p_conversation uuid,p_request uuid,p_version integer,p_question text,p_fingerprint text,p_snapshot jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare sid uuid;c public.conversations%rowtype;
begin
 if not exists(select 1 from public.company_members where company_id=p_company and user_id=p_user)then raise exception 'Access denied' using errcode='42501';end if;
 perform 1 from public.companies where id=p_company for update;
 select * into c from public.conversations where id=p_conversation;
 if found and (c.company_id<>p_company or c.user_id<>p_user or c.version<>p_version)then raise exception 'Conversation changed' using errcode='40001';end if;
 if c.id is null then
  if p_version<>0 then raise exception 'Conversation unavailable';end if;
  insert into public.conversations(id,company_id,user_id,title)values(p_conversation,p_company,p_user,left(p_question,120));
 end if;
 select id into sid from public.decision_simulations where company_id=p_company and user_id=p_user and conversation_id=p_conversation and status='DRAFT' and context_fingerprint=p_fingerprint for update;
 if found then update public.decision_simulations set request_id=p_request,updated_at=now() where id=sid;return sid;end if;
 insert into public.decision_simulations(company_id,user_id,conversation_id,request_id,question,decision_type,materiality,status,snapshot,recommendation_summary,calculation_version,context_fingerprint)
 values(p_company,p_user,p_conversation,p_request,p_question,p_snapshot#>>'{intent,type}',p_snapshot#>>'{intent,materiality}','DRAFT',p_snapshot,'',p_snapshot->>'calculation_version',p_fingerprint) returning id into sid;
 insert into public.decision_simulation_versions(simulation_id,company_id,version,snapshot)values(sid,p_company,1,p_snapshot);
 insert into public.execution_events(company_id,user_id,entity_id,operation)values(p_company,p_user,sid,'simulation_started');
 return sid;
end $$;

create function public.save_decision_simulation(p_user uuid,p_company uuid,p_conversation uuid,p_request uuid,p_snapshot jsonb,p_summary text) returns uuid
language plpgsql security definer set search_path='' as $$
declare sid uuid;mid uuid;question text;existing public.decision_simulations%rowtype;
begin
 if not exists(select 1 from public.company_members where company_id=p_company and user_id=p_user) or not exists(select 1 from public.conversations where id=p_conversation and company_id=p_company and user_id=p_user) then raise exception 'Access denied' using errcode='42501';end if;
 perform 1 from public.companies where id=p_company for update;
 select * into existing from public.decision_simulations where request_id=p_request and company_id=p_company and user_id=p_user;
 if found and existing.status<>'DRAFT' then return existing.id;end if;
 select id,content into mid,question from public.messages where conversation_id=p_conversation and request_id=p_request and role='user';
 if mid is null then raise exception 'Simulation source unavailable';end if;
 if p_snapshot->>'status' not in ('WAITING_FOR_INFORMATION','READY') or p_snapshot->>'readiness' not in ('NOT_READY','READY_WITH_LIMITATIONS','READY') then raise exception 'Invalid simulation';end if;
 if existing.id is not null then
  update public.decision_simulations set snapshot=p_snapshot,status=p_snapshot->>'status',recommendation_summary=p_summary,source_message_id=mid,version=version+1,updated_at=now() where id=existing.id;
  insert into public.decision_simulation_versions(simulation_id,company_id,version,snapshot)values(existing.id,p_company,existing.version+1,p_snapshot);
  insert into public.execution_events(company_id,user_id,source_message_id,entity_id,operation)values(p_company,p_user,mid,existing.id,'simulation_completed');
  return existing.id;
 end if;
 insert into public.decision_simulations(company_id,user_id,conversation_id,request_id,source_message_id,question,decision_type,materiality,status,snapshot,recommendation_summary,calculation_version)
 values(p_company,p_user,p_conversation,p_request,mid,question,p_snapshot#>>'{intent,type}',p_snapshot#>>'{intent,materiality}',p_snapshot->>'status',p_snapshot,p_summary,p_snapshot->>'calculation_version') returning id into sid;
 insert into public.decision_simulation_versions(simulation_id,company_id,version,snapshot)values(sid,p_company,1,p_snapshot);
 insert into public.execution_events(company_id,user_id,source_message_id,entity_id,operation)values(p_company,p_user,mid,sid,case when p_snapshot->>'status'='READY' then 'simulation_completed' else 'simulation_waiting_for_information' end);
 return sid;
end $$;

create function public.revise_decision_simulation(p_user uuid,p_company uuid,p_id uuid,p_version integer,p_snapshot jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare s public.decision_simulations%rowtype;
begin
 if not exists(select 1 from public.company_members where company_id=p_company and user_id=p_user)then raise exception 'Access denied' using errcode='42501';end if;
 select * into s from public.decision_simulations where id=p_id and company_id=p_company and user_id=p_user for update;
 if not found or s.version<>p_version or s.status not in ('DRAFT','READY','WAITING_FOR_INFORMATION','COMPLETED') then raise exception 'Simulation changed' using errcode='40001';end if;
 if p_snapshot->>'status' not in ('WAITING_FOR_INFORMATION','READY') or p_snapshot->'intent' is distinct from s.snapshot->'intent' then raise exception 'Invalid revision';end if;
 update public.decision_simulations set snapshot=p_snapshot,status=p_snapshot->>'status',version=version+1,updated_at=now(),recommendation_summary='' where id=p_id;
 insert into public.decision_simulation_versions(simulation_id,company_id,version,snapshot) values(p_id,p_company,p_version+1,p_snapshot);
 insert into public.execution_events(company_id,user_id,entity_id,operation)values(p_company,p_user,p_id,'scenario_calculated');
 return p_version+1;
end $$;

create function public.accept_decision_scenario(p_user uuid,p_company uuid,p_id uuid,p_version integer,p_scenario text) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.decision_simulations%rowtype;option jsonb;did uuid;
begin
 if not exists(select 1 from public.company_members where company_id=p_company and user_id=p_user)then raise exception 'Access denied' using errcode='42501';end if;
 perform 1 from public.companies where id=p_company for update;
 select * into s from public.decision_simulations where id=p_id and company_id=p_company and user_id=p_user for update;
 if not found then raise exception 'Simulation unavailable';end if;
 if s.status='ACCEPTED' and s.selected_scenario=p_scenario then return s.decision_id;end if;
 if s.version<>p_version or s.status<>'READY' or s.snapshot->>'readiness'='NOT_READY' then raise exception 'Simulation changed' using errcode='40001';end if;
 select v into option from jsonb_array_elements(s.snapshot->'scenarios')v where v->>'id'=p_scenario;
 if option is null then raise exception 'Scenario unavailable';end if;
 did:=gen_random_uuid();
 insert into public.decisions(id,company_id,created_by,decision,context,reason,hypothesis,baseline,decision_date,request_hash,source_message_id)
 values(did,p_company,p_user,left(option->>'label',1000),left(s.question,3000),left(coalesce(nullif(s.recommendation_summary,''),option->>'label'),3000),left((option->'assumption_ids')::text,2000),left((s.snapshot#>'{extraction,inputs}')::text,2000),current_date,md5(p_id::text||':'||s.version||':'||p_scenario),s.source_message_id);
 update public.decision_simulations set decision_id=did,selected_scenario=p_scenario,status='ACCEPTED',version=version+1,updated_at=now() where id=p_id;
 insert into public.execution_events(company_id,user_id,source_message_id,entity_id,operation,after_state)values(p_company,p_user,s.source_message_id,p_id,'scenario_accepted',jsonb_build_object('decision_id',did,'scenario',p_scenario,'simulation_version',s.version));
 return did;
end $$;

create function public.commit_seed_turn_v96(p_user uuid,p_company uuid,p_conversation uuid,p_request uuid,p_version integer,p_message text,p_answer text,p_diagnosis jsonb,p_memories jsonb,p_skip_journal boolean,p_recommendation jsonb,p_commands jsonb,p_document boolean,p_simulation jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare cmd jsonb;sim public.decision_simulations%rowtype;linked uuid;mid uuid;
begin
 perform public.commit_seed_turn_v95(p_user,p_company,p_conversation,p_request,p_version,p_message,p_answer,p_diagnosis,p_memories,p_skip_journal,p_recommendation,p_commands,p_document);
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
revoke all on function public.save_decision_simulation(uuid,uuid,uuid,uuid,jsonb,text),public.revise_decision_simulation(uuid,uuid,uuid,integer,jsonb),public.accept_decision_scenario(uuid,uuid,uuid,integer,text),public.commit_seed_turn_v96(uuid,uuid,uuid,uuid,integer,text,text,jsonb,jsonb,boolean,jsonb,jsonb,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.save_decision_simulation(uuid,uuid,uuid,uuid,jsonb,text),public.revise_decision_simulation(uuid,uuid,uuid,integer,jsonb),public.accept_decision_scenario(uuid,uuid,uuid,integer,text),public.commit_seed_turn_v96(uuid,uuid,uuid,uuid,integer,text,text,jsonb,jsonb,boolean,jsonb,jsonb,boolean,jsonb) to service_role;
create function public.record_simulation_assessment(p_user uuid,p_company uuid,p_id uuid,p_result uuid,p_assessment jsonb,p_summary text) returns void
language plpgsql security definer set search_path='' as $$
declare s public.decision_simulations%rowtype;r public.execution_results%rowtype;
begin
 if not exists(select 1 from public.company_members where company_id=p_company and user_id=p_user)then raise exception 'Access denied' using errcode='42501';end if;
 perform 1 from public.companies where id=p_company for update;
 select * into s from public.decision_simulations where id=p_id and company_id=p_company and user_id=p_user and status='ACCEPTED';
 if not found then raise exception 'Simulation unavailable';end if;
 select * into r from public.execution_results where id=p_result and company_id=p_company and (decision_id=s.decision_id or plan_id=s.plan_id or experiment_id=s.experiment_id);
 if not found then raise exception 'Result unrelated to simulation';end if;
 if p_assessment->>'status' not in ('SUPPORTED','NOT_SUPPORTED','UNKNOWN') or p_assessment->>'result_id'<>p_result::text or length(p_summary) not between 1 and 1000 or not exists(select 1 from jsonb_array_elements(s.snapshot#>'{extraction,inputs}')v where v->>'id'=p_assessment->>'input_id' and v->>'kind'<>'FACT')then raise exception 'Invalid assessment';end if;
 if exists(select 1 from public.execution_events where company_id=p_company and entity_id=p_id and operation='assumption_assessed' and after_state->>'result_id'=p_result::text and after_state->>'input_id'=p_assessment->>'input_id')then return;end if;
 insert into public.execution_events(company_id,user_id,source_message_id,entity_id,operation,after_state)values(p_company,p_user,r.source_message_id,p_id,'assumption_assessed',p_assessment||jsonb_build_object('summary',p_summary));
 if p_assessment->>'status'<>'UNKNOWN' then
  insert into public.execution_learnings(company_id,result_id,plan_id,statement,evidence_summary,evidence_level)values(p_company,p_result,s.plan_id,p_summary,r.description,'PRELIMINARY')on conflict(result_id)do nothing;
 end if;
end $$;
revoke all on function public.record_simulation_assessment(uuid,uuid,uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.record_simulation_assessment(uuid,uuid,uuid,uuid,jsonb,text) to service_role;
revoke all on function public.stage_decision_simulation(uuid,uuid,uuid,uuid,integer,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.stage_decision_simulation(uuid,uuid,uuid,uuid,integer,text,text,jsonb) to service_role;
commit;
