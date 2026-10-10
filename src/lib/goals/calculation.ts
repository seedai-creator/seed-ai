import {bounds,goalMissing,sameScope,type Goal,type Observation,type Amount,type CalculationTrace} from './domain';
export const FORMULAS={conversion:{inputs:['sales','leads'],units:['count','count'],unit:'percent',factor:100},average_ticket:{inputs:['revenue','sales'],units:['money','count'],unit:'money',factor:1},cac:{inputs:['acquisition_spend','new_customers'],units:['money','count'],unit:'money',factor:1},roas:{inputs:['attributed_revenue','ad_spend'],units:['money','money'],unit:'ratio',factor:1},capacity_utilization:{inputs:['actual_volume','known_capacity'],units:['count','count'],unit:'percent',factor:100},repeat_purchase_rate:{inputs:['returning_customers','eligible_customers'],units:['count','count'],unit:'percent',factor:100}} as const;
export function deriveMetric(formula:keyof typeof FORMULAS,a:Observation,b:Observation,at=new Date()):Observation|null{
 const f=FORMULAS[formula],x=bounds(a.amount),y=bounds(b.amount);
 if(!x||!y||y.min<=0||a.id===b.id||a.company_id!==b.company_id||!sameScope(a.scope,b.scope)||!a.start||a.start!==b.start||a.end!==b.end||!a.complete||!b.complete||a.quality!=='VALID'||b.quality!=='VALID'||a.source==='EXTERNAL'||b.source==='EXTERNAL'||a.metric!==f.inputs[0]||b.metric!==f.inputs[1]||a.unit!==f.units[0]||b.unit!==f.units[1])return null;
 if(f.units[0]==='money'&&!a.currency||f.units[1]==='money'&&a.currency!==b.currency||formula==='roas'&&!a.attribution)return null;
 if(['conversion','repeat_purchase_rate'].includes(formula)&&x.max>y.min)return null;
 // Multiply before dividing to avoid artificial decimals such as 14.000000000000002.
 const lo=x.min*f.factor/y.max,hi=x.max*f.factor/y.min;if(!Number.isFinite(hi)||Math.abs(hi)>1e15)return null;
 const amount:Amount=lo===hi?{value:lo,min:null,max:null,approximate:a.amount.approximate||b.amount.approximate}:{value:null,min:lo,max:hi,approximate:true};
 const trace:CalculationTrace={formula,version:1,inputs:[a,b].map(o=>({id:o.id,version:o.version,table:o.source_table})),calculated_at:at.toISOString(),period:[a.start,a.end],scope:a.scope,output:amount};
 return {...a,id:`derived:${formula}:${a.id}:${b.id}`,metric:formula,amount,unit:f.unit,currency:f.unit==='money'?a.currency:null,source:'SYSTEM_DERIVED',source_table:'derived',confidence:a.confidence==='LOW'||b.confidence==='LOW'?'LOW':a.confidence==='HIGH'&&b.confidence==='HIGH'?'HIGH':'MEDIUM',trace};
}
export type Trajectory='INSUFFICIENT_DATA'|'AHEAD_OF_REFERENCE'|'ON_REFERENCE'|'SLIGHTLY_BEHIND'|'AT_RISK'|'ACHIEVED'|'MISSED';
export type Progress={current:Amount|null;gap:Amount|null;progress:Amount|null;range:'WITHIN_RANGE'|'BELOW_RANGE'|'ABOVE_RANGE'|'OVERLAPS_RANGE'|null;trajectory:Trajectory;coverage:'UNKNOWN'|'LIMITED'|'PARTIAL'|'SUFFICIENT'|'STRONG';confidence:'LOW'|'MEDIUM'|'HIGH';missing:string[];limitations:string[];sources:{id:string;version:number;table:string}[];asOf:string|null;requiredPace:number|null;observedPace:number|null;reference:number|null;percentagePoints:number|null;relativeChange:number|null;guardrails:{metric:string;status:'BREACH'|'OK'|'UNKNOWN'}[];formula:'GOAL_PROGRESS_LINEAR_V1'};
function point(lo:number,hi=lo,approximate=false):Amount{return lo===hi?{value:lo,min:null,max:null,approximate}:{value:null,min:lo,max:hi,approximate:true};}
const days=(a:string,b:string)=>(Date.parse(b)-Date.parse(a))/86400000;
export function goalProgress(goal:Goal,observations:Observation[],today:string,limited=false):Progress{
 const s=goal.spec,missing=goalMissing(s),r:Progress={current:null,gap:null,progress:null,range:null,trajectory:'INSUFFICIENT_DATA',coverage:'UNKNOWN',confidence:'LOW',missing,limitations:[],sources:[],asOf:null,requiredPace:null,observedPace:null,reference:null,percentagePoints:null,relativeChange:null,guardrails:[],formula:'GOAL_PROGRESS_LINEAR_V1'};
 if(limited)r.limitations.push('bounded_history');if(goal.status!=='ACTIVE')r.limitations.push('inactive_goal');
 if(s.direction==='COMPLETE'){
  const m=s.milestones;if(m.length&&m.every(x=>x.weight!==null)){const total=m.reduce((a,b)=>a+b.weight!,0);r.progress=point(m.filter(x=>x.done).reduce((a,b)=>a+b.weight!,0)/total*100);}
  r.coverage=m.length?'PARTIAL':'UNKNOWN';if(m.length&&m.every(x=>x.done)&&s.success&&!missing.length)r.trajectory='ACHIEVED';else if(s.deadline&&s.deadline<today)r.trajectory='MISSED';return r;
 }
 const all=observations.filter(o=>o.company_id===goal.company_id&&o.metric===s.primary_metric);
 if(all.some(o=>!sameScope(s.scope,o.scope)))r.limitations.push('scope_mismatch');
 if(all.some(o=>sameScope(s.scope,o.scope)&&o.currency!==s.currency))r.limitations.push('currency_mismatch');
 const compatible=all.filter(o=>sameScope(s.scope,o.scope)&&o.unit===s.unit&&o.currency===s.currency&&o.period===s.period&&o.start&&o.end&&o.end<=today&&o.source!=='EXTERNAL'&&(s.period!=='CUSTOM_RANGE'||s.baseline_start&&s.baseline_end&&days(o.start,o.end)===days(s.baseline_start,s.baseline_end))).sort((a,b)=>b.end!.localeCompare(a.end!));
 if(all.some(o=>o.period!==s.period||!o.complete))r.limitations.push('period_mismatch');
 const latest=compatible[0];if(!latest){r.missing.push('observation');return r;}
 r.asOf=latest.end;r.sources=compatible.slice(0,12).map(o=>({id:o.id,version:o.version,table:o.source_table}));
 const samePeriod=compatible.filter(o=>o.start===latest.start&&o.end===latest.end);
 if(samePeriod.some(o=>JSON.stringify(bounds(o.amount))!==JSON.stringify(bounds(latest.amount)))||latest.quality==='CONFLICTING'){r.limitations.push('conflict');return r;}
 if(latest.quality!=='VALID'||!latest.complete||latest.confidence==='LOW'){r.limitations.push('unreliable_observation');return r;}
 const stale={DAY:3,WEEK:14,MONTH:62,QUARTER:120,YEAR:400,CUSTOM_RANGE:90,UNKNOWN:0}[s.period];
 if(days(latest.end!,today)>stale){r.limitations.push('stale');return r;}
 const current=bounds(latest.amount),target=bounds(s.target),base=bounds(s.baseline);r.current=latest.amount;r.coverage='LIMITED';
 if(!current||!target||missing.length)return r;
 const series=[...new Map(compatible.filter(o=>o.quality==='VALID'&&o.complete&&o.confidence!=='LOW'&&!compatible.some(other=>other.start===o.start&&other.end===o.end&&(other.quality==='CONFLICTING'||JSON.stringify(bounds(other.amount))!==JSON.stringify(bounds(o.amount))))).map(o=>[o.start+':'+o.end,o])).values()];
 r.coverage=limited?'PARTIAL':series.length>=3?'STRONG':series.length>=2?'SUFFICIENT':'PARTIAL';r.confidence=r.coverage==='STRONG'&&!latest.amount.approximate?'HIGH':'MEDIUM';
 if(latest.amount.approximate||s.baseline.approximate||s.target.approximate){r.limitations.push('approximate');r.confidence='LOW';}
 const decrease=s.direction==='DECREASE';
 r.gap=decrease?point(current.min-target.max,current.max-target.min,latest.amount.approximate||s.target.approximate):point(target.min-current.max,target.max-current.min,latest.amount.approximate||s.target.approximate);
 if(s.direction==='RANGE'){r.range=current.min>=target.min&&current.max<=target.max?'WITHIN_RANGE':current.max<target.min?'BELOW_RANGE':current.min>target.max?'ABOVE_RANGE':'OVERLAPS_RANGE';}
 const meets=(o:Observation)=>{const v=bounds(o.amount);return !!v&&(s.direction==='RANGE'?v.min>=target.min&&v.max<=target.max:decrease?v.max<=target.min:v.min>=target.max);};
 const enough=series.length>=s.consistency_periods&&new Set(series.slice(0,s.consistency_periods).map(o=>o.start+':'+o.end)).size===s.consistency_periods;
 if(enough&&!s.target.approximate&&series.slice(0,s.consistency_periods).every(o=>meets(o)&&!o.amount.approximate)&&s.direction!=='MAINTAIN')r.trajectory='ACHIEVED';
 if(base&&['INCREASE','DECREASE','REACH'].includes(s.direction)&&s.baseline.value!==null&&s.target.value!==null&&s.target.value!==s.baseline.value){
  const delta=s.target.value-s.baseline.value,vals=[(current.min-s.baseline.value)/delta*100,(current.max-s.baseline.value)/delta*100];r.progress=point(Math.min(...vals),Math.max(...vals),latest.amount.approximate||s.baseline.approximate||s.target.approximate);
  if(latest.amount.value!==null){r.percentagePoints=s.unit==='percent'?latest.amount.value-s.baseline.value:null;r.relativeChange=s.baseline.value!==0?(latest.amount.value-s.baseline.value)/Math.abs(s.baseline.value)*100:null;}
  if(s.start&&s.deadline&&days(s.start,s.deadline)>0&&latest.end!>s.start&&series.length>=2&&!limited&&!r.limitations.includes('approximate')){
   r.requiredPace=delta/days(s.start,s.deadline);r.reference=s.baseline.value+r.requiredPace*Math.min(days(s.start,latest.end!),days(s.start,s.deadline));
   r.observedPace=latest.amount.value===null?null:(latest.amount.value-s.baseline.value)/days(s.start,latest.end!);
   const expected=Math.min(100,days(s.start,latest.end!)/days(s.start,s.deadline)*100),actual=r.progress.value;
   if(r.trajectory!=='ACHIEVED'&&actual!==null)r.trajectory=actual>expected+5?'AHEAD_OF_REFERENCE':actual>=expected-5?'ON_REFERENCE':actual>=expected-15?'SLIGHTLY_BEHIND':'AT_RISK';
  }
 }
 if(s.deadline&&s.deadline<today&&r.trajectory!=='ACHIEVED'){if(latest.end!>=s.deadline)r.trajectory='MISSED';else r.limitations.push('deadline_result_missing');}
 if(s.direction==='MAINTAIN')r.limitations.push('sustained_observation_required');
 for(const link of s.links.filter(l=>l.role==='GUARDRAIL')){const records=observations.filter(o=>o.company_id===goal.company_id&&o.metric===link.metric&&sameScope(o.scope,s.scope)&&o.start===latest.start&&o.end===latest.end&&o.complete&&o.source!=='EXTERNAL'&&(o.unit!=='money'||o.currency===s.currency)).sort((a,b)=>b.observed_at.localeCompare(a.observed_at)),o=records[0],v=o?bounds(o.amount):null;
  const conflicting=records.some(other=>other.quality==='CONFLICTING'||JSON.stringify(bounds(other.amount))!==JSON.stringify(v));
  r.guardrails.push({metric:link.metric,status:!v||conflicting||o.quality!=='VALID'||o.confidence==='LOW'||o.amount.approximate?'UNKNOWN':link.min!==null&&v.max<link.min||link.max!==null&&v.min>link.max?'BREACH':link.min!==null&&v.min<link.min||link.max!==null&&v.max>link.max?'UNKNOWN':'OK'});
 }
 if(r.guardrails.some(g=>g.status==='BREACH'))r.limitations.push('guardrail_breach');
 return r;
}
