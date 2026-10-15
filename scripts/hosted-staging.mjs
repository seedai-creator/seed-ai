import {stagingDatabaseConfig} from './staging-config.mjs';
import {validateEnvironment} from './environment.mjs';

// The hosted test app uses Vercel Preview only. Never import the local app's
// environment, provider keys, schedules, production domains or project link.
export function hostedStagingEnvironment(staging,site,cronSecret) {
  stagingDatabaseConfig(staging);
  const url=new URL(site);
  if(url.protocol!=='https:'||!url.hostname.endsWith('.vercel.app')||url.port||url.pathname!=='/'||url.search||url.hash||url.username||url.password)throw Error('A dedicated Vercel staging origin is required.');
  const env={
    SEED_ENV:'staging',SEED_STAGING_CORE_ONLY:'true',SEED_OPERATIONS_ENABLED:'true',
    SEED_STAGING_SUPABASE_REF:staging.SEED_STAGING_SUPABASE_REF,
    SEED_PRODUCTION_SUPABASE_REF:staging.SEED_PRODUCTION_SUPABASE_REF,
    NEXT_PUBLIC_SUPABASE_URL:staging.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:staging.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY:staging.SUPABASE_SECRET_KEY,NEXT_PUBLIC_SITE_URL:url.origin,
    CRON_SECRET:cronSecret,SEED_JOURNAL_ENABLED:'false',SEED_RADAR_ENABLED:'false',
    SEED_EXTERNAL_MODE:'DISABLED',SEED_ALERTS_ENABLED:'false',
    SEED_COCKPIT_ENABLED:'true',SEED_GROWTH_MAP_ENABLED:'true',SEED_GOALS_ENABLED:'true',SEED_SIMULATOR_ENABLED:'true',
    NEXT_TELEMETRY_DISABLED:'1',
  };
  validateEnvironment({...env,VERCEL_ENV:'preview'});
  return env;
}

const rootFiles=new Set(['package.json','package-lock.json','next.config.mjs','next-env.d.ts','postcss.config.mjs','tsconfig.json']);
export function hostedSourceFile(file) {
  if(file.includes('\\')||file.startsWith('/')||file.split('/').some(p=>p==='..'||p.startsWith('.'))||/\.(?:log|sql|map|tsbuildinfo)$/i.test(file))return false;
  return rootFiles.has(file)||file==='scripts/environment.mjs'||file.startsWith('src/')||file.startsWith('public/');
}
