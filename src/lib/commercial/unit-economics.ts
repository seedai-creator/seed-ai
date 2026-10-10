export type Money = { amount_minor: number; currency: string };
export type ExchangeRate = { from: string; to: string; rate: number; source: string; as_of: string };
export function contribution(input:{revenue:Money;payment_cost:Money|null;billing_cost:Money|null;other_variable_cost:Money|null;ai_cost_usd:number|null;exchange_rate:ExchangeRate|null}){
 const {revenue}=input;
 if(!Number.isSafeInteger(revenue.amount_minor)||revenue.amount_minor<0)throw new Error("INVALID_REVENUE");
 const costs=[input.payment_cost,input.billing_cost,input.other_variable_cost];
 if(costs.some(c=>c===null)||input.ai_cost_usd===null)return {status:"UNKNOWN" as const,reason:"COST_DATA_MISSING",amount:null};
 if(costs.some(c=>c!.currency!==revenue.currency||!Number.isSafeInteger(c!.amount_minor)||c!.amount_minor<0)||!Number.isFinite(input.ai_cost_usd)||input.ai_cost_usd<0)throw new Error("INVALID_COST");
 let ai=input.ai_cost_usd;
 if(revenue.currency!=="USD"){
  const fx=input.exchange_rate;
  if(!fx||fx.from!=="USD"||fx.to!==revenue.currency||!Number.isFinite(fx.rate)||fx.rate<=0||!fx.source.trim()||!Number.isFinite(Date.parse(fx.as_of)))return {status:"UNKNOWN" as const,reason:"FX_DATA_MISSING",amount:null};
  ai*=fx.rate;
 }
 return {status:"ESTIMATED" as const,currency:revenue.currency,amount:revenue.amount_minor/100-costs.reduce((sum,c)=>sum+c!.amount_minor/100,0)-ai,label:"contribution_before_taxes_and_fixed_costs"};
}
