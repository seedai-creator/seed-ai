import test from "node:test";
import assert from "node:assert/strict";
import { calculateAiCost, type AiPricing } from "../src/lib/commercial/ai-cost";
import { effectivePlan, getPlanEntitlements, usageState, canCreateCompany, isValueMoment } from "../src/lib/commercial/entitlements";
import { routeAiModel } from "../src/lib/commercial/model-router";
import { canActivateMarket, validateMarketReadiness, resolveCommercialMarket, READINESS_CATEGORIES } from "../src/lib/commercial/markets";
import { validateTestPrice, checkoutCanActivatePlan } from "../src/lib/billing/contracts";
import type { Market, Plan, UsagePolicy } from "../src/lib/commercial/contracts";
import {contribution} from "../src/lib/commercial/unit-economics";
const policy: UsagePolicy = { window:"lifetime",target_usd:0.1,approaching_usd:0.12,soft_usd:0.15,warning_usd:0.18,heavy_usd:0.22,hard_usd:0.25,interactions:30,diagnoses:3,max_concurrent:1,requests_per_minute:6,user_day_usd:0.25,user_month_usd:0.25,global_day_usd:10 };
const plan: Plan={code:"FREE",available:true,company_limit:1,strategy_limit:1,flags:{diagnosis:true},policy};
const market: Market={code:"PT",locale:"pt-PT",currency:"EUR",timezone:"Europe/Lisbon",status:"READY",signup_enabled:false,free_enabled:true,pro_enabled:false,billing_enabled:false,disable_new_signups:false,disable_new_subscriptions:false,disable_ai_requests:false,flags:{diagnosis:false},readiness:{}};
test("usage boundaries and limits preserve data access independently",()=>{
 assert.equal(usageState(0,0,policy),"NORMAL");assert.equal(usageState(.12,0,policy),"APPROACHING_LIMIT");assert.equal(usageState(.15,0,policy),"SOFT_LIMIT");assert.equal(usageState(.25,0,policy),"HARD_LIMIT");assert.equal(usageState(0,30,policy),"HARD_LIMIT");assert.throws(()=>usageState(NaN,0,policy));
 assert.equal(canCreateCompany(plan,0),true);assert.equal(canCreateCompany(plan,2),false);
});
test("subscription lifecycle does not trust checkout redirects",()=>{
 const now=new Date("2026-09-28"),s={plan_code:"PRO" as const,status:"active" as const,current_period_end:"2026-10-01",cancel_at_period_end:true};
 assert.equal(effectivePlan(s,null,now),"PRO");assert.equal(effectivePlan({...s,status:"past_due"},null,now),"FREE");assert.equal(effectivePlan(s,null,new Date("2026-10-02")),"FREE");assert.equal(checkoutCanActivatePlan(),false);
 assert.equal(effectivePlan(null,{plan_code:"PRO",expires_at:"2026-10-01"},now),"PRO");assert.equal(effectivePlan(null,{plan_code:"PRO",expires_at:"2026-09-01"},now),"FREE");
});
test("flags follow global, plan, market, unexpired override",()=>{
 assert.equal(getPlanEntitlements({diagnosis:false},plan,market,null,new Date()).diagnosis,false);
 assert.equal(getPlanEntitlements({},plan,market,{flags:{diagnosis:true},expires_at:"2099-01-01"},new Date()).diagnosis,true);
 assert.equal(isValueMoment({hasCompany:true,diagnosis:true,bottleneck:"Conversão",action:""}),false);
});
test("AI cost splits cached tokens and counts reasoning only once",()=>{
 const pricing: AiPricing={id:"fixture",provider:"openai",model:"test-model",effective_from:"2026-01-01",effective_to:null,input_per_million:"2",cached_per_million:"0.5",output_per_million:"10",currency:"USD",processing_tier:"default",context_tier:"standard"};
 const input={provider:"openai",model:"test-model",at:"2026-09-28",processing_tier:"default",context_tier:"standard",pricing,tool_cost_usd:"0",usage:{input_tokens:1000,cached_input_tokens:400,output_tokens:200,reasoning_tokens:100,total_tokens:1200}};
 const cost=calculateAiCost(input);assert.equal(cost.status,"ESTIMATED");assert.equal(cost.total_usd,"0.003400000000");
 assert.equal(calculateAiCost({...input,pricing:null}).status,"UNKNOWN");assert.equal(calculateAiCost({...input,usage:null}).status,"UNKNOWN");assert.equal(calculateAiCost({...input,usage:{...input.usage,cached_input_tokens:null}}).status,"UNKNOWN");assert.throws(()=>calculateAiCost({...input,usage:{...input.usage,cached_input_tokens:1001}}));
});
test("router never downgrades a strategic task solely for soft limit",()=>{
 const models={economy:{model:"cheap",capabilities:["structured"],max_output_tokens:800},strategic:{model:"deep",capabilities:["structured"],max_output_tokens:3800}};
 const input={feature:"diagnosis" as const,complexity:"LOW" as const,plan:"FREE" as const,market:"BR" as const,usage_state:"SOFT_LIMIT" as const,required_capabilities:["structured"],risk_level:"LOW" as const};
 assert.equal(routeAiModel(input,models,true).model,"deep");assert.equal(routeAiModel({...input,feature:"classification"},models,true).model,"cheap");assert.throws(()=>routeAiModel({...input,usage_state:"HARD_LIMIT"},models,true));assert.throws(()=>routeAiModel({...input,required_capabilities:["vision"]},models,true));
});
test("cache writes are priced separately and missing write usage remains unknown",()=>{
 const pricing: AiPricing={id:"fixture",provider:"openai",model:"test-model",effective_from:"2026-01-01",effective_to:null,input_per_million:"2",cached_per_million:"0.2",cache_write_per_million:"2.5",output_per_million:"10",currency:"USD",processing_tier:"default",context_tier:"standard"};
 const input={provider:"openai",model:"test-model",at:"2026-09-30",processing_tier:"default",context_tier:"standard",pricing,tool_cost_usd:"0",usage:{input_tokens:1000,cached_input_tokens:200,cache_write_tokens:300,output_tokens:100,reasoning_tokens:50,total_tokens:1100}};
 const cost=calculateAiCost(input);assert.equal(cost.status,"ESTIMATED");assert.equal(cost.total_usd,"0.002790000000");
 assert.equal(calculateAiCost({...input,usage:{...input.usage,cache_write_tokens:null}}).status,"UNKNOWN");
 assert.equal(calculateAiCost({...input,pricing:{...pricing,cache_write_per_million:null}}).status,"UNKNOWN");
 assert.throws(()=>calculateAiCost({...input,usage:{...input.usage,cache_write_tokens:801}}));
});
test("international activation requires evidence and is test-only",()=>{
 const technical={validPrice:true,providerConfigured:true,costProtectionReady:true};assert.equal(validateMarketReadiness(market,technical).ready,false);
 const complete={...market,readiness:Object.fromEntries(READINESS_CATEGORIES.map(k=>[k,{pass:true,evidence:"FIXTURE: simulated check"}]))};const r=validateMarketReadiness(complete,technical);
 assert.equal(canActivateMarket(complete,r,"test"),true);assert.equal(canActivateMarket(complete,r,"production"),false);
 assert.equal(validateMarketReadiness(complete,{...technical,providerConfigured:false}).ready,false);
 assert.equal(resolveCommercialMarket("BR","PT","US"),"BR");assert.equal(resolveCommercialMarket(null,null,null),null);
});
test("test pricing rejects live, incorrect amounts and yearly products",()=>{
 const expected={currency:"BRL",amount_minor:9999},p={active:true,livemode:false,currency:"brl",unit_amount:9999,recurring:{interval:"month",interval_count:1,usage_type:"licensed"}};
 assert.doesNotThrow(()=>validateTestPrice(p,expected));assert.throws(()=>validateTestPrice({...p,livemode:true},expected));assert.throws(()=>validateTestPrice({...p,unit_amount:1999},expected));assert.throws(()=>validateTestPrice({...p,recurring:{...p.recurring,interval:"year"}},expected));
});
test("contribution never combines BRL and USD without an explicit sourced exchange rate",()=>{
 const input={revenue:{amount_minor:9999,currency:"BRL"},payment_cost:{amount_minor:100,currency:"BRL"},billing_cost:{amount_minor:50,currency:"BRL"},other_variable_cost:{amount_minor:0,currency:"BRL"},ai_cost_usd:1,exchange_rate:null};
 assert.equal(contribution(input).status,"UNKNOWN");
 const c=contribution({...input,exchange_rate:{from:"USD",to:"BRL",rate:5,source:"TEST FIXTURE ONLY",as_of:"2026-09-28"}});assert.equal(c.status,"ESTIMATED");assert.ok(Math.abs(c.amount!-93.49)<.00001);
 assert.equal(contribution({...input,payment_cost:null}).status,"UNKNOWN");
});
