import {createHash} from 'node:crypto';
import {schemaAuditQuery,compareSchema} from './schema-audit.mjs';

const normalize=sql=>sql.replaceAll('\r\n','\n').trim();
const md5=value=>value===null?null:createHash('md5').update(value).digest('hex');
const literal=value=>value===null?'null':"'"+value.replaceAll("'","''")+"'";
const digestRows=rows=>rows.map(r=>({version:r.version,name:r.name,sql_md5:md5(r.statements===null?null:r.statements.join('\n'))})).sort((a,b)=>a.version.localeCompare(b.version));
const ledgerQuery="select coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name,'sql_md5',md5(array_to_string(statements,E'\\n'))) order by version),'[]'::jsonb) from supabase_migrations.schema_migrations";

// Produces an offline, reviewable repair, never executes SQL or opens a network
// connection. The installed set must be supplied explicitly, not inferred from
// filenames or a cutoff that could accidentally mark unapplied work as done.
export function planMigrationHistory({sources,installedFiles,remote,expectedSchema,actualSchema,schemaFingerprint}) {
  const comparison=compareSchema(expectedSchema,actualSchema);
  if(!comparison.matches||comparison.extra.length)throw Error('SCHEMA_NOT_EXACT');
  if(!/^[a-f0-9]{32}$/.test(schemaFingerprint??''))throw Error('MISSING_SCHEMA_FINGERPRINT');
  const byName=new Map(),versions=new Set();
  for(const source of sources) {
    const match=source.file.match(/^(\d{12}(?:\d{2})?)_([a-z0-9_]+)\.sql$/);
    if(!match||versions.has(match[1])||byName.has(match[2])||!source.sql)throw Error('INVALID_SOURCE');
    versions.add(match[1]);byName.set(match[2],{...source,version:match[1],name:match[2]});
  }
  if(!installedFiles.length||new Set(installedFiles).size!==installedFiles.length||installedFiles.some(file=>!sources.some(s=>s.file===file)))throw Error('INVALID_INSTALLED_SET');
  const installed=[...byName.values()].filter(s=>installedFiles.includes(s.file));
  const observed=new Set(),renames=[];
  for(const row of remote) {
    const source=byName.get(row.name);
    if(!/^\d{12}(?:\d{2})?$/.test(row.version)||observed.has(row.version)||!source||!installedFiles.includes(source.file))throw Error('UNKNOWN_REMOTE_MIGRATION');
    if(remote.filter(r=>r.name===row.name).length!==1||!Array.isArray(row.statements)||normalize(row.statements.join('\n'))!==normalize(source.sql))throw Error('REMOTE_SQL_MISMATCH');
    observed.add(row.version);
    if(source.version!==row.version) {
      if(remote.some(r=>r.version===source.version))throw Error('VERSION_COLLISION');
      renames.push({from:row.version,to:source.version,name:row.name});
    }
  }
  const inserted=installed.filter(source=>!remote.some(r=>r.name===source.name));
  if(inserted.some(s=>observed.has(s.version)))throw Error('VERSION_COLLISION');
  const after=remote.map(r=>({...r,version:byName.get(r.name).version})).concat(inserted.map(s=>({version:s.version,name:s.name,statements:null})));
  const guard=rows=>`if (${ledgerQuery}) <> ${literal(JSON.stringify(digestRows(rows)))}::jsonb then raise exception 'MIGRATION_LEDGER_CHANGED'; end if;`;
  const schemaGuard=`if (select md5(snapshot::text) from (${schemaAuditQuery.trim().replace(/;$/,'')}) audit) <> '${schemaFingerprint}' then raise exception 'SCHEMA_CHANGED'; end if;`;
  const wrap=(before,body,after)=>`-- Metadata only. No migration SQL is replayed.\nbegin;\nset local lock_timeout='5s';\nset local statement_timeout='30s';\nlock table supabase_migrations.schema_migrations in exclusive mode;\ndo $repair$ begin\n${guard(before)}\n${schemaGuard}\n${body}\n${guard(after)}\nend $repair$;\ncommit;\n`;
  const forward=renames.map(r=>`update supabase_migrations.schema_migrations set version='${r.to}' where version='${r.from}';`).concat(inserted.map(s=>`insert into supabase_migrations.schema_migrations(version,name) values('${s.version}','${s.name}');`)).join('\n');
  const backward=inserted.map(s=>`delete from supabase_migrations.schema_migrations where version='${s.version}' and name='${s.name}' and statements is null;`).concat(renames.map(r=>`update supabase_migrations.schema_migrations set version='${r.from}' where version='${r.to}';`)).join('\n');
  return {renames,inserted:inserted.map(s=>({version:s.version,name:s.name})),pending:sources.filter(s=>!installedFiles.includes(s.file)).map(s=>s.file),expectedLedger:digestRows(after),forward:wrap(remote,forward,after),rollback:wrap(after,backward,remote)};
}
