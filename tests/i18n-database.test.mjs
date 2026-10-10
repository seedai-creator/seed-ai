import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("migração internacional preserva memória e isolamento", async (t) => {
  const db = new PGlite();
  const alice = "11111111-1111-4111-8111-111111111111", bob = "22222222-2222-4222-8222-222222222222";
  try {
    await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
      create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth,public to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
    for (const name of ["202609230001_foundation.sql", "202609240001_business_memory.sql"])
      await db.exec(await readFile(new URL("../supabase/migrations/" + name, import.meta.url), "utf8"));
    await db.query("insert into auth.users(id) values ($1),($2)", [alice,bob]);
    const a = (await db.query("select company_id from public.company_members where user_id=$1", [alice])).rows[0].company_id;
    const b = (await db.query("select company_id from public.company_members where user_id=$1", [bob])).rows[0].company_id;
    await db.query("insert into public.company_facts(company_id,key,value) values ($1,'country','Brasil'),($1,'monthly_revenue','38000.50'),($2,'country','País ainda não confirmado')",[a,b]);
    await db.exec(await readFile(new URL("../supabase/migrations/202609260001_internationalization.sql", import.meta.url), "utf8"));
    async function asUser(uid, sql, params = [], role = "authenticated") {
      await db.exec("begin");
      try {
        await db.exec("set local role " + role);
        await db.query("select set_config('request.jwt.claim.sub',$1,true)",[uid ?? ""]);
        const result = await db.query(sql,params);
        await db.exec("commit"); return result.rows;
      } catch (error) { await db.exec("rollback"); throw error; }
    }
    const stamp = async () => (await asUser(alice,"select updated_at::text as stamp from public.companies where id=$1",[a]))[0].stamp;
    const save = "select public.save_company_market($1,$2,$3,$4,$5,$6,$7,$8,$9)";
    await t.test("migração mantém valores e não adivinha país/idioma", async () => {
      assert.equal((await asUser(alice,"select value from public.company_facts where key='country'"))[0].value,"BR");
      assert.equal((await asUser(alice,"select value from public.company_facts where key='monthly_revenue'"))[0].value,"38000.50");
      assert.equal((await asUser(bob,"select value from public.company_facts where key='country'"))[0].value,"País ainda não confirmado");
      assert.equal((await asUser(alice,"select locale from public.companies"))[0].locale,null);
    });
    await t.test("idioma persiste no perfil entre transações e não altera outro usuário", async () => {
      for (const locale of ["pt-BR","pt-PT","en-US","es-ES"]) {
        await asUser(alice,"update public.profiles set locale=$1 where id=$2",[locale,alice]);
        assert.equal((await asUser(alice,"select locale from public.profiles"))[0].locale,locale);
      }
      assert.deepEqual(await asUser(bob,"update public.profiles set locale='en-US' where id=$1 returning id",[alice]),[]);
      await assert.rejects(asUser(alice,"update public.profiles set locale='unknown'"));
    });
    await t.test("mercado usa fatos únicos e aceita idioma diferente do país", async () => {
      await asUser(alice,save,[a,"US","USD","pt-PT","en-US","America/New_York",await stamp(),2,null]);
      const company = (await asUser(alice,"select * from public.companies where id=$1",[a]))[0];
      assert.equal(company.preferred_language,"pt-PT"); assert.equal(company.locale,"en-US");
      const facts = await asUser(alice,"select key,value from public.company_facts");
      assert.equal(facts.filter(f=>f.key==="country").length,1);
      assert.equal(facts.find(f=>f.key==="country").value,"US");
      assert.equal(facts.find(f=>f.key==="currency").value,"USD");
      assert.equal(facts.find(f=>f.key==="monthly_revenue").value,"38000.50");
    });
    await t.test("outra empresa, anônimo e membro sem propriedade não alteram mercado", async () => {
      const args=[a,"BR","BRL","pt-BR","pt-BR","America/Sao_Paulo",await stamp(),3,1];
      await assert.rejects(asUser(bob,save,args));
      await assert.rejects(asUser(null,save,args, "anon"));
      await db.query("insert into public.company_members(company_id,user_id,role) values ($1,$2,'member')",[a,bob]);
      await assert.rejects(asUser(bob,save,args));
      await assert.rejects(asUser(alice,"update public.companies set timezone='Fake/Zone' where id=$1",[a]));
    });
    await t.test("timezone inválido e versões antigas são rejeitados atomicamente", async () => {
      const before = await stamp();
      await assert.rejects(asUser(alice,save,[a,"BR","BRL","pt-BR","pt-BR","Fake/Zone",before,3,1]));
      await assert.rejects(asUser(alice,save,[a,"BR","BRL","pt-BR","pt-BR","UTC",before,2,1]));
      assert.equal(await stamp(),before);
      assert.equal((await asUser(alice,"select value from public.company_facts where key='country'"))[0].value,"US");
    });
  } finally { await db.close(); }
});
