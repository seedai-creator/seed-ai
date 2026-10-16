import {PGlite} from '@electric-sql/pglite';
import {createHash} from 'node:crypto';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {schemaAuditQuery,compareSchema} from './schema-audit.mjs';
const through=process.argv.find(v=>v.startsWith('--through='))?.slice('--through='.length);
const include=(process.argv.find(v=>v.startsWith('--include='))?.slice('--include='.length)??'').split(',').filter(Boolean);
if(through&&!/^(?:\d{12}|\d{14})$/.test(through))throw Error('INVALID_MIGRATION_BOUNDARY');
if(include.some(v=>!/^\d{12}(?:\d{2})?$/.test(v))||new Set(include).size!==include.length)throw Error('INVALID_INCLUDED_MIGRATIONS');
const suffix=(through?'-'+through:'')+(include.length?'-shared':'');
const dir=new URL('../.test-build/schema-audit'+suffix+'/',import.meta.url);
await mkdir(dir,{recursive:true});
if(process.argv[2]==='compare') {
 const actual=JSON.parse(await readFile(process.argv[3],'utf8'));
 const expected=JSON.parse(await readFile(new URL('expected.json',dir),'utf8'));
 const report=compareSchema(expected,actual);
 await writeFile(new URL('comparison.json',dir),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
 if(!report.matches)process.exitCode=1;
} else {
 const db=new PGlite();
 try {
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;");
  // Supabase's privileged server role receives these defaults. Client grants
  // must still match the migrations exactly; never normalize them away.
  await db.exec('alter default privileges in schema public grant all on tables to service_role; alter default privileges in schema public grant all on functions to service_role;');
  const source=new URL('../supabase/migrations/',import.meta.url),manifest=[];
  const files=(await readdir(source)).filter(f=>f.endsWith('.sql')).sort();
  if(through&&!files.some(file=>file.startsWith(through+'_')))throw Error('UNKNOWN_MIGRATION_BOUNDARY');
  if(include.some(version=>!files.some(file=>file.startsWith(version+'_'))))throw Error('UNKNOWN_INCLUDED_MIGRATION');
  for(const file of files.filter(file=>!through||file.split('_')[0]<=through||include.includes(file.split('_')[0]))) {
   const sql=await readFile(new URL(file,source),'utf8');
   await db.exec(sql);
   manifest.push({file,sha256:createHash('sha256').update(sql).digest('hex')});
  }
  await writeFile(new URL('expected.json',dir),JSON.stringify((await db.query(schemaAuditQuery)).rows[0].snapshot,null,2));
  await writeFile(new URL('function-bodies.json',dir),JSON.stringify((await db.query("select proname,prosrc from pg_proc where pronamespace='public'::regnamespace")).rows,null,2));
  await writeFile(new URL('manifest.json',dir),JSON.stringify({createdAt:new Date().toISOString(),migrations:manifest},null,2));
  await writeFile(new URL('query.sql',dir),schemaAuditQuery);
  console.log(JSON.stringify({migrations:manifest.length,output:'.test-build/schema-audit'+suffix,network:false}));
 } finally {await db.close();}
}
