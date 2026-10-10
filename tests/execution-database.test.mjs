import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
test('execution loop: atomic acceptance, chat updates, results, review and tenant isolation',async t=>{
 const db=new PGlite(),uid=crypto.randomUUID(),other=crypto.randomUUID(),conversation=crypto.randomUUID();let company,plan,recommendation,action,version=0;
 const draft={name:'Entender objeções',objective:'Melhorar fechamento',situation:'Perdas de vendas relatadas',bottleneck:'Conversão',hypothesis:'Objeções não registradas',strategy:'Entender objeções',review_date:null,actions:[{title:'Analisar vendas perdidas',description:'Perguntar aos clientes',reason:'Identificar objeções',responsible:'',deadline:null,metric:'Objeções',target:''}]};
 const reliability={sufficiency:'SUFFICIENT',confidence:'MEDIUM',evidence:[{quote:'Analisei vendas perdidas'}],recommendation:{action:'Entender objeções'},revision:'Os dados ainda não isolam causa e efeito; rever a abordagem.'};
 const rec={title:'Entender objeções',recommendation:'Entender objeções',rationale_summary:'Há perdas relatadas',expected_outcome:'Conhecer motivos',primary_indicator:'Objeções',confidence:'MEDIUM',draft,reliability};
 const cmd=(kind,target_type,target_id,version,status=null)=>({kind,target_type,target_id,version,scope:'CURRENT_COMPANY',assertion:'EXPLICIT',quote:'Analisei vendas perdidas',status,description:'Relato de teste',reason:'Vendedor ausente',hypothesis:null,indicator:null,baseline:null,observed:null,target:null,unit:null,currency:null,start:null,end:null});
 async function turn(commands=[],proposal=null,request=crypto.randomUUID(),who=uid,co=company){
  const result=await db.query('select commit_seed_turn_v94($1,$2,$3,$4,$5,$6,$7,$8,$9,false,$10,$11)',[who,co,conversation,request,version,'Analisei vendas perdidas','Resposta de teste',{reliability},[],proposal,commands]);version++;return result;
 }
 async function asUser(sql,args=[],who=uid){await db.exec('begin');try{await db.exec('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[who]);const r=await db.query(sql,args);await db.exec('commit');return r.rows;}catch(e){await db.exec('rollback');throw e;}}
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`);
 const folder=new URL('../supabase/migrations/',import.meta.url);for(const file of (await readdir(folder)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,folder),'utf8'));
 await db.query('insert into auth.users(id) values($1),($2)',[uid,other]);company=(await db.query('select company_id from company_members where user_id=$1',[uid])).rows[0].company_id;
 await db.query("insert into commercial_accounts(user_id,market_code) values($1,'BR') on conflict(user_id) do update set market_code='BR'",[uid]);
 await db.query("insert into commercial_overrides(user_id,kind,settings,expires_at,reason,created_by) values($1,'TEMPORARY_PRO','{\"plan_code\":\"PRO\"}',now()+interval '1 day','Fixture phase94',$1)",[uid]);
 await db.exec("update commercial_settings set value='{\"enabled\":true}' where id='rollout'");
 await t.test('gated recommendation persists; direct writes, acceptance and cross-tenant reads denied',async()=>{
  await turn([],rec);recommendation=(await db.query('select * from recommendations')).rows[0];
  assert.equal(recommendation.status,'PROPOSED');assert.equal((await asUser('select * from recommendations',[],other)).length,0);
  await assert.rejects(asUser("update recommendations set status='ACCEPTED'"));
  await assert.rejects(asUser('select accept_execution_recommendation($1,$2,$3,1)',[uid,company,recommendation.id]));
  await assert.rejects(db.query('select accept_execution_recommendation($1,$2,$3,1)',[other,company,recommendation.id]));
 });
 await t.test('acceptance creates the existing strategy/actions exactly once',async()=>{
  plan=(await db.query('select accept_execution_recommendation($1,$2,$3,1) id',[uid,company,recommendation.id])).rows[0].id;
  assert.equal((await db.query('select accept_execution_recommendation($1,$2,$3,1) id',[uid,company,recommendation.id])).rows[0].id,plan);
  action=(await db.query('select * from actions where strategy_id=$1',[plan])).rows[0];assert.equal(action.status,'TODO');
 });
 await t.test('blocked does not complete; stale updates roll back entire conversation',async()=>{
  await turn([cmd('ACTION','ACTION',action.id,1,'BLOCKED')]);
  const a=(await db.query('select * from actions where id=$1',[action.id])).rows[0];assert.equal(a.status,'BLOCKED');assert.equal(a.completed_at,null);
  const before=(await db.query('select count(*) from messages')).rows[0].count;
  await assert.rejects(turn([cmd('ACTION','ACTION',action.id,1,'COMPLETED')]));assert.equal((await db.query('select count(*) from messages')).rows[0].count,before);
  await db.query("update actions set deadline=current_date-1 where id=$1",[action.id]);assert.equal((await db.query('select status from actions where id=$1',[action.id])).rows[0].status,'BLOCKED');
 });
 await t.test('execution completion does not fabricate a result; unknown stays null',async()=>{
  await turn([cmd('ACTION','ACTION',action.id,2,'COMPLETED')]);assert.equal((await db.query('select count(*) from execution_results')).rows[0].count,0);
  await turn([cmd('RESULT','ACTION',action.id,3,'PARTIAL')]);const result=(await db.query('select * from execution_results')).rows[0];assert.equal(result.observed_value,null);assert.equal(result.status,'PARTIAL');
  await assert.rejects(turn([cmd('REVIEW','PLAN',plan,1,'RESOLVED')]));
 });
 await t.test('zero is a reported result; analysis creates a cautious learning and supersedes diagnosis',async()=>{
  await turn([{...cmd('RESULT','PLAN',plan,1,'COLLECTED'),observed:0}]);
  await turn([cmd('REVIEW','PLAN',plan,1,'SUPERSEDED')]);
  const learning=(await db.query('select * from execution_learnings')).rows[0];assert.equal(learning.evidence_level,'PRELIMINARY');assert.equal(learning.statement,reliability.revision);
  assert.equal((await db.query('select observed_value from execution_results where id=$1',[learning.result_id])).rows[0].observed_value,'0');
  assert.equal((await db.query('select status from recommendations where id=$1',[recommendation.id])).rows[0].status,'SUPERSEDED');
  assert.equal((await db.query('select diagnosis_status from messages where id=$1',[recommendation.diagnosis_id])).rows[0].diagnosis_status,'SUPERSEDED');
  assert.equal((await asUser('select * from execution_learnings',[],other)).length,0);
 });
 await t.test('decision and experiment reuse existing entities; completion is not validation',async()=>{
  await turn([{...cmd('DECISION','PLAN',plan,2),description:'Manter anúncios'}]);
  const decision=(await db.query('select * from decisions')).rows[0];assert.equal(decision.plan_id,plan);
  await turn([cmd('DECISION_STATUS','DECISION',decision.id,1,'IMPLEMENTED')]);assert.equal((await db.query('select execution_status from decisions')).rows[0].execution_status,'IMPLEMENTED');
  await turn([{...cmd('EXPERIMENT','PLAN',plan,2),description:'Nova abordagem',hypothesis:'Pode melhorar conversão',indicator:'Conversão',baseline:11,target:17,start:'2026-10-05',end:'2026-10-12'}]);
  const e=(await db.query('select * from experiments')).rows[0];assert.equal(e.execution_status,'READY');
  await turn([cmd('EXPERIMENT_STATUS','EXPERIMENT',e.id,1,'RUNNING')]);
  await turn([cmd('EXPERIMENT_STATUS','EXPERIMENT',e.id,2,'COMPLETED')]);
  const end=(await db.query('select * from experiments')).rows[0];assert.equal(end.execution_status,'COMPLETED');assert.equal(end.analytical_outcome,null);assert.equal(end.result,null);
 });
 await t.test('analyzed execution result stays coherent with legacy experiment history',async()=>{
  const experiment=(await db.query('select * from experiments')).rows[0];
  await turn([{...cmd('RESULT','EXPERIMENT',experiment.id,experiment.version,'COLLECTED'),observed:14,baseline:11}]);
  await turn([cmd('REVIEW','PLAN',plan,2,'ACTIVE')]);
  const reviewed=(await db.query('select * from experiments where id=$1',[experiment.id])).rows[0];
  assert.equal(reviewed.execution_status,'ANALYZED');assert.equal(reviewed.status,'INCONCLUSIVE');
  assert.equal(reviewed.result,'14');assert.equal(reviewed.learning,reliability.revision);assert.ok(reviewed.finished_at);
  assert.equal((await asUser('select * from experiments',[],other)).length,0);
 });
 await t.test('same turn can update and record result without a false version conflict',async()=>{
  const aid=crypto.randomUUID();await db.query("insert into actions(id,company_id,strategy_id,position,title,description,reason,responsible,metric,target) values($1,$2,$3,2,'Outra ação','Teste','Teste','','','')",[aid,company,plan]);
  await turn([cmd('ACTION','ACTION',aid,1,'COMPLETED'),cmd('RESULT','ACTION',aid,1,'PARTIAL')]);
  assert.equal((await db.query('select status,version from actions where id=$1',[aid])).rows[0].version,3);
 });
 await t.test('ambiguous/attachment/foreign target updates never commit; replay does not duplicate',async()=>{
  await assert.rejects(turn([{...cmd('ACTION','ACTION',action.id,4,'COMPLETED'),scope:'OTHER'}]));
  await assert.rejects(turn([cmd('ACTION','ACTION',crypto.randomUUID(),1,'COMPLETED')]));
  const request=crypto.randomUUID();await turn([],null,request);version--;await turn([],null,request);
  assert.equal((await db.query('select count(*) from messages where request_id=$1',[request])).rows[0].count,2);
  await assert.rejects(db.query('select commit_seed_turn_v94($1,$2,$3,$4,$5,$6,$7,$8,$9,true,null,$10)',[uid,company,conversation,crypto.randomUUID(),version,'Analisei vendas perdidas','Resposta',{reliability},[],[cmd('ACTION','ACTION',action.id,4,'COMPLETED')]]));
 });
 }finally{await db.close();}
});
