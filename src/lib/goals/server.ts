import 'server-only';
import {commercialDatabase} from '../commercial/server';
import {validId} from '../auth/validation';
import {businessDay,EMPTY_AMOUNT,COMPANY_SCOPE,periodShape,validateGoal,validateObservation,goalMissing,type Goal,type Observation,type ObservationData,type GoalSpec} from './domain';
import {deriveMetric,FORMULAS,goalProgress} from './calculation';
import {METRIC_CATALOG} from './ingestion';
import type {StoredObservation,Entity} from '../business-model/domain';
import {executionObservation,type ExecutionMetric} from './execution';
import {buildGoalContext} from './context';
export const goalsEnabled=()=>process.env.SEED_GOALS_ENABLED==='true'&&process.env.SEED_JOURNAL_ENABLED==='true';
type JournalRow={id:string;company_id:string;metric_type:string;value:number|null;unit:string;currency_code:string|null;period_start:string|null;period_end:string|null;confidence:Observation['confidence'];source_type:string;source_message_id:string|null;version:number;created_at:string;updated_at:string;channel:string|null;product:string|null;location:string|null;metric_data:ObservationData|null};
async function member(company:string,user:string){if(!validId(company)||!validId(user))throw Error('GOAL_ACCESS_DENIED');const db=commercialDatabase(),m=await db.from('company_members').select('user_id').eq('company_id',company).eq('user_id',user).maybeSingle();if(m.error||!m.data)throw Error('GOAL_ACCESS_DENIED');return db;}
export function journalObservation(r:JournalRow):Observation{
 const d=r.metric_data;
 return {...(d??{metric:r.metric_type,boolean:null,text:null,unit:r.unit,currency:r.currency_code,period:periodShape(r.period_start,r.period_end),start:r.period_start,end:r.period_end,complete:periodShape(r.period_start,r.period_end)!=='CUSTOM_RANGE',scope:r.product?{type:'PRODUCT' as const,id:r.product}:r.channel?{type:'CHANNEL' as const,id:r.channel}:r.location?{type:'LOCATION' as const,id:r.location}:COMPANY_SCOPE,confidence:r.confidence,source:r.source_type==='MANUAL'?'MANUAL_EDIT' as const:'JOURNAL' as const,quality:'VALID' as const,attribution:null}),amount:{...(d?.amount??EMPTY_AMOUNT),value:r.value===null?null:Number(r.value)},id:r.id,company_id:r.company_id,version:r.version,observed_at:r.updated_at??r.created_at,source_message_id:r.source_message_id,source_table:'business_journal_entries'};
}
function businessObservation(o:StoredObservation,entities:Entity[]):Observation|null{
 const e=entities.find(e=>e.id===o.entity_id);if(!e||e.reference_id&&e.type!=='COMPANY'||!['FACT','METRIC','DERIVED_METRIC'].includes(o.kind))return null;
 const metric=o.attribute==='ticket'?'average_ticket':o.attribute;if(!METRIC_CATALOG.some(m=>m.code===metric))return null;
 const map={LOCATION:'LOCATION',PRODUCT_SERVICE:'PRODUCT',CHANNEL:'CHANNEL',TEAM:'TEAM',OPERATION:'OPERATION',SALES_PROCESS:'SALES_PROCESS',CUSTOMER_SEGMENT:'CUSTOMER_SEGMENT'} as const;
 const scope=e.type==='COMPANY'?COMPANY_SCOPE:map[e.type as keyof typeof map]?{type:map[e.type as keyof typeof map],id:e.id}:null;if(!scope)return null;
 return {id:o.id,company_id:o.company_id,version:o.version,metric,amount:{value:o.data.value,min:o.data.min,max:o.data.max,approximate:o.data.approximate},boolean:null,text:null,unit:o.data.unit??'unknown',currency:o.data.currency,period:periodShape(o.data.period_start,o.data.period_end),start:o.data.period_start,end:o.data.period_end,complete:periodShape(o.data.period_start,o.data.period_end)!=='UNKNOWN'&&periodShape(o.data.period_start,o.data.period_end)!=='CUSTOM_RANGE',scope,confidence:o.confidence,source:o.source_type as Observation['source'],quality:o.state==='CONFIRMED'?'VALID':o.state==='CONFLICTING'?'CONFLICTING':o.state==='STALE'?'STALE':'PROVISIONAL',observed_at:o.observed_at,source_table:'business_observations',source_message_id:o.source_message_id,attribution:null};
}
export async function goalSnapshot(company:string,user:string,now=new Date()){
 const db=await member(company,user);
 const [g,j,b,e,c,m,plans,actions,results,jobs]=await Promise.all([
  db.from('goals').select('*').eq('company_id',company).order('updated_at',{ascending:false}).limit(41),
  db.from('metric_observations').select('*').eq('company_id',company).order('period_end',{ascending:false,nullsFirst:false}).limit(301),
  db.from('business_observations').select('*').eq('company_id',company).in('kind',['FACT','METRIC','DERIVED_METRIC']).order('observed_at',{ascending:false}).limit(201),
  db.from('business_entities').select('*').eq('company_id',company).eq('status','ACTIVE').limit(200),
  db.from('companies').select('timezone,locale,preferred_language').eq('id',company).single(),
  db.from('business_memories').select('id,value,kind,deleted').eq('company_id',company).in('kind',['GOAL','CONSTRAINT']).order('updated_at',{ascending:false}).limit(100),
  db.from('strategies').select('id,name,current_focus,goal_id,status').eq('company_id',company).order('created_at',{ascending:false}).limit(30),
  db.from('actions').select('id,title,strategy_id,status,position').eq('company_id',company).in('status',['TODO','IN_PROGRESS','BLOCKED']).order('position').limit(60),
  db.from('execution_results').select('*').eq('company_id',company).order('created_at',{ascending:false}).limit(101),
  db.from('journal_jobs').select('status,goals_payload,created_at').eq('company_id',company).eq('kind','EXTRACTION').order('created_at',{ascending:false}).limit(1)]);
 if(g.error||j.error||b.error||e.error||c.error||m.error||plans.error||actions.error||results.error||jobs.error)throw Error('GOAL_READ_FAILED');
 const goals=(g.data as Goal[]).filter(goal=>!m.data.some(memory=>memory.id===goal.id&&memory.deleted)).slice(0,40);
 const journal=(j.data as JournalRow[]).slice(0,300).map(journalObservation);
 const corrected=new Set(b.data.filter(o=>o.operation==='CORRECTION').map(o=>o.supersedes));
 const business=(b.data as StoredObservation[]).filter(o=>!corrected.has(o.id)).slice(0,200).map(o=>businessObservation(o,e.data as Entity[])).filter((o):o is Observation=>!!o);
 const observations=[...journal,...business.filter(o=>!journal.some(j=>o.source_message_id&&j.source_message_id===o.source_message_id&&j.metric===o.metric))];
 observations.push(...(results.data as ExecutionMetric[]).slice(0,100).map(r=>executionObservation(r,observations)).filter((o):o is Observation=>!!o));
 // Derived results are read models with versioned input traces, never a second observation ledger.
 for(const formula of Object.keys(FORMULAS) as (keyof typeof FORMULAS)[]){const def=FORMULAS[formula];for(const a of observations.filter(o=>o.metric===def.inputs[0]).slice(0,24))for(const b of observations.filter(o=>o.metric===def.inputs[1]).slice(0,24)){const derived=deriveMetric(formula,a,b,now);if(derived)observations.push(derived);}}
 const limited=g.data.length>40||j.data.length>300||b.data.length>200||results.data.length>100||m.data.length===100||e.data.length===200||plans.data.length===30||actions.data.length===60;
 const today=c.data.timezone?businessDay(c.data.timezone,now):null;
 return {goals,observations,plans:plans.data,actions:actions.data,ingestionNeedsReview:!!jobs.data[0]?.goals_payload?.rejected?.length,ingestionPending:!!jobs.data[0]&&['QUEUED','RUNNING','READY'].includes(jobs.data[0].status),progress:today?goals.map(goal=>({goal,progress:goalProgress(goal,observations,today,limited)})):[],limited,timezone:c.data.timezone as string|null,locale:c.data.preferred_language??c.data.locale??'en-US',memories:m.data.filter(x=>x.kind==='GOAL'&&!x.deleted&&!goals.some(g=>g.id===x.id)).map(x=>({id:x.id,value:x.value})),constraints:m.data.filter(x=>x.kind==='CONSTRAINT'&&!x.deleted).map(x=>({id:x.id,value:x.value})),entities:e.data.map(e=>({id:e.id,type:e.type,name:e.name}))};
}
export type GoalSnapshot=Awaited<ReturnType<typeof goalSnapshot>>;
export async function goalContext(company:string,user:string,question:string){
 if(!goalsEnabled())return [];const s=await goalSnapshot(company,user);return buildGoalContext(s.progress,s.observations,s.constraints,question);
}
async function definitions(company:string){const r=await commercialDatabase().from('metric_definitions').upsert(METRIC_CATALOG.map(d=>({code:d.code,name:d.name,unit:d.unit,metric_type:d.type,company_id:company})),{onConflict:'company_id,code',ignoreDuplicates:true});if(r.error)throw Error('METRIC_DEFINITIONS_FAILED');}
export async function saveGoal(company:string,user:string,id:string|null,version:number,raw:unknown,status:Goal['status'],reason:string,key:string){
 const db=await member(company,user),spec=validateGoal(raw);if(id&&!validId(id)||!Number.isSafeInteger(version)||version<0||!validId(key)||reason.trim().length<1||reason.length>500)throw Error('GOAL_INVALID');
 const s=await goalSnapshot(company,user);if(!s.timezone)throw Error('GOAL_TIMEZONE_REQUIRED');
 if(status==='ACTIVE'&&goalMissing(spec).length)throw Error('GOAL_INCOMPLETE');
 if(status==='ACHIEVED'||status==='MISSED'){const g=s.goals.find(g=>g.id===id);if(!g||goalProgress({...g,spec},s.observations,businessDay(s.timezone)).trajectory!==status)throw Error('GOAL_COMPLETION_UNSUPPORTED');}
 await definitions(company);const r=await db.rpc('save_goal',{p_user:user,p_company:company,p_id:id,p_version:version,p_spec:spec,p_status:status,p_reason:reason,p_source:null,p_key:key,p_timezone:s.timezone,p_locale:s.locale});if(r.error)throw Error('GOAL_SAVE_FAILED');return r.data as string;
}
export async function recordMetric(company:string,user:string,id:string|null,version:number,raw:unknown,reason:string,key:string){
 const db=await member(company,user),data=validateObservation(raw);if(id&&!validId(id)||!validId(key)||!Number.isSafeInteger(version)||version<0||!reason.trim()||reason.length>500||data.source!=='MANUAL_EDIT'||!METRIC_CATALOG.some(d=>d.code===data.metric&&d.unit===data.unit))throw Error('METRIC_INVALID');
 await definitions(company);const r=await db.rpc('record_goal_metric',{p_user:user,p_company:company,p_id:id,p_version:version,p_data:data,p_description:reason,p_evidence:reason,p_source:null,p_key:key});if(r.error)throw Error('METRIC_SAVE_FAILED');return r.data as string;
}
export async function metricSeries(company:string,user:string,metric:string,offset=0){const db=await member(company,user);if(!/^[a-z][a-z0-9_]{1,79}$/.test(metric)||!Number.isSafeInteger(offset)||offset<0||offset>10000)throw Error('METRIC_FILTER_INVALID');const r=await db.from('metric_observations').select('*').eq('company_id',company).eq('metric_type',metric).order('period_end',{ascending:false}).order('id').range(offset,offset+49);if(r.error)throw Error('METRIC_READ_FAILED');return (r.data as JournalRow[]).map(journalObservation);}
export async function goalHistory(company:string,user:string,id:string){const db=await member(company,user);if(!validId(id))throw Error('GOAL_INVALID');const r=await db.from('goal_events').select('kind,snapshot,reason,created_at').eq('company_id',company).eq('goal_id',id).order('created_at',{ascending:false}).limit(30);if(r.error)throw Error('GOAL_READ_FAILED');return r.data;}
export type {GoalSpec};
