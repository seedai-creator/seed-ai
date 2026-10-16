import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
test('Cockpit sources retain PostgreSQL tenant isolation and private analytics',async t=>{
 const db=new PGlite(),user=crypto.randomUUID(),other=crypto.randomUUID(),conversation=crypto.randomUUID();
 async function asUser(sql,params=[],who=user){await db.exec('begin');try{await db.exec('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[who]);const r=await db.query(sql,params);await db.exec('commit');return r.rows;}catch(e){await db.exec('rollback');throw e;}}
 try{
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;");
  const dir=new URL('../supabase/migrations/',import.meta.url);for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
  await db.query('insert into auth.users(id) values($1),($2)',[user,other]);const company=(await db.query('select company_id from company_members where user_id=$1',[user])).rows[0].company_id;
  await db.query("insert into conversations(id,company_id,user_id,title) values($1,$2,$3,'FICTÍCIO')",[conversation,company,user]);
  await db.query("insert into messages(conversation_id,request_id,role,content) values($1,$2,'assistant','FICTÍCIO')",[conversation,crypto.randomUUID()]);
  await db.query("insert into business_memories(company_id,key,kind,value) values($1,'test_context','FACT','FICTÍCIO')",[company]);
  await db.query("insert into commercial_events(user_id,event,dedupe_key) values($1,'weekly_intelligence_opened','cockpit:ack:test')",[user]);
  await t.test('RLS enabled on every persisted source read by cockpit',async()=>{for(const table of ['companies','company_members','strategies','actions','goals','business_memories','conversations','messages','weekly_intelligence_reports','execution_results','execution_learnings','decisions','growth_map_snapshots','radar_insights','commercial_events'])assert.equal((await db.query('select relrowsecurity from pg_class where relname=$1',[table])).rows[0].relrowsecurity,true,table);});
  await t.test('another tenant cannot read the conversation, diagnosis or memory',async()=>{for(const table of ['conversations','messages','business_memories']){assert.equal((await asUser('select * from '+table)).length,1);assert.equal((await asUser('select * from '+table,[],other)).length,0);}});
  await t.test('analytics are unavailable to regular authenticated clients, including guessed keys',async()=>{assert.equal((await asUser("select * from commercial_events where dedupe_key='cockpit:ack:test'")).length,0);assert.equal((await asUser('select * from commercial_events',[],other)).length,0);await assert.rejects(asUser("insert into commercial_events(user_id,event,dedupe_key) values($1,'home_viewed','fake')",[user]));});
  await t.test('tenant membership remains a separate server boundary when service_role bypasses RLS',async()=>{assert.equal((await db.query('select * from company_members where company_id=$1 and user_id=$2',[company,other])).rows.length,0);await db.exec('begin;set local role service_role');assert.equal((await db.query('select count(*) from conversations')).rows[0].count,1);await db.exec('rollback');});
 }finally{await db.close();}
});
