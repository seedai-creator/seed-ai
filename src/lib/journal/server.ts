import {growthContext} from '../growth/server';
import {externalContext} from '../external/server';
import {goalsEnabled,goalSnapshot,goalContext} from '../goals/server';
import {normalizeIngestion,METRIC_CATALOG} from '../goals/ingestion';
import {radarEnabled} from '../radar/domain';
import {normalizeWatches,type WatchMemory} from '../radar/watches';
import {radarWeekly} from '../radar/server';
import "server-only";
import {builderContext,builderPayload,processBusinessModelJob} from '../business-model/server';
import {normalizeModelBatch} from '../business-model/domain';
import OpenAI from "openai";
import { ChatError } from "../chat/contracts";
import { createHash } from "node:crypto";
import { commercialDatabase } from "../commercial/server";
import { meteredCompletion } from "../commercial/metering";
import { localDay,shiftDay,periodBounds,normalizeExtraction,type Entry,type EntityRef } from "./domain";
import { extractionRequest,weeklyRequest } from "./requests";
import { eligibility,weeklyMetrics,compareWeeks,validateWeekly,GENERATION_VERSION,type Window } from "./weekly";

export const journalEnabled=()=>process.env.SEED_JOURNAL_ENABLED==="true";
const numberSetting=(name:string,fallback:number,max:number)=>{const v=Number(process.env[name]??fallback);return Number.isSafeInteger(v)&&v>0&&v<=max?v:fallback;};
export async function journalRows(company:string,window?:Window,offset=0,chronological=false):Promise<Entry[]> {
 const db=commercialDatabase();
 let query=db.from("business_journal_entries").select("*").eq("company_id",company).eq("status","ACTIVE");
 if(window)query=query.gte("period_start",window.start).lte("period_end",window.end);
 if(chronological)query=query.order("event_date",{ascending:false,nullsFirst:false});
 const result=await query.order("created_at",{ascending:false}).order("id").range(offset,offset+(window?200:39));
 if(result.error)throw Error("JOURNAL_READ_FAILED");
 if(window&&result.data.length>200)throw Error("WEEKLY_CONTEXT_LIMIT");
 return result.data.map(e=>({...e,value:e.value===null?null:Number(e.value)})) as Entry[];
}
export async function queueWeekly(company:string,user:string,current=false) {
 if(!journalEnabled())return "DISABLED";
 const db=commercialDatabase();
 const member=await db.from("company_members").select("user_id").eq("company_id",company).eq("user_id",user).maybeSingle();
 if(member.error||!member.data)throw Error("JOURNAL_ACCESS_DENIED");
 const access=await db.rpc("commercial_usage",{p_user:user,p_window:"lifetime"});
 if(access.error||!access.data)throw Error("JOURNAL_PLAN_UNAVAILABLE");
 if(access.data.plan!=="PRO")return "PRO_REQUIRED";
 const c=await db.from("companies").select("timezone,preferred_language,locale").eq("id",company).single();
 if(c.error)throw Error("JOURNAL_COMPANY_UNAVAILABLE");
 const day=localDay(new Date(),c.data.timezone);
 if(!day)return "TIMEZONE_REQUIRED";
 const [start,end]=periodBounds(current?"THIS_WEEK":"LAST_WEEK",day);
 const window={start:start!,end:end!};
 const rows=await journalRows(company,window);
 const selection=eligibility(rows,window,numberSetting("SEED_WEEKLY_MIN_EVENTS",3,200),numberSetting("SEED_WEEKLY_MIN_DAYS",2,7));
 if(!selection.eligible)return "INSUFFICIENT";
 const goalVersions=goalsEnabled()?await db.from('goals').select('id,version').eq('company_id',company).in('status',['ACTIVE','DRAFT']).limit(40):null;if(goalVersions?.error)throw Error('GOAL_READ_FAILED');
 const fingerprint=createHash("sha256").update(JSON.stringify([...rows.map(e=>[e.id,e.version]),...(goalVersions?.data??[]).map(g=>[g.id,g.version])].sort())).digest("hex");
 const context={...window,timezone:c.data.timezone,locale:c.data.preferred_language??c.data.locale??"en-US",fingerprint,current};
 const result=await db.from("journal_jobs").upsert({company_id:company,user_id:user,kind:"WEEKLY",dedupe_key:`weekly:${company}:${start}:${end}:${fingerprint}:${goalsEnabled()?'10.0.0':GENERATION_VERSION}`,context},{onConflict:"dedupe_key",ignoreDuplicates:true});
 if(result.error)throw Error("WEEKLY_QUEUE_FAILED");
 return "QUEUED";
}
// One bounded job per invocation; after() awaits this and a protected scheduled endpoint drains retries.
export async function processJournalJob(company?:string) {
 if(!journalEnabled())return;
 const db=commercialDatabase();
 const claimed=await db.rpc("claim_journal_job",{p_company:company??null});
 if(claimed.error)throw Error("JOURNAL_CLAIM_FAILED");
 const job=claimed.data?.[0];if(!job)return;
 let providerStarted=false,persisted=!!job.payload;
 try {
  const member=await db.from("company_members").select("user_id").eq("company_id",job.company_id).eq("user_id",job.user_id).maybeSingle();
  if(member.error||!member.data)throw Error("JOURNAL_ACCESS_DENIED");
  if(!persisted){
   const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,timeout:55000,maxRetries:0});
   const complete=await meteredCompletion(client,job.company_id,job.id,job.user_id);
   let radarPayload:ReturnType<typeof normalizeWatches>=[];
   let payload:unknown,modelPayload:unknown=null,modelCandidate:unknown=null,modelError:string|null=null,goalsPayload:unknown=null;
   if(job.kind==="EXTRACTION"){
    const source=await db.from("messages").select("content,role,conversation_id").eq("id",job.source_message_id).single();
    if(source.error||source.data.role!=="user")throw Error("JOURNAL_SOURCE_UNAVAILABLE");
    const recent=await journalRows(job.company_id);
    const entities: (EntityRef&{label:string})[]=[];
    for(const [table,type,label] of [["strategies","STRATEGY","name"],["actions","ACTION","title"],["decisions","DECISION","decision"],["experiments","EXPERIMENT","name"]] as const){
     const result=await db.from(table).select("id,"+label).eq("company_id",job.company_id).order("created_at",{ascending:false}).limit(4);
     if(result.error)throw Error("JOURNAL_RELATIONS_UNAVAILABLE");
     for(const item of result.data as unknown as Record<string,string>[])entities.push({type,id:item.id,label:item[label]});
    }
    const diagnosis=await db.from("messages").select("id,diagnosis").eq("conversation_id",source.data.conversation_id).not("diagnosis","is",null).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(diagnosis.data)entities.push({type:"DIAGNOSIS",id:diagnosis.data.id,label:diagnosis.data.diagnosis.main_bottleneck??diagnosis.data.diagnosis.situation});
    const referenceDay=localDay(new Date(job.context.at),job.context.timezone);
    const business_context=await builderContext(job.company_id,job.user_id);
    const goalState=goalsEnabled()?await goalSnapshot(job.company_id,job.user_id):null;
    const radarMemories=radarEnabled()?await db.from('business_memories').select('id,version,kind,value,evidence').eq('company_id',job.company_id).eq('deleted',false).in('kind',['GOAL','BUSINESS_PREFERENCE','CONSTRAINT']).order('updated_at',{ascending:false}).limit(20):null;
    providerStarted=true;
    const response=await complete(extractionRequest(process.env.OPENAI_MODEL??"",source.data.content,recent.slice(0,20),{...job.context,referenceDay,entities,business_context,...(goalState?{goals_context:{goals:goalState.goals.slice(0,8),observations:goalState.observations.slice(0,24),memories:goalState.memories.slice(0,6),entities:goalState.entities.slice(0,20),catalog:METRIC_CATALOG}}:{}),...(radarMemories?.data?{radar_memories:radarMemories.data}:{})}),AbortSignal.timeout(55000));
    if(response.status!=="completed")throw Error("JOURNAL_OUTPUT_INCOMPLETE");
    const parsed=JSON.parse(response.output_text);
    if(goalState){const normalized=normalizeIngestion(parsed.goals_metrics,source.data.content,{company:job.company_id,goals:goalState.goals,observations:goalState.observations,memories:goalState.memories,timezone:job.context.timezone,at:job.context.at,document:!!job.context.document});
     goalsPayload={...normalized,goals:normalized.goals.map(g=>({...g,key:job.id+':'+g.key})),observations:normalized.observations.map(o=>({...o,key:job.id+':'+o.key}))};
     if(normalized.rejected.length)console.warn('[seed:goals]',{code:'EXTRACTION_PARTIAL',rejected:normalized.rejected});
     // One canonical measurement is committed by the typed Journal writer.
     parsed.entries=parsed.entries.filter((e:{entry_type:string;metric_type:string})=>e.entry_type!=='METRIC'||!normalized.observations.some(o=>o.data.metric===e.metric_type));
    }
    payload=job.context.document?[]:normalizeExtraction({entries:parsed.entries},source.data.content,new Date(job.context.at),job.context.timezone,recent,entities);
    if(radarMemories?.data)try{radarPayload=normalizeWatches(parsed.radar_watches,radarMemories.data as WatchMemory[]);}catch{console.warn('[seed:radar]',{code:'WATCH_EXTRACTION_REJECTED'});}
    modelCandidate=parsed.business_model??null;
    try{const validated=normalizeModelBatch(modelCandidate,source.data.content,business_context.entities,business_context.references,new Date(job.context.at));
     modelPayload=builderPayload(validated.model,job.context.document===true);
     if(validated.rejected.length){modelError='BUSINESS_PARTIAL_REVIEW_REQUIRED';console.warn('[seed:business-model]',{code:modelError,rejected:validated.rejected});}
    }
    catch{modelError='BUSINESS_VALIDATION_FAILED';console.error('[seed:business-model]',{code:modelError});}
   }else{
    const window={start:job.context.start,end:job.context.end};
    const entries=await journalRows(job.company_id,window);
    if(!eligibility(entries,window,numberSetting("SEED_WEEKLY_MIN_EVENTS",3,200),numberSetting("SEED_WEEKLY_MIN_DAYS",2,7)).eligible)throw Error("WEEKLY_INSUFFICIENT");
    // Diagnose changes against the latest interpretation without treating it as factual evidence.
    const conversations=await db.from("conversations").select("id").eq("company_id",job.company_id).eq("user_id",job.user_id).order("updated_at",{ascending:false}).limit(3);
    const previous=conversations.data?.length?await db.from("messages").select("diagnosis").in("conversation_id",conversations.data.map(c=>c.id)).not("diagnosis","is",null).order("created_at",{ascending:false}).limit(1).maybeSingle():null;
    const priorWindow={start:shiftDay(window.start,-7),end:shiftDay(window.end,-7)};
    const priorEntries=await journalRows(job.company_id,priorWindow);
    const comparisons=compareWeeks(weeklyMetrics(entries,window),weeklyMetrics(priorEntries,priorWindow),window,priorWindow);
    const comparableIds=new Set(comparisons.flatMap(c=>c.source_ids));
    const sources=[...entries,...priorEntries.filter(e=>comparableIds.has(e.id))];
    const radar=await radarWeekly(job.company_id,job.user_id,sources.map(e=>e.id)).catch(()=>[]);
    const external=await externalContext(job.company_id,job.user_id,entries.map(e=>e.description).join(' ')).catch(()=>[]);
    const goals=await goalContext(job.company_id,job.user_id,'weekly review progress').catch(()=>[]);
    const growth=await growthContext(job.company_id,job.user_id,'weekly review progress').catch(()=>[]);
    providerStarted=true;
    const response=await complete(weeklyRequest(process.env.OPENAI_MODEL??"",sources,window,{...job.context,comparisons,radar,external,goals,growth,previous_diagnosis:previous?.data?.diagnosis??null}),AbortSignal.timeout(55000));
    if(response.status!=="completed")throw Error("WEEKLY_OUTPUT_INCOMPLETE");
    payload={growth,goals,external_research:external,report:validateWeekly(JSON.parse(response.output_text),sources),comparisons,key_metrics:weeklyMetrics(entries,window),coverage:eligibility(entries,window).coverage,sources:sources.map(e=>({id:e.id,version:e.version})),generation_version:goalsEnabled()?'10.0.0':GENERATION_VERSION,model_metadata:{model:response.model,response_id:response.id},partial:job.context.current===true};
   }
   const saved=await db.from("journal_jobs").update({payload,...(goalsEnabled()?{goals_payload:goalsPayload}:{}),...(radarEnabled()?{radar_payload:radarPayload}:{}),model_payload:modelPayload,model_candidate:modelError?modelCandidate:null,model_error:modelError,model_attempts:modelError==='BUSINESS_PARTIAL_REVIEW_REQUIRED'?4:modelError?1:0,updated_at:new Date().toISOString()}).eq("id",job.id).eq("lease_token",job.lease_token).eq("status","RUNNING").select("id").single();
   if(saved.error)throw Error("JOURNAL_PAYLOAD_SAVE_FAILED");
   persisted=true;
  }
  const result=await db.rpc(job.kind==="EXTRACTION"?"apply_journal_extraction":"finish_weekly_job",{p_job:job.id,p_lease:job.lease_token});
  if(result.error)throw Error("JOURNAL_APPLY_FAILED");
  if(radarEnabled()){const watch=await db.from('journal_jobs').select('radar_payload').eq('id',job.id).single();for(const w of watch.data?.radar_payload??[]){const saved=await db.rpc('save_radar_watch',{p_user:job.user_id,p_company:job.company_id,p_memory:w.memory_id,p_version:w.memory_version,p_kind:w.kind,p_config:w.config,p_evidence:w.evidence});if(saved.error)console.warn('[seed:radar]',{code:'WATCH_SAVE_REJECTED'});}}
  try{await processBusinessModelJob(job.company_id);}catch{console.error('[seed:business-model]',{code:'WORKER_WAKE_FAILED'});}
  console.info("[seed:journal]",{job:job.id,kind:job.kind,status:"COMPLETED"});
 }catch(error){
  const code=error instanceof ChatError?error.code:error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:"JOURNAL_PROCESSING_FAILED";
  const status=code==="PRO_REQUIRED"?"FAILED":persisted?(job.attempts<4?"READY":"FAILED"):providerStarted&&!(error instanceof ChatError)?"UNKNOWN":job.attempts<4?"QUEUED":"FAILED";
  await db.from("journal_jobs").update({status,error_code:code,available_at:new Date(Date.now()+Math.min(900000,30000*2**job.attempts)).toISOString(),updated_at:new Date().toISOString()}).eq("id",job.id).eq("lease_token",job.lease_token);
  console.error("[seed:journal]",{job:job.id,kind:job.kind,status,code});
 }
}
