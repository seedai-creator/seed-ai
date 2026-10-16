"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {requireAdmin} from "@/lib/commercial/server";
import {stripeClient} from "@/lib/billing/stripe";
import {READINESS_CATEGORIES} from "@/lib/commercial/markets";
import {validatePolicy, type UsagePolicy} from "@/lib/commercial/contracts";
import {validId} from "@/lib/auth/validation";
export async function changeCatalog(form:FormData){
 try{
  const {db,user}=await requireAdmin("SUPER_ADMIN");const operation=String(form.get("operation")),reason=String(form.get("reason")??"").trim();
  if(form.get("confirmed")!=="on"||reason.length<5||reason.length>1000)throw new Error("CONFIRMATION_REQUIRED");
  let value:Record<string,unknown>;
  if(operation==="PRICE_CHANGED"){
   const market=String(form.get("market_code")),id=String(form.get("provider_price_id"));if(!["BR","PT","ES","US"].includes(market)||!/^price_[a-zA-Z0-9]+$/.test(id))throw new Error("INVALID_PRICE");
   const price=await stripeClient().prices.retrieve(id);if(price.livemode||!price.active||!price.unit_amount||price.recurring?.interval!=="month"||price.recurring.interval_count!==1||price.recurring.usage_type!=="licensed")throw new Error("INVALID_PRICE");
   value={market_code:market,currency:price.currency.toUpperCase(),amount_minor:price.unit_amount,provider_price_id:price.id,provider_product_id:typeof price.product==="string"?price.product:price.product.id};
  }else if(operation==="AI_PRICE_CHANGED"){
   const model=String(form.get("model")).trim(),source=String(form.get("source")).trim();
   if(model.length<1||model.length>150||source.length<10||source.length>1000)throw new Error("INVALID_SOURCE");
   value={model,source};for(const field of ["input_per_million","cached_per_million","cache_write_per_million","output_per_million"]){const v=String(form.get(field));if(!/^\d{1,9}(\.\d{1,6})?$/.test(v))throw new Error("INVALID_RATE");value[field]=v;}
  }else if(operation==="READINESS_CHANGED"){
   const market=String(form.get("market_code"));if(!["BR","PT","ES","US"].includes(market))throw new Error("INVALID_MARKET");
   value={market_code:market,readiness:Object.fromEntries(READINESS_CATEGORIES.map(k=>{const pass=form.get(k)==="on",evidence=String(form.get(k+"_evidence")??"").trim();if((pass&&!evidence)||evidence.length>1000)throw new Error("INVALID_EVIDENCE");return[k,{pass,evidence}];}))};
  }else if(operation==="FLAGS_CHANGED"){
   const plan=String(form.get("plan_code"));if(!["FREE","PRO"].includes(plan))throw new Error("INVALID_PLAN");
   value={plan_code:plan,flags:Object.fromEntries(["chat","memory","diagnosis","strategies","decisions","experiments","advanced_analysis","growth_map","weekly_checkin","goals","metrics","reports"].map(k=>[k,form.get(k)==="on"]))};
  }else if(operation==="SUBSCRIPTION_OVERRIDE"){
   const userId=String(form.get("user_id")),expires=String(form.get("expires_at")),kind=String(form.get("kind"));
   if(!validId(userId)||!Number.isFinite(Date.parse(expires))||!["INTERNAL","BETA","FOUNDER","TEMPORARY_PRO","CUSTOM_ALLOWANCE"].includes(kind))throw new Error("INVALID_OVERRIDE");
   const settings:Record<string,unknown> = kind==="CUSTOM_ALLOWANCE" ? {policy:validatePolicy(JSON.parse(String(form.get("policy"))) as UsagePolicy)} : {plan_code:"PRO",market_access:kind!=="TEMPORARY_PRO"};
   value={user_id:userId,expires_at:new Date(expires).toISOString(),kind,settings};
  }else if(operation==="ROLLOUT_CHANGED" || operation==="INTERNATIONAL_LAUNCH_CHANGED"){
   value={enabled:form.get("enabled")==="on",environment:"test"};
   if(operation==="ROLLOUT_CHANGED" && value.enabled){
    for(const model of [process.env.OPENAI_ECONOMY_MODEL||process.env.OPENAI_MODEL,process.env.OPENAI_STRATEGIC_MODEL||process.env.OPENAI_MODEL]){
     const price=await db.from("ai_model_pricing").select("id").eq("model",model??"").is("effective_to",null).single();if(price.error||!price.data)throw new Error("PRICING_REQUIRED");
    }
   }
  }else if(operation==="ROUTING_CHANGED"){
   value={classification_output_tokens:Number(form.get("classification_output_tokens")),diagnosis_output_tokens:Number(form.get("diagnosis_output_tokens"))};
   if(Object.values(value).some(v=>!Number.isSafeInteger(v)||Number(v)<128||Number(v)>32768))throw new Error("INVALID_BUDGET");
  }else if(operation==="ECONOMICS_CHANGED"){
   const market=String(form.get("market_code")),source=String(form.get("source")??"").trim(),as_of=String(form.get("as_of")??"");
   if(!["BR","PT","ES","US"].includes(market)||source.length<10||source.length>1000||!Number.isFinite(Date.parse(as_of)))throw new Error("INVALID_EVIDENCE");
   const config:Record<string,unknown>={source,as_of};
   for(const key of ["payment_percent","payment_fixed_minor","billing_percent","other_minor","usd_rate"]){const n=Number(form.get(key));if(!Number.isFinite(n)||n<0||n>1e7)throw new Error("INVALID_COST");config[key]=n;}
   if(Number(config.usd_rate)<=0 || Number(config.payment_percent)>100 || Number(config.billing_percent)>100)throw new Error("INVALID_COST");
   const previous=await db.from("commercial_settings").select("value").eq("id","economics").single();if(previous.error)throw new Error("UNAVAILABLE");value={...previous.data.value,[market]:config};
  }else if(operation==="AI_COST_RECONCILED"){
   const id=String(form.get("request_id")),cost=Number(form.get("cost"));if(!validId(id)||!Number.isFinite(cost)||cost<0)throw new Error("INVALID_COST");
   const r=await db.rpc("reconcile_ai_cost",{p_actor:user.id,p_request:id,p_cost:cost,p_evidence:reason});if(r.error)throw new Error("RECONCILE_FAILED");value={};
  }else throw new Error("INVALID_OPERATION");
  const {error}=operation==="AI_COST_RECONCILED"?{error:null}:await db.rpc("change_commercial_catalog",{p_actor:user.id,p_operation:operation,p_value:value,p_reason:reason});if(error)throw new Error("SAVE_FAILED");
 }catch{redirect("/admin/catalog?error=update");}
 revalidatePath("/admin");revalidatePath("/billing");redirect("/admin/catalog?saved=1");
}
