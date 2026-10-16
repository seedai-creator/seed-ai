import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {buildStagingBootstrap} from '../scripts/staging-bootstrap.mjs';
import {stagingDatabaseConfig} from '../scripts/staging-config.mjs';
const project='dgqvcvebydjxxkuvrgkl';
const env={SEED_STAGING_SUPABASE_REF:project,SEED_PRODUCTION_SUPABASE_REF:'gqumxaapjyujrpqggnon',NEXT_PUBLIC_SUPABASE_URL:`https://${project}.supabase.co`};

test('bootstrap accepts official CLI timestamps while rejecting paths, duplicates and malformed names',()=>{
 const migration={name:'20261014211433_fixture.sql',sql:'begin; select 1; commit;'};
 assert.match(buildStagingBootstrap([migration],project),/20261014211433_fixture.sql/);
 for(const name of ['../20261014211433_fixture.sql','2026101421143_fixture.sql','20261014211433_fixture;drop.sql'])
  assert.throws(()=>buildStagingBootstrap([{...migration,name}],project));
 assert.throws(()=>buildStagingBootstrap([migration,migration],project));
 assert.throws(()=>buildStagingBootstrap([{name:'20261013171010_waitlist_email_notifications.sql',sql:'select 1;'}],project),/transaction boundaries/);
});

test('staging configuration never accepts production, arbitrary hosts or missing keys',()=>{
 assert.equal(stagingDatabaseConfig(env,{requireKeys:false}).project,project);
 assert.throws(()=>stagingDatabaseConfig(env),/chaves/);
 assert.throws(()=>stagingDatabaseConfig({...env,SEED_STAGING_SUPABASE_REF:env.SEED_PRODUCTION_SUPABASE_REF},{requireKeys:false}),/distintas/);
 for(const url of ['https://attacker.invalid','https://'+project+'.supabase.co/other','https://'+project+'.supabase.co?token=private'])assert.throws(()=>stagingDatabaseConfig({...env,NEXT_PUBLIC_SUPABASE_URL:url},{requireKeys:false}),/exatamente/);
});

test('fresh staging bootstrap is atomic, refuses an installed database and leaves access/AI paused',async()=>{
 const db=new PGlite();
 try{
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;");
  const broken=buildStagingBootstrap([{name:'209901010001_fixture.sql',sql:'begin; create table public.rollback_probe(id int); select * from missing_bootstrap_fixture; commit;'}],project);
  await assert.rejects(db.exec(broken));await db.exec('rollback');
  assert.equal((await db.query("select count(*)::int n from pg_tables where schemaname='public'")).rows[0].n,0);
  const dir=new URL('../supabase/migrations/',import.meta.url),migrations=await Promise.all((await readdir(dir)).filter(name=>name.endsWith('.sql')).sort().map(async name=>({name,sql:await readFile(new URL(name,dir),'utf8')})));
  const sql=buildStagingBootstrap(migrations,project);await db.exec(sql);
  assert.deepEqual((await db.query('select closed_beta,disable_ai,disable_uploads from operations_controls')).rows,[{closed_beta:true,disable_ai:true,disable_uploads:true}]);
  assert.deepEqual((await db.query("select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='r' and not relrowsecurity")).rows,[]);
  await assert.rejects(db.exec(sql),/empty public schema/);await db.exec('rollback');
  assert.equal((await db.query('select count(*)::int n from operations_controls')).rows[0].n,1);
 }finally{await db.close();}
});
