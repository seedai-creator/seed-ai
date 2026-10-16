import {logEvent} from '../operations/logging';
import {parseExecution,type ExecutionSnapshot} from '../execution/domain';
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import { ChatError, type ChatMessage } from "../chat/contracts";
import { parseStructuredAnswer } from "../memory/contracts";
import { buildRouteRequest, buildSeedRequest } from "./request";
import { EMPTY_MARKET, type MarketContext } from "../i18n/market";
import { parseGeneratedDiagnosis, validateEvidence, type Diagnosis } from "../diagnosis/contracts";

import { parseStrategicRoute } from "../reliability/routing";
import { applyReliabilityGate } from "../reliability/gate";
import {parseDecisionIntent,parseExtraction,buildSimulation,applySimulationSufficiency,type Simulation,type SimulationLifecycle} from '../simulation/domain';
import {withDecisionIntent,extractionRequest,withSimulation,renderSimulationAnswer} from '../simulation/requests';
import { freeAnalysisInstructions, type FreeExperience } from '../commercial/free-experience';

type Completion = { status?: string; output_text: string };
export type Complete = (request: ResponseCreateParamsNonStreaming, signal: AbortSignal) => Promise<Completion>;
function completedText(response: Completion) {
  if (response.status !== "completed" || !response.output_text?.trim())
    throw new ChatError(502, "INCOMPLETE_RESPONSE", "A análise não foi concluída. Tente novamente.");
  return response.output_text;
}
export async function runSeedAnalysis(complete: Complete, model: string, messages: ChatMessage[], memory: string, signal: AbortSignal, market: MarketContext = EMPTY_MARKET, previousDiagnosis: Diagnosis | null = null, execution?: ExecutionSnapshot, attachment=false,lifecycle?:SimulationLifecycle, free?: FreeExperience | null) {
  const started = Date.now();
  signal.throwIfAborted();
  if (free?.limited) throw new ChatError(429, 'USAGE_LIMIT', 'Seu limite de uso foi atingido. Seus dados continuam disponíveis.');
  const simulatorEnabled=process.env.SEED_SIMULATOR_ENABLED==='true'&&!attachment&&!free;
  const routeRequest=buildRouteRequest(model,messages);
  const prepared=simulatorEnabled?lifecycle?.prepared:undefined;
  const classification = prepared?.route?JSON.stringify({...prepared.route,decision_simulation:prepared.intent}):completedText(await complete(simulatorEnabled?withDecisionIntent(routeRequest):routeRequest, signal));
  let route;
  let simulation:Simulation|null=null;
  let decisionIntent=null;
  try {
    const parsed=JSON.parse(classification);
    if(simulatorEnabled){decisionIntent=parseDecisionIntent(parsed.decision_simulation,messages.at(-1)!.content);delete parsed.decision_simulation;}
    route = parseStrategicRoute(JSON.stringify(parsed));
    if(decisionIntent&&['HIGH','CRITICAL'].includes(decisionIntent.materiality))route.materiality='HIGH';
    if(decisionIntent){
      const profiles={HIRING:'HIRING',MARKETING_INVESTMENT:'ADS',NEW_LOCATION:'EXPANSION',CAPACITY_EXPANSION:'EXPANSION',PAYMENT_TERMS:'FINANCIAL',DISCOUNT:'DISCOUNT'} as const;
      const forced=profiles[decisionIntent.type as keyof typeof profiles];if(forced)route.profile=forced;
    }
  }
  catch { throw new ChatError(502, "INVALID_AI_RESPONSE", "A resposta não pôde ser validada. Tente novamente."); }
  if(decisionIntent){
    const extracted=prepared?JSON.stringify(prepared.extraction):completedText(await complete(extractionRequest(model,messages,memory,decisionIntent,market.user_language),signal));
    try{simulation={...buildSimulation(decisionIntent,parseExtraction(JSON.parse(extracted),messages,memory,market.user_language)),route};}
    catch(error){logEvent('simulation',{stage:'EXTRACTION',code:error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'VALIDATION_FAILED'},'error');throw new ChatError(502,'INVALID_AI_RESPONSE','Não foi possível validar os dados da simulação. Confira os valores e tente novamente.');}
    await lifecycle?.calculated(simulation);
  }
  signal.throwIfAborted();
  const seedRequest=buildSeedRequest(model, messages, memory, route.intent, market, route, previousDiagnosis, free ? undefined : execution);
  if (free) {
    seedRequest.instructions += freeAnalysisInstructions(free);
    seedRequest.max_output_tokens = Math.min(seedRequest.max_output_tokens ?? 3800, 3800);
    seedRequest.metadata = { ...seedRequest.metadata, free_experience: 'first_value_v1' };
  }
  const raw = completedText(await complete(simulation?withSimulation(seedRequest,simulation,market.user_language):seedRequest, signal));
  let validationStage='ANSWER_SCHEMA';
  try {
    const result = parseStructuredAnswer(raw);
    validationStage='INTENT';
    if (result.intent !== route.intent) throw new Error("Intent mismatch");
    validationStage='DIAGNOSIS_SCHEMA';
    const diagnosis = parseGeneratedDiagnosis(JSON.parse(raw).diagnosis);
    if (!diagnosis && route.task !== "SOCIAL") throw new Error("Missing business diagnosis");
    validationStage='DIAGNOSIS_EVIDENCE';
    validateEvidence(diagnosis, messages, memory);
    validationStage='RELIABILITY';
    const checked = applyReliabilityGate(JSON.parse(raw).reliability, result, diagnosis, route, messages, memory, market.user_language);
    console.info("[seed:reliability]", { sufficiency: checked.reliability?.sufficiency ?? null, confidence: checked.reliability?.confidence ?? null, route: route.profile, materiality: route.materiality, validation: checked.validation, latency_ms: Date.now()-started });
    validationStage='EXECUTION';
    const commands=execution && !free ? parseExecution(JSON.parse(raw).execution,messages.at(-1)!.content,execution,checked.validation==="PASSED"?checked.reliability:null,attachment) : [];
    if(simulation)simulation={...applySimulationSufficiency(simulation,checked.reliability),reliability:checked.reliability};
    return {...checked,answer:simulation?renderSimulationAnswer(checked.answer,simulation,market.user_language):checked.answer,execution_commands:commands,simulation};
  } catch (error) {
    const code = error instanceof Error && /^[A-Z_]{1,60}$/.test(error.message) ? error.message : "SCHEMA_OR_EVIDENCE_FAILED";
    logEvent('reliability',{ validation: code, stage:validationStage, route: route.profile },'error');
    
    throw new ChatError(502, "INVALID_AI_RESPONSE", "A resposta não pôde ser validada. Tente novamente.");
  }
}
