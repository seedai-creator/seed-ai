import type {AiPricing} from '../commercial/ai-cost';
import type {ExternalRequest} from './request';

export function externalReservation(request:unknown,maxCalls:number,maxOutput:number,prices:AiPricing[]) {
  if(!Number.isSafeInteger(maxCalls)||maxCalls<0||maxCalls>6||!Number.isSafeInteger(maxOutput)||maxOutput<1)throw Error('EXTERNAL_COST_LIMIT');
  const input=Buffer.byteLength(JSON.stringify(request),'utf8')+(maxCalls?128000*maxCalls:8192);
  const contextTier=input>272000?'long':'standard';
  const price=prices.find(p=>p.context_tier===contextTier);
  if(!price)throw Error('EXTERNAL_CONTEXT_PRICING_REQUIRED');
  const rates=[Number(price.input_per_million),Number(price.cached_per_million??0),Number(price.cache_write_per_million??0),Number(price.output_per_million)];
  if(rates.some(n=>!Number.isFinite(n)||n<0))throw Error('EXTERNAL_PRICING_REQUIRED');
  return {input,contextTier,tokenReserve:(input*Math.max(...rates.slice(0,3))+maxOutput*rates[3])/1e6};
}

export function externalBudgetOptions(request:ExternalRequest,maxCalls:number,maxOutput:number,prices:AiPricing[],toolRate:number){
  if(!Number.isSafeInteger(maxCalls)||maxCalls<0||maxCalls>6)throw Error('EXTERNAL_CALL_LIMIT');
  if(!Number.isFinite(toolRate)||toolRate<0)throw Error('EXTERNAL_PRICING_REQUIRED');
  return Array.from({length:Math.max(1,maxCalls)},(_,i)=>maxCalls-i).map(calls=>{
    const reduced=calls<maxCalls;
    const bounded:ExternalRequest={...request,...(maxCalls?{max_tool_calls:calls}:{}),
      ...(reduced?{instructions:(request.instructions??'')+`\nEffective call budget: ${calls}. Coverage was reduced to fit the remaining allowance. Explicitly state limited coverage; do not present this as exhaustive research.`}:{}),};
    const reserve=externalReservation(bounded,calls,maxOutput,prices);
    // A real provider sample returned an extra tool item. Keep one extra call's
    // price as headroom, while metering every observed call (never a zero fallback).
    return {request:bounded,calls,reserved:reserve.tokenReserve+(calls+(calls?1:0))*toolRate,reduced};
  });
}
