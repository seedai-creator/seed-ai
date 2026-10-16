import 'server-only';
import {commercialDatabase} from '../commercial/server';
import {validId} from '../auth/validation';
import type {Locale} from '../i18n/config';
import {goalSnapshot,goalsEnabled} from '../goals/server';
import {radarGrowthSnapshot,growthContext} from '../growth/server';
import type {Dimension} from '../growth/domain';
import {radarEnabled,RADAR_CONFIG} from '../radar/domain';
import {radarPreferences,radarContext} from '../radar/server';
import {externalPreference} from '../external/server';
import {parseDiagnosis} from '../diagnosis/contracts';
import {EMPTY_EXECUTION,type ExecutionRow} from '../execution/domain';
import {aggregateCandidates,viewModel,type AggregationInput,type ConversationRecord,type DiagnosisRecord,type RadarRecord,type WeeklyRecord} from './aggregate';
import {cockpitEnabled,parseReference,type Candidate,type Reference,type ResolvedAction} from './domain';
import {acknowledgementKey,eventKey,requireCandidate,stamp} from './identity';
import {prioritize} from './priority';
import {cockpitText} from './format';

type Database=ReturnType<typeof commercialDatabase>;
type QueryResult<T>={data:T|null;error:unknown};
async function rows<T>(query:PromiseLike<QueryResult<T>>){const r=await query;if(r.error||r.data===null)throw Error('COCKPIT_SOURCE_FAILED');return r.data;}
async function authorized(company:string,user:string){
 if(!cockpitEnabled()||!validId(company)||!validId(user))throw Error('COCKPIT_ACCESS_DENIED');
 const db=commercialDatabase();const m=await db.from('company_members').select('user_id').eq('company_id',company).eq('user_id',user).maybeSingle();
 if(m.error||!m.data)throw Error('COCKPIT_ACCESS_DENIED');return db;
}

async function planSource(db:Database,company:string){
 const plans=await rows(db.from('strategies').select('*').eq('company_id',company).eq('status','ACTIVE').order('updated_at',{ascending:false}).order('id').limit(1));
 const actions=plans.length?await rows(db.from('actions').select('*').eq('company_id',company).eq('strategy_id',plans[0].id).order('position').order('id').limit(101)):[];
 // A truncated action list cannot safely establish dependencies or a next action.
 return {plans:plans as ExecutionRow[],actions:actions.length>100?[]:actions as ExecutionRow[],limited:actions.length>100};
}
async function conversationSource(db:Database,company:string,user:string){
 const conversations=await rows(db.from('conversations').select('id,title,version,updated_at').eq('company_id',company).eq('user_id',user).order('updated_at',{ascending:false}).limit(6));
 if(!conversations.length)return {conversation:null,diagnosis:null};
 const messages=await rows(db.from('messages').select('id,conversation_id,diagnosis,created_at').in('conversation_id',conversations.map(c=>c.id)).eq('role','assistant').not('diagnosis','is',null).order('created_at',{ascending:false}).limit(1));
 const row=messages[0],diagnosis=row?parseDiagnosis(row.diagnosis):null;
 return {conversation:conversations[0] as ConversationRecord,diagnosis:row&&diagnosis?{...row,company_id:company,diagnosis} as DiagnosisRecord:null};
}
async function decisionSource(db:Database,company:string,user:string,now:Date){
 const decisions=await rows(db.from('decisions').select('*').eq('company_id',company).is('reviewed_at',null).lte('review_date',now.toISOString().slice(0,10)).order('review_date').limit(6));
 if(!decisions.length)return [];
 const material=await rows(db.from('decision_simulations').select('decision_id').eq('company_id',company).eq('user_id',user).eq('status','ACCEPTED').in('materiality',['HIGH','CRITICAL']).in('decision_id',decisions.map(d=>d.id)).limit(6));
 return decisions.map(d=>({...d,cockpit_material:material.some(s=>s.decision_id===d.id)}));
}
async function radarSource(db:Database,company:string,user:string,now:Date){
 if(!radarEnabled())return [];
 const [pref,state,insights]=await Promise.all([
  radarPreferences(company,user),
  db.from('radar_company_state').select('generation,processed_generation,last_success_at').eq('company_id',company).maybeSingle(),
  rows(db.from('radar_insights').select('id,company_id,version,updated_at,attention,payload').eq('company_id',company).eq('status','READY').order('updated_at',{ascending:false}).limit(8))
 ]);
 if(state.error)throw Error('COCKPIT_SOURCE_FAILED');
 if(!pref.proactive_insights_enabled||pref.mute_until&&Date.parse(pref.mute_until)>now.getTime()||!state.data||state.data.generation!==state.data.processed_generation||!state.data.last_success_at||now.getTime()-Date.parse(state.data.last_success_at)>2*86400000)return [];
 const ids=insights.flatMap(i=>(i.payload.signals as RadarRecord['payload']['signals']).flatMap(s=>s.knowledge_source_scope==='EXTERNAL_INTELLIGENCE'?s.evidence.filter(e=>e.table==='external_research_runs').map(e=>e.id):[]));
 let currentExternal=new Set<string>();
 if(ids.length){
  const external=await externalPreference(company,user);
  if(external.enabled&&!external.sensitive_mode){
   const reports=await rows(db.from('external_research_runs').select('id,report').eq('company_id',company).in('id',[...new Set(ids)]).eq('status','COMPLETED').gt('expires_at',now.toISOString()).limit(32));
   currentExternal=new Set(reports.filter(r=>!r.report?.partial&&!r.report?.conflicts?.length&&r.report?.sources?.length).map(r=>r.id));
  }
 }
 return (insights as RadarRecord[]).map(i=>({...i,payload:{signals:i.payload.signals.filter(s=>s.knowledge_source_scope!=='EXTERNAL_INTELLIGENCE'||s.evidence.some(e=>e.table==='external_research_runs'&&currentExternal.has(e.id)))}}));
}

// Bounded independent source groups; unavailable sources do not disable the composer.
// No shared cache: every authorization and every explicit click sees current canonical records.
export async function loadCockpit(company:string,user:string,locale:Locale,now=new Date()){
 const started=performance.now(),db=await authorized(company,user);
 let partial=false;
 async function source<T>(name:string,work:PromiseLike<T>,fallback:T):Promise<T>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('COCKPIT_SOURCE_TIMEOUT')),8000);})]);}
  catch{partial=true;console.warn('[seed:cockpit]',{source:name,code:'SOURCE_UNAVAILABLE'});return fallback;}
  finally{clearTimeout(timer);}
 }
 const [plan,goals,growth,radar,weekly,history,memories,results,learnings,decisions]=await Promise.all([
  source('plan',planSource(db,company),{plans:[],actions:[],limited:false}),
  source('goals',goalsEnabled()?goalSnapshot(company,user,now):Promise.resolve(null),null),
  source('growth',radarGrowthSnapshot(company),null),
  source('radar',radarSource(db,company,user,now),[]),
  source('weekly',rows(db.from('weekly_intelligence_reports').select('id,company_id,generated_at,period_start,period_end,confidence,source_ids,structured_report').eq('company_id',company).eq('status','AVAILABLE').eq('locale',locale).order('generated_at',{ascending:false}).limit(1)),[]),
  source('conversation',conversationSource(db,company,user),{conversation:null,diagnosis:null}),
  source('memory',rows(db.from('business_memories').select('updated_at,deleted').eq('company_id',company).order('updated_at',{ascending:false}).limit(1)),[]),
  source('results',rows(db.from('execution_results').select('*').eq('company_id',company).in('status',['COLLECTED','VALIDATED','ANALYZED']).order('updated_at',{ascending:false}).limit(6)),[]),
  source('learnings',rows(db.from('execution_learnings').select('*').eq('company_id',company).eq('status','ACTIVE').order('updated_at',{ascending:false}).limit(6)),[]),
  source('decisions',decisionSource(db,company,user,now),[])
 ]);
 const input:AggregationInput={company,locale,now,known:!!(history.conversation||memories.some(m=>!m.deleted)||goals?.goals.length||plan.plans.length),partial:partial||!!goals?.limited||plan.limited,canConverse:true,goals:goals?.progress??[],scopes:goals?.entities??[],execution:{...EMPTY_EXECUTION,...plan,results:results as ExecutionRow[],learnings:learnings as ExecutionRow[],decisions:decisions as ExecutionRow[]},actionsLimited:plan.limited,growth,radar,weekly:weekly as WeeklyRecord[],conversation:history.conversation,diagnosis:history.diagnosis&&(!memories[0]||memories[0].updated_at<=history.diagnosis.created_at)?history.diagnosis:null};
 // Keep valid groups even if an older malformed record cannot be rendered.
 const candidates:Candidate[]=[];
 const empty={...input,goals:[],execution:null,growth:null,radar:[],weekly:[],diagnosis:null,conversation:null};
 const groups:AggregationInput[]=[{...empty,execution:input.execution},{...empty,goals:input.goals,execution:input.execution?{...EMPTY_EXECUTION,plans:input.execution.plans}:null},{...empty,growth},{...empty,radar},{...empty,weekly:input.weekly},{...empty,diagnosis:input.diagnosis},{...empty,conversation:input.conversation}];
 const seen=new Set<string>();
 for(const group of groups){try{for(const candidate of aggregateCandidates(group)){const key=candidate.item.ref.type+candidate.item.ref.id;if(!seen.has(key)){seen.add(key);candidates.push(stamp(candidate));}}}catch{input.partial=true;console.warn('[seed:cockpit]',{code:'INVALID_SOURCE'});}}
 // Suppress the same accepted plan's diagnosis even when loaded independently.
 const activePlan=input.execution?.plans[0];if(activePlan)for(const c of candidates)if(c.item.ref.type==='DIAGNOSIS')c.storyKeys.push('plan:'+activePlan.id);
 console.info('[seed:cockpit]',{event:'read',partial:input.partial,candidates:candidates.length,latencyMs:Math.round(performance.now()-started)});
 return {db,input,candidates};
}

export async function readCockpit(company:string,user:string,locale:Locale){
 const state=await loadCockpit(company,user,locale),{db,input,candidates}=state;
 const keys=candidates.filter(c=>c.item.dismissible).map(c=>acknowledgementKey(user,company,c.item.ref));
 if(keys.length){const r=await db.from('commercial_events').select('dedupe_key').eq('user_id',user).in('dedupe_key',keys);if(r.error)input.partial=true;else for(const c of candidates)c.acknowledged=r.data.some(e=>e.dedupe_key===acknowledgementKey(user,company,c.item.ref));}
 // Only displayed Radar items consume its existing delivery/cooldown budget.
 for(let attempt=0;attempt<8;attempt++){
  const radar=prioritize(candidates,company,input.now).find(c=>c.item.ref.type==='RADAR');if(!radar)break;
  const r=await db.rpc('radar_surface',{p_user:user,p_company:company,p_id:radar.item.ref.id,p_version:radar.radarVersion,p_daily:RADAR_CONFIG.dailyBudget,p_cooldown:RADAR_CONFIG.cooldownHours});
  if(!r.error&&r.data)break;radar.acknowledged=true;if(r.error)input.partial=true;
 }
 return viewModel(input,candidates);
}

export const EVENTS=['home_viewed','composer_started','quick_action_clicked','continue_plan_clicked','goal_opened','diagnosis_opened','radar_insight_opened','weekly_intelligence_opened','growth_map_opened','cockpit_item_dismissed'] as const;
export type CockpitEvent=typeof EVENTS[number];
async function writeEvent(db:Database,user:string,company:string,event:CockpitEvent,ref?:Reference,ack=false){
 const account=await db.from('commercial_accounts').select('market_code').eq('user_id',user).maybeSingle();
 if(account.error)return;
 const key=ack&&ref?acknowledgementKey(user,company,ref):eventKey(user,company,event,new Date().toISOString().slice(0,13),ref);
 const r=await db.from('commercial_events').upsert({user_id:user,market_code:account.data?.market_code??null,event,dedupe_key:key},{onConflict:'dedupe_key',ignoreDuplicates:true});
 if(r.error)console.warn('[seed:cockpit]',{code:'EVENT_UNAVAILABLE'});
}
export async function recordCockpitEvent(company:string,user:string,event:CockpitEvent){
 const db=await authorized(company,user);if(!['home_viewed','composer_started','quick_action_clicked'].includes(event))throw Error('COCKPIT_EVENT_INVALID');await writeEvent(db,user,company,event);
}
export async function resolveCockpit(company:string,user:string,locale:Locale,raw:unknown,dismiss=false):Promise<ResolvedAction>{
 const ref=parseReference(raw),{db,candidates}=await loadCockpit(company,user,locale),c=requireCandidate(candidates,company,ref,new Date());
 if(dismiss&&!c.item.dismissible)throw Error('COCKPIT_REFERENCE_INVALID');
 if(c.item.ref.type==='RADAR'){
  const r=await db.rpc('radar_feedback',{p_user:user,p_company:company,p_insight:ref.id,p_action:dismiss?'DISMISSED':'INVESTIGATING',p_feedback:null});if(r.error)throw Error('COCKPIT_CONTEXT_CHANGED');
 }
 const event:CockpitEvent=dismiss?'cockpit_item_dismissed':ref.type==='PLAN'?'continue_plan_clicked':ref.type==='GOAL'?'goal_opened':ref.type==='GROWTH'?'growth_map_opened':ref.type==='RADAR'?'radar_insight_opened':ref.type==='WEEKLY'?'weekly_intelligence_opened':'diagnosis_opened';
 await writeEvent(db,user,company,event,ref,c.item.dismissible);
 return {reference:ref,destination:c.item.destination,prompt:cockpitText(locale)('prompt'),conversationId:c.conversationId??null,planId:c.planId??null};
}

export async function cockpitContext(company:string,user:string,locale:Locale,raw:unknown){
 const ref=parseReference(raw),{candidates}=await loadCockpit(company,user,locale),c=requireCandidate(candidates,company,ref,new Date());
 if(c.item.ref.type==='RADAR')return {rows:await radarContext(company,user,'',ref.id),planId:c.planId};
 if(c.item.ref.type==='GROWTH')return {rows:await growthContext(company,user,'',ref.id,c.growthDimension as Dimension),planId:c.planId};
 return {rows:c.context,planId:c.planId};
}
