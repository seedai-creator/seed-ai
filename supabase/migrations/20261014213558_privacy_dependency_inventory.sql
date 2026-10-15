begin;

-- Read-only, server-only inventory. Counts are not permission to erase records.
create function public.privacy_deletion_dependencies(p_request uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare subject uuid; item record; n bigint; dependencies jsonb:='[]'; active_jobs jsonb;
begin
 select user_id into subject from public.support_requests where id=p_request
 and category='DELETE_ACCOUNT' and status in ('OPEN','IN_REVIEW','AWAITING_USER');
 if subject is null then raise exception 'Open deletion request required' using errcode='22023'; end if;
 for item in
  select ns.nspname schema_name,cl.relname table_name,attr.attname column_name,
   not attr.attnotnull nullable,fk.confdeltype,cardinality(fk.conkey) key_columns
  from pg_catalog.pg_constraint fk
  join pg_catalog.pg_class cl on cl.oid=fk.conrelid
  join pg_catalog.pg_namespace ns on ns.oid=cl.relnamespace
  join pg_catalog.pg_attribute attr on attr.attrelid=cl.oid and attr.attnum=fk.conkey[1]
  where fk.contype='f' and ns.nspname='public'
   and fk.confrelid in ('public.profiles'::regclass,'auth.users'::regclass)
  order by ns.nspname,cl.relname,attr.attname
 loop
  if item.key_columns<>1 then raise exception 'Composite account dependency requires manual review'; end if;
  -- Identifiers come from PostgreSQL catalogs, quoted as identifiers. Only UUID is bound as data.
  execute format('select count(*) from %I.%I where %I=$1',item.schema_name,item.table_name,item.column_name)
   into n using subject;
  dependencies:=dependencies||jsonb_build_array(jsonb_build_object('table',item.table_name,'column',item.column_name,
   'nullable',item.nullable,'delete_action',case item.confdeltype when 'c' then 'CASCADE' when 'n' then 'SET_NULL'
    when 'd' then 'SET_DEFAULT' when 'r' then 'RESTRICT' else 'NO_ACTION' end,'count',n));
 end loop;
 select jsonb_build_object(
  'ai_requests',(select count(*) from public.ai_requests where user_id=subject and status='RESERVED'),
  'journal_jobs',(select count(*) from public.journal_jobs where user_id=subject and status in ('QUEUED','RUNNING','READY')),
  'business_model_jobs',(select count(*) from public.business_model_jobs where user_id=subject and status='QUEUED'),
  'external_research_runs',(select count(*) from public.external_research_runs where user_id=subject and status in ('QUEUED','RUNNING')),
  'growth_map_requests',(select count(*) from public.growth_map_requests where requested_by=subject and status in ('QUEUED','RUNNING'))
 ) into active_jobs;
 return jsonb_build_object('version',1,'request_id',p_request,'observed_at',now(),
  'dependencies',dependencies,'active_jobs',active_jobs,
  'coverage','Direct public-schema foreign keys to profiles/auth.users. Embedded JSON, free text, company-wide workers, Storage and external providers require separate review.');
end $$;
revoke all on function public.privacy_deletion_dependencies(uuid) from public,anon,authenticated;
grant execute on function public.privacy_deletion_dependencies(uuid) to service_role;
commit;
