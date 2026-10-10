import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {ChatError} from '../chat/contracts';
import {logEvent} from './logging';
export const operationsEnabled=()=>process.env.SEED_OPERATIONS_ENABLED==='true';
export async function operationControls(db:SupabaseClient) {
  const result=await db.from('operations_controls').select('*').eq('id',true).single();
  if(result.error||!result.data)throw new ChatError(503,'OPERATIONS_UNAVAILABLE','O serviço está temporariamente indisponível. Tente novamente.');
  return result.data as {closed_beta:boolean;disable_ai:boolean;disable_uploads:boolean;paused_features:string[];blocked_models:string[];version:number};
}
export async function guardBackgroundAccess(db:SupabaseClient,userId:string) {
  if(!operationsEnabled())return;
  const controls=await operationControls(db);
  const [access,role]=await Promise.all([db.from('beta_access').select('disabled,expires_at').eq('user_id',userId).maybeSingle(),db.from('admin_roles').select('role').eq('user_id',userId).maybeSingle()]);
  if(access.error||role.error)throw new ChatError(503,'OPERATIONS_UNAVAILABLE','O serviço está temporariamente indisponível.');
  if(access.data?.disabled||(controls.closed_beta&&!role.data&&(!access.data||Date.parse(access.data.expires_at)<=Date.now())))throw new ChatError(403,'BETA_ACCESS_REQUIRED','O acesso ao beta precisa ser liberado. Entre em contato pelo suporte.');
}
export async function guardAiOperation(db:SupabaseClient,feature:string,model:string) {
  if(!operationsEnabled())return;
  const result=await db.rpc('operations_can_call_ai',{p_feature:feature,p_model:model});
  if(result.error||result.data!==true)throw new ChatError(503,'AI_PAUSED','As análises estão pausadas. Seus dados continuam disponíveis.');
}
export async function recordOperation(db:SupabaseClient,data:{request_id?:string;user_id?:string;company_id?:string;feature:string;code:string;level:'INFO'|'WARN'|'ERROR';duration_ms?:number}) {
  if(!operationsEnabled())return;
  try{const result=await db.from('operational_events').upsert(data,{onConflict:'request_id,feature,code',ignoreDuplicates:true});if(result.error)throw Error('EVENT_FAILED');}
  catch{logEvent('operations.record_failed',{code:'EVENT_FAILED',feature:data.feature},'warn');}
}
