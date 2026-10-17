import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {accessEvidence} from './access-retention';

function database(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)throw new Error('ACCESS_STORE_UNAVAILABLE');
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},
    global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(5000)})}});
}
export async function recordApplicationAccess(headers:Headers,pathname:string){
  const evidence=accessEvidence(headers,pathname,{enabled:process.env.SEED_ACCESS_RETENTION_ENABLED,vercel:process.env.VERCEL});
  if(!evidence)return;
  const {error}=await database().rpc('record_application_access',{p_id:randomUUID(),p_ip:evidence.ip});
  if(error)throw new Error('ACCESS_STORE_UNAVAILABLE');
}
export async function processAccessRetention(){
  if(process.env.SEED_ACCESS_RETENTION_ENABLED!=='true')return;
  const {error}=await database().rpc('prune_application_access',{p_dry_run:false,p_batch:1000});
  if(error)throw new Error('ACCESS_RETENTION_FAILED');
}
