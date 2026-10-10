import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("migração e isolamento real de linhas no PostgreSQL (PGlite)", async (t) => {
  const db = new PGlite();
  const alice = "11111111-1111-4111-8111-111111111111";
  const bob = "22222222-2222-4222-8222-222222222222";
  try {
    // Only Supabase's Auth schema and identities are fixtures; RLS is the real migration.
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, public to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
    `);
    await db.exec(await readFile(new URL("../supabase/migrations/202609230001_foundation.sql", import.meta.url), "utf8"));
    await db.query("insert into auth.users(id,raw_user_meta_data) values ($1,$2),($3,$4)", [alice, { display_name: "Alice" }, bob, { display_name: "Bob" }]);
    async function asUser(uid, query, params = [], role = "authenticated") {
      await db.exec("begin");
      try {
        await db.exec("set local role " + role);
        await db.query("select set_config('request.jwt.claim.sub', $1, true)", [uid ?? ""]);
        const result = await db.query(query, params);
        await db.exec("commit");
        return result.rows;
      } catch (error) { await db.exec("rollback"); throw error; }
    }
    let aliceCompany;
    let bobCompany;
    await t.test("cadastro cria perfil, empresa e vínculo automaticamente", async () => {
      const a = await asUser(alice, "select id,name from public.companies");
      const b = await asUser(bob, "select id,name from public.companies");
      assert.equal(a.length, 1); assert.equal(b.length, 1);
      aliceCompany = a[0].id; bobCompany = b[0].id;
      assert.notEqual(aliceCompany, bobCompany);
      assert.deepEqual(await asUser(alice, "select id,display_name from public.profiles"), [{ id: alice, display_name: "Alice" }]);
      assert.equal((await asUser(alice, "select * from public.company_members"))[0].role, "owner");
    });
    await t.test("não lê nem altera empresa alheia mesmo sabendo UUID", async () => {
      assert.deepEqual(await asUser(alice, "select * from public.companies where id=$1", [bobCompany]), []);
      assert.deepEqual(await asUser(alice, "update public.companies set name='Invadida' where id=$1 returning id", [bobCompany]), []);
      assert.deepEqual(await asUser(alice, "select * from public.company_members where user_id=$1", [bob]), []);
      assert.deepEqual(await asUser(alice, "update public.profiles set display_name='Invadido' where id=$1 returning id", [bob]), []);
    });
    await t.test("não permite autopromoção, falsificação de vínculo ou alteração do UUID", async () => {
      await assert.rejects(asUser(alice, "insert into public.company_members(company_id,user_id) values ($1,$2)", [bobCompany,alice]));
      await assert.rejects(asUser(alice, "update public.company_members set role='owner' where company_id=$1", [bobCompany]));
      await assert.rejects(asUser(alice, "update public.companies set id=$1 where id=$2", [bobCompany,aliceCompany]));
      await assert.rejects(asUser(alice, "insert into public.companies(name) values ('Sem dono')"));
    });
    await t.test("proprietário renomeia e RPC cria empresa ligada somente ao solicitante", async () => {
      assert.equal((await asUser(alice, "update public.companies set name='Empresa Alice' where id=$1 returning name", [aliceCompany]))[0].name, "Empresa Alice");
      const created = (await asUser(alice, "select public.create_company($1) as id", ["Segunda empresa"]))[0].id;
      assert.equal((await asUser(alice, "select * from public.company_members where company_id=$1", [created])).length, 1);
      assert.deepEqual(await asUser(bob, "select * from public.companies where id=$1", [created]), []);
      assert.equal((await asUser(alice, "select * from public.companies")).length, 2);
      await assert.rejects(asUser(alice, "select public.create_company(' ')"));
      assert.equal((await asUser(alice, "select * from public.companies")).length, 2);
    });
    await t.test("membro comum consulta mas não pode renomear", async () => {
      await db.query("insert into public.company_members(company_id,user_id,role) values ($1,$2,'member')", [aliceCompany,bob]);
      assert.equal((await asUser(bob, "select * from public.companies where id=$1", [aliceCompany])).length, 1);
      assert.deepEqual(await asUser(bob, "update public.companies set name='Alterada' where id=$1 returning id", [aliceCompany]), []);
    });
    await t.test("anônimo não lê tabelas nem cria empresa", async () => {
      for (const table of ["profiles","companies","company_members"]) await assert.rejects(asUser(null, "select * from public." + table, [], "anon"));
      await assert.rejects(asUser(null, "select public.create_company('Sem login')", [], "anon"));
      await assert.rejects(asUser(null, "select public.create_company('Sem identidade')"));
    });
  } finally { await db.close(); }
});
