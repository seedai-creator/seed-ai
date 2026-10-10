import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
test('simulator database: atomic persistence, immutable versions, acceptance, tenant isolation and idempotency',async t=>{
 const db=new PGlite();const user=crypto.randomUUID(),other=crypto.randomUUID(),conversation=crypto.randomUUID(),request=crypto.randomUUID();let company,id;
 const snapshot={intent:{type:'PRICING',materiality:'LOW',reversibility:'REVERSIBLE',quote:'Preço?'},calculation_version:'1.0.0',status:'READY',readiness:'READY_WITH_LIMITATIONS',extraction:{inputs:[{id:'cpl',kind:'USER_ASSUMPTION'}],scenarios:[]},scenarios:[{id:'option_a',label:'Piloto de preço',assumption_ids:['cpl'],results:[]}],errors:[],limitations:[]};
 async function asUser(sql,args=[],who=user){await db.exec('begin');try{await db.exec('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[who]);const r=await db.query(sql,args);await db.exec('commit');return r.rows;}catch(e){await db.exec('rollback');throw e;}}
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`);
 const folder=new URL('../supabase/migrations/',import.meta.url);for(const f of (await readdir(folder)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(f,folder),'utf8'));
 await db.query('insert into auth.users(id) values($1),($2)',[user,other]);company=(await db.query('select company_id from company_members where user_id=$1',[user])).rows[0].company_id;
 await t.test('chat, simulation and initial immutable snapshot share a transaction',async()=>{
 await db.query('select commit_seed_turn_v96($1,$2,$3,$4,0,$5,$6,null,$7,true,null,$8,false,$9)',[user,company,conversation,request,'Preço?','Cenário condicional.',[],[],snapshot]);
 const r=(await db.query('select * from decision_simulations')).rows[0];id=r.id;assert.equal(r.version,1);assert.equal((await db.query('select count(*) from decision_simulation_versions')).rows[0].count,1);
 await db.query('select commit_seed_turn_v96($1,$2,$3,$4,0,$5,$6,null,$7,true,null,$8,false,$9)',[user,company,conversation,request,'Preço?','Cenário condicional.',[],[],snapshot]);
 assert.equal((await db.query('select count(*) from decision_simulations')).rows[0].count,1);
 });
 await t.test('RLS hides another company and rejects direct client mutation and privileged RPC',async()=>{
 assert.equal((await asUser('select * from decision_simulations')).length,1);
 for(const table of ['decision_simulations','decision_simulation_versions'])assert.equal((await asUser('select * from '+table,[],other)).length,0);
 await assert.rejects(asUser("update decision_simulations set status='ACCEPTED'"));
 await assert.rejects(asUser("select accept_decision_scenario($1,$2,$3,1,'option_a')",[user,company,id]));
 await assert.rejects(db.query("select accept_decision_scenario($1,$2,$3,1,'option_a')",[other,company,id]));
 });
 await t.test('recalculation appends history and rejects stale edits',async()=>{
 const revised={...snapshot,limitations:['REVISED']};await db.query('select revise_decision_simulation($1,$2,$3,1,$4)',[user,company,id,revised]);
 await assert.rejects(db.query('select revise_decision_simulation($1,$2,$3,1,$4)',[user,company,id,snapshot]));
 const versions=(await db.query('select * from decision_simulation_versions order by version')).rows;assert.equal(versions.length,2);assert.deepEqual(versions[0].snapshot.limitations,[]);assert.deepEqual(versions[1].snapshot.limitations,['REVISED']);
 });
 await t.test('acceptance creates existing journal decision exactly once',async()=>{
 const args=[user,company,id,2,'option_a'];const first=(await db.query('select accept_decision_scenario($1,$2,$3,$4,$5) id',args)).rows[0].id;
 const second=(await db.query('select accept_decision_scenario($1,$2,$3,$4,$5) id',args)).rows[0].id;assert.equal(first,second);
 assert.equal((await db.query('select count(*) from decisions')).rows[0].count,1);assert.equal((await db.query('select status from decision_simulations')).rows[0].status,'ACCEPTED');
 await assert.rejects(db.query('select revise_decision_simulation($1,$2,$3,3,$4)',[user,company,id,snapshot]));
 });
 await t.test('invalid simulation rolls back its conversation turn',async()=>{
 const c=crypto.randomUUID();await assert.rejects(db.query('select commit_seed_turn_v96($1,$2,$3,$4,0,$5,$6,null,$7,true,null,$8,false,$9)',[user,company,c,crypto.randomUUID(),'Teste','Resposta',[],[],{...snapshot,intent:{...snapshot.intent,type:'INVALID'}}]));
 assert.equal((await db.query('select count(*) from conversations where id=$1',[c])).rows[0].count,0);
 });
 await t.test('explicit plan link is atomic, idempotent and rejects foreign callers and unrelated conversations',async()=>{
  const draft={name:'Piloto de preço',objective:'Validar contribuição',situation:'Cenário condicional',bottleneck:'Demanda desconhecida',hypothesis:'Volume mantido',strategy:'Testar preço',review_date:null,actions:[{title:'Medir volume',description:'Registrar vendas',reason:'Validar premissa',responsible:'Responsável do teste',deadline:null,metric:'Unidades',target:'95'}]};
  await db.query("insert into strategies(id,company_id,created_by,name,objective,situation,bottleneck,hypothesis,strategy,status,request_hash)values(gen_random_uuid(),$1,$2,'Plano anterior','Objetivo anterior','Situação','Gargalo','Hipótese','Estratégia','ACTIVE','fixture-existing-plan')",[company,user]);
  const rec={title:'Piloto de preço',recommendation:'Testar preço',rationale_summary:'Validar cenário escolhido',expected_outcome:'Aprender',primary_indicator:'Unidades',confidence:'MEDIUM',draft,reliability:{}};
  await db.query('select commit_seed_turn_v96($1,$2,$3,$4,1,$5,$6,$10,$7,false,$8,$9,false,null)',[user,company,conversation,crypto.randomUUID(),'Prepare o plano','Plano de teste',[],rec,[],{reliability:{recommendation:{action:'Testar preço'}}}]);
  const r=(await db.query('select id,version from recommendations where conversation_id=$1',[conversation])).rows[0];
  assert.ok(r);
  await assert.rejects(db.query('select accept_simulation_plan($1,$2,$3,$4,$5)',[other,company,r.id,r.version,id]));
  const args=[user,company,r.id,r.version,id];
  const first=(await db.query('select accept_simulation_plan($1,$2,$3,$4,$5) id',args)).rows[0].id;
  assert.equal((await db.query('select accept_simulation_plan($1,$2,$3,$4,$5) id',args)).rows[0].id,first);
  assert.equal((await db.query('select plan_id from decision_simulations where id=$1',[id])).rows[0].plan_id,first);
  assert.equal((await db.query("select count(*) from execution_events where entity_id=$1 and operation='simulation_to_plan'",[id])).rows[0].count,1);
 });
 await t.test('linked result generates a scoped learning and assessment once; foreign/unrelated results denied',async()=>{
  const s=(await db.query('select * from decision_simulations where id=$1',[id])).rows[0];
  const result=(await db.query("insert into execution_results(company_id,decision_id,description,metric_type,observed_value,unit,currency_code,status,source_message_id,evidence)values($1,$2,'CPL 12.5','cpl',12.5,'MONEY_PER_UNIT','BRL','COLLECTED',$3,'CPL 12.5')returning id",[company,s.decision_id,s.source_message_id])).rows[0].id;
  const assessment={input_id:'cpl',result_id:result,status:'NOT_SUPPORTED'};const args=[user,company,id,result,assessment,'CPL acima da premissa. Não comprova causalidade.'];
  await db.query('select record_simulation_assessment($1,$2,$3,$4,$5,$6)',args);await db.query('select record_simulation_assessment($1,$2,$3,$4,$5,$6)',args);
  assert.equal((await db.query('select count(*) from execution_learnings where result_id=$1',[result])).rows[0].count,1);
  assert.equal((await db.query("select count(*) from execution_events where entity_id=$1 and operation='assumption_assessed'",[id])).rows[0].count,1);
  await assert.rejects(db.query('select record_simulation_assessment($1,$2,$3,$4,$5,$6)',[other,...args.slice(1)]));
  await assert.rejects(db.query('select record_simulation_assessment($1,$2,$3,$4,$5,$6)',[user,company,id,crypto.randomUUID(),assessment,'Invalid']));
 });
 await t.test('staging preserves arithmetic across provider failure, retry reuses draft, and completion adds a version',async()=>{
  const c=crypto.randomUUID(),r=crypto.randomUUID(),retry=crypto.randomUUID();
  const stage=(request)=>db.query('select stage_decision_simulation($1,$2,$3,$4,0,$5,$6,$7) id',[user,company,c,request,'Preço?','fixture-fingerprint',snapshot]);
  const first=(await stage(r)).rows[0].id;const second=(await stage(retry)).rows[0].id;assert.equal(first,second);
  assert.equal((await db.query('select version from conversations where id=$1',[c])).rows[0].version,0);
  assert.equal((await db.query('select count(*) from messages where conversation_id=$1',[c])).rows[0].count,0);
  await db.query('select commit_seed_turn_v96($1,$2,$3,$4,0,$5,$6,null,$7,true,null,$8,false,$9)',[user,company,c,retry,'Preço?','Concluído',[],[],snapshot]);
  const row=(await db.query('select * from decision_simulations where id=$1',[first])).rows[0];assert.equal(row.status,'READY');assert.equal(row.version,2);assert.ok(row.source_message_id);
  assert.equal((await db.query('select count(*) from decision_simulation_versions where simulation_id=$1',[first])).rows[0].count,2);
 });
 }finally{await db.close();}
});
