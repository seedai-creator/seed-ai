import test from 'node:test';
import assert from 'node:assert/strict';
import {stagingRuntimeEnvironment} from '../scripts/staging-runtime.mjs';
import {environmentIssues} from '../scripts/environment.mjs';

const fixture=()=>({SEED_STAGING_SUPABASE_REF:'s'.repeat(20),SEED_PRODUCTION_SUPABASE_REF:'p'.repeat(20),NEXT_PUBLIC_SUPABASE_URL:'https://'+'s'.repeat(20)+'.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',SUPABASE_SECRET_KEY:'sb_secret_fixture'});
test('staging does not inherit production secrets, providers, preloads or build location',()=>{
 const env=stagingRuntimeEnvironment(fixture(),['OPENAI_PREMIUM_MODEL','DATABASE_URL'],{PATH:'fixture-path',OPENAI_API_KEY:'production',SUPABASE_SECRET_KEY:'production',NODE_OPTIONS:'--require unsafe.js',VERCEL_ENV:'production'});
 assert.equal(env.SUPABASE_SECRET_KEY,'sb_secret_fixture');
 assert.equal(env.OPENAI_API_KEY,'');assert.equal(env.DATABASE_URL,'');assert.equal(env.OPENAI_PREMIUM_MODEL,'');
 assert.equal(env.NODE_OPTIONS,undefined);assert.equal(env.PATH,'fixture-path');
 assert.equal(env.SEED_BUILD_TARGET,'staging');assert.equal(env.SEED_OPERATIONS_ENABLED,'true');
 assert.equal(env.SEED_JOURNAL_ENABLED,'false');assert.equal(env.SEED_EXTERNAL_MODE,'DISABLED');
 assert.deepEqual(environmentIssues(env),[]);
});
test('core-only exemption cannot disable production validation or admit provider secrets',()=>{
 const env=stagingRuntimeEnvironment(fixture(),[],{});
 assert.ok(environmentIssues({...env,SEED_ENV:'production'}).some(x=>x.includes('forbidden')));
 assert.ok(environmentIssues({...env,OPENAI_API_KEY:'accidental-key'}).some(x=>x.includes('must not receive')));
 assert.ok(environmentIssues({...env,SEED_OPERATIONS_ENABLED:'false'}).some(x=>x.includes('operations controls')));
 assert.ok(environmentIssues({...env,SEED_STAGING_CORE_ONLY:'false'}).includes('OPENAI_API_KEY is required'));
 assert.throws(()=>stagingRuntimeEnvironment({...fixture(),NEXT_PUBLIC_SUPABASE_URL:'https://'+'p'.repeat(20)+'.supabase.co'},[],{}));
});
