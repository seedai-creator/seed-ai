begin;
-- Explicit UI selection links a plan atomically; no inferred association across conversations.
create function public.accept_simulation_plan(p_user uuid,p_company uuid,p_id uuid,p_version integer,p_simulation uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.decision_simulations%rowtype;r public.recommendations%rowtype;pid uuid;
begin
 if not exists(select 1 from public.company_members where company_id=p_company and user_id=p_user)then raise exception 'Access denied' using errcode='42501';end if;
 perform 1 from public.companies where id=p_company for update;
 select * into s from public.decision_simulations where id=p_simulation and company_id=p_company and user_id=p_user and status='ACCEPTED' for update;
 if not found then raise exception 'Simulation unavailable';end if;
 select * into r from public.recommendations where id=p_id and company_id=p_company and conversation_id=s.conversation_id;
 if not found then raise exception 'Recommendation outside simulation conversation';end if;
 pid:=public.accept_execution_recommendation(p_user,p_company,p_id,p_version);
 if s.plan_id is not null and s.plan_id<>pid then raise exception 'Simulation plan conflict';end if;
 if s.plan_id is null then
  update public.decision_simulations set plan_id=pid,updated_at=now() where id=s.id;
  update public.decisions set plan_id=pid where id=s.decision_id and company_id=p_company;
  insert into public.execution_events(company_id,user_id,entity_id,operation,after_state)values(p_company,p_user,s.id,'simulation_to_plan',jsonb_build_object('plan_id',pid));
 end if;
 return pid;
end $$;
revoke all on function public.accept_simulation_plan(uuid,uuid,uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.accept_simulation_plan(uuid,uuid,uuid,integer,uuid) to service_role;
create or replace function public.accept_decision_scenario(p_user uuid,p_company uuid,p_id uuid,p_version integer,p_scenario text) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.decision_simulations%rowtype;option jsonb;did uuid;
begin
 if not exists(select 1 from public.company_members where company_id=p_company and user_id=p_user)then raise exception 'Access denied' using errcode='42501';end if;
 perform set_config('request.jwt.claim.sub',p_user::text,true);
 perform 1 from public.companies where id=p_company for update;
 select * into s from public.decision_simulations where id=p_id and company_id=p_company and user_id=p_user for update;
 if not found then raise exception 'Simulation unavailable';end if;
 if s.status='ACCEPTED' and s.selected_scenario=p_scenario then return s.decision_id;end if;
 if s.version<>p_version or s.status<>'READY' or coalesce(s.snapshot->>'readiness','NOT_READY') not in ('READY','READY_WITH_LIMITATIONS') then raise exception 'Simulation changed' using errcode='40001';end if;
 select v into option from jsonb_array_elements(s.snapshot->'scenarios')v where v->>'id'=p_scenario;
 if option is null then raise exception 'Scenario unavailable';end if;
 did:=gen_random_uuid();
 insert into public.decisions(id,company_id,created_by,decision,context,reason,hypothesis,baseline,decision_date,request_hash,source_message_id)
 values(did,p_company,p_user,left(option->>'label',1000),left(s.question,3000),left(coalesce(nullif(s.recommendation_summary,''),option->>'label'),3000),left((option->'assumption_ids')::text,2000),left((s.snapshot#>'{extraction,inputs}')::text,2000),current_date,md5(p_id::text||':'||s.version||':'||p_scenario),s.source_message_id);
 update public.decision_simulations set decision_id=did,selected_scenario=p_scenario,status='ACCEPTED',version=version+1,updated_at=now() where id=p_id;
 insert into public.execution_events(company_id,user_id,source_message_id,entity_id,operation,after_state)values(p_company,p_user,s.source_message_id,p_id,'scenario_accepted',jsonb_build_object('decision_id',did,'scenario',p_scenario,'simulation_version',s.version));
 return did;
end $$;


commit;
