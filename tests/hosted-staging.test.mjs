import test from 'node:test';
import assert from 'node:assert/strict';
import {hostedStagingEnvironment,hostedSourceFile} from '../scripts/hosted-staging.mjs';
import {environmentIssues} from '../scripts/environment.mjs';

const fixture={SEED_STAGING_SUPABASE_REF:'s'.repeat(20),SEED_PRODUCTION_SUPABASE_REF:'p'.repeat(20),NEXT_PUBLIC_SUPABASE_URL:'https://'+'s'.repeat(20)+'.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',SUPABASE_SECRET_KEY:'sb_secret_fixture'};
test('hosted preview cannot inherit paid providers, production keys, flags or cron configuration',()=>{
  const env=hostedStagingEnvironment({...fixture,OPENAI_API_KEY:'unsafe',RESEND_API_KEY:'unsafe',STRIPE_SECRET_KEY:'unsafe',SEED_ENV:'production',SEED_JOURNAL_ENABLED:'true',VERCEL_PROJECT_ID:'production'},'https://fixture-staging.vercel.app','x'.repeat(32));
  assert.deepEqual(Object.keys(env).filter(k=>/^(OPENAI|RESEND|STRIPE|VERCEL)_/.test(k)),[]);
  assert.equal(env.SEED_JOURNAL_ENABLED,'false');
  assert.deepEqual(environmentIssues({...env,VERCEL_ENV:'preview'}),[]);
  assert.ok(environmentIssues({...env,VERCEL_ENV:'production'}).length);
  assert.throws(()=>hostedStagingEnvironment({...fixture,NEXT_PUBLIC_SUPABASE_URL:'https://'+'p'.repeat(20)+'.supabase.co'},'https://fixture-staging.vercel.app','x'.repeat(32)));
  for(const origin of ['https://appseedai.com','http://fixture.vercel.app','https://fixture.vercel.app.evil.test','https://fixture.vercel.app/?secret=1'])assert.throws(()=>hostedStagingEnvironment(fixture,origin,'x'.repeat(32)));
});
test('deployment source allowlist excludes secrets, private evidence, migrations and project links',()=>{
  for(const file of ['.env.local','.env.staging.local','.test-build/report.json','.vercel/project.json','docs/private.md','supabase/migrations/test.sql','src/../.env','src/.env','src/data.log','public/data.sql','C:\\secret.txt'])assert.equal(hostedSourceFile(file),false,file);
  for(const file of ['src/app/page.tsx','src/lib/brain/index.ts','public/logo.png','package-lock.json','next.config.mjs','scripts/environment.mjs'])assert.equal(hostedSourceFile(file),true,file);
});

test('hosted billing exemption accepts only isolated Preview, test Stripe, no AI/email and paused jobs',()=>{
 const env={...hostedStagingEnvironment(fixture,'https://fixture-staging.vercel.app','x'.repeat(32)),VERCEL_ENV:'preview',SEED_STAGING_CORE_ONLY:'false',SEED_STAGING_HOSTED_BILLING:'true',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_WEBHOOK_SECRET:'whsec_fixture'};
 assert.deepEqual(environmentIssues(env),[]);
 for(const change of [
  {SEED_ENV:'production'},{SEED_ENV:'development'},{VERCEL_ENV:'production'},{VERCEL_ENV:undefined},
  {SEED_STAGING_CORE_ONLY:'true'},{SEED_STAGING_BILLING_ONLY:'true'},
  {NEXT_PUBLIC_SITE_URL:'https://appseedai.com'},{NEXT_PUBLIC_SUPABASE_URL:'https://other.supabase.co'},
  {SEED_STAGING_SUPABASE_REF:undefined},{STRIPE_SECRET_KEY:'sk_live_fixture'},
  {OPENAI_API_KEY:'unexpected'},{RESEND_API_KEY:'unexpected'},{SEED_ALERTS_ENABLED:'true'},
  {SEED_JOURNAL_ENABLED:'true'},{SEED_OPERATIONS_ENABLED:'false'},{SEED_EXTERNAL_MODE:'LIVE_WEB_ENABLED'},
 ])assert.ok(environmentIssues({...env,...change}).length,JSON.stringify(change));
});
