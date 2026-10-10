import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
test('operations migration preserves tenant isolation and controls beta, support and consent',async t=>{
 const db=new PGlite(),user=crypto.randomUUID(),other=crypto.randomUUID(),admin=crypto.randomUUID();
 async function asUser(sql,params=[],who=user){await db.exec('begin');try{await db.exec('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[who]);const r=await db.query(sql,params);await db.exec('commit');return r.rows;}catch(e){await db.exec('rollback');throw e;}}
 try{
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;");
  const dir=new URL('../supabase/migrations/',import.meta.url);for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
  await db.query("insert into auth.users(id,email) values($1,'owner@example.invalid'),($2,'other@example.invalid'),($3,'admin@example.invalid')",[user,other,admin]);
  await db.query("insert into admin_roles(user_id,role) values($1,'SUPER_ADMIN')",[admin]);
  const company=(await db.query('select company_id from company_members where user_id=$1',[user])).rows[0].company_id;
  await t.test('every public table has RLS and beta restrictions never grant cross-tenant access',async()=>{
   assert.deepEqual((await db.query("select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='r' and not relrowsecurity")).rows,[]);
   assert.equal((await asUser('select * from companies where id=$1',[company],other)).length,0);
   await assert.rejects(asUser("update operations_controls set disable_ai=true"));
   await assert.rejects(asUser("select operations_change($1,'controls','disable_ai','true',1,'invalid actor')",[admin]));
  });
  await t.test('closed beta blocks direct signup and direct data access, then permits only a valid invitation',async()=>{
   await db.query("select operations_change($1,'controls','closed_beta','true',1,'Enable isolated staging beta')",[admin]);
   assert.equal((await asUser('select * from companies')).length,0);
   await assert.rejects(db.query("insert into auth.users(id,email) values($1,'intruder@example.invalid')",[crypto.randomUUID()]));
   const invited=crypto.randomUUID();
   await db.query("select operations_change($1,'invitation','invited@example.invalid',$2::jsonb,0,'Invite fictitious tester')",[admin,JSON.stringify({cohort:'FIXTURE',expires_at:'2099-01-01T00:00:00Z'})]);
   await db.query("insert into auth.users(id,email) values($1,'invited@example.invalid')",[invited]);
   assert.equal((await asUser('select operations_user_allowed() as allowed',[],invited))[0].allowed,true);
   assert.equal((await asUser('select * from companies where id=$1',[company],invited)).length,0);
  });
  await t.test('grant, expiration, disable, concurrency and audit are enforced',async()=>{
   await db.query("select operations_change($1,'access',$2,$3::jsonb,0,'Grant fictitious beta')",[admin,user,JSON.stringify({cohort:'FIXTURE',expires_at:'2099-01-01T00:00:00Z'})]);
   assert.equal((await asUser('select * from companies')).length,1);
   await db.query('update beta_access set disabled=true where user_id=$1',[user]);
   assert.equal((await asUser('select * from companies')).length,0);
   await assert.rejects(asUser("select create_company('Forbidden fictitious company')"),/Beta access required/);
   await assert.rejects(asUser("select save_company_fact($1,'segment','Forbidden update',null)",[company]),/Beta access required/);
   await db.query("update beta_access set disabled=false,expires_at=now()-interval '1 day' where user_id=$1",[user]);
   assert.equal((await asUser('select * from companies')).length,0);
   await assert.rejects(db.query("select operations_change($1,'controls','disable_ai','true',1,'stale update rejected')",[admin]));
   await assert.rejects(db.query("select operations_change($1,'controls','disable_ai',null,2,'null input rejected')",[admin]));
   assert.ok((await db.query('select count(*)::int as n from admin_audit_log')).rows[0].n>=3);
  });
  await t.test('privacy remains reachable for restricted users, rejects another company and rate limits spam',async()=>{
   await assert.rejects(asUser("select submit_support_request($1,'PRIVACY','Request about another company')",[company],other));
   for(let i=0;i<5;i++)await asUser("select submit_support_request(null,'EXPORT_DATA','Fictitious data export request')");
   await assert.rejects(asUser("select submit_support_request(null,'BUG','Another support request')"));
   assert.equal((await asUser('select * from support_requests')).length,5);
   assert.equal((await asUser('select * from support_requests',[],other)).length,0);
   const request=(await asUser('select id from support_requests limit 1'))[0].id;
   await assert.rejects(asUser("select resolve_support_request($1,$2,1,'RESOLVED','Cannot impersonate admin')",[admin,request]));
   await db.query("select resolve_support_request($1,$2,1,'IN_REVIEW','Review fictitious request')",[admin,request]);
   await assert.rejects(db.query("select resolve_support_request($1,$2,1,'RESOLVED','Stale version rejected')",[admin,request]));
   assert.equal((await asUser('select status from support_requests where id=$1',[request]))[0].status,'IN_REVIEW');
  });
  await t.test('consent requires approved current documents and is idempotent',async()=>{
   const terms=crypto.randomUUID(),privacy=crypto.randomUUID();
   await db.query("insert into legal_documents(id,kind,version,locale,content,approved,approved_by) values($1,'TERMS','fixture-v1','pt-BR',$3,true,$4),($2,'PRIVACY','fixture-v1','pt-BR',$3,true,$4)",[terms,privacy,'FICTITIOUS LEGAL TEST DATA. '.repeat(6),admin]);
   await asUser("select accept_legal_documents($1,$2,'pt-BR')",[terms,privacy]);
   await asUser("select accept_legal_documents($1,$2,'pt-BR')",[terms,privacy]);
   assert.equal((await asUser('select * from legal_acceptances')).length,1);
   assert.equal((await asUser('select * from legal_acceptances',[],other)).length,0);
   await assert.rejects(asUser("select accept_legal_documents($1,$2,'en-US')",[terms,privacy]));
   assert.equal((await asUser('select operations_terms_current() as current'))[0].current,true);
   await db.query("insert into legal_documents(kind,version,locale,content,approved,approved_by,published_at) values('TERMS','fixture-v2','pt-BR',$1,true,$2,now()+interval '1 second')",['FICTITIOUS REVISED LEGAL TEST DATA. '.repeat(6),admin]);
   assert.equal((await asUser('select operations_terms_current() as current'))[0].current,false);
  });
  await t.test('shared AI breaker, explicit pauses and retry deduplication protect costs',async()=>{
   const allowed=async()=> (await db.query("select operations_can_call_ai('CHAT','fixture-model') as ok")).rows[0].ok;
   assert.equal(await allowed(),true);
   await assert.rejects(asUser("select operations_can_call_ai('CHAT','fixture-model')"));
   const request=crypto.randomUUID();
   for(let i=0;i<6;i++)await db.query("insert into operational_events(request_id,feature,code,level) values($1,'CHAT','AI_FAILED','ERROR') on conflict(request_id,feature,code) do nothing",[request]);
   assert.equal((await db.query('select count(*)::int n from operational_events')).rows[0].n,1);
   assert.equal(await allowed(),true);
   for(let i=0;i<4;i++)await db.query("insert into operational_events(request_id,feature,code,level) values($1,'CHAT','AI_FAILED','ERROR')",[crypto.randomUUID()]);
   assert.equal(await allowed(),false);
   await db.exec("update operational_events set created_at=now()-interval '3 minutes'");
   assert.equal(await allowed(),true);
   await db.exec("update operations_controls set paused_features=array['CHAT']");assert.equal(await allowed(),false);
   await db.exec("update operations_controls set paused_features='{}',blocked_models=array['fixture-model']");assert.equal(await allowed(),false);
   await db.exec("update operations_controls set blocked_models='{}',disable_ai=true");assert.equal(await allowed(),false);
   await db.exec("update operations_controls set disable_ai=false");assert.equal(await allowed(),true);
  });
 }finally{await db.close();}
});
