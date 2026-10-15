import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';

test('operational outbox enforces isolation, deduplication, bounded retries and immutable messages',async t=>{
 const db=new PGlite();
 const claim=async(sender='alerts@example.invalid',recipient='owner@example.invalid',environment='staging')=>
  (await db.query('select * from claim_operational_alert($1,$2,$3)',[sender,recipient,environment])).rows[0];
 const finish=async(row,id=null,retry=true,code='NETWORK_FAILURE')=>(await db.query('select finish_operational_alert($1,$2,$3,$4,$5) ok',[row.id,row.lease_token,id,retry,code])).rows[0].ok;
 const queue=async()=>(await db.query('select queue_operational_alerts() n')).rows[0].n;
 async function role(sql,who){await db.exec('begin');try{await db.exec('set local role '+who);const r=await db.exec(sql);await db.exec('commit');return r;}catch(e){await db.exec('rollback');throw e;}}
 try{
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;");
  const dir=new URL('../supabase/migrations/',import.meta.url);
  for(const f of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(f,dir),'utf8'));
  await t.test('only service role can inspect and operate the queue; clients cannot forge an alert',async()=>{
   for(const who of ['anon','authenticated'])for(const sql of [
    'select * from operational_alerts','select queue_operational_alerts()',
    "select claim_operational_alert('a@example.invalid','b@example.invalid','production')",
    "select finish_operational_alert(gen_random_uuid(),gen_random_uuid(),null,true,'NETWORK_FAILURE')",
    "insert into operational_alerts(severity,window_start,metrics) values('P1',now(),'{}')",
   ])await assert.rejects(role(sql,who));
   assert.equal((await role('select queue_operational_alerts() n','service_role'))[0].rows[0].n,0);
   assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.operational_alerts'::regclass")).rows[0].relrowsecurity,true);
  });
  await t.test('ordinary events do not alert; a failure burst creates one immutable alert per severity/hour',async()=>{
   await db.exec("insert into operational_events(feature,code,level) values('fixture','AI_COMPLETED','INFO')");
   assert.equal(await queue(),0);
   await db.exec("insert into operational_events(feature,code,level) select 'fixture','AI_FAILED','ERROR' from generate_series(1,5)");
   assert.equal(await queue(),1);assert.equal(await queue(),0);
   await db.exec("insert into operational_events(feature,code,level) values('fixture','UNHANDLED_REQUEST','ERROR')");
   assert.equal(await queue(),0);
   const rows=(await db.query('select * from operational_alerts')).rows;
   assert.equal(rows.length,1);assert.equal(rows[0].metrics.errors_15m,5);assert.equal(rows[0].severity,'P1');
  });
  let first;
  await t.test('active leases exclude other workers; expired leases preserve recipients and message identity',async()=>{
   first=await claim();assert.equal(first.attempts,1);assert.equal(await claim(),undefined);
   assert.equal(await finish({...first,lease_token:crypto.randomUUID()}),false);
   await db.exec("update operational_alerts set lease_until=now()-interval '1 second'");
   const second=await claim('changed@example.invalid','changed@example.invalid','production');
   assert.equal(second.id,first.id);assert.notEqual(second.lease_token,first.lease_token);
   assert.equal(second.sender,first.sender);assert.equal(second.recipient,first.recipient);assert.equal(second.environment,'staging');
   assert.deepEqual(second.metrics,first.metrics);assert.equal(await finish(first),false);first=second;
  });
  await t.test('transient retry is delayed, acceptance records receipt and prevents future sends',async()=>{
   assert.equal(await finish(first),true);assert.equal(await claim(),undefined);
   await db.exec("update operational_alerts set available_at=now()-interval '1 second'");
   const retry=await claim(),providerId=crypto.randomUUID();
   assert.equal(await finish(retry,providerId,false,null),true);
   assert.equal(await claim(),undefined);
   const stored=(await db.query('select * from operational_alerts')).rows[0];
   assert.equal(stored.status,'ACCEPTED');assert.equal(stored.provider_id,providerId);
  });
  await t.test('permanent rejection and maximum retry age/count terminate safely',async()=>{
   await db.exec("update operational_alerts set status='QUEUED',available_at=now(),attempts=0,accepted_at=null,provider_id=null");
   const row=await claim();assert.equal(await finish(row,null,false,'PROVIDER_REJECTED'),true);assert.equal(await claim(),undefined);
   await db.exec("update operational_alerts set status='QUEUED',available_at=now(),attempts=6");
   assert.equal(await claim(),undefined);
   assert.equal((await db.query('select status from operational_alerts')).rows[0].status,'FAILED');
   await db.exec("update operational_alerts set status='QUEUED',attempts=0,created_at=now()-interval '24 hours'");
   assert.equal(await claim(),undefined);
   await assert.rejects(claim('a@example.invalid\nBcc: leak@example.invalid'));
  });
  await t.test('cost risk respects current plan policy and includes reservations; an idle pause is not an outage',async()=>{
   await db.exec("delete from operational_alerts;delete from operational_events;update operations_controls set disable_ai=true");
   assert.equal(await queue(),0);
   const user=crypto.randomUUID();await db.query("insert into auth.users(id,email) values($1,'fixture-alert@example.invalid')",[user]);
   const company=(await db.query('select company_id from company_members where user_id=$1',[user])).rows[0].company_id;
   await db.exec("update commercial_plans set policy=jsonb_set(policy,'{global_day_usd}','2')");
   await db.query("insert into ai_requests(id,user_id,company_id,plan_code,market_code,status,reserved_usd,feature) values($1,$2,$3,'FREE','BR','RESERVED',1.6,'diagnosis')",[crypto.randomUUID(),user,company]);
   assert.equal(await queue(),1);
   const row=(await db.query('select * from operational_alerts')).rows[0];
   assert.equal(row.severity,'P2');assert.equal(row.metrics.budget_reference_usd,2);assert.equal(row.metrics.accounted_or_reserved_usd_today,1.6);
  });
 }finally{await db.close();}
});
