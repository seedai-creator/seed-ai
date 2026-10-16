import 'server-only';
import {guardAiOperation,recordOperation} from '../operations/server';
import {createHash} from 'node:crypto';
import type OpenAI from 'openai';
import type {Response,ResponseCreateParamsNonStreaming} from 'openai/resources/responses/responses';
import {commercialContextForUser,commercialDatabase} from '../commercial/server';
import {routeAiModel} from '../commercial/model-router';
import type {AiPricing} from '../commercial/ai-cost';
import {responseCost} from '../commercial/response-cost';
import {externalBudgetOptions} from './cost';
import {persistUsage} from '../commercial/persistence';
import {reservationError} from '../commercial/usage-errors';
import {usageState} from '../commercial/entitlements';
import {ChatError} from '../chat/contracts';
import type {ExternalRequest} from './provider';
export type ExternalFeature='EXTERNAL_RESEARCH_PLANNING'|'WEB_SEARCH_QUICK'|'WEB_SEARCH_STANDARD'|'WEB_SEARCH_DEEP'|'EXTERNAL_SYNTHESIS';
export type Charge={key:string;id:string;user:string;company:string;feature:ExternalFeature;model:string;plan:string;market:string;pricing:AiPricing;longPricing?:AiPricing;at:string;started:number;toolRate:number;reserved:number;requestedToolCalls?:number;coverageReduced?:boolean};
export async function prepareExternalRequest(user:string,company:string,key:string,feature:ExternalFeature,original:ExternalRequest):Promise<{request:ExternalRequest;charge:Charge}>{
 const c=await commercialContextForUser({id:user});if(!c.flags.chat)throw new ChatError(403,'FEATURE_UNAVAILABLE','Esta análise não está disponível para sua conta.');
 const u=await c.db.rpc('commercial_usage',{p_user:user,p_window:c.policy.window});if(u.error||!u.data)throw Error('EXTERNAL_USAGE_UNAVAILABLE');
 const config=await c.db.from('commercial_settings').select('value').eq('id','external_research').single();if(config.error||!config.data?.value?.enabled)throw Error('EXTERNAL_DISABLED');
 const cfg=config.data.value,search=feature.startsWith('WEB_SEARCH_'),simple=feature==='EXTERNAL_RESEARCH_PLANNING'||feature==='WEB_SEARCH_QUICK';
 if(search&&!(c.plan.code==='PRO'?cfg.pro_depths:cfg.free_depths)?.includes(feature.replace('WEB_SEARCH_','')))throw new ChatError(403,'PRO_REQUIRED','Esta profundidade de pesquisa não está disponível no seu plano.');
 const maxOutput=Number(original.max_output_tokens??(simple?1600:4000));
 const route=routeAiModel({feature:simple?'extraction':'diagnosis',complexity:simple?'LOW':'HIGH',materiality:simple?'LOW':'HIGH',risk_level:simple?'LOW':'HIGH',plan:c.plan.code,market:c.market.code,usage_state:usageState(Number(u.data.cost),0,c.policy),required_capabilities:[search?'web_search':'structured']},{economy:{model:(search?process.env.OPENAI_WEB_ECONOMY_MODEL:undefined)||process.env.OPENAI_ECONOMY_MODEL||process.env.OPENAI_MODEL||'',capabilities:['structured','web_search'],max_output_tokens:maxOutput},strategic:{model:(search?process.env.OPENAI_WEB_STRATEGIC_MODEL:undefined)||process.env.OPENAI_STRATEGIC_MODEL||process.env.OPENAI_MODEL||'',capabilities:['structured','web_search'],max_output_tokens:maxOutput}},!c.market.disable_ai_requests);
 const request={...(process.env.OPENAI_REASONING_EFFORT==='low'?{reasoning:{effort:'low' as const}}:{}),...original,model:route.model,max_output_tokens:route.max_output_tokens,service_tier:'default' as const};
 await guardAiOperation(c.db,feature,route.model);
 const at=new Date().toISOString(),prices=await c.db.from('ai_model_pricing').select('*').eq('provider','openai').eq('model',route.model).eq('processing_tier','default').in('context_tier',['standard','long']).lte('effective_from',at).or(`effective_to.is.null,effective_to.gt.${at}`).order('effective_from',{ascending:false}).limit(2);
 if(prices.error||!prices.data?.length)throw Error('EXTERNAL_PRICING_REQUIRED');const price=prices.data.find(p=>p.context_tier==='standard') as AiPricing|undefined,longPrice=prices.data.find(p=>p.context_tier==='long') as AiPricing|undefined;if(!price)throw Error('EXTERNAL_PRICING_REQUIRED');
 const toolRate=Number(cfg.tool_call_usd);if(!Number.isFinite(toolRate)||toolRate<0||!cfg.price_source)throw Error('EXTERNAL_PRICING_REQUIRED');
 const maxCalls=Number(original.max_tool_calls??0);if(search&&(!Number.isSafeInteger(maxCalls)||maxCalls<1||maxCalls>cfg.max_calls))throw Error('EXTERNAL_CALL_LIMIT');
 // Reserve a full search context per allowed call; actual usage is reconciled afterward.
 // This deliberately over-reserves multi-call research instead of assuming all searches share one context.
 const options=externalBudgetOptions(request,maxCalls,maxOutput,prices.data as AiPricing[],toolRate);
 const h=createHash('sha256').update(key+feature).digest('hex');const id=`${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
 for(const option of options){
  const result=await c.db.rpc('reserve_external_ai',{p_user:user,p_company:company,p_id:id,p_reserve:Math.max(option.reserved,1e-12),p_feature:feature,p_fingerprint:createHash('sha256').update(company+JSON.stringify(option.request)).digest('hex')});
  if(result.error)throw reservationError(null);
  if(result.data?.allowed)return {request:option.request,charge:{key,id,user,company,feature,model:route.model,plan:c.plan.code,market:c.market.code,pricing:price,...(longPrice?{longPricing:longPrice}:{}),at,started:Date.now(),toolRate,reserved:option.reserved,requestedToolCalls:option.calls,coverageReduced:option.reduced}};
  if(result.data?.reason!=='REQUEST_BUDGET')throw reservationError(result.data?.reason);
 }
 throw reservationError('REQUEST_BUDGET');
}
export async function settleExternal(charge:Charge,response:Response|null){
 const db=commercialDatabase(),u=response?.usage;
 await recordOperation(db,{request_id:charge.id,user_id:charge.user,company_id:charge.company,feature:charge.feature,code:response?.status==='completed'?'AI_COMPLETED':'AI_FAILED',level:response?.status==='completed'?'INFO':'ERROR',duration_ms:Date.now()-charge.started});
 const price={...((u?.input_tokens??0)>272000?charge.longPricing??charge.pricing:charge.pricing)};for(const k of ['input_per_million','cached_per_million','output_per_million','cache_write_per_million'] as const){if(price[k]!=null)price[k]=String(price[k]);}
 const {cost,calls}=responseCost(response,price,charge.at,charge.toolRate);
 const toolLimitExceeded=charge.requestedToolCalls!==undefined&&calls>charge.requestedToolCalls;
 if(toolLimitExceeded)await recordOperation(db,{request_id:charge.id,user_id:charge.user,company_id:charge.company,feature:charge.feature,code:'AI_TOOL_LIMIT_EXCEEDED',level:'WARN'});
 const logged=await persistUsage(()=>db.from('usage_logs').upsert({request_id:charge.id,user_id:charge.user,company_id:charge.company,plan_code:charge.plan,market_code:charge.market,feature:charge.feature,provider:'openai',model:response?.model??charge.model,provider_request_id:response?.id??null,input_tokens:u?.input_tokens??null,output_tokens:u?.output_tokens??null,cached_input_tokens:u?.input_tokens_details?.cached_tokens??null,cache_write_tokens:u?.input_tokens_details?.cache_write_tokens??null,reasoning_tokens:u?.output_tokens_details?.reasoning_tokens??null,total_tokens:u?.total_tokens??null,pricing_id:price.id,cost_status:cost.status,estimated_cache_write_cost_usd:cost.status==='ESTIMATED'?cost.cache_write_usd:null,estimated_input_cost_usd:cost.status==='ESTIMATED'?cost.input_usd:null,estimated_output_cost_usd:cost.status==='ESTIMATED'?cost.output_usd:null,estimated_cached_cost_usd:cost.status==='ESTIMATED'?cost.cached_usd:null,estimated_tool_cost_usd:cost.status==='ESTIMATED'?cost.tool_usd:null,estimated_total_cost_usd:cost.total_usd,latency_ms:Date.now()-charge.started,status:response?.status??'unknown',router_decision:{external:true,requested_tool_calls:charge.requestedToolCalls??null,tool_limit_exceeded:toolLimitExceeded,cost_reason:cost.status==='UNKNOWN'?cost.reason:null,reservation_overrun:cost.status==='ESTIMATED'&&Number(cost.total_usd)>charge.reserved,external_key:charge.key,tool_calls:calls,depth:charge.feature.startsWith('WEB_SEARCH_')?charge.feature.replace('WEB_SEARCH_',''):null}},{onConflict:'request_id,feature'}));
 if(logged.error)throw Error('EXTERNAL_USAGE_SAVE_FAILED');
 const done=await persistUsage(()=>db.rpc('finish_ai_request',{p_id:charge.id,p_status:cost.status==='ESTIMATED'?'COMPLETED':'UNKNOWN',p_cost:cost.total_usd}));if(done.error)throw Error('EXTERNAL_COST_SAVE_FAILED');return cost;
}
export async function externalCompletion(client:OpenAI,user:string,company:string,key:string,feature:ExternalFeature,original:ResponseCreateParamsNonStreaming){
 const {request,charge}=await prepareExternalRequest(user,company,key,feature,original);let settled=false;let received:Response|null=null;
 try{const r=await client.responses.create({...request,background:false,store:false,stream:false},{signal:AbortSignal.timeout(55000)});received=r;await settleExternal(charge,r);settled=true;if(r.status!=='completed')throw Error('EXTERNAL_INCOMPLETE');return r;}
 finally{if(!settled)await settleExternal(charge,received);}
}
