import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {validateDependencyInventory} from '../scripts/privacy-review.mjs';

test('privacy dependency inventory detects retention and authorship without granting deletion',async t=>{
 const db=new PGlite(),subject=crypto.randomUUID(),other=crypto.randomUUID(),request=crypto.randomUUID();
 async function asRole(role,sql,params=[]){await db.exec('begin');try{await db.exec('set local role '+role);const r=await db.query(sql,params);await db.exec('commit');return r.rows;}catch(e){await db.exec('rollback');throw e;}}
 const inventory=async()=>validateDependencyInventory((await asRole('service_role','select privacy_deletion_dependencies($1) value',[request]))[0].value,request);
 try{
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;");
  const dir=new URL('../supabase/migrations/',import.meta.url);
  for(const f of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(f,dir),'utf8'));
  // Mirror the hosted service-role table privileges, without changing client permissions.
  await db.exec('grant select on all tables in schema public to service_role');
  await db.query("insert into auth.users(id,email) values($1,'privacy-subject@example.invalid'),($2,'privacy-other@example.invalid')",[subject,other]);
  const own=(await db.query('select company_id from company_members where user_id=$1',[subject])).rows[0].company_id;
  const shared=(await db.query('select company_id from company_members where user_id=$1',[other])).rows[0].company_id;
  await db.query("insert into company_members(company_id,user_id,role) values($1,$2,'member')",[shared,subject]);
  await db.query("insert into support_requests(id,user_id,category,description) values($1,$2,'DELETE_ACCOUNT','FICTIONAL PRIVACY TEST REQUEST')",[request,subject]);
  await db.query("insert into conversations(id,company_id,user_id,title) values($1,$2,$3,'PRIVATE_AUTHORSHIP_CANARY')",[crypto.randomUUID(),shared,subject]);
  await db.query("insert into ai_requests(id,user_id,company_id,plan_code,market_code,status,reserved_usd,feature) values($1,$2,$3,'FREE','BR','RESERVED',0.01,'diagnosis')",[crypto.randomUUID(),subject,own]);
  await t.test('anonymous and signed-in users cannot inspect another account or call the inventory',async()=>{
   for(const role of ['anon','authenticated'])await assert.rejects(asRole(role,'select privacy_deletion_dependencies($1)',[request]),/permission denied/);
   await assert.rejects(asRole('service_role','select privacy_deletion_dependencies($1)',[crypto.randomUUID()]),/Open deletion/);
  });
  await t.test('restricting foreign keys, active work and shared authorship appear as counts only',async()=>{
   const report=await inventory();
   assert.equal(report.foreignKeys.find(d=>d.table==='conversations'&&d.column==='user_id').count,1);
   assert.equal(report.foreignKeys.find(d=>d.table==='ai_requests'&&d.column==='user_id').deleteAction,'NO_ACTION');
   assert.equal(report.activeJobs.ai_requests,1);
   assert.equal(report.foreignKeys.find(d=>d.table==='company_members'&&d.column==='user_id').count,2);
   assert.doesNotMatch(JSON.stringify(report),/PRIVATE_AUTHORSHIP_CANARY|privacy-subject|privacy-other/);
   await assert.rejects(db.query('delete from auth.users where id=$1',[subject]),/foreign key/);
   assert.equal((await db.query('select count(*)::int n from conversations where company_id=$1',[shared])).rows[0].n,1);
  });
  await t.test('new dependencies are discovered without a hardcoded table list; missing privilege fails closed',async()=>{
   await db.exec('create table public.future_private_fixture(id uuid primary key,subject uuid references public.profiles);alter table public.future_private_fixture enable row level security');
   await db.query('insert into future_private_fixture values($1,$2)',[crypto.randomUUID(),subject]);
   await assert.rejects(inventory(),/permission denied/);
   await db.exec('grant select on public.future_private_fixture to service_role');
   assert.equal((await inventory()).foreignKeys.find(d=>d.table==='future_private_fixture').count,1);
  });
  await t.test('closed or unrelated requests never produce an actionable review',async()=>{
   await db.query("update support_requests set status='RESOLVED' where id=$1",[request]);
   await assert.rejects(inventory(),/Open deletion/);
   await db.query("update support_requests set status='OPEN',category='BUG' where id=$1",[request]);
   await assert.rejects(inventory(),/Open deletion/);
  });
 }finally{await db.close();}
});
