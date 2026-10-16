import type {Goal,Observation} from './domain';
import type {Progress} from './calculation';
export function buildGoalContext(items:{goal:Goal;progress:Progress}[],observations:Observation[],constraints:{id:string;value:string}[],question:string){
 const words=question.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)??[];
 const selected=items.filter(x=>['ACTIVE','DRAFT'].includes(x.goal.status)).sort((a,b)=>Number(b.goal.spec.primary)-Number(a.goal.spec.primary)||words.filter(w=>b.goal.spec.title.toLowerCase().includes(w)).length-words.filter(w=>a.goal.spec.title.toLowerCase().includes(w)).length).slice(0,2);
 const rows:{key:string;kind:string;value:string;observed_at:string;source_id:string;version:number;state?:string;approximate?:boolean}[]=[];
 for(const {goal:g,progress:p} of selected){
  rows.push({key:'goal_'+g.id,kind:'GOAL',source_id:g.id,version:g.version,observed_at:g.updated_at,value:JSON.stringify({title:g.spec.title,status:g.status,spec:g.spec,trajectory:p.trajectory,coverage:p.coverage,confidence:p.confidence,missing:p.missing,limitations:p.limitations,guardrails:p.guardrails,constraints:constraints.slice(0,3),notice:'The goal is a commitment, not observed performance. Classify goal evidence as OBSERVATION/key goal. Reference trajectory is not a forecast. Learning does not modify the target.'})});
  const current=observations.find(o=>o.id===p.sources[0]?.id);
  if(current&&p.current)rows.push({key:'goal_metric_'+g.id,kind:current.source==='SYSTEM_DERIVED'?'DERIVED_METRIC':'METRIC',source_id:current.id,version:current.version,observed_at:current.observed_at,state:current.quality==='VALID'?'CONFIRMED':current.quality,approximate:current.amount.approximate,value:JSON.stringify({metric:current.metric,...current.amount,unit:current.unit,currency:current.currency,scope:current.scope,period:[current.start,current.end],source:current.source,trace:current.trace??null,notice:'Approximate values/ranges remain uncertain. No midpoint.'})});
  for(const [name,amount,unit] of [['progress',p.progress,'percent'],['gap',p.gap,g.spec.unit]] as const)if(amount){rows.push({key:`goal_${name}_${g.id}`,kind:'DERIVED_METRIC',source_id:g.id,version:g.version,observed_at:p.asOf??g.updated_at,state:'CONFIRMED',approximate:amount.approximate,value:JSON.stringify({...amount,unit,currency:unit==='money'?g.spec.currency:null,scope:g.spec.scope,period:p.asOf,formula:name==='gap'?'GOAL_GAP_V1':p.formula,inputs:p.sources,notice:'Calculated by software, not an observed fact. Reference only; not a forecast.'})});}
 }
 return rows;
}
