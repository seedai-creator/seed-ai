import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {parseDiagnosis} from '../.test-build/src/lib/diagnosis/contracts.js';
import {emptyReliability} from '../.test-build/tests/reliability-fixtures.js';
test('core experience: private conversations and temporal memory',async t=>{
 const db=new PGlite(); const uid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
   create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`);
  const folder=new URL('../supabase/migrations/',import.meta.url);
  for(const name of (await readdir(folder)).filter(n=>n.endsWith('.sql')).sort())await db.exec(await readFile(new URL(name,folder),'utf8'));
  await db.query('insert into auth.users(id) values($1),($2)',[uid,other]);
  await db.query("insert into commercial_accounts(user_id,market_code) values($1,'BR'),($2,'BR') on conflict(user_id) do update set market_code='BR'",[uid,other]);
  const company=(await db.query('select company_id from company_members where user_id=$1',[uid])).rows[0].company_id;
  async function role(sql,args=[],as='authenticated',user=uid){await db.exec('begin');try{await db.exec('set local role '+as);await db.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);const result=await db.query(sql,args);await db.exec('commit');return result.rows;}catch(e){await db.exec('rollback');throw e;}}

  const convo=crypto.randomUUID();
  const item={key:'team_size',kind:'METRIC',value:'4 vendedores',evidence:'4 vendedores',certainty:'EXPLICIT',scope:'CURRENT_COMPANY',observed_at:null,replaces_current:true};
  const commit='select commit_seed_turn($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb)';
  async function turn(version,value=item){return role(commit,[uid,company,convo,crypto.randomUUID(),version,'Agora temos '+value.evidence,'Resposta de teste','null',JSON.stringify([value])],'service_role');}
  await t.test('only server can commit; another tenant cannot read conversation or memory',async()=>{
   await assert.rejects(role(commit,[uid,company,convo,crypto.randomUUID(),0,'4 vendedores','teste','null','[]']));
   await turn(0);assert.equal((await role('select * from conversations')).length,1);
   assert.equal((await role('select * from conversations',[],'authenticated',other)).length,0);
   assert.equal((await role('select * from messages',[],'authenticated',other)).length,0);
   assert.equal((await role('select * from business_memories',[],'authenticated',other)).length,0);
   await assert.rejects(role(commit,[other,company,crypto.randomUUID(),crypto.randomUUID(),0,'teste','teste','null','[]'],'service_role'));
  });
  await t.test('automatic update keeps history; stale conversation fails atomically',async()=>{
   await turn(1,{...item,value:'7 vendedores',evidence:'7 vendedores'});
   assert.equal((await role('select value from business_memories'))[0].value,'7 vendedores');
   assert.equal((await role('select * from business_memory_history')).length,1);
   await assert.rejects(turn(1));assert.equal((await role('select * from messages')).length,4);
  });
  await t.test('manual correction and deletion survive subsequent automatic inference',async()=>{
   let row=(await role('select * from business_memories'))[0];
   await assert.rejects(role('select edit_business_memory($1,$2,$3,$4,false)',[company,row.id,row.version,'8 vendedores'],'authenticated',other));
   await role('select edit_business_memory($1,$2,$3,$4,false)',[company,row.id,row.version,'8 vendedores']);
   await turn(2);assert.equal((await role('select value from business_memories'))[0].value,'8 vendedores');
   row=(await role('select * from business_memories'))[0];
   await role('select edit_business_memory($1,$2,$3,$4,true)',[company,row.id,row.version,'']);
   await turn(3);assert.equal((await role('select deleted from business_memories'))[0].deleted,true);
  });
  await t.test('hypotheses stay hypotheses; ambiguous and foreign statements are not learned',async()=>{
   await turn(4,{...item,key:'price_concern',kind:'HYPOTHESIS',value:'O preço pode afetar as vendas',evidence:'acho o preço alto'});
   assert.equal((await role("select kind from business_memories where key='price_concern'"))[0].kind,'HYPOTHESIS');
   await turn(5,{...item,key:'unknown_unit',certainty:'AMBIGUOUS'});
   await turn(6,{...item,key:'competitor',scope:'OTHER'});
   assert.equal((await role('select * from business_memories')).length,2);
  });
  await t.test('reliability trace persists in existing diagnosis JSON and remains tenant isolated',async()=>{
   const diagnosis={situation:'Dados insuficientes',objective:null,main_bottleneck:null,secondary_bottlenecks:[],evidence:[],hypotheses:[],missing_data:['Custo'],opportunities:[],risks:[],priorities:[],confidence:'LOW',reliability:emptyReliability()};
   await role(commit,[uid,company,convo,crypto.randomUUID(),7,'Posso dar desconto?','Preciso conhecer o custo.',JSON.stringify(diagnosis),'[]'],'service_role');
   const rows=await role("select diagnosis from messages where diagnosis->'reliability' is not null");
   assert.deepEqual(parseDiagnosis(rows[0].diagnosis).reliability,emptyReliability());
   assert.equal((await role('select diagnosis from messages',[],'authenticated',other)).length,0);
  });
 }finally{await db.close();}
});
