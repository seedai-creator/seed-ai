import {logEvent} from '../operations/logging';
import {featureEnabled} from '../operations/flags';
import {cockpitContext} from '../cockpit/server';
import {operationsEnabled,operationControls} from '../operations/server';
import {growthContext,scheduleGrowth,processGrowthJob} from '../growth/server';
import {DIMENSIONS,type Dimension} from '../growth/domain';
import {radarContext,processRadarJob} from '../radar/server';
import {radarEnabled} from '../radar/domain';
import {executionSnapshot,executionMemory} from '../execution/server';
import {simulationMemory,simulationLifecycle} from '../simulation/server';
import {recommendationFromDiagnosis,relevantExecution} from '../execution/domain';
import "server-only";
import {resolveBusinessContext} from '../business-model/server';
import { after } from "next/server";
import { journalEnabled,journalRows,processJournalJob } from "../journal/server";
import { selectJournalContext } from "../journal/domain";
import { parseDiagnosis, type Diagnosis } from "../diagnosis/contracts";
import { parseMessages } from "../chat/contracts";
import { respond } from "../openai/respond";
import { companyContext } from "../auth/context";
import type { CompanyFact } from "../memory/contracts";

import { eligibleMemories, relevantMemory, type MemoryItem } from "../memory/automatic";
import { readConversation } from "@/app/workspace/actions";
import { getLocale } from "../i18n/server";
import { buildMarketContext } from "../i18n/market";
import { ChatError } from "../chat/contracts";
import { commercialRolloutEnabled } from "../commercial/metering";
import { commercialDatabase } from "../commercial/server";
import { validId } from "../auth/validation";
import {externalTurn,externalContext} from '../external/server';
import {goalsEnabled,goalContext} from '../goals/server';
export async function orchestrate(body: unknown, signal?: AbortSignal) {
  let messages = parseMessages(body);
  let previousDiagnosis: Diagnosis | null = null;
  const companyId = body && typeof body === "object" && "companyId" in body ? body.companyId : undefined;
  const context = await companyContext(companyId);

  const input = body as Record<string,unknown>;
  if (!validId(input.conversationId) || !Number.isSafeInteger(input.version) || Number(input.version)<0) throw new ChatError(400,"INVALID_CONVERSATION","Atualize a página e tente novamente.");
  const db = commercialDatabase();
  if(operationsEnabled()&&input.hasAttachment&&(await operationControls(db)).disable_uploads)throw new ChatError(503,'UPLOADS_PAUSED','Os anexos estão temporariamente pausados. Você pode continuar escrevendo sua mensagem.');
  const existing=await db.from("conversations").select("user_id,company_id,version").eq("id",input.conversationId).maybeSingle();
  if(existing.error)throw new ChatError(503,"CONVERSATION_UNAVAILABLE","Não foi possível acessar a conversa.");
  if(existing.data&&(existing.data.user_id!==context.userId||existing.data.company_id!==context.companyId))throw new ChatError(403,"ACCESS_DENIED","Solicitação não autorizada.");
  if((existing.data?.version??0)!==input.version)throw new ChatError(409,"CONVERSATION_CHANGED","A conversa mudou. Reabra a conversa antes de continuar.");
  if (Number(input.version)>0) {
    const stored=await readConversation(context.companyId,String(input.conversationId));
    if(stored.version!==input.version) throw new ChatError(409,"CONVERSATION_CHANGED","A conversa mudou. Reabra a conversa antes de continuar.");
    previousDiagnosis = parseDiagnosis([...stored.messages].reverse().find(m=>m.diagnosis)?.diagnosis ?? null);
    messages=parseMessages({messages:[...stored.messages.map(m=>({role:m.role,content:m.content})),messages.at(-1)!]});
  } else if(messages.length!==1) throw new ChatError(400,"INVALID_CONVERSATION","Inicie uma nova conversa.");
  let selectedHome:Awaited<ReturnType<typeof cockpitContext>>|null=null;
  if(input.cockpitReference){
    try{selectedHome=await cockpitContext(context.companyId,context.userId,await getLocale(),input.cockpitReference);}
    catch{throw new ChatError(409,"COCKPIT_CONTEXT_CHANGED","Este item mudou. Atualize a Home e tente novamente.");}
  }
  const memoryRows=await db.from("business_memories").select("*").eq("company_id",context.companyId).eq("deleted",false).order("observed_at",{ascending:false}).limit(40);
  if(memoryRows.error)throw new ChatError(503,"MEMORY_UNAVAILABLE","Não foi possível acessar sua empresa. Tente novamente.");
  const marketRows=await db.from("business_memories").select("key,value").eq("company_id",context.companyId).eq("deleted",false).in("key",["country","currency"]);
  if(marketRows.error)throw new ChatError(503,"MEMORY_UNAVAILABLE","Não foi possível acessar sua empresa. Tente novamente.");
  const facts=marketRows.data as CompanyFact[];
  const historical=journalEnabled()?selectJournalContext(await journalRows(context.companyId),context.companyId,messages.at(-1)!.content,new Date()):[];
  const execution=await executionSnapshot(context.companyId,context.userId);
  if(selectedHome?.planId)input.planId=selectedHome.planId;
  if(input.planId){if(!validId(input.planId)||!execution.plans.some(p=>p.id===input.planId))throw new ChatError(409,"PLAN_CHANGED","O plano mudou. Abra Meu Plano Estratégico novamente.");execution.plans.sort((a,b)=>Number(b.id===input.planId)-Number(a.id===input.planId));}
  const business=await resolveBusinessContext(context.companyId,context.userId,messages.at(-1)!.content);
  const simulationContext=await simulationMemory(context.companyId,context.userId,String(input.conversationId),messages.at(-1)!.content);
  const proactive=await radarContext(context.companyId,context.userId,messages.at(-1)!.content,typeof input.radarId==='string'?input.radarId:undefined).catch(()=>[]);
  let memory=JSON.stringify([...relevantMemory(memoryRows.data as MemoryItem[],context.companyId,messages.at(-1)!.content).filter(m=>!business.coveredMemoryIds.includes(m.source_id)),...historical,...(selectedHome?.rows??[]),...executionMemory(execution,messages.at(-1)!.content),...business.rows,...simulationContext,...proactive,{key:'business_coverage',kind:'INFERENCE',value:JSON.stringify({coverage:business.coverage,missingInformation:business.missingInformation,notice:'Partial retrieval. Missing does not mean absent. Dependencies do not prove causality.'})}]);
  const { data: company, error } = await context.supabase.from("companies").select("preferred_language,locale,timezone").eq("id", context.companyId).single();
  // Keep existing chat available during the additive migration rollout.
  if ((error && error.code !== "42703") || (!error && !company))
    throw new ChatError(503, "MARKET_UNAVAILABLE", "Não foi possível acessar sua empresa. Tente novamente.");
  const market = buildMarketContext(await getLocale(), company ?? { preferred_language: null, locale: null, timezone: null }, facts);
  const commercial = await commercialRolloutEnabled();
  const requestId = body && typeof body === "object" && "requestId" in body ? body.requestId : undefined;
  if(!validId(requestId)) throw new ChatError(400,"INVALID_REQUEST_ID","Atualize a página e envie novamente.");
  if(input.researchId&&!validId(input.researchId))throw new ChatError(400,'INVALID_INPUT','Atualize a página.');
  const external=input.researchId?null:await externalTurn({user:context.userId,company:context.companyId,conversation:String(input.conversationId),request:String(requestId),version:Number(input.version),question:messages.at(-1)!.content,memory,market,attachment:!!input.hasAttachment});
  if(external)return external;
  const externalRows=await externalContext(context.companyId,context.userId,messages.at(-1)!.content,typeof input.researchId==='string'?input.researchId:undefined);
  const goals=await goalContext(context.companyId,context.userId,messages.at(-1)!.content);
  if(goals.length)memory=JSON.stringify([...JSON.parse(memory),...goals]);
  if(externalRows.length)memory=JSON.stringify([...JSON.parse(memory),...externalRows]);
  if(input.growthSnapshotId&&!validId(input.growthSnapshotId)||input.growthDimension&&!DIMENSIONS.includes(input.growthDimension as Dimension))throw new ChatError(400,'INVALID_INPUT','Atualize a página.');
  let growth:Awaited<ReturnType<typeof growthContext>>;
  try{growth=await growthContext(context.companyId,context.userId,messages.at(-1)!.content,typeof input.growthSnapshotId==='string'?input.growthSnapshotId:undefined,input.growthDimension as Dimension|undefined);}
  catch{if(input.growthSnapshotId)throw new ChatError(409,'GROWTH_CONTEXT_CHANGED','O mapa mudou. Atualize o Diagnóstico antes de continuar.');growth=[];}
  if(growth.length)memory=JSON.stringify([...JSON.parse(memory),...growth]);
  const lifecycle=await simulationLifecycle(context.userId,context.companyId,String(input.conversationId),String(requestId),Number(input.version),messages.at(-1)!.content,JSON.stringify({messages,memory,market,version:input.version}));
  const result = await respond(messages, memory, signal, market, commercial ? {companyId:context.companyId,requestId:String(requestId)} : undefined, previousDiagnosis, relevantExecution(execution,messages.at(-1)!.content), !!input.hasAttachment,lifecycle);
  if(commercial && result.diagnosis){
    const db=commercialDatabase();const account=await db.from("commercial_accounts").select("market_code").eq("user_id",context.userId).single();
    const request=await db.from("ai_requests").select("plan_code").eq("user_id",context.userId).eq("feature","diagnosis").order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(request.data?.plan_code==="FREE")await db.from("commercial_events").upsert({user_id:context.userId,market_code:account.data?.market_code,event:"free_diagnosis_completed",dedupe_key:"diagnosis:"+String(requestId)},{onConflict:"dedupe_key",ignoreDuplicates:true});
  }
  if(commercial && result.diagnosis?.main_bottleneck && result.diagnosis.priorities.length) {
    const db = commercialDatabase();
    const {error:activationError}=await db.from("commercial_accounts").update({activated_at:new Date().toISOString()}).eq("user_id",context.userId).is("activated_at",null);
    if(activationError) logEvent('activation',{code:"ACTIVATION_PERSISTENCE_FAILED"},'error');
  }
  const simulationEnabled=featureEnabled('simulation');
  const assumptionQuotes=result.simulation?.extraction.inputs.filter(i=>i.kind!=='FACT').map(i=>i.quote)??[];
  const safeMemories=eligibleMemories(result.memory_detected??[],messages.at(-1)!.content).filter(m=>!(goalsEnabled()&&journalEnabled()&&['GOAL','METRIC'].includes(m.kind))&&!assumptionQuotes.some(q=>q.includes(m.evidence)||m.evidence.includes(q)));
  const saved=await db.rpc(simulationEnabled?'commit_seed_turn_v96':'commit_seed_turn_v95',{...(simulationEnabled?{p_simulation:result.simulation}:{}),p_document:!!input.hasAttachment,p_skip_journal:!journalEnabled(),p_commands:result.execution_commands,p_recommendation:recommendationFromDiagnosis(result.diagnosis),p_user:context.userId,p_company:context.companyId,p_conversation:input.conversationId,p_request:requestId,p_version:input.version,p_message:messages.at(-1)!.content,p_answer:result.answer,p_diagnosis:result.diagnosis,p_memories:input.hasAttachment ? [] : safeMemories});
  if(saved.error){logEvent('execution',{code:saved.error.code},'error');throw new ChatError(503,"CONVERSATION_SAVE_FAILED","Não foi possível salvar a conversa. Reabra a conversa antes de tentar novamente.");}
  if(journalEnabled())after(async()=>{try{await processJournalJob(context.companyId);await scheduleGrowth(context.companyId,context.userId);await processGrowthJob(context.companyId);}catch{logEvent('journal',{code:"WORKER_WAKE_FAILED"},'error');}});
  if(radarEnabled())after(async()=>{try{await processRadarJob(context.companyId);}catch{logEvent('radar',{code:'WORKER_WAKE_FAILED'},'error');}});
  return { intent: result.intent, answer: result.answer, diagnosis: result.diagnosis, version:Number(input.version)+1 };
}

