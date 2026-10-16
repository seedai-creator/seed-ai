import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('usage cycles: independent conversation quota, PRO reports and expiring test allowance', async t => {
 const db=new PGlite(), uid=crypto.randomUUID();
 try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`);
 const folder=new URL('../supabase/migrations/',import.meta.url);
 for(const n of (await readdir(folder)).filter(n=>n.endsWith('.sql')).sort())await db.exec(await readFile(new URL(n,folder),'utf8'));
 await db.query('insert into auth.users(id) values($1)',[uid]);
 const company=(await db.query('select company_id from company_members where user_id=$1',[uid])).rows[0].company_id;
 await db.query("insert into commercial_accounts(user_id,market_code) values($1,'BR') on conflict(user_id) do update set market_code='BR'",[uid]);
 await db.exec("update commercial_markets set status='ACTIVE',disable_ai_requests=false where code='BR'");
 const snapshot=async()=>(await db.query("select commercial_usage($1,'month') as r",[uid])).rows[0].r;
 const reserve=async(feature='diagnosis')=>{const id=crypto.randomUUID();const r=(await db.query('select reserve_ai_request($1,$2,$3,0.001,$4,$5) as r',[uid,company,id,feature,id])).rows[0].r; if(r.allowed)await db.query("select finish_ai_request($1,'COMPLETED',0.001)",[id]);return r;};
 const insert=async(feature,status='COMPLETED',at="now()-interval '1 day'",allowance=null)=>db.query(`insert into ai_requests(id,user_id,company_id,plan_code,market_code,status,reserved_usd,accounted_usd,feature,created_at,allowance_id) values($1,$2,$3,'FREE','BR',$4,0.001,0.001,$5,${at},$6)`,[crypto.randomUUID(),uid,company,status,feature,allowance]);
 await t.test('FREE retains three lifetime analyses; historical weekly report costs money but no conversation unit',async()=>{
  await insert('diagnosis');await insert('diagnosis');await insert('WEEKLY_INTELLIGENCE_GENERATION');await insert('classification');await insert('diagnosis','FAILED');
  const s=await snapshot();assert.equal(s.diagnoses,2);assert.equal(s.analysis_limit,3);assert.equal(s.period_end,null);assert.equal(s.window,'lifetime');assert.equal(s.cost,.005);
  assert.equal((await reserve('WEEKLY_INTELLIGENCE_GENERATION')).reason,'PRO_REQUIRED');
  assert.equal((await reserve()).allowed,true);assert.equal((await reserve()).reason,'DIAGNOSIS_LIMIT');
  assert.equal((await reserve('classification')).reason,'DIAGNOSIS_LIMIT');
  assert.equal((await reserve('BUSINESS_JOURNAL_EXTRACTION')).allowed,true);
 });
 await t.test('test allowance is separate, expires back to original balance, and keeps every financial record',async()=>{
  const before=await snapshot();const policy={...before.policy,diagnoses:10};const oid=crypto.randomUUID();
  await db.query("insert into commercial_overrides(id,user_id,kind,settings,expires_at,reason,created_by) values($1,$2,'CUSTOM_ALLOWANCE',$3,now()+interval '7 days','Fixture allowance',$2)",[oid,uid,{policy}]);
  assert.equal((await snapshot()).diagnoses,0);assert.equal((await snapshot()).analysis_limit,10);
  assert.equal((await reserve()).allowed,true);assert.equal((await snapshot()).diagnoses,1);
  assert.equal((await snapshot()).cost,before.cost+.001);
  await db.query("update commercial_overrides set created_at=now()-interval '8 days',expires_at=now()-interval '1 day' where id=$1",[oid]);
  assert.equal((await snapshot()).diagnoses,3);assert.equal((await snapshot()).cost,before.cost+.001);
  assert.equal((await reserve()).reason,'DIAGNOSIS_LIMIT');
 });
 await t.test('paid quota follows provider cycle and reports continue after conversation quota exhaustion',async()=>{
  await db.query("insert into subscriptions(user_id,plan_code,market_code,provider,status,currency,amount_minor,current_period_start,current_period_end) values($1,'PRO','BR','stripe','active','BRL',9990,now()-interval '20 days',now()+interval '10 days')",[uid]);
  await insert('diagnosis','COMPLETED',"now()-interval '21 days'");
  await db.exec("update commercial_plans set policy=jsonb_set(policy,'{diagnoses}','3') where code='PRO'");
  const s=await snapshot();assert.equal(s.window,'subscription');assert.equal(s.diagnoses,3);assert.ok(s.period_end);assert.equal((await reserve()).reason,'DIAGNOSIS_LIMIT');
  assert.equal((await reserve('WEEKLY_INTELLIGENCE_GENERATION')).allowed,true);assert.equal((await snapshot()).diagnoses,3);
  await db.query("update subscriptions set current_period_start=now(),current_period_end=now()+interval '30 days' where user_id=$1",[uid]);
  assert.equal((await snapshot()).diagnoses,0);
 });
 await t.test('clients cannot forge quota snapshots; invalid subscription periods fail closed',async()=>{
  await db.exec('set role authenticated');await assert.rejects(snapshot());await db.exec('reset role');
  await db.query('update subscriptions set current_period_start=null where user_id=$1',[uid]);await assert.rejects(snapshot());
 });
 }finally{await db.close();}
});
