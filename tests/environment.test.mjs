import test from 'node:test';
import assert from 'node:assert/strict';
import {environmentIssues} from '../scripts/environment.mjs';
const fixture=()=>({SEED_ENV:'staging',SEED_PRODUCTION_SUPABASE_REF:'production-project',NEXT_PUBLIC_SUPABASE_URL:'https://staging-project.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-public',NEXT_PUBLIC_SITE_URL:'https://staging.seed.example',SUPABASE_SECRET_KEY:'fixture-private',OPENAI_API_KEY:'fixture-provider',OPENAI_MODEL:'fixture-model',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_WEBHOOK_SECRET:'whsec_fixture',CRON_SECRET:'fixture-only-'.repeat(4)});
test('environment validation detects missing secrets without including their values',()=>{
  const e=fixture();delete e.OPENAI_API_KEY;
  assert.ok(environmentIssues(e).includes('OPENAI_API_KEY is required'));
  assert.deepEqual(environmentIssues(fixture()),[]);
});
test('staging rejects production database, live billing and public secrets',()=>{
  const errors=environmentIssues({...fixture(),NEXT_PUBLIC_SUPABASE_URL:'https://production-project.supabase.co',STRIPE_SECRET_KEY:'sk_live_fixture',NEXT_PUBLIC_OPENAI_API_KEY:'private'});
  assert.ok(errors.some(x=>x.includes('production database')));
  assert.ok(errors.some(x=>x.includes('test mode')));
  assert.ok(errors.some(x=>x.includes('must not be public')));
});
test('preview cannot pretend to be production and remote HTTP is forbidden',()=>{
  assert.ok(environmentIssues({...fixture(),VERCEL_ENV:'preview',SEED_ENV:'production'}).some(x=>x.includes('Preview')));
  assert.ok(environmentIssues({...fixture(),NEXT_PUBLIC_SITE_URL:'http://staging.seed.example'}).some(x=>x.includes('HTTPS')));
});
test('health monitor requires a separate non-public credential when configured',()=>{
  const env=fixture();
  assert.deepEqual(environmentIssues({...env,SEED_HEALTH_TOKEN:'dedicated_monitor_fixture_'.repeat(3)}),[]);
  assert.ok(environmentIssues({...env,SEED_HEALTH_TOKEN:env.CRON_SECRET}).some(x=>x.includes('privileged credential')));
  assert.ok(environmentIssues({...env,SEED_HEALTH_TOKEN:'short'}).some(x=>x.includes('URL-safe')));
  assert.ok(environmentIssues({...env,NEXT_PUBLIC_SEED_HEALTH_TOKEN:'fixture'}).some(x=>x.includes('must not be public')));
});
