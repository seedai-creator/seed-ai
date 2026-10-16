import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("decisões: confirmação, revisão, isolamento e preservação do contexto original", async t => {
  const db=new PGlite(); const alice="11111111-1111-4111-8111-111111111111",bob="22222222-2222-4222-8222-222222222222",id="33333333-3333-4333-8333-333333333333";
  try {
    await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
      create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth,public to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
    for(const file of ["202609230001_foundation.sql","202609240001_business_memory.sql","202609260001_internationalization.sql","202609260002_strategies_actions.sql","202609270001_decision_journal.sql"])
      await db.exec(await readFile(new URL("../supabase/migrations/"+file,import.meta.url),"utf8"));
    await db.query("insert into auth.users(id) values ($1),($2)",[alice,bob]);
    const a=(await db.query("select company_id from public.company_members where user_id=$1",[alice])).rows[0].company_id;
    const b=(await db.query("select company_id from public.company_members where user_id=$1",[bob])).rows[0].company_id;
    async function asUser(uid,sql,params=[],role="authenticated") {
      await db.exec("begin");try {await db.exec("set local role "+role);await db.query("select set_config('request.jwt.claim.sub',$1,true)",[uid??""]);
        const result=await db.query(sql,params);await db.exec("commit");return result.rows;
      }catch(error){await db.exec("rollback");throw error;}
    }
    const draft={decision:"Testar atendimento",context:"Demora relatada",reason:"Medir antes de investir",hypothesis:"Responder antes pode ajudar",baseline:"Sem medição",decision_date:"2026-09-27",review_date:"2026-10-04"};
    const save="select public.save_decision($1,$2,$3::jsonb)",review="select public.review_decision($1,$2,$3,$4,$5)";
    await t.test("confirmação persiste e repetir envio não duplica",async()=>{
      await asUser(alice,save,[a,id,JSON.stringify(draft)]);await asUser(alice,save,[a,id,JSON.stringify(draft)]);
      const rows=await asUser(alice,"select * from public.decisions");assert.equal(rows.length,1);assert.equal(rows[0].created_by,alice);assert.equal(rows[0].reviewed_at,null);
      await assert.rejects(asUser(alice,save,[a,id,JSON.stringify({...draft,decision:"Outra"})]));
    });
    await t.test("outro tenant e anônimo não acessam; escrita direta bloqueada",async()=>{
      assert.deepEqual(await asUser(bob,"select * from public.decisions"),[]);
      await assert.rejects(asUser(bob,save,[a,id,JSON.stringify(draft)]));await assert.rejects(asUser(bob,save,[b,id,JSON.stringify(draft)]));
      await assert.rejects(asUser(bob,review,[a,id,1,"resultado","aprendizado"]));await assert.rejects(asUser(bob,review,[b,id,1,"resultado","aprendizado"]));
      await assert.rejects(asUser(null,"select * from public.decisions",[],"anon"));await assert.rejects(asUser(null,save,[a,id,JSON.stringify(draft)],"anon"));
      await assert.rejects(asUser(alice,"update public.decisions set reason='alterado'"));
    });
    await t.test("revisão persiste sem reescrever decisão; versão antiga é rejeitada",async()=>{
      await asUser(alice,review,[a,id,1,"Inconclusivo","Precisamos observar por mais tempo"]);
      const row=(await asUser(alice,"select * from public.decisions"))[0];
      for(const field of ["decision","context","reason","hypothesis","baseline"])assert.equal(row[field],draft[field]);
      assert.equal(row.result,"Inconclusivo");assert.equal(row.reviewed_by,alice);assert.ok(row.reviewed_at);assert.equal(row.version,2);
      await assert.rejects(asUser(alice,review,[a,id,1,"desatualizado","desatualizado"]));
      await assert.rejects(asUser(alice,review,[a,id,2,"","sem resultado"]));
      assert.equal((await asUser(alice,"select result from public.decisions"))[0].result,"Inconclusivo");
    });
    await t.test("banco rejeita data invertida e campos inválidos sem inserir",async()=>{
      for(const bad of [{...draft,review_date:"2026-09-26"},{...draft,reason:""},{...draft,decision:42}])await assert.rejects(asUser(alice,save,[a,"44444444-4444-4444-8444-444444444444",JSON.stringify(bad)]));
      assert.equal((await asUser(alice,"select * from public.decisions")).length,1);
    });
  }finally{await db.close();}
});
