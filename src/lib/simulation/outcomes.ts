import {quantity,type Quantity} from './calculation';
import {validateAssumption,type Simulation} from './domain';
export type ObservedResult={id:string;description:string;metric_type:string;observed_value:number|null;unit:string|null;currency_code:string|null;period_start:string|null;period_end:string|null;created_at:string};
export type AssumptionAssessment={input_id:string;result_id:string;status:'SUPPORTED'|'NOT_SUPPORTED'|'UNKNOWN';reason:'COMPARABLE_OBSERVATION'|'COMPARABILITY_NOT_ESTABLISHED';expected:Quantity;observed:Quantity|null};
/** Exact metric names only; ambiguous scope or dates never silently become compatible. */
export function assessAssumptions(simulation:Simulation,results:ObservedResult[],scope:string,acceptedOn:string):AssumptionAssessment[]{
 const assessments:AssumptionAssessment[]=[];
 for(const input of simulation.extraction.inputs.filter(i=>i.kind!=='FACT')){
  const matching=results.filter(r=>r.metric_type.toLocaleLowerCase()===input.id.toLocaleLowerCase()||r.metric_type.toLocaleLowerCase()===input.label.toLocaleLowerCase()).slice(0,5);
  for(const r of matching){
   const expected=input.value;let observed:Quantity|null=null;
   const unit=r.unit?.toUpperCase();
   const period=expected.period;
   const start=r.period_start?new Date(r.period_start+'T00:00:00Z'):null,end=r.period_end?new Date(r.period_end+'T00:00:00Z'):null;
   const days=start&&end?(end.getTime()-start.getTime())/86400000+1:null;
   const periodMatches=period==='ONCE'||period==='DAY'&&days===1||period==='WEEK'&&days===7||period==='MONTH'&&!!start&&!!end&&start.getUTCDate()===1&&new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()+1,0)).getUTCDate()===end.getUTCDate()&&start.getUTCMonth()===end.getUTCMonth()&&start.getUTCFullYear()===end.getUTCFullYear()||period==='YEAR'&&!!start&&!!end&&start.toISOString().slice(5,10)==='01-01'&&end.toISOString().slice(5,10)==='12-31'&&start.getUTCFullYear()===end.getUTCFullYear();
   const afterAcceptance=r.created_at.slice(0,10)>=acceptedOn&&(!r.period_start||r.period_start>=acceptedOn);
   if(scope===expected.scope&&unit===expected.unit&&r.currency_code===expected.currency&&r.observed_value!==null&&periodMatches&&afterAcceptance){
    try{observed=quantity({...expected,min:r.observed_value,max:r.observed_value,approximate:false});}catch{/* Invalid observations remain unknown. */}
   }
   assessments.push({input_id:input.id,result_id:r.id,status:observed?validateAssumption(expected,observed):'UNKNOWN',reason:observed?'COMPARABLE_OBSERVATION':'COMPARABILITY_NOT_ESTABLISHED',expected,observed});
  }
 }
 return assessments;
}
