import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {candidate} from '../.test-build/tests/journal-fixtures.js';
import {normalizeExtraction} from '../.test-build/src/lib/journal/domain.js';
test('journal database: outbox, isolation, deduplication, correction and safe retries',async t=>{
 const db=new PGlite();const uid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`);
 const folder=new URL('../supabase/migrations/',import.meta.url);
 for(const name of (await readdir(folder)).filter(n=>n.endsWith('.sql')).sort())await db.exec(await readFile(new URL(name,folder),'utf8'));
 await db.query('insert into auth.users(id) values($1),($2)',[uid,other]);
 const company=(await db.query('select company_id from company_members where user_id=$1',[uid])).rows[0].company_id;
 async function role(sql,args=[],as='authenticated',user=uid){await db.exec('begin');try{await db.exec('set local role '+as);await db.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);const r=await db.query(sql,args);await db.exec('commit');return r.rows;}catch(e){await db.exec('rollback');throw e;}}
 const conversation=crypto.randomUUID();let version=0;
 async function turn(text,skip=false){const request=crypto.randomUUID();await role('select commit_seed_turn_v93($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10)',[uid,company,conversation,request,version++,text,'Resposta','null','[]',skip],'service_role');return request;}
 async function claim(){return (await role('select * from claim_journal_job($1)',[company],'service_role'))[0];}
 async function apply(job,items){await db.query('update journal_jobs set payload=$2::jsonb where id=$1',[job.id,JSON.stringify(items)]);await role('select apply_journal_extraction($1,$2)',[job.id,job.lease_token],'service_role');}
 let first,record;
 await t.test('atomic source outbox, attachment exclusion, tenant and client restrictions',async()=>{
  await turn('18 interessados');first=await claim();assert.ok(first.source_message_id);assert.equal((await role('select * from claim_journal_job($1)',[company],'service_role')).length,0);
  await assert.rejects(role('select * from journal_jobs'));await assert.rejects(role('select * from claim_journal_job($1)',[company]));
  await turn('arquivo',true);assert.equal((await db.query('select * from journal_jobs')).rows.length,1);
 });
 await t.test('idempotent apply and exact source, all writes server-side',async()=>{
  const items=normalizeExtraction({entries:[candidate]},'18 interessados',new Date('2026-10-01T12:00:00Z'),'UTC',[]);
  await assert.rejects(role('select apply_journal_extraction($1,$2)',[first.id,first.lease_token]));
  await apply(first,items);await role('select apply_journal_extraction($1,$2)',[first.id,first.lease_token],'service_role');
  const rows=await role('select * from business_journal_entries');assert.equal(rows.length,1);record=rows[0];
  assert.equal((await role('select * from business_journal_entries',[],'authenticated',other)).length,0);
  await assert.rejects(role("update business_journal_entries set description='forged'"));
  assert.equal((await db.query('select * from business_memories')).rows.length,0);
 });
 await t.test('enrichment never doubles totals, repeated normalized metric remains unique',async()=>{
  await turn('Esses 18 vieram do Meta');const job=await claim();
  const c={...candidate,evidence:'18',operation:'ENRICH',target_id:record.id,target_version:1,channel:'Meta'};
  await apply(job,normalizeExtraction({entries:[c]},'Esses 18 vieram do Meta',new Date('2026-10-01T12:00:00Z'),'UTC',[{...record,value:Number(record.value)}]));
  await turn('18 interessados no Meta');const again=await claim();await apply(again,normalizeExtraction({entries:[{...candidate,channel:'Meta'}]},'18 interessados no Meta',new Date('2026-10-01T12:00:00Z'),'UTC',[]));
  const rows=await role('select * from business_journal_entries');assert.equal(rows.length,1);assert.equal(Number(rows[0].value),18);record=rows[0];assert.equal(record.channel,'Meta');
 });
 await t.test('explicit correction preserves audit; manual edits and deletion protected',async()=>{
  await turn('Na verdade foram 21, não 18');const job=await claim();const c={...candidate,evidence:'21',value:21,operation:'CORRECT',target_id:record.id,target_version:record.version,channel:'Meta'};
  await apply(job,normalizeExtraction({entries:[c]},'Na verdade foram 21, não 18',new Date('2026-10-01T12:00:00Z'),'UTC',[{...record,value:Number(record.value)}]));
  record=(await role('select * from business_journal_entries'))[0];assert.equal(Number(record.value),21);assert.equal((await role('select * from business_journal_history')).length,2);
  await assert.rejects(role('select edit_journal_entry($1,$2,$3,$4,$5,false)',[company,record.id,record.version,'Corrigido',22],'authenticated',other));
  await role('select edit_journal_entry($1,$2,$3,$4,$5,false)',[company,record.id,record.version,'22 interessados',22]);
  await assert.rejects(role('select edit_journal_entry($1,$2,$3,$4,$5,false)',[company,record.id,record.version,'stale',23]));
  record=(await role('select * from business_journal_entries'))[0];await role('select edit_journal_entry($1,$2,$3,$4,$5,true)',[company,record.id,record.version,'',null]);
  assert.equal((await role('select description from business_journal_entries'))[0].description,'');assert.equal((await role('select snapshot from business_journal_history'))[0].snapshot.deleted,true);
 });

 await t.test('weekly publication checks sources, is immutable/idempotent, isolated and invalidates on correction',async()=>{
  await turn('30 interessados');const extraction=await claim();const c={...candidate,value:30,evidence:'30 interessados',description:'30 interessados'};
  await apply(extraction,normalizeExtraction({entries:[c]},'30 interessados',new Date('2026-10-02T12:00:00Z'),'UTC',[]));
  const active=(await role("select * from business_journal_entries where status='ACTIVE'"))[0];
  const reportJob=crypto.randomUUID();
  await db.query("insert into journal_jobs(id,company_id,user_id,kind,dedupe_key,context) values($1::uuid,$2,$3,'WEEKLY',($1::uuid)::text,$4::jsonb)",[reportJob,company,uid,JSON.stringify({start:'2026-09-28',end:'2026-10-04',timezone:'America/Sao_Paulo',locale:'pt-BR'})]);
  const job=await claim();const payload={report:{summary:{text:'Leitura fictícia'},confidence:'LOW',next_priority:null,primary_indicator:null},sources:[{id:active.id,version:active.version}],generation_version:'9.3.1',model_metadata:{model:'fixture'}};
  await db.query('update journal_jobs set payload=$2::jsonb where id=$1',[job.id,JSON.stringify(payload)]);
  await role('select finish_weekly_job($1,$2)',[job.id,job.lease_token],'service_role');await role('select finish_weekly_job($1,$2)',[job.id,job.lease_token],'service_role');
  assert.equal((await role('select * from weekly_intelligence_reports')).length,1);assert.equal((await role('select * from weekly_intelligence_reports',[],'authenticated',other)).length,0);
  await role('select edit_journal_entry($1,$2,$3,$4,$5,false)',[company,active.id,active.version,'31 interessados',31]);
  const report=(await role('select * from weekly_intelligence_reports'))[0];assert.equal(report.status,'INVALIDATED');assert.deepEqual(report.structured_report,{});
  const stale=crypto.randomUUID();await db.query("insert into journal_jobs(id,company_id,user_id,kind,dedupe_key,context,payload) values($1::uuid,$2,$3,'WEEKLY',($1::uuid)::text,$4::jsonb,$5::jsonb)",[stale,company,uid,JSON.stringify({start:'2026-09-28',end:'2026-10-04',timezone:'UTC',locale:'en-US'}),JSON.stringify(payload)]);
  const staleJob=await claim();await assert.rejects(role('select finish_weekly_job($1,$2)',[staleJob.id,staleJob.lease_token],'service_role'));
  await db.query("update journal_jobs set status='FAILED' where id=$1",[stale]);
 });
 await t.test('expired provider lease becomes UNKNOWN, not another billed retry',async()=>{
  await turn('Hoje tivemos 30 interessados');const job=await claim();await db.query("update journal_jobs set locked_at=now()-interval '10 minutes' where id=$1",[job.id]);assert.equal(await claim(),undefined);assert.equal((await db.query('select status from journal_jobs where id=$1',[job.id])).rows[0].status,'UNKNOWN');
 });

 await t.test('new AI features reserve and account cost through existing commercial controls',async()=>{
  await db.query("insert into commercial_accounts(user_id,market_code) values($1,'BR') on conflict(user_id) do update set market_code='BR'",[uid]);
  await db.exec("update commercial_markets set status='ACTIVE',disable_ai_requests=false where code='BR'");
  await db.query("insert into commercial_overrides(user_id,kind,settings,expires_at,reason,created_by) values($1,'TEMPORARY_PRO','{\"plan_code\":\"PRO\"}',now()+interval '1 day','Fixture PRO weekly report',$1)",[uid]);
  for(const feature of ['BUSINESS_JOURNAL_EXTRACTION','BUSINESS_JOURNAL_CLASSIFICATION','WEEKLY_INTELLIGENCE_GENERATION']){
   const request=crypto.randomUUID();const result=await role('select reserve_ai_request($1,$2,$3,$4,$5,$6) as result',[uid,company,request,0.000001,feature,request],'service_role');
   assert.equal(result[0].result.allowed,true,JSON.stringify(result));await role("select finish_ai_request($1,'COMPLETED',0.000001)",[request],'service_role');
  }
  assert.equal((await db.query('select count(*) from ai_requests where accounted_usd>0')).rows[0].count,3);
 });
 await t.test('failed transaction never loses the queued source',async()=>{
  const before=(await db.query('select count(*) from journal_jobs')).rows[0].count;
  await assert.rejects(role('select commit_seed_turn_v93($1,$2,$3,$4,0,$5,$6,$7::jsonb,$8::jsonb,false)',[uid,company,conversation,crypto.randomUUID(),'bad version','answer','null','[]'],'service_role'));
  assert.equal((await db.query('select count(*) from journal_jobs')).rows[0].count,before);
 });
 }finally{await db.close();}
});
