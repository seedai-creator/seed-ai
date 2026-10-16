import test from 'node:test';
import assert from 'node:assert/strict';
import type {Response} from 'openai/resources/responses/responses';
import {PRO_PROPOSAL,proposedProPolicy} from '../src/lib/commercial/pro-proposal';
import {usageState} from '../src/lib/commercial/entitlements';
import {reservationError} from '../src/lib/commercial/usage-errors';
import {responseCost} from '../src/lib/commercial/response-cost';
import {externalReservation,externalBudgetOptions} from '../src/lib/external/cost';
import type {AiPricing} from '../src/lib/commercial/ai-cost';
import {hasPeriodEvidence} from '../src/lib/simulation/period-evidence';
const price:AiPricing={id:'fixture',provider:'openai',model:'gpt-6-sol',effective_from:'2026-01-01',effective_to:null,input_per_million:'2',cached_per_million:'0.2',cache_write_per_million:'2.5',output_per_million:'10',currency:'USD',processing_tier:'default',context_tier:'standard'};
function response():Response{return {model:'gpt-6-sol',service_tier:'default',output:[{type:'web_search_call',id:'fixture1'},{type:'web_search_call',id:'fixture2'}],usage:{input_tokens:1000,input_tokens_details:{cached_tokens:200,cache_write_tokens:300},output_tokens:100,output_tokens_details:{reasoning_tokens:50},total_tokens:1100}} as Response;}
test('proposal preserves agreed prices, company counts and shared cycle budgets, with no count ceiling',()=>{
 assert.deepEqual(PRO_PROPOSAL.map(p=>[p.amount_minor,p.company_limit,p.allowance_usd]),[[9999,1,4],[19999,3,8],[39999,5,16]]);
 for(const p of PRO_PROPOSAL){const policy=proposedProPolicy(p.allowance_usd);assert.equal(usageState(.5,1000,policy,1000),'NORMAL');assert.equal(usageState(p.allowance_usd,0,policy),'HARD_LIMIT');assert.equal(policy.user_day_usd,p.allowance_usd);}
});
test('service protections never claim the user spent their cycle allowance',()=>{
 assert.equal(reservationError('GLOBAL_BUDGET').status,503);
 assert.equal(reservationError('DAILY_BUDGET').code,'DAILY_USAGE_LIMIT');
 assert.equal(reservationError('EXTERNAL_BUDGET').code,'EXTERNAL_USAGE_LIMIT');
 assert.equal(reservationError('HARD_LIMIT').code,'USAGE_LIMIT');
});
test('provider metering counts tools, cached reads, cache writes and output without double billing reasoning',()=>{
 const observed=responseCost(response(),price,'2026-10-16',.01);
 assert.equal(observed.calls,2);assert.equal(observed.cost.total_usd,'0.022790000000');
 assert.equal(observed.cost.status,'ESTIMATED');
});
test('unknown or invalid usage retains a reason and cannot turn into free usage',()=>{
 assert.equal(responseCost(null,price,'2026-10-16',.01).cost.status,'UNKNOWN');
 const r=response();r.usage!.input_tokens_details.cache_write_tokens=undefined as unknown as number;
 assert.deepEqual(responseCost(r,price,'2026-10-16',.01).cost,{status:'UNKNOWN',reason:'CACHE_WRITE_USAGE_MISSING',total_usd:null});
 r.usage!.input_tokens_details.cache_write_tokens=900;
 assert.equal(responseCost(r,price,'2026-10-16',.01).cost.status,'UNKNOWN');
 const unknownModel=response();unknownModel.model='unpriced';assert.equal(responseCost(unknownModel,price,'2026-10-16',.01).cost.status,'UNKNOWN');
});
test('long-context research requires its own price and small actual requests settle at standard rates',()=>{
 assert.throws(()=>externalReservation({},3,3500,[price]),/CONTEXT_PRICING/);
 const long={...price,id:'long-fixture',context_tier:'long',input_per_million:'4',cached_per_million:'0.4',cache_write_per_million:'5',output_per_million:'15'};
 const reserve=externalReservation({},3,3500,[price,long]);assert.equal(reserve.contextTier,'long');assert.ok(reserve.tokenReserve>1.9);
 const r=response();r.usage!.input_tokens=300000;r.usage!.total_tokens=300100;
 assert.equal(responseCost(r,price,'2026-10-16',.01).cost.status,'UNKNOWN');
 assert.equal(responseCost(r,long,'2026-10-16',.01).cost.total_usd,'1.221080000000');
 assert.equal(responseCost(response(),price,'2026-10-16',.01).cost.status,'ESTIMATED');
});
test('period provenance rejects borrowed periods, mismatches and ambiguous capacity; supports explicit PT/ES/EN and typed memory',()=>{
 const q={min:120,max:120,approximate:false,unit:'UNITS' as const,currency:null,scope:'service',period:'MONTH' as const};
 for(const quote of ['capacidade de 120','vendemos 100 por mês e temos capacidade de 120','100 per month, capacity 120','120 por semana'])assert.equal(hasPeriodEvidence(quote,q),false,quote);
 for(const quote of ['capacidade de 120 por mês','capacity 120 per month','capacidad mensual 120',JSON.stringify({min:120,max:120,period:'MONTH'})])assert.equal(hasPeriodEvidence(quote,q),true,quote);
 assert.equal(hasPeriodEvidence('capacidade de 120',{...q,period:'ONCE'}),false);
 assert.equal(hasPeriodEvidence('estoque 120',{...q,period:'ONCE'}),true);
});

test('research reservation can shrink coverage while keeping the same model, price and accounting guard',()=>{
 const long={...price,id:'long',context_tier:'long',input_per_million:'4',cached_per_million:'0.4',cache_write_per_million:'5',output_per_million:'15'};
 const options=externalBudgetOptions({model:'gpt-6-sol',instructions:'Research',max_tool_calls:3},3,3500,[price,long],.01);
 assert.deepEqual(options.map(x=>x.calls),[3,2,1]);
 assert.ok(options[0].reserved>options[1].reserved&&options[1].reserved>options[2].reserved);
 const remaining=.5;const chosen=options.find(x=>x.reserved<=remaining)!;
 assert.equal(chosen.calls,1);assert.equal(chosen.reduced,true);assert.equal(chosen.request.model,'gpt-6-sol');
 assert.match(chosen.request.instructions!,/limited coverage/);
 assert.equal(reservationError('REQUEST_BUDGET').code,'REQUEST_BUDGET');
});
