import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("memória empresarial: confirmação, correção, concorrência e isolamento PostgreSQL", async (t) => {
  const db = new PGlite();
  const alice = "11111111-1111-4111-8111-111111111111";
  const bob = "22222222-2222-4222-8222-222222222222";
  try {
    await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
      create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth,public to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
    for (const name of ["202609230001_foundation.sql", "202609240001_business_memory.sql"])
      await db.exec(await readFile(new URL("../supabase/migrations/" + name, import.meta.url), "utf8"));
    await db.query("insert into auth.users(id) values ($1),($2)", [alice,bob]);
    async function asUser(uid, query, params = [], role = "authenticated") {
      await db.exec("begin");
      try {
        await db.exec("set local role " + role);
        await db.query("select set_config('request.jwt.claim.sub',$1,true)", [uid ?? ""]);
        const { rows } = await db.query(query, params);
        await db.exec("commit"); return rows;
      } catch (error) { await db.exec("rollback"); throw error; }
    }
    const a = (await asUser(alice,"select company_id from public.company_members"))[0].company_id;
    const b = (await asUser(bob,"select company_id from public.company_members"))[0].company_id;
    const saveSql = "select * from public.save_company_fact($1,$2,$3,$4)";
    await t.test("nenhum fato é criado com cadastro ou mera consulta", async () => {
      assert.deepEqual(await asUser(alice,"select * from public.company_facts"), []);
    });
    await t.test("confirmação salva com autor real; nova sessão lê o fato", async () => {
      const saved = (await asUser(alice, saveSql, [a,"city","Leiria",null]))[0];
      assert.equal(saved.confirmed_by,alice); assert.equal(saved.version,1);
      const rows = await asUser(alice,"select * from public.company_facts where company_id=$1",[a]);
      assert.equal(rows[0].value,"Leiria");
    });
    await t.test("outro tenant não lê, grava, corrige ou altera diretamente", async () => {
      assert.deepEqual(await asUser(bob,"select * from public.company_facts where company_id=$1",[a]), []);
      await assert.rejects(asUser(bob,saveSql,[a,"city","Porto",1]));
      await assert.rejects(asUser(bob,saveSql,[a,"segment","Pizzaria",null]));
      await assert.rejects(asUser(alice,"insert into public.company_facts(company_id,key,value,confirmed_by) values ($1,'segment','X',$2)",[a,bob]));
      await assert.rejects(asUser(alice,"update public.company_facts set company_id=$1 where company_id=$2",[b,a]));
    });
    await t.test("corrige explicitamente sem duplicar e rejeita versões antigas", async () => {
      const saved = (await asUser(alice,saveSql,[a,"city","Porto",1]))[0];
      assert.equal(saved.version,2);
      await assert.rejects(asUser(alice,saveSql,[a,"city","Lisboa",1]), e => e.code === "40001");
      await assert.rejects(asUser(alice,saveSql,[a,"city","Lisboa",null]), e => e.code === "40001");
      assert.equal((await asUser(alice,"select * from public.company_facts")).length,1);
      assert.equal((await asUser(alice,"select value from public.company_facts"))[0].value,"Porto");
    });
    await t.test("novo campo rejeita versão falsa, chave inválida e valores inválidos", async () => {
      for (const params of [
        [a,"segment","Pizzaria",1], [a,"password","secret",null], [a,"city"," ",null],
        [a,"monthly_revenue","38 mil",null], [a,"monthly_revenue","-1",null], [a,"team_size","2.3",null],
      ]) await assert.rejects(asUser(alice,saveSql,params));
    });
    await t.test("empresa B possui memória independente e sem acesso anônimo", async () => {
      await asUser(bob,saveSql,[b,"city","Lisboa",null]);
      assert.equal((await asUser(bob,"select value from public.company_facts"))[0].value,"Lisboa");
      await assert.rejects(asUser(null,"select * from public.company_facts",[],"anon"));
      await assert.rejects(asUser(null,saveSql,[a,"city","Lisboa",2],"anon"));
      await assert.rejects(asUser(null,saveSql,[a,"city","Lisboa",2]));
    });
  } finally { await db.close(); }
});
