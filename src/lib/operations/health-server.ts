import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {readOperationalHealthFrom} from './health';
import {logEvent} from './logging';

function database() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
  if(process.env.SEED_OPERATIONS_ENABLED!=='true'||!url||!key)throw Error('HEALTH_UNAVAILABLE');
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},
    global:{fetch:(input,init)=>fetch(input,{...init,redirect:'error',signal:AbortSignal.timeout(3000)})}});
}
export async function readOperationalHealth() {
  return readOperationalHealthFrom(database());
}
// This receipt proves only completion of the scheduler handler, not delivery of
// every job or email. Existing job/alert states remain the authoritative source.
export async function recordSchedulerCompletion() {
  if(process.env.SEED_OPERATIONS_ENABLED!=='true')return;
  try {
    const result=await database().from('operational_events').insert({request_id:randomUUID(),feature:'scheduler',code:'CRON_FINISHED',level:'INFO'});
    if(result.error)throw Error('HEARTBEAT_FAILED');
  } catch {logEvent('operations.scheduler',{code:'HEARTBEAT_FAILED'},'error');}
}
