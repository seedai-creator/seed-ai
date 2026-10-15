begin;
-- Application version/idempotency conflicts are permanent for this payload.
-- SQLSTATE 40001 means a transient serialization failure and can cause repeated
-- transactions in hosted PostgREST. PT409 returns a direct HTTP conflict.
-- Preserve existing bodies, signatures, ownership, grants and authorization.
do $migration$
declare signature text; definition text; target regprocedure;
begin
 foreach signature in array array[
  'public.accept_decision_scenario(uuid,uuid,uuid,integer,text)',
  'public.accept_execution_recommendation(uuid,uuid,uuid,integer)',
  'public.commit_seed_turn_v94(uuid,uuid,uuid,uuid,integer,text,text,jsonb,jsonb,boolean,jsonb,jsonb)',
  'public.finish_experiment(uuid,uuid,integer,text,text,text)',
  'public.operations_change(uuid,text,text,jsonb,integer,text)',
  'public.reserve_ai_request(uuid,uuid,uuid,numeric,text,text)',
  'public.resolve_support_request(uuid,uuid,integer,text,text)',
  'public.review_decision(uuid,uuid,integer,text,text)',
  'public.revise_decision_simulation(uuid,uuid,uuid,integer,jsonb)',
  'public.save_company_fact(uuid,text,text,integer)',
  'public.save_company_market(uuid,text,text,text,text,text,timestamp with time zone,integer,integer)',
  'public.save_decision(uuid,uuid,jsonb)',
  'public.save_experiment(uuid,uuid,jsonb)',
  'public.save_strategy(uuid,uuid,jsonb)',
  'public.set_action_status(uuid,uuid,text,integer)',
  'public.set_strategy_status(uuid,uuid,text,integer)',
  'public.stage_decision_simulation(uuid,uuid,uuid,uuid,integer,text,text,jsonb)',
  'public.start_experiment(uuid,uuid,integer)',
  'public.update_commercial_config(uuid,text,text,integer,jsonb,text)'
 ] loop
  target:=to_regprocedure(signature);
  if target is null then raise exception 'Required function missing: %',signature; end if;
  definition:=pg_get_functiondef(target);
  if position('''40001''' in definition)=0 then raise exception 'Expected conflict definition missing: %',signature; end if;
  execute replace(definition,'''40001''','''PT409''');
 end loop;
end $migration$;
commit;
