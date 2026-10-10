import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("estratégias: persistência atômica, idempotência, status e isolamento", async t => {
  const db = new PGlite();
  const alice = "11111111-1111-4111-8111-111111111111", bob = "22222222-2222-4222-8222-222222222222", id = "33333333-3333-4333-8333-333333333333";
  try {
    await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
      create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth,public to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
    for (const file of ["202609230001_foundation.sql", "202609240001_business_memory.sql", "202609260001_internationalization.sql", "202609260002_strategies_actions.sql"])
      await db.exec(await readFile(new URL("../supabase/migrations/" + file, import.meta.url), "utf8"));
    await db.query("insert into auth.users(id) values ($1),($2)", [alice,bob]);
    const a = (await db.query("select company_id from public.company_members where user_id=$1",[alice])).rows[0].company_id;
    const b = (await db.query("select company_id from public.company_members where user_id=$1",[bob])).rows[0].company_id;
    async function asUser(uid, sql, params=[], role="authenticated") {
      await db.exec("begin");
      try { await db.exec("set local role " + role); await db.query("select set_config('request.jwt.claim.sub',$1,true)",[uid ?? ""]);
        const result = await db.query(sql,params); await db.exec("commit"); return result.rows;
      } catch (error) { await db.exec("rollback"); throw error; }
    }
    const draft = { name:"Plano de teste",objective:"Medir vendas",situation:"Sem dados",bottleneck:"",hypothesis:"Medir pode identificar gargalo",strategy:"Registrar pedidos",review_date:"2026-10-01",
      actions:[{title:"Contar pedidos",description:"Registrar diariamente",reason:"Medir antes de investir",responsible:"Equipe de teste",deadline:"2026-09-30",metric:"Pedidos",target:"Registro diário"}] };
    const save = "select public.save_strategy($1,$2,$3::jsonb) as id";
    await t.test("salva plano e ações juntos e repetição não duplica", async () => {
      await asUser(alice,save,[a,id,JSON.stringify(draft)]);
      await asUser(alice,save,[a,id,JSON.stringify(draft)]);
      assert.equal((await asUser(alice,"select * from public.strategies")).length,1);
      const rows=await asUser(alice,"select * from public.actions"); assert.equal(rows.length,1); assert.equal(rows[0].status,"TODO");
      assert.equal(rows[0].company_id,a); assert.equal(rows[0].strategy_id,id);
      await assert.rejects(asUser(alice,save,[a,id,JSON.stringify({...draft,name:"Outro plano"})]));
    });
    await t.test("outra empresa e anônimo não leem nem gravam", async () => {
      assert.deepEqual(await asUser(bob,"select * from public.strategies"),[]);
      assert.deepEqual(await asUser(bob,"select * from public.actions"),[]);
      await assert.rejects(asUser(bob,save,[a,id,JSON.stringify(draft)]));
      await assert.rejects(asUser(bob,save,[b,id,JSON.stringify(draft)]));
      await assert.rejects(asUser(null,save,[a,id,JSON.stringify(draft)],"anon"));
      await assert.rejects(asUser(null,"select * from public.strategies",[],"anon"));
      await assert.rejects(asUser(alice,"update public.strategies set status='ACTIVE'"));
    });
    await t.test("erro em ação desfaz estratégia inteira", async () => {
      const bad = {...draft,actions:[...draft.actions,{...draft.actions[0],title:""}]};
      await assert.rejects(asUser(alice,save,[a,"44444444-4444-4444-8444-444444444444",JSON.stringify(bad)]));
      assert.equal((await asUser(alice,"select * from public.strategies")).length,1);
      assert.equal((await asUser(alice,"select * from public.actions")).length,1);
      await assert.rejects(asUser(alice,save,[a,"44444444-4444-4444-8444-444444444444",JSON.stringify({...draft,name:42})]));
    });
    await t.test("status persiste e rejeita outro tenant, versão antiga e valor inválido", async () => {
      const actionId=(await asUser(alice,"select id from public.actions"))[0].id;
      const update="select public.set_action_status($1,$2,$3,$4)";
      await assert.rejects(asUser(bob,update,[a,actionId,"COMPLETED",1]));
      await assert.rejects(asUser(bob,update,[b,actionId,"COMPLETED",1]));
      await asUser(alice,update,[a,actionId,"IN_PROGRESS",1]);
      await assert.rejects(asUser(alice,update,[a,actionId,"COMPLETED",1]));
      await assert.rejects(asUser(alice,update,[a,actionId,"INVALID",2]));
      await asUser(alice,update,[a,actionId,"COMPLETED",2]);
      assert.equal((await asUser(alice,"select status from public.actions"))[0].status,"COMPLETED");
      await asUser(alice,"select public.set_strategy_status($1,$2,'ACTIVE',1)",[a,id]);
      assert.equal((await asUser(alice,"select status from public.strategies"))[0].status,"ACTIVE");
    });
  } finally { await db.close(); }
});
