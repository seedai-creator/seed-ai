import { contribution } from "@/lib/commercial/unit-economics";
type Group = { cost_usd: number | null; plan_code?: string; feature?: string; model?: string; market_code?: string; user_id?: string };
type Report = {
  users:number; free_users:number; pro_users:number; activated_users:number;
  ai_cost_today_usd:number|null; ai_cost_month_usd:number|null; cached_tokens:number|null; input_tokens:number|null;
  cache_savings_usd:number|null; ai_errors:number; unknown_cost_operations:number;
  monthly_markets:{market_code:string;currency:string;users:number;pro_users:number;revenue_minor:number;ai_cost_usd:number|null}[];
  by_plan:Group[]; by_market:Group[]; by_feature:Group[]; by_model:Group[]; top_users:Group[];
};
type CostConfig={payment_percent:number;payment_fixed_minor:number;billing_percent:number;other_minor:number;usd_rate:number;source:string;as_of:string};
const money=(v:number|null)=>v==null?"Desconhecido":Number(v).toFixed(6);
export function EconomicsReport({data,config}:{data:Report;config:Record<string,CostConfig>}){
 return <div><p>FREE: {data.free_users} · PRO: {data.pro_users} · Ativados: {data.activated_users} · Conversão atual: {data.users?(100*data.pro_users/data.users).toFixed(1):"0"}%</p>
 <p>IA hoje: USD {money(data.ai_cost_today_usd)} · Mês: USD {money(data.ai_cost_month_usd)} · Média por conta/mês: USD {money(data.ai_cost_month_usd==null?null:data.users?data.ai_cost_month_usd/data.users:0)}</p>
 <p>Cache: {data.cached_tokens??"Desconhecido"} tokens · Taxa: {data.input_tokens&&data.cached_tokens!=null?(100*data.cached_tokens/data.input_tokens).toFixed(1)+"%":"Indisponível"} · Economia estimada: USD {money(data.cache_savings_usd)} · Erros: {data.ai_errors} · Operações sem custo final: {data.unknown_cost_operations}</p>
 <h3>Economia mensal por mercado</h3><p>MRR contratado no sandbox, não caixa recebido. Taxas configuradas são estimativas com fonte; contribuição antes de impostos e custos fixos.</p>
 <div className="commercial-table"><table><thead><tr><th>Mercado</th><th>Contas / PRO</th><th>MRR / ARPU PRO</th><th>IA USD</th><th>Pagamento</th><th>Contribuição</th></tr></thead><tbody>{(data.monthly_markets??[]).map(m=>{
 const c=config[m.market_code];const revenue=Number(m.revenue_minor);const fee=c?Math.round(revenue*c.payment_percent/100+m.pro_users*c.payment_fixed_minor):null;
 const result=contribution({revenue:{currency:m.currency,amount_minor:revenue},payment_cost:fee==null?null:{currency:m.currency,amount_minor:fee},billing_cost:c?{currency:m.currency,amount_minor:Math.round(revenue*c.billing_percent/100)}:null,other_variable_cost:c?{currency:m.currency,amount_minor:Math.round(c.other_minor)}:null,ai_cost_usd:m.ai_cost_usd==null?null:Number(m.ai_cost_usd),exchange_rate:c?{from:"USD",to:m.currency,rate:c.usd_rate,source:c.source,as_of:c.as_of}:null});
 return <tr key={m.market_code}><td>{m.market_code}</td><td>{m.users} / {m.pro_users}</td><td>{m.currency} {(revenue/100).toFixed(2)} / {m.pro_users?(revenue/100/m.pro_users).toFixed(2):"—"}</td><td>{money(m.ai_cost_usd)}</td><td>{fee==null?"Desconhecido":(fee/100).toFixed(2)}</td><td>{result.amount==null?"Desconhecida":result.amount.toFixed(2)}</td></tr>;
 })}</tbody></table></div>
 {([["Plano",data.by_plan],["Mercado",data.by_market],["Recurso",data.by_feature],["Modelo",data.by_model],["Maiores custos por usuário",data.top_users]] as [string,Group[]][]).map(([label,rows])=><details key={label}><summary>{label} — custos USD acumulados</summary>{rows.map((r,i)=><p key={i}>{r.plan_code??r.market_code??r.feature??r.model??r.user_id}: {money(r.cost_usd)}</p>)}</details>)}
 </div>;
}
