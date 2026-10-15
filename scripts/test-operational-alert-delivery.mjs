import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {loadStagingEnvironment,stagingDatabaseConfig} from './staging-config.mjs';
import {alertConfiguration,deliverOperationalAlert,renderOperationalAlert} from '../.test-build/src/lib/operations/alerts.js';

// Explicit manual test only. Does not load .env.local or inherit provider credentials.
const directory=new URL('../.test-build/phase-13-private-reports/',import.meta.url);
await mkdir(directory,{recursive:true});
const delivery=parseEnv(await readFile(new URL('../.env.alerts.staging.local',import.meta.url),'utf8'));
const fixture={id:randomUUID(),severity:'P1',sender:delivery.SEED_ALERT_FROM,recipient:delivery.SEED_ALERT_TO,
 environment:'staging',created_at:new Date().toISOString(),metrics:{errors_15m:5,ai_failures_2m:0,webhook_failures_15m:0,
 auth_failures_15m:0,journal_overdue:0,cost_unknown_today:0,accounted_or_reserved_usd_today:0,budget_reference_usd:null}};
if(!process.argv.includes('--send')){
 const preview=renderOperationalAlert(fixture);
 await writeFile(new URL('OPERATIONAL_ALERT_PREVIEW.txt',directory),preview.subject+'\n\n'+preview.text+'\n');
 console.log('Preview saved. No network calls or emails.');
}else{
 const stateFile=new URL('ALERT_DELIVERY_STATE.json',directory);
 let state;try{state=JSON.parse(await readFile(stateFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw Error('Invalid delivery state');}
 if(state)throw Error('A prior attempt exists. Review its receipt before authorizing another test.');
 const config=alertConfiguration({...delivery,SEED_ENV:'staging',SEED_OPERATIONS_ENABLED:'true',SEED_ALERTS_ENABLED:'true'});
 const staging=stagingDatabaseConfig(await loadStagingEnvironment());
 const db=createClient(staging.url,staging.serverKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(5000)})}});
 const controls=await db.from('operations_controls').select('closed_beta,disable_ai,disable_uploads').single();
 if(controls.error||!controls.data?.closed_beta||!controls.data.disable_ai||!controls.data.disable_uploads)throw Error('Staging controls must remain closed and paused.');
 const existing=await db.from('operational_alerts').select('id',{count:'exact',head:true});
 if(existing.error||existing.count!==0)throw Error('Review existing alerts before this isolated test.');
 const eventId=randomUUID();
 state={status:'prepared',project:staging.project,eventId,startedAt:new Date().toISOString()};
 await writeFile(stateFile,JSON.stringify(state,null,2));
 try{
  const events=await db.from('operational_events').insert(Array.from({length:5},(_,i)=>({request_id:eventId,feature:'alert_test',code:'FIXTURE_FAILURE_'+i,level:'ERROR'})));
  if(events.error)throw Error('Fixture insertion failed');
  const queued=await db.rpc('queue_operational_alerts');if(queued.error||queued.data!==1)throw Error('Queue failed');
  const claimed=await db.rpc('claim_operational_alert',{p_sender:config.sender,p_recipient:config.recipient,p_environment:'staging'});
  if(claimed.error||claimed.data?.length!==1)throw Error('Claim failed');
  const row=claimed.data[0];state.alertId=row.id;state.status='sending';await writeFile(stateFile,JSON.stringify(state,null,2));
  const result=await deliverOperationalAlert(row,config.key);
  state.providerId=result.providerId;state.code=result.code;state.status=result.providerId?'provider_accepted':'not_confirmed';
  // Save the provider outcome before the database acknowledgment, for reconciliation.
  await writeFile(stateFile,JSON.stringify(state,null,2));
  const finished=await db.rpc('finish_operational_alert',{p_id:row.id,p_lease:row.lease_token,p_provider_id:result.providerId,p_retry:result.retry,p_code:result.code});
  state.receiptRecorded=!finished.error&&finished.data===true;state.finishedAt=new Date().toISOString();
  await writeFile(stateFile,JSON.stringify(state,null,2));
  console.log(JSON.stringify({providerAccepted:!!result.providerId,receiptRecorded:state.receiptRecorded,inboxDelivery:'requires_confirmation'}));
  if(!result.providerId||!state.receiptRecorded)process.exitCode=1;
 }finally{
  const cleanup=await db.from('operational_events').delete().eq('request_id',eventId).eq('feature','alert_test');
  state.fixtureEventsCleaned=!cleanup.error;await writeFile(stateFile,JSON.stringify(state,null,2));
  if(cleanup.error)console.error('Fixture event cleanup requires review. No automatic resend.');
 }
}
