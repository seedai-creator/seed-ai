import {spawn} from 'node:child_process';
// Build-only fixture: no production database, credentials, paid providers or jobs.
// This never deploys and is not a substitute for staging integration validation.
const env={...process.env,SEED_ENV:'development',SEED_PRODUCTION_SUPABASE_REF:'production-fixture',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-public',SUPABASE_SECRET_KEY:'fixture-private',NEXT_PUBLIC_SITE_URL:'http://127.0.0.1:3002',OPENAI_API_KEY:'fixture-provider',OPENAI_MODEL:'fixture-model',OPENAI_ECONOMY_MODEL:'fixture-model',OPENAI_STRATEGIC_MODEL:'fixture-model',OPENAI_PREMIUM_MODEL:'fixture-model',OPENAI_WEB_ECONOMY_MODEL:'fixture-model',OPENAI_WEB_STRATEGIC_MODEL:'fixture-model',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_WEBHOOK_SECRET:'whsec_fixture',CRON_SECRET:'fixture-only-not-a-secret-'.repeat(3),SEED_EXTERNAL_MODE:'DISABLED',NEXT_TELEMETRY_DISABLED:'1'};
delete env.VERCEL_ENV;
for(const key of Object.keys(env))if(key.startsWith('SEED_')&&key.endsWith('_ENABLED'))env[key]='false';
for(const key of ['OPERATIONS','ALERTS','COCKPIT','GROWTH_MAP','GOALS','RADAR','SIMULATOR','JOURNAL'])env[`SEED_${key}_ENABLED`]='false';
env.RESEND_API_KEY='';
const command=process.argv.includes('--serve')?['start','--hostname','127.0.0.1','--port','3002']:['build'];
const child=spawn(process.execPath,['node_modules/next/dist/bin/next',...command],{env,stdio:'inherit'});
child.on('exit',code=>{process.exitCode=code??1;});
