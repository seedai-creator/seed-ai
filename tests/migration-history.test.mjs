import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {planMigrationHistory} from '../scripts/migration-history.mjs';
import {schemaAuditQuery} from '../scripts/schema-audit.mjs';
const sources=[
 {file:'202610010001_existing.sql',sql:'create table fixture(id int primary key);'},
 {file:'20261012214901_shared.sql',sql:'select 1;\n'},
 {file:'20261016133617_pending.sql',sql:'select 2;'},
];
const schema={tables:{fixture:{rls:true}},functions:{'fixture()':{bodyHash:'same'}}};
const remote=[{version:'20261013165942',name:'shared',statements:['select 1;\r\n']}];
const base=()=>({sources,installedFiles:sources.slice(0,2).map(s=>s.file),remote,expectedSchema:schema,actualSchema:schema,schemaFingerprint:'a'.repeat(32)});

test('history plan excludes uninstalled migrations and refuses unknown or different remote SQL',()=>{
 const plan=planMigrationHistory(base());
 assert.deepEqual(plan.pending,[sources[2].file]);
 assert.equal(plan.inserted.length,1);assert.equal(plan.renames.length,1);
 assert.doesNotMatch(plan.forward,/create table fixture|select 2;/);
 assert.throws(()=>planMigrationHistory({...base(),installedFiles:[]}),/INSTALLED/);
 assert.throws(()=>planMigrationHistory({...base(),remote:[{...remote[0],name:'unknown'}]}),/UNKNOWN_REMOTE/);
 assert.throws(()=>planMigrationHistory({...base(),remote:[{...remote[0],statements:['select 3;']}]}),/SQL_MISMATCH/);
 assert.throws(()=>planMigrationHistory({...base(),remote:[...remote,remote[0]]}));
 assert.throws(()=>planMigrationHistory({...base(),sources:[...sources,sources[0]]}),/INVALID_SOURCE/);
 assert.throws(()=>planMigrationHistory({...base(),actualSchema:{...schema,tables:{fixture:{rls:false}}}}),/SCHEMA_NOT_EXACT/);
 assert.throws(()=>planMigrationHistory({...base(),schemaFingerprint:''}),/FINGERPRINT/);
});

test('metadata repair is atomic, schema guarded, non-replayable and reversible without changing application data',async()=>{
 const db=new PGlite();
 try{
  await db.exec("create role anon;create role authenticated;create role service_role;create table public.fixture(id int primary key);insert into fixture values(42);create function public.fixture_fn() returns int language sql as 'select 1';create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[],created_by text);");
  await db.query('insert into supabase_migrations.schema_migrations values($1,$2,$3,$4)',[remote[0].version,remote[0].name,remote[0].statements,'original-author']);
  const snapshot=(await db.query(schemaAuditQuery)).rows[0].snapshot;
  const fingerprint=(await db.query('select md5(snapshot::text) fingerprint from ('+schemaAuditQuery.trim().replace(/;$/,'')+') s')).rows[0].fingerprint;
  const plan=planMigrationHistory({...base(),expectedSchema:snapshot,actualSchema:snapshot,schemaFingerprint:fingerprint});
  await db.exec('alter table fixture add column changed int');
  await assert.rejects(db.exec(plan.forward),/SCHEMA_CHANGED/);await db.exec('rollback');
  assert.equal((await db.query('select count(*)::int n from supabase_migrations.schema_migrations')).rows[0].n,1);
  await db.exec('alter table fixture drop column changed');
  await db.exec(plan.forward);
  assert.deepEqual((await db.query('select * from fixture')).rows,[{id:42}]);
  assert.equal((await db.query('select count(*)::int n from supabase_migrations.schema_migrations')).rows[0].n,2);
  assert.equal((await db.query("select created_by from supabase_migrations.schema_migrations where name='shared'")).rows[0].created_by,'original-author');
  await assert.rejects(db.exec(plan.forward),/MIGRATION_LEDGER_CHANGED/);await db.exec('rollback');
  await db.exec(plan.rollback);
  assert.deepEqual((await db.query('select version,name,statements from supabase_migrations.schema_migrations')).rows,remote);
  assert.deepEqual((await db.query('select * from fixture')).rows,[{id:42}]);
  await db.exec("update supabase_migrations.schema_migrations set statements=array['changed']");
  await assert.rejects(db.exec(plan.forward),/MIGRATION_LEDGER_CHANGED/);await db.exec('rollback');
 }finally{await db.close();}
});
