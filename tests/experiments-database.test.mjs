import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
test("experimentos: ciclo completo, aprendizado, concorrência e isolamento",async t=>{
 const db=new PGlite();const alice="11111111-1111-4111-8111-111111111111",bob="22222222-2222-4222-8222-222222222222",id="33333333-3333-4333-8333-333333333333";
 try{
  await db.exec(`create role anon nologin;create role authenticated nologin;create schema auth;
   create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
  for(const file of ["202609230001_foundation.sql","202609240001_business_memory.sql","202609260001_internationalization.sql","202609260002_strategies_actions.sql","202609270001_decision_journal.sql","202609270002_experiments.sql"])await db.exec(await readFile(new URL("../supabase/migrations/"+file,import.meta.url),"utf8"));
  await db.query("insert into auth.users(id) values ($1),($2)",[alice,bob]);
  const a=(await db.query("select company_id from public.company_members where user_id=$1",[alice])).rows[0].company_id;
  const b=(await db.query("select company_id from public.company_members where user_id=$1",[bob])).rows[0].company_id;
  async function asUser(uid,sql,params=[],role="authenticated"){
   await db.exec("begin");try{await db.exec("set local role "+role);await db.query("select set_config('request.jwt.claim.sub',$1,true)",[uid??""]);const result=await db.query(sql,params);await db.exec("commit");return result.rows;}catch(error){await db.exec("rollback");throw error;}
  }
  const draft={name:"Teste",problem:"Demora",hypothesis:"Resposta rápida ajuda",action:"Organizar fila",baseline:"3",target:"1",metric:"Dias de resposta",start_date:"2026-09-27",end_date:"2026-10-04"};
  const save="select public.save_experiment($1,$2,$3::jsonb)",start="select public.start_experiment($1,$2,$3)",finish="select public.finish_experiment($1,$2,$3,$4,$5,$6)";
  await t.test("salva uma vez, sem gerar resultado ou aprendizado antecipados",async()=>{
   await asUser(alice,save,[a,id,JSON.stringify(draft)]);await asUser(alice,save,[a,id,JSON.stringify(draft)]);
   const rows=await asUser(alice,"select * from public.experiments");assert.equal(rows.length,1);assert.equal(rows[0].status,"PLANNED");assert.equal(rows[0].result,null);assert.equal(rows[0].learning,"");
   await assert.rejects(asUser(alice,save,[a,id,JSON.stringify({...draft,target:"2"})]));
  });
  await t.test("RLS e funções impedem leitura ou alterações de outro tenant",async()=>{
   assert.deepEqual(await asUser(bob,"select * from public.experiments"),[]);
   await assert.rejects(asUser(bob,save,[a,id,JSON.stringify(draft)]));await assert.rejects(asUser(bob,save,[b,id,JSON.stringify(draft)]));
   await assert.rejects(asUser(bob,start,[a,id,1]));await assert.rejects(asUser(bob,start,[b,id,1]));
   await assert.rejects(asUser(bob,finish,[a,id,1,"VALIDATED","1","Tentativa"]));
   await assert.rejects(asUser(null,"select * from public.experiments",[],"anon"));await assert.rejects(asUser(null,start,[a,id,1],"anon"));
   await assert.rejects(asUser(alice,"update public.experiments set status='RUNNING'"));
  });
  await t.test("inicia e conclui, rejeitando salto, ausência de resultado e versão antiga",async()=>{
   await assert.rejects(asUser(alice,finish,[a,id,1,"VALIDATED","1","Texto"]));
   await asUser(alice,start,[a,id,1]);await assert.rejects(asUser(alice,start,[a,id,1]));
   await assert.rejects(asUser(alice,finish,[a,id,1,"VALIDATED","1","Texto"]));
   await assert.rejects(asUser(alice,finish,[a,id,2,"VALIDATED",null,"Texto"]));
   await assert.rejects(asUser(alice,finish,[a,id,2,"VALIDATED","1",""]));
   await asUser(alice,finish,[a,id,2,"VALIDATED","1","O tempo de resposta caiu no teste"]);
   const row=(await asUser(alice,"select * from public.experiments where id=$1",[id]))[0];
   assert.equal(row.status,"VALIDATED");assert.equal(row.result,"1");assert.equal(row.finished_by,alice);assert.ok(row.started_at&&row.finished_at);
   assert.equal(row.hypothesis,draft.hypothesis);assert.equal(row.baseline,"3");assert.equal(row.version,3);
   await assert.rejects(asUser(alice,finish,[a,id,3,"INVALIDATED","4","Sobrescrever"]));
  });
  await t.test("encerra invalidado e inconclusivo; preserva zero como resultado real",async()=>{
   for(const [expId,status,result]of [["44444444-4444-4444-8444-444444444444","INVALIDATED","0"],["55555555-5555-4555-8555-555555555555","INCONCLUSIVE",null]]){
    await asUser(alice,save,[a,expId,JSON.stringify(draft)]);await asUser(alice,start,[a,expId,1]);await asUser(alice,finish,[a,expId,2,status,result,"Aprendizado documentado"]);
    const row=(await asUser(alice,"select * from public.experiments where id=$1",[expId]))[0];assert.equal(row.status,status);assert.equal(row.result,result);
   }
  });
  await t.test("banco rejeita datas invertidas e números não canônicos",async()=>{
   for(const bad of [{...draft,end_date:"2026-09-26"},{...draft,baseline:"1,5"},{...draft,target:"NaN"}])await assert.rejects(asUser(alice,save,[a,"66666666-6666-4666-8666-666666666666",JSON.stringify(bad)]));
   assert.equal((await asUser(alice,"select * from public.experiments")).length,3);
  });
 }finally{await db.close();}
});
