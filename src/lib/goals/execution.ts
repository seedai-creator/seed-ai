import {EMPTY_AMOUNT,periodShape,type Observation} from './domain';
// Legacy results have a plan/experiment scope, not an implicit whole-company scope.
// Chat results also extracted into the Journal are skipped by their source identity.
export type ExecutionMetric={id:string;company_id:string;plan_id:string|null;experiment_id:string|null;metric_type:string|null;observed_value:number|null;unit:string|null;currency_code:string|null;period_start:string|null;period_end:string|null;status:string;confidence:Observation['confidence'];version:number;source_message_id:string;created_at:string};
export function executionObservation(r:ExecutionMetric,existing:Observation[]):Observation|null{
 if(!r.metric_type||r.observed_value===null||!r.unit||!r.plan_id&&!r.experiment_id||existing.some(o=>o.source_message_id===r.source_message_id&&o.metric===r.metric_type))return null;
 const period=periodShape(r.period_start,r.period_end);return {id:r.id,company_id:r.company_id,metric:r.metric_type,amount:{...EMPTY_AMOUNT,value:Number(r.observed_value)},boolean:null,text:null,unit:r.unit,currency:r.currency_code,period,start:r.period_start,end:r.period_end,complete:period!=='UNKNOWN'&&period!=='CUSTOM_RANGE'&&r.status!=='PARTIAL',scope:r.experiment_id?{type:'EXPERIMENT',id:r.experiment_id}:{type:'PLAN',id:r.plan_id},source:'USER_EXPLICIT',confidence:r.confidence,quality:['COLLECTED','VALIDATED','ANALYZED'].includes(r.status)?'VALID':'PROVISIONAL',attribution:null,version:r.version,observed_at:r.created_at,source_message_id:r.source_message_id,source_table:'execution_results'};
}
