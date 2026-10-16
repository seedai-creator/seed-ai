import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';

test('queue monitoring isolates clients and covers due, running, backoff and resolved work',async()=>{
 const db=new PGlite();
 try {
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;");
  const folder=new URL('../supabase/migrations/',import.meta.url);
  for(const file of (await readdir(folder)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,folder),'utf8'));
  for(const role of ['anon','authenticated']) {
   await db.exec('begin;set local role '+role);
   await assert.rejects(db.query('select operational_queue_health()'),{code:'42501'});
   await db.exec('rollback');
  }
  await db.exec('begin;set local role service_role');
  assert.deepEqual((await db.query('select operational_queue_health() health')).rows[0].health,
   {journal_overdue:0,business_model_overdue:0,radar_overdue:0,external_overdue:0,growth_overdue:0});
  await db.exec('rollback');
  await db.exec(await readFile(new URL('./fixtures/operational-queues.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('./fixtures/operational-queue-load.sql',import.meta.url),'utf8'));
  assert.equal((await db.query('select count(*) n from auth.users')).rows[0].n,0);
  const user=crypto.randomUUID();
  await db.query('insert into auth.users(id) values($1)',[user]);
  const company=(await db.query('select company_id from company_members where user_id=$1',[user])).rows[0].company_id;
  // A Radar-only backlog must alert even with no Journal job or error burst.
  await db.query("insert into radar_company_state(company_id,next_scan_at) values($1,now()-interval '16 minutes') on conflict(company_id) do update set next_scan_at=excluded.next_scan_at",[company]);
  assert.equal((await db.query('select queue_operational_alerts() n')).rows[0].n,1);
  assert.equal((await db.query('select queue_operational_alerts() n')).rows[0].n,0);
  const row=(await db.query('select severity,metrics from operational_alerts')).rows[0];
  assert.equal(row.severity,'P2');assert.equal(row.metrics.radar_overdue,1);assert.equal(row.metrics.journal_overdue,0);
  assert.doesNotMatch(JSON.stringify(row),new RegExp(user+'|'+company));
  // Resolution does not mutate a receipt that may already be at the provider.
  await db.exec('update radar_company_state set processed_generation=generation');
  assert.equal((await db.query('select queue_operational_alerts() n')).rows[0].n,0);
  assert.deepEqual((await db.query('select severity,metrics from operational_alerts')).rows[0],row);
 }finally{await db.close();}
});
