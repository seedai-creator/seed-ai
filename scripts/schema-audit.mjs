// Read-only catalog evidence. No customer rows, credentials or Auth records.
// Compare the installed contract, not just migration names or a table count.
export const schemaAuditQuery = `
with tables as (
 select c.oid,c.relname,c.relrowsecurity,c.relforcerowsecurity
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r'
), functions as (
 select p.*,p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' as identity
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prokind='f'
 and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')
)
select jsonb_build_object(
 'tables',coalesce((select jsonb_object_agg(t.relname,jsonb_build_object(
  'rls',t.relrowsecurity,'forceRls',t.relforcerowsecurity,
  'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,
    'default',pg_get_expr(d.adbin,d.adrelid),'generated',a.attgenerated,'identity',a.attidentity,
    'clientPrivileges',(select jsonb_object_agg(r||':'||v,has_column_privilege(r,t.oid,a.attnum,v)) from unnest(array['anon','authenticated']) r cross join unnest(array['SELECT','INSERT','UPDATE','REFERENCES']) v))
    order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped),
  'constraints',coalesce((select jsonb_object_agg(c.conname,pg_get_constraintdef(c.oid)) from pg_constraint c where c.conrelid=t.oid and c.contype<>'n'),'{}'::jsonb),
  'policies',coalesce((select jsonb_object_agg(p.polname,jsonb_build_object('command',p.polcmd,'permissive',p.polpermissive,
    'roles',(select jsonb_agg(case when role_oid=0 then 'public' else pg_get_userbyid(role_oid) end order by case when role_oid=0 then 'public' else pg_get_userbyid(role_oid) end) from unnest(p.polroles) role_oid),
    'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid))) from pg_policy p where p.polrelid=t.oid),'{}'::jsonb),
  'grants',(select jsonb_object_agg(r||':'||v,has_table_privilege(r,t.oid,v)) from unnest(array['anon','authenticated','service_role']) r cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) v),
  'triggers',coalesce((select jsonb_object_agg(g.tgname,pg_get_triggerdef(g.oid)) from pg_trigger g where g.tgrelid=t.oid and not g.tgisinternal),'{}'::jsonb),
  'indexes',coalesce((select jsonb_object_agg(i.indexname,i.indexdef) from pg_indexes i where i.schemaname='public' and i.tablename=t.relname),'{}'::jsonb)
 )) from tables t),'{}'::jsonb),
 'functions',coalesce((select jsonb_object_agg(f.identity,jsonb_build_object('bodyHash',md5(replace(trim(f.prosrc),chr(13),'')),
  'returns',pg_get_function_result(f.oid),'securityDefiner',f.prosecdef,'volatility',f.provolatile,'strict',f.proisstrict,
  'settings',f.proconfig,'grants',jsonb_build_object('anon',has_function_privilege('anon',f.oid,'EXECUTE'),
   'authenticated',has_function_privilege('authenticated',f.oid,'EXECUTE'),'service_role',has_function_privilege('service_role',f.oid,'EXECUTE')))) from functions f),'{}'::jsonb)
) as snapshot;
`;

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  return value;
}

export function compareSchema(expected,actual) {
  for (const snapshot of [expected,actual]) for (const kind of ['tables','functions']) {
    if (!snapshot || !snapshot[kind] || Array.isArray(snapshot[kind]) || typeof snapshot[kind]!=='object') throw Error('INVALID_SCHEMA_SNAPSHOT');
  }
  if (!Object.keys(expected.tables).length || !Object.keys(expected.functions).length) throw Error('EMPTY_EXPECTED_SCHEMA');
  const missing=[],changed=[],extra=[];
  for (const kind of ['tables','functions']) {
    for (const [name,contract] of Object.entries(expected[kind])) {
      if (!Object.hasOwn(actual[kind],name)) {missing.push({kind,name});continue;}
      for (const field of Object.keys(contract)) if (JSON.stringify(canonical(contract[field]))!==JSON.stringify(canonical(actual[kind][name][field]))) changed.push({kind,name,field});
    }
    for (const name of Object.keys(actual[kind])) if (!Object.hasOwn(expected[kind],name)) extra.push({kind,name});
  }
  return {matches:missing.length===0&&changed.length===0,comparedTables:Object.keys(expected.tables).length,
    comparedFunctions:Object.keys(expected.functions).length,missing,changed,extra,
    // Extra objects may belong to another app (the institutional landing).
    // Never delete them or fabricate migration-history entries from this result.
    migrationHistoryRepaired:false};
}
