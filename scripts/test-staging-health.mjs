// Read-only integration: the production health queries against isolated staging.
// No users, alerts, heartbeat receipts or provider calls are created by this test.
import {createClient} from '@supabase/supabase-js';
import {writeFile} from 'node:fs/promises';
import {loadStagingEnvironment,stagingDatabaseConfig} from './staging-config.mjs';
import {readOperationalHealthFrom,evaluateHealth} from '../.test-build/src/lib/operations/health.js';
const report={checkedAt:new Date().toISOString(),readOnly:true,checks:[]};
try {
 if(!process.argv.includes('--run'))throw Error('RUN_FLAG_REQUIRED');
 const config=stagingDatabaseConfig(await loadStagingEnvironment());
 const client=key=>createClient(config.url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,redirect:'error',signal:AbortSignal.timeout(3000)})}});
 const observation=await readOperationalHealthFrom(client(config.serverKey));
 if(!observation.database)throw Error('DATABASE_CHECK_FAILED');
 report.checks.push('real_health_queries_succeeded');
 report.status=evaluateHealth(observation,Date.now()).status;
 // This isolated environment has no scheduled heartbeat. A degraded status is
 // valid; do not insert fake success receipts just to make the monitor green.
 let denied=false;
 try{await readOperationalHealthFrom(client(config.publicKey));}catch{denied=true;}
 if(!denied)throw Error('ANONYMOUS_HEALTH_TABLES_EXPOSED');
 report.checks.push('anonymous_catalog_access_denied');
 console.log(JSON.stringify(report));
}catch{report.failed=true;console.error('STAGING_HEALTH_VERIFICATION_FAILED');process.exitCode=1;}
await writeFile(new URL('../.test-build/staging-health-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
