import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';

test('domain conflict migration preserves permissions and returns non-retryable version conflicts',async()=>{
 const db=new PGlite(),user=crypto.randomUUID(),other=crypto.randomUUID();
 try{
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;");
  const dir=new URL('../supabase/migrations/',import.meta.url),fix='20261015165036_domain_conflict_status.sql';
  for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')&&f<fix).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
  const inventory="select p.oid::regprocedure::text signature,p.prosrc,p.proacl,p.proconfig,p.prosecdef,p.proowner from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' order by 1";
  const before=(await db.query(inventory)).rows;
  assert.equal(before.filter(p=>p.prosrc.includes("'40001'")).length,19);
  await db.exec(await readFile(new URL(fix,dir),'utf8'));
  const after=(await db.query(inventory)).rows;
  assert.equal(after.length,before.length);
  for(let i=0;i<before.length;i++)assert.deepEqual(after[i],{...before[i],prosrc:before[i].prosrc.replaceAll("'40001'","'PT409'")});
  await db.query("insert into auth.users(id,email) values($1,'conflict-fixture-a@example.invalid'),($2,'conflict-fixture-b@example.invalid')",[user,other]);
  const company=(await db.query('select company_id from company_members where user_id=$1',[user])).rows[0].company_id;
  async function save(who,version,value){
   await db.exec('begin');try{
    await db.exec('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[who]);
    const result=await db.query("select * from save_company_fact($1,'segment',$2,$3)",[company,value,version]);
    await db.exec('commit');return result.rows;
   }catch(error){await db.exec('rollback');throw error;}
  }
  assert.equal((await save(user,null,'FIXTURE INITIAL'))[0].version,1);
  assert.equal((await save(user,1,'FIXTURE UPDATED'))[0].version,2);
  await assert.rejects(save(user,1,'STALE FIXTURE'),e=>e.code==='PT409');
  await assert.rejects(save(other,2,'FOREIGN FIXTURE'),e=>e.code==='42501');
  assert.equal((await db.query('select value from company_facts where company_id=$1',[company])).rows[0].value,'FIXTURE UPDATED');
 }finally{await db.close();}
});
