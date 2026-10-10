begin;
-- Mirror an already persisted execution review into the original experiment
-- record. Finishing execution alone still does NOT validate a hypothesis.
create or replace function public.sync_execution_lifecycle() returns trigger
language plpgsql set search_path='' as $$
declare measured numeric; learned text;
begin
 if tg_table_name='experiments' then
  if new.execution_status='ANALYZED' and new.status='RUNNING' then
   select r.observed_value,l.statement into measured,learned
   from public.execution_results r join public.execution_learnings l on l.result_id=r.id and l.company_id=r.company_id
   where r.company_id=new.company_id and r.experiment_id=new.id and r.status='ANALYZED'
   order by r.created_at desc limit 1;
   if not found then raise exception 'Analyzed experiment needs a recorded result and learning'; end if;
   new.status:=case new.analytical_outcome when 'SUPPORTED' then 'VALIDATED' when 'NOT_SUPPORTED' then 'INVALIDATED' else 'INCONCLUSIVE' end;
   new.analytical_outcome:=coalesce(new.analytical_outcome,'INCONCLUSIVE');
   new.result:=measured::text;
   new.learning:=left(learned,4000);
   new.finished_at:=coalesce(new.finished_at,now());
   new.finished_by:=coalesce(new.finished_by,auth.uid());
  elsif new.status is distinct from old.status then
   new.execution_status:=case when new.status='PLANNED' then 'READY' when new.status='RUNNING' then 'RUNNING' else 'ANALYZED' end;
   new.analytical_outcome:=case new.status when 'VALIDATED' then 'SUPPORTED' when 'INVALIDATED' then 'NOT_SUPPORTED' when 'INCONCLUSIVE' then 'INCONCLUSIVE' end;
  end if;
 elsif tg_table_name='decisions' then
  if new.reviewed_at is distinct from old.reviewed_at and new.reviewed_at is not null then new.execution_status:='REVIEWED'; end if;
 end if;
 return new;
end $$;
-- Repair only reviews whose result and learning already exist; no new inference.
update public.experiments e set execution_status=e.execution_status,version=e.version+1
where e.execution_status='ANALYZED' and e.status='RUNNING'
and exists(select 1 from public.execution_results r join public.execution_learnings l on l.result_id=r.id and l.company_id=r.company_id
 where r.experiment_id=e.id and r.company_id=e.company_id and r.status='ANALYZED');
commit;
