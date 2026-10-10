'use server';
import {after} from 'next/server';
import {createHash,randomUUID} from 'node:crypto';
import {authorizeChat,companyContext} from '@/lib/auth/context';
import {commercialDatabase,commercialContextForUser,requireAdmin} from '@/lib/commercial/server';
import {validId} from '@/lib/auth/validation';
import {externalEnabled,type ResearchView,type ResearchPlan} from '@/lib/external/domain';
import {externalPreference,processExternalJob,externalObservability} from '@/lib/external/server';
import {resolveBusinessContext} from '@/lib/business-model/server';
import {OpenAIWebSearchProvider} from '@/lib/external/provider';
import {settleExternal} from '@/lib/external/meter';
import {externalLabels} from '@/lib/external/labels';
async function context(company:string){await authorizeChat({companyId:company});const c=await companyContext(company);if(!externalEnabled())throw Error('EXTERNAL_DISABLED');return {...c,db:commercialDatabase()};}
export async function readExternalPreference(company:string){const c=await context(company);return externalPreference(c.companyId,c.userId);}
export async function setExternalPreference(company:string,enabled:boolean,sensitive:boolean){
 const c=await context(company);if(typeof enabled!=='boolean'||typeof sensitive!=='boolean')throw Error('EXTERNAL_INVALID_INPUT');
 const r=await c.db.from('external_preferences').upsert({company_id:c.companyId,user_id:c.userId,enabled,sensitive_mode:sensitive,updated_at:new Date().toISOString()},{onConflict:'company_id,user_id'});if(r.error)throw Error('EXTERNAL_SAVE_FAILED');
 if(!enabled||sensitive){const runs=await c.db.from('external_research_runs').select('id').eq('company_id',c.companyId).eq('user_id',c.userId).in('status',['QUEUED','RUNNING']);for(const row of runs.data??[])await cancelExternalResearch(company,row.id);await c.db.from('external_watchlist').update({enabled:false}).eq('company_id',c.companyId).eq('user_id',c.userId);}
 await c.db.from('external_events').insert({company_id:c.companyId,user_id:c.userId,kind:enabled?'web_search_enabled':'user_disabled_web_search'});
}
export async function readExternalResearch(company:string,conversation:string){
 const c=await context(company);if(!validId(conversation))throw Error('EXTERNAL_INVALID_INPUT');
 const rows=await c.db.from('external_research_runs').select('id,status,depth,created_at,completed_at,expires_at,report,error_code,feedback').eq('company_id',c.companyId).eq('user_id',c.userId).eq('conversation_id',conversation).order('created_at',{ascending:false}).limit(5);if(rows.error)throw Error('EXTERNAL_READ_FAILED');
 const pending=rows.data.find(r=>['QUEUED','RUNNING'].includes(r.status));if(pending)after(()=>processExternalJob(pending.id));return rows.data as ResearchView[];
}
export async function cancelExternalResearch(company:string,id:string){
 const c=await context(company);if(!validId(id))throw Error('EXTERNAL_INVALID_INPUT');
 const r=await c.db.from('external_research_runs').update({status:'CANCELLED',updated_at:new Date().toISOString()}).eq('id',id).eq('company_id',c.companyId).eq('user_id',c.userId).in('status',['QUEUED','RUNNING']).select('id').maybeSingle();if(r.error)throw Error('EXTERNAL_CANCEL_FAILED');if(!r.data)return;
 const job=await c.db.from('external_research_jobs').select('provider_state,plan').eq('run_id',id).eq('company_id',c.companyId).single();
 await c.db.from('external_research_jobs').update({lease_token:null,lease_until:null,internal_context:'',evidence:null}).eq('run_id',id).eq('company_id',c.companyId);
 if(job.data?.provider_state?.id){try{const response=await new OpenAIWebSearchProvider().cancel(job.data.provider_state.id);await settleExternal(job.data.provider_state.charge,response);}catch{await settleExternal(job.data.provider_state.charge,null);}}
 await c.db.from('external_events').insert({company_id:c.companyId,user_id:c.userId,run_id:id,kind:'external_research_cancelled'});
}
export async function externalFeedback(company:string,id:string,feedback:'USEFUL'|'NOT_USEFUL'|'STALE'|'WRONG_MARKET'){
 const c=await context(company);if(!validId(id)||!['USEFUL','NOT_USEFUL','STALE','WRONG_MARKET'].includes(feedback))throw Error('EXTERNAL_INVALID_INPUT');
 const r=await c.db.from('external_research_runs').update({feedback,...(['STALE','WRONG_MARKET'].includes(feedback)?{expires_at:new Date(0).toISOString()}:{}),updated_at:new Date().toISOString()}).eq('id',id).eq('company_id',c.companyId).eq('user_id',c.userId).select('id').single();if(r.error)throw Error('EXTERNAL_SAVE_FAILED');
 await c.db.from('external_events').insert({company_id:c.companyId,user_id:c.userId,run_id:id,kind:'research_feedback',metadata:{feedback}});
}
export async function researchSourcesViewed(company:string,id:string){const c=await context(company);if(!validId(id))return;const run=await c.db.from('external_research_runs').select('id').eq('id',id).eq('company_id',c.companyId).eq('user_id',c.userId).maybeSingle();if(run.data)await c.db.from('external_events').insert({company_id:c.companyId,user_id:c.userId,run_id:id,kind:'sources_viewed'});}
export async function refreshExternalResearch(company:string,id:string){
 const c=await context(company);if(!validId(id))throw Error('EXTERNAL_INVALID_INPUT');
 const old=await c.db.from('external_research_runs').select('conversation_id,locale').eq('id',id).eq('company_id',c.companyId).eq('user_id',c.userId).single();const job=await c.db.from('external_research_jobs').select('plan').eq('run_id',id).eq('company_id',c.companyId).single();if(old.error||job.error||!old.data.conversation_id)throw Error('EXTERNAL_UNAVAILABLE');
 const plan=job.data.plan as ResearchPlan;const conversation=await c.db.from('conversations').select('version').eq('id',old.data.conversation_id).eq('user_id',c.userId).eq('company_id',c.companyId).single();if(conversation.error)throw Error('EXTERNAL_ACCESS_DENIED');
 const business=await resolveBusinessContext(c.companyId,c.userId,plan.query),memory=JSON.stringify(business.rows),run=randomUUID(),l=externalLabels(old.data.locale);
 const r=await c.db.rpc('queue_external_research',{p_user:c.userId,p_company:c.companyId,p_run:run,p_conversation:old.data.conversation_id,p_request:randomUUID(),p_version:conversation.data.version,p_message:l.refresh+': '+plan.subject,p_answer:l.queued,p_plan:plan,p_context:memory,p_cache_key:createHash('sha256').update(JSON.stringify({plan,memory})).digest('hex')});if(r.error)throw Error('EXTERNAL_REFRESH_LIMIT');after(()=>processExternalJob(run));return {version:conversation.data.version+1};
}
export async function confirmExternalCompetitor(company:string,domain:string,confirmed:boolean){const c=await context(company);if(typeof domain!=='string'||domain.length>200||typeof confirmed!=='boolean')throw Error('EXTERNAL_INVALID_INPUT');const r=await c.db.from('external_competitors').update({relationship:confirmed?'CONFIRMED':'REJECTED',updated_at:new Date().toISOString()}).eq('company_id',c.companyId).eq('domain',domain).select('id').single();if(r.error)throw Error('EXTERNAL_SAVE_FAILED');}
export async function setExternalWatch(company:string,id:string,reason:string,enabled:boolean){
 const c=await context(company);if(!validId(id)||typeof enabled!=='boolean'||typeof reason!=='string'||reason.length<5||reason.length>500)throw Error('EXTERNAL_INVALID_INPUT');
 const commercial=await commercialContextForUser({id:c.userId});if(enabled&&commercial.plan.code!=='PRO')throw Error('PRO_REQUIRED');
 const run=await c.db.from('external_research_runs').select('id,status,report').eq('id',id).eq('company_id',c.companyId).eq('user_id',c.userId).single();if(run.error||!['COMPLETED','PARTIAL'].includes(run.data.status))throw Error('EXTERNAL_UNAVAILABLE');
 const r=await c.db.from('external_watchlist').upsert({company_id:c.companyId,user_id:c.userId,run_id:id,reason,enabled,next_run_at:new Date(Date.now()+7*86400000).toISOString()},{onConflict:'company_id,user_id,run_id'});if(r.error)throw Error('EXTERNAL_SAVE_FAILED');
}
export async function readExternalAdmin(){await requireAdmin();return externalObservability();}
