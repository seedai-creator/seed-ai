import type {Response} from 'openai/resources/responses/responses';
import {calculateAiCost, type AiPricing} from './ai-cost';

/** Same accounting path for application calls and the acceptance runner. */
export function responseCost(response:Response|null, pricing:AiPricing, at:string, toolRate=0) {
  const u=response?.usage;
  const calls=response?.output.filter(item=>item.type==='web_search_call').length??0;
  const unknown=(reason:string)=>({status:'UNKNOWN' as const,reason,total_usd:null});
  if (!Number.isFinite(toolRate)||toolRate<0) return {calls,cost:unknown('TOOL_PRICING_INVALID')};
  // No silent standard-context pricing for a long-context request.
  const contextTier=u&&u.input_tokens>272000?'long':'standard';
  try {
    const cost=calculateAiCost({provider:'openai',model:response?.model??pricing.model,at,
      processing_tier:response?.service_tier??'default',context_tier:contextTier,pricing,
      tool_cost_usd:response?(calls*toolRate).toFixed(6):null,
      usage:u?{input_tokens:u.input_tokens,cached_input_tokens:u.input_tokens_details?.cached_tokens??null,
        cache_write_tokens:u.input_tokens_details?.cache_write_tokens??null,output_tokens:u.output_tokens,
        reasoning_tokens:u.output_tokens_details?.reasoning_tokens??null,total_tokens:u.total_tokens}:null});
    return {calls,cost};
  } catch {
    // Preserve the reservation and diagnostic reason, never record missing usage as zero.
    return {calls,cost:unknown('PROVIDER_USAGE_OR_PRICING_INVALID')};
  }
}
