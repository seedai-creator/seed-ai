import {deriveRatio,numericConflict,type StoredObservation,type Entity} from './domain';

export function consistency(observations:StoredObservation[]){
 const derived:NonNullable<ReturnType<typeof deriveRatio>>[]=[],conflicts:{type:'NUMERIC_CONFLICT';reported_id:string;derived:NonNullable<ReturnType<typeof deriveRatio>>}[]=[];
 const inputs=observations.filter(o=>o.is_current&&o.state==='CONFIRMED');
 for(const formula of ['conversion','ticket','utilization'] as const){
 const left=formula==='conversion'?'sales':formula==='ticket'?'revenue':'sales',right=formula==='conversion'?'leads':formula==='ticket'?'sales':'capacity';
 for(const a of inputs.filter(o=>o.attribute===left))for(const b of inputs.filter(o=>o.attribute===right)){
 const result=deriveRatio(a,b,formula);if(!result)continue;derived.push(result);
 for(const report of inputs.filter(o=>o.attribute===formula))if(numericConflict(report,result))conflicts.push({type:'NUMERIC_CONFLICT',reported_id:report.id,derived:result});
 }
 }
 return {derived,conflicts};
}
// A remaining share is computable only for one explicit partition in the same source and period.
export function remainingShare(entities:Entity[],observations:StoredObservation[]) {
 const groups=new Map<string,StoredObservation[]>();
 for(const o of observations){if(o.attribute!=='share'||!o.source_message_id||o.state!=='CONFIRMED'||!o.is_current||o.data.unit!=='percent'||!entities.some(e=>e.id===o.entity_id&&e.company_id===o.company_id&&e.type==='REVENUE_STREAM'))continue;
 const key=JSON.stringify([o.company_id,o.source_message_id,o.data.period_start,o.data.period_end]);groups.set(key,[...(groups.get(key)??[]),o]);}
 return [...groups.values()].flatMap(rows=>{
 const unknown=rows.filter(o=>o.data.value===null),known=rows.filter(o=>o.data.value!==null);
 if(unknown.length!==1||!known.length||! /\b(restante|resto|remaining|remainder)\b/i.test(unknown[0].data.text??'')||rows.some(o=>o.data.min!==null))return [];
 const sum=known.reduce((v,o)=>v+o.data.value!,0);if(sum>100)return [];
 return [{kind:'DERIVED_METRIC' as const,source_type:'SYSTEM_DERIVED',formula:'remaining_share:1',entity_id:unknown[0].entity_id,value:Number((100-sum).toPrecision(12)),unit:'percent',approximate:rows.some(o=>o.data.approximate),inputs:rows.map(o=>({id:o.id,version:o.version})),period_start:rows[0].data.period_start,period_end:rows[0].data.period_end,calculated_at:new Date().toISOString()}];
 });
}
