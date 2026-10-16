import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {commercialDatabase,commercialContextForUser} from '../commercial/server';
import {resolveBusinessContext} from '../business-model/server';
import {externalPreference} from './server';
import {externalEnabled,type ResearchPlan,type ResearchReport} from './domain';
import {externalChangeSignal} from './watch-signal';
export async function queueExternalWatches(){
 if(!externalEnabled())return;const db=commercialDatabase();const result=await db.rpc('claim_external_watch');if(result.error)throw Error('EXTERNAL_WATCH_UNAVAILABLE');const watch=result.data?.[0];if(!watch)return;
 const pref=await externalPreference(watch.company_id,watch.user_id),c=await commercialContextForUser({id:watch.user_id});if(!pref.enabled||pref.sensitive_mode||c.plan.code!=='PRO')return;
 const old=await db.from('external_research_jobs').select('plan').eq('run_id',watch.run_id).eq('company_id',watch.company_id).single();if(old.error)throw Error('EXTERNAL_WATCH_PLAN');
 const plan=old.data.plan as ResearchPlan;const business=await resolveBusinessContext(watch.company_id,watch.user_id,plan.query);const memory=JSON.stringify(business.rows);
 const created=await db.rpc('enqueue_external_watch_run',{p_watch:watch.id,p_run:randomUUID(),p_plan:plan,p_context:memory,p_cache_key:createHash('sha256').update(watch.id+plan.query).digest('hex')});if(created.error)throw Error('EXTERNAL_WATCH_QUEUE');
}
export async function externalRadarSignals(company:string){
 if(!externalEnabled())return [];const db=commercialDatabase();const watches=await db.from('external_watchlist').select('*').eq('company_id',company).eq('enabled',true).limit(20);if(watches.error)throw Error('EXTERNAL_WATCH_UNAVAILABLE');const out=[];
 for(const w of watches.data){
 if(!w.previous_result_id||!w.last_result_id)continue;
 const pref=await externalPreference(company,w.user_id);if(!pref.enabled||pref.sensitive_mode)continue;
 const r=await db.from('external_research_runs').select('id,report,feedback').eq('company_id',company).in('id',[w.previous_result_id,w.last_result_id]).in('status',['COMPLETED','PARTIAL']);if(r.error)continue;
 const previous=r.data.find(r=>r.id===w.previous_result_id),current=r.data.find(r=>r.id===w.last_result_id);if(!previous?.report||!current?.report||current.feedback==='WRONG_MARKET'||current.feedback==='STALE')continue;
 const confirmed=await db.from('external_competitors').select('domain').eq('company_id',company).eq('relationship','CONFIRMED');
 const signal=externalChangeSignal(w.id,w.reason,w.last_result_id,previous.report as ResearchReport,current.report as ResearchReport,confirmed.data?.map(c=>c.domain)??[]);if(signal)out.push(signal);
 }
 return out;
}
