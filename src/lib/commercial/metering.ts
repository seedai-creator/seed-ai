import {logEvent} from '../operations/logging';
import "server-only";
import {guardAiOperation,recordOperation,operationsEnabled} from '../operations/server';
import {persistUsage} from "./persistence";
import type OpenAI from "openai";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import { createHash } from "node:crypto";
import { commercialContext, commercialContextForUser, commercialDatabase } from "./server";
import type { AiPricing } from "./ai-cost";
import {responseCost} from "./response-cost";
import { routeAiModel } from "./model-router";
import { usageState } from "./entitlements";
import { ChatError } from "../chat/contracts";
import { reservationError } from "./usage-errors";
export async function commercialRolloutEnabled() {
  // Deployment compatibility: the existing app stays in phase 9 until credentials and rollout are configured.
  if (!process.env.SUPABASE_SECRET_KEY) {if(operationsEnabled())throw new ChatError(503,'COMMERCIAL_UNAVAILABLE','O serviço está temporariamente indisponível.');return false;}
  const { data, error } = await commercialDatabase().from("commercial_settings").select("value").eq("id", "rollout").single();
  if (error || !data) throw new ChatError(503, "COMMERCIAL_UNAVAILABLE", "Não foi possível verificar sua assinatura.");
  if(operationsEnabled()&&data.value.enabled!==true)throw new ChatError(503,'COMMERCIAL_UNAVAILABLE','O serviço está temporariamente indisponível.');
  return data.value.enabled === true;
}
function stepId(id: string, feature: string) {
  const hex = createHash("sha256").update(id + ":" + feature).digest("hex");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`;
}
export async function meteredCompletion(client: OpenAI, companyId: string, requestId: string, backgroundUserId?: string) {
  const context = backgroundUserId ? await commercialContextForUser({id:backgroundUserId}) : await commercialContext();
  if(backgroundUserId){const member=await context.db.from("company_members").select("user_id").eq("company_id",companyId).eq("user_id",backgroundUserId).maybeSingle();if(member.error||!member.data)throw Error("JOURNAL_ACCESS_DENIED");}
  if(context.flags.chat!==true || context.flags.diagnosis!==true) throw new ChatError(403,"FEATURE_UNAVAILABLE","Esta análise não está disponível para sua conta.");
  const { data: usage, error } = await context.db.rpc("commercial_usage",{p_user:context.user.id,p_window:context.policy.window});
  if (error || !usage) throw new Error("USAGE_UNAVAILABLE");
  // Financial protection applies to every operation. Conversation quotas are
  // checked atomically in reserve_ai_request, not against background work here.
  const state = usageState(Number(usage.cost),0,context.policy);
  if (context.market.disable_ai_requests || !(["ACTIVE", "PAUSED"].includes(context.market.status) || (context.market.status === "READY" && context.override?.market_access === true)))
    throw new ChatError(503, "AI_PAUSED", "As análises estão pausadas neste mercado. Seus dados continuam disponíveis.");
  if (state === "HARD_LIMIT") throw new ChatError(429, "USAGE_LIMIT", "Seu limite de uso foi atingido. Seus dados continuam disponíveis.");
  const config = await context.db.from("commercial_settings").select("value").eq("id","model_routing").single();
  const limits=config.data?.value;
  if(config.error || !limits || ![limits.classification_output_tokens,limits.diagnosis_output_tokens].every(v=>Number.isSafeInteger(v)&&v>0&&v<=32768))throw new Error("OUTPUT_BUDGET_UNAVAILABLE");
  return async (original: ResponseCreateParamsNonStreaming, signal: AbortSignal) => {
    const journalFeature = original.metadata?.journal_feature;
    const simulationExtraction=original.metadata?.simulation_feature==='DECISION_SCENARIO_EXTRACTION';
    const taskFeature = simulationExtraction || journalFeature === "BUSINESS_JOURNAL_EXTRACTION" ? "extraction" : journalFeature === "WEEKLY_INTELLIGENCE_GENERATION" ? "diagnosis" : original.text?.format?.type === "json_schema" && ["seed_intent", "seed_route"].includes(original.text.format.name) ? "classification" : original.metadata?.seed_task === "SOCIAL" ? "followup" : "diagnosis";
    const feature = simulationExtraction?'classification':journalFeature === "BUSINESS_JOURNAL_EXTRACTION" || journalFeature === "WEEKLY_INTELLIGENCE_GENERATION" ? journalFeature : taskFeature === "followup" ? "diagnosis" : taskFeature;
    const route = routeAiModel({ materiality: original.metadata?.materiality === "HIGH" ? "HIGH" : "LOW", feature: taskFeature, complexity: taskFeature !== "diagnosis" ? "LOW" : "HIGH", plan: context.plan.code, market: context.market.code, usage_state: state, required_capabilities: ["structured"], risk_level: taskFeature !== "diagnosis" ? "LOW" : "HIGH" }, {
      economy: { model: process.env.OPENAI_ECONOMY_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || "", capabilities: ["structured"], max_output_tokens: taskFeature === "followup" ? Math.min(1200, limits.diagnosis_output_tokens) : taskFeature === "extraction" ? limits.diagnosis_output_tokens : limits.classification_output_tokens },
      strategic: { model: process.env.OPENAI_STRATEGIC_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || "", capabilities: ["structured"], max_output_tokens: limits.diagnosis_output_tokens },
    }, !context.market.disable_ai_requests && (["ACTIVE","PAUSED"].includes(context.market.status) || (context.market.status === "READY" && context.override?.market_access === true)));
    const outputLimit = Math.min(route.max_output_tokens, original.max_output_tokens ?? route.max_output_tokens);
    const request = { ...original, model: route.model, max_output_tokens: outputLimit, service_tier: "default" as const };
    await guardAiOperation(context.db,feature,route.model);
    const now = new Date().toISOString();
    const { data: prices, error: priceError } = await context.db.from("ai_model_pricing").select("*").eq("provider", "openai").eq("model", route.model).eq("processing_tier", "default").eq("context_tier", "standard").lte("effective_from", now).or(`effective_to.is.null,effective_to.gt.${now}`).order("effective_from", {ascending:false}).limit(1);
    if (priceError || !prices?.length || prices[0].cached_per_million === null) throw new ChatError(503,"AI_PRICING_REQUIRED","A análise está temporariamente indisponível. Tente novamente mais tarde.");
    const rawPrice = prices[0];
    const price: AiPricing = { ...rawPrice, cache_write_per_million: rawPrice.cache_write_per_million == null ? null : String(rawPrice.cache_write_per_million), input_per_million: String(rawPrice.input_per_million), cached_per_million: rawPrice.cached_per_million === null ? null : String(rawPrice.cached_per_million), output_per_million: String(rawPrice.output_per_million) };
    // Conservative byte bound for the text-only payload, not a provider token count.
    const upperInput = Buffer.byteLength(JSON.stringify(request), "utf8") + 8192;
    if (upperInput > 272000) throw new ChatError(400,"CONTEXT_LIMIT","Reduza o contexto desta análise para continuar.");
    const reserve = (upperInput * Math.max(Number(price.input_per_million),Number(price.cached_per_million),Number(price.cache_write_per_million ?? 0)) + outputLimit * Number(price.output_per_million)) / 1_000_000;
    // One charged conversational analysis; extraction has its own cost reservation and idempotency key.
    const id = stepId(requestId, simulationExtraction?'classification:decision-extraction':feature);
    const reservation = await context.db.rpc("reserve_ai_request", { p_user: context.user.id, p_company: companyId, p_id: id, p_reserve: Math.max(reserve, 0.000000000001),p_feature:feature,p_fingerprint:createHash("sha256").update(companyId+JSON.stringify(request)).digest("hex") });
    if (reservation.error) throw reservationError(null);
    if (!reservation.data?.allowed) throw reservationError(reservation.data?.reason);
    const started = Date.now();
    let completed = false;
    try {
      const response = await client.responses.create(request, { signal });
      const u = response.usage;
      const {cost} = responseCost(response,price,now);
      const { error: logError } = await persistUsage(()=>context.db.from("usage_logs").upsert({request_id:id,user_id:context.user.id,company_id:companyId,plan_code:context.plan.code,market_code:context.market.code,feature,provider:"openai",model:response.model,provider_request_id:response.id,input_tokens:u?.input_tokens ?? null,cached_input_tokens:u?.input_tokens_details?.cached_tokens ?? null,cache_write_tokens:u?.input_tokens_details?.cache_write_tokens ?? null,output_tokens:u?.output_tokens ?? null,reasoning_tokens:u?.output_tokens_details?.reasoning_tokens ?? null,total_tokens:u?.total_tokens ?? null,pricing_id:price.id,cost_status:cost.status,estimated_cache_write_cost_usd:cost.status==="ESTIMATED"?cost.cache_write_usd:null,cache_savings_usd:cost.status==="ESTIMATED"?cost.cache_savings_usd:null,estimated_input_cost_usd:cost.status==="ESTIMATED"?cost.input_usd:null,estimated_cached_cost_usd:cost.status==="ESTIMATED"?cost.cached_usd:null,estimated_output_cost_usd:cost.status==="ESTIMATED"?cost.output_usd:null,estimated_tool_cost_usd:cost.status==="ESTIMATED"?cost.tool_usd:null,estimated_total_cost_usd:cost.total_usd,latency_ms:Date.now()-started,status:response.status ?? "unknown",router_decision:{...route,cost_reason:cost.status==='UNKNOWN'?cost.reason:null,reservation_overrun:cost.status==='ESTIMATED'&&Number(cost.total_usd)>reserve,materiality:original.metadata?.materiality ?? "LOW",profile:original.metadata?.profile ?? "GENERAL",task:taskFeature,simulation_feature:original.metadata?.simulation_feature??null,business_model_feature:original.metadata?.business_model_feature??null,goals_feature:original.metadata?.goals_feature??null,growth_map_feature:original.metadata?.growth_map_feature??null,cockpit_feature:original.metadata?.cockpit_feature??null}},{onConflict:"request_id,feature",ignoreDuplicates:true}));
      if(logError){logEvent('usage',{code:logError.code},'error');throw new Error("USAGE_LOG_FAILED");}
      const finish = await persistUsage(()=>context.db.rpc("finish_ai_request",{p_id:id,p_status:cost.status==="ESTIMATED"?"COMPLETED":"UNKNOWN",p_cost:cost.total_usd}));
      if(finish.error)throw new Error("USAGE_FINALIZATION_FAILED");
      completed = true;
      await recordOperation(context.db,{request_id:id,user_id:context.user.id,company_id:companyId,feature,code:'AI_COMPLETED',level:'INFO',duration_ms:Date.now()-started});
      return response;
    } finally {
      if(!completed) {
        await recordOperation(context.db,{request_id:id,user_id:context.user.id,company_id:companyId,feature,code:'AI_FAILED',level:'ERROR',duration_ms:Date.now()-started});
        await context.db.from("usage_logs").upsert({request_id:id,user_id:context.user.id,company_id:companyId,plan_code:context.plan.code,market_code:context.market.code,feature,provider:"openai",model:route.model,cost_status:"UNKNOWN",latency_ms:Date.now()-started,status:"error",error_code:"PROVIDER_OR_METERING_FAILURE",router_decision:route},{onConflict:"request_id,feature",ignoreDuplicates:true});
        // Keep reservation on uncertain provider failures. Never free an unaccounted charge.
        await context.db.rpc("finish_ai_request",{p_id:id,p_status:"UNKNOWN",p_cost:null});
      }
    }
  };
}
