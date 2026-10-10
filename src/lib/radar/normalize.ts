import {assessAssumptions,type ObservedResult,type AssumptionAssessment} from '../simulation/outcomes';
import {bounds} from '../goals/domain';
import type {Simulation} from '../simulation/domain';
import type {Entry} from '../journal/domain';
import {localDay,shiftDay} from '../journal/domain';
import {effectiveState,type StoredObservation,type Entity,type Relationship} from '../business-model/domain';
import {RADAR_CONFIG as C,EMPTY_SCOPE,scopeKey,type Point,type Snapshot,type Source,type Scope,type Watch,type Capacity,type Assumption} from './domain';
export type Row={id:string;company_id:string;[key:string]:unknown};
const str=(x:unknown)=>typeof x==='string'?x:null;
const src=(table:string,r:{id:string;version?:unknown}):Source=>({table,id:r.id,version:Number(r.version??1)});
const range=(v:number,min:number|null=null,max:number|null=null,approximate=false)=>({min:min??v,max:max??v,approximate});
const canonicalUnit=(u:string|null)=>({COUNT:'count',UNITS:'count',PERCENT:'percent',RATIO:'ratio',BRL:'money',EUR:'money',USD:'money',GBP:'money'}[u??'']??u);
// Small explicit phrase families. A shared isolated word never establishes a complaint pattern.
export function problemTopic(description:string):string|null{
 const t=description.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase();
 if(/\b(atras\w* (?:na |de |da )?entrega|entrega\w* (?:\w+ ){0,2}atras|pedido\w* (?:\w+ ){0,2}atras|reclam\w* (?:\w+ ){0,3}(?:demora|prazo)|delivery delay|late deliver|delayed order|entrega tard|retraso (?:de |en )?(?:la )?entrega)\b/u.test(t))return 'delivery_delay';
 if(/\b(reclam\w* (?:\w+ ){0,3}(?:defeito|qualidade)|produto\w* (?:\w+ ){0,2}defeito|quality complaint|defective product|queja\w* (?:\w+ ){0,2}calidad)\b/u.test(t))return 'quality_complaint';
 if(/\b(preco alto|caro demais|too expensive|precio alto|demasiado caro)\b/u.test(t))return 'price_objection';
 return null;
}
export function journalPoints(entries:Entry[],day:string):Point[]{
 const rows=entries.filter(e=>!e.metric_data&&e.status==='ACTIVE'&&e.entry_type==='METRIC'&&e.value!==null&&e.metric_type&&e.unit&&e.period_start&&e.period_end);
 const points:Point[]=rows.map(e=>({metric:e.metric_type!,value:range(Number(e.value),null,null,/\b(aproximad\w*|cerca|around|about|roughly|mais ou menos|em media|en promedio)\b/i.test(e.evidence.normalize('NFKD').replace(/\p{M}/gu,''))),unit:e.unit!,currency:e.currency_code,scope:{product:e.product,channel:e.channel,location:e.location,entity:null},start:e.period_start!,end:e.period_end!,complete:e.period_end!<day&&!/\b(hoje|today|hoy|esta semana|essa semana|this week|este mes|neste mes|this month)\b/i.test(e.evidence.normalize('NFKD').replace(/\p{M}/gu,''))&&!['TODAY','THIS_WEEK','THIS_MONTH'].includes((e.metadata as {period?:string}).period??''),quality:e.confidence==='LOW'?'PROVISIONAL':'CONFIRMED',sources:[src('business_journal_entries',e)]}));
 for(const e of entries.filter(e=>e.metric_data&&e.status==='ACTIVE'&&e.entry_type==='METRIC')){
  const d=e.metric_data!,v=bounds({...d.amount,value:e.value===null?null:Number(e.value)});if(!v||!d.start||!d.end||d.source==='EXTERNAL')continue;
  points.push({metric:d.metric,value:{...v,approximate:d.amount.approximate},unit:d.unit,currency:d.currency,scope:{...EMPTY_SCOPE,entity:d.scope.id},start:d.start,end:d.end,complete:d.complete&&d.end<=day,quality:d.quality==='VALID'&&d.confidence!=='LOW'?'CONFIRMED':d.quality==='STALE'?'STALE':d.quality==='CONFLICTING'?'CONFLICTING':'PROVISIONAL',sources:[src('business_journal_entries',e)]});
 }
 for(const numerator of points.filter(p=>p.metric==='sales')){
  const denominators=points.filter(p=>p.metric==='leads'&&scopeKey(p.scope)===scopeKey(numerator.scope)&&p.start===numerator.start&&p.end===numerator.end&&p.value.min>0);
  const sales=points.filter(p=>p.metric==='sales'&&scopeKey(p.scope)===scopeKey(numerator.scope)&&p.start===numerator.start&&p.end===numerator.end);
  if(denominators.length!==1||sales.length!==1||numerator.value.max>denominators[0].value.min)continue;
  const d=denominators[0];points.push({...numerator,metric:'conversion',value:range(Number((numerator.value.min/d.value.min*100).toPrecision(12)),null,null,numerator.value.approximate||d.value.approximate),unit:'percent',currency:null,complete:numerator.complete&&d.complete,quality:numerator.quality==='CONFIRMED'&&d.quality==='CONFIRMED'?'CONFIRMED':'PROVISIONAL',sources:[...numerator.sources,...d.sources]});
 }
 return points;
}
export type RawSnapshot={company:string;timezone:string|null;journal:Entry[];entities:Entity[];observations:StoredObservation[];relations:Relationship[];plans:Row[];actions:Row[];decisions:Row[];experiments:Row[];results:Row[];events:Row[];simulations:Row[];watches:Watch[];limited:boolean};
export function normalizeSnapshot(raw:RawSnapshot,at=new Date()):Snapshot{
 const day=localDay(at,raw.timezone);if(!day)throw Error('RADAR_TIMEZONE_REQUIRED');
 for(const rows of [raw.journal,raw.entities,raw.observations,raw.relations,raw.plans,raw.actions,raw.decisions,raw.experiments,raw.results,raw.events,raw.simulations])if(rows.some(r=>r.company_id!==raw.company))throw Error('RADAR_SCOPE_INVALID');
 const active=new Set(raw.entities.filter(e=>e.status==='ACTIVE').map(e=>e.id));
 const points=journalPoints(raw.journal,day),capacities:Capacity[]=[],changes:Snapshot['changes']=[];
 const modelRows=raw.observations as (StoredObservation&{operation?:string;supersedes?:string})[];
 const corrected=new Set(modelRows.filter(o=>o.operation==='CORRECTION').map(o=>o.supersedes));
 for(const o of raw.observations){
  if(corrected.has(o.id)||!active.has(o.entity_id)||!['FACT','METRIC','DERIVED_METRIC'].includes(o.kind))continue;
  const entity=raw.entities.find(e=>e.id===o.entity_id)!;
  // Graph references never copy canonical metric values into structural observations.
  if(entity.reference_table)continue;
  const d=o.data,v=d.value??d.min;
  const scope:Scope={...EMPTY_SCOPE,entity:entity.id,product:entity.type==='PRODUCT_SERVICE'?entity.name:null,channel:entity.type==='CHANNEL'?entity.name:null,location:entity.type==='LOCATION'?entity.name:null};
  const quality=o.is_current?effectiveState(o,at.getTime()):o.state;
  if(o.is_current&&quality==='CONFIRMED'&&(o as StoredObservation&{operation?:string}).operation==='CHANGE'&&o.observed_at.slice(0,10)>=shiftDay(day,-30)&&o.observed_at.slice(0,10)<=day)changes.push({source:src('business_observations',o),scope,kind:o.attribute,related:raw.relations.some(r=>r.status==='ACTIVE'&&r.kind==='FACT'&&(r.source_id===entity.id||r.target_id===entity.id))});
  if(v===null||!d.unit)continue;
  if(d.period_start&&d.period_end)points.push({metric:o.attribute,value:range(v,d.min,d.max,d.approximate),unit:canonicalUnit(d.unit)!,currency:d.currency,scope,start:d.period_start,end:d.period_end,complete:d.period_end<day,quality:quality==='UNKNOWN'?'PROVISIONAL':quality,sources:[src('business_observations',o)]});
  if(o.attribute==='capacity'&&o.is_current){
   // Explicit graph connection + matching period unit; no guessed operating capacity.
   const links=raw.relations.filter(r=>r.status==='ACTIVE'&&r.kind==='FACT'&&r.type==='CONSUMES'&&r.target_id===entity.id);
   const units:Record<string,{period:'DAY'|'WEEK'|'MONTH';unit:string}>={'orders/day':{period:'DAY',unit:'count'},'pedidos/dia':{period:'DAY',unit:'count'},'units/day':{period:'DAY',unit:'count'},'units/month':{period:'MONTH',unit:'count'},'unidades/mes':{period:'MONTH',unit:'count'},'orders/week':{period:'WEEK',unit:'count'}};
   const unit=units[d.unit.toLowerCase().normalize('NFKD').replace(/\p{M}/gu,'')];if(!unit)continue;
   for(const link of links){const target=raw.entities.find(e=>e.id===link.source_id);if(!target)continue;capacities.push({value:range(v,d.min,d.max,d.approximate),metric:'sales',unit:unit.unit,period:unit.period,currency:null,scope:{...EMPTY_SCOPE,entity:target.id,product:target.type==='PRODUCT_SERVICE'?target.name:null},source:src('business_observations',o),sources:[src('business_observations',o),src('business_relationships',link),src('business_entities',target),src('business_entities',entity)],quality:quality==='UNKNOWN'?'PROVISIONAL':quality});}
  }
 }
 // Match named Journal scopes to exact structural entity names only, never fuzzy merge entities.
 for(const p of points){if(p.scope.entity)continue;const name=p.scope.product??p.scope.channel??p.scope.location;if(!name)continue;const type=p.scope.product?'PRODUCT_SERVICE':p.scope.channel?'CHANNEL':'LOCATION';const entities=raw.entities.filter(e=>e.type===type&&e.name===name&&e.status==='ACTIVE');if(entities.length===1)p.scope.entity=entities[0].id;}
 const problems=raw.journal.filter(e=>e.status==='ACTIVE'&&e.entry_type==='PROBLEM'&&e.event_date).flatMap(e=>{const topic=problemTopic(e.description);return topic?[{topic,scope:points.find(p=>p.scope.product===e.product&&p.scope.channel===e.channel&&p.scope.location===e.location)?.scope??{product:e.product,channel:e.channel,location:e.location,entity:null},day:e.event_date!,source:src('business_journal_entries',e),occurrence:e.source_message_id??e.id,confidence:e.confidence}]:[];});
 const plans=raw.plans.filter(p=>['ACTIVE','DRAFT'].includes(String(p.status)));
 const relevantScopes=raw.relations.filter(r=>r.status==='ACTIVE'&&r.kind==='FACT'&&['DEPENDS_ON','LIMITS'].includes(r.type)).flatMap(r=>points.filter(p=>p.scope.entity===r.source_id||p.scope.entity===r.target_id).map(p=>scopeKey(p.scope)));
 const tasks:Snapshot['tasks']=[];
 for(const a of raw.actions){const plan=plans.find(p=>p.id===a.strategy_id);const dependencies=raw.actions.some(b=>b.strategy_id===a.strategy_id&&Array.isArray(b.depends_on)&&b.depends_on.includes(a.id)&&!['COMPLETED','CANCELLED'].includes(String(b.status)));tasks.push({source:src('actions',a),kind:'ACTION',label:str(a.title)??undefined,status:String(a.status),due:str(a.deadline),review:null,strategic:!!plan&&(dependencies||Number(a.position)===0)&&!!(plan.objective||plan.goal_id),blocked:a.status==='BLOCKED',hasResult:raw.results.some(r=>r.action_id===a.id),scope:{...EMPTY_SCOPE,entity:a.id}});}
 for(const e of raw.experiments)tasks.push({source:src('experiments',e),kind:'EXPERIMENT',label:str(e.name)??undefined,status:String(e.execution_status),due:str(e.end_date),review:null,strategic:plans.some(p=>p.id===e.plan_id),blocked:false,hasResult:raw.results.some(r=>r.experiment_id===e.id),scope:{...EMPTY_SCOPE,entity:e.id}});
 for(const d of raw.decisions)tasks.push({source:src('decisions',d),kind:'DECISION',label:str(d.decision)??undefined,status:String(d.execution_status),due:null,review:str(d.review_date),strategic:!!d.plan_id||raw.simulations.some(s=>s.decision_id===d.id&&s.status==='ACCEPTED'),blocked:false,hasResult:raw.results.some(r=>r.decision_id===d.id),scope:{...EMPTY_SCOPE,entity:d.id}});
 for(const p of plans)tasks.push({source:src('strategies',p),kind:'PLAN',label:str(p.name)??undefined,status:String(p.status),due:null,review:str(p.review_date),strategic:!!p.primary_indicator,blocked:false,hasResult:raw.results.some(r=>r.plan_id===p.id),scope:{...EMPTY_SCOPE,entity:p.id}});
 const assumptions:Assumption[]=[];
 const assessments=raw.events.filter(e=>e.operation==='assumption_assessed');
 const seen=new Set<string>();
 for(const event of assessments){const a=event.after_state as AssumptionAssessment|null;if(!a)continue;const sim=raw.simulations.find(s=>s.id===event.entity_id&&s.status==='ACCEPTED');if(!sim)continue;const snapshot=sim.snapshot as Simulation;const selected=snapshot.scenarios.find(s=>s.id===sim.selected_scenario);if(!selected?.assumption_ids.includes(a.input_id))continue;const key=sim.id+':'+a.input_id;if(seen.has(key))continue;const result=raw.results.find(r=>r.id===a.result_id);if(!result||a.observed?.min!==Number(result.observed_value)||a.expected.currency!==result.currency_code||Date.parse(String(result.updated_at??result.created_at))>Date.parse(String(event.created_at)))continue;seen.add(key);assumptions.push({source:src('execution_events',event),simulationId:sim.id,resultSource:src('execution_results',result),status:a.status,scope:{...EMPTY_SCOPE,entity:sim.id},expected:a.expected,observed:a.observed,unit:a.expected.unit,currency:a.expected.currency,metric:key,accepted:true,material:true});}
 for(const sim of raw.simulations.filter(s=>s.status==='ACCEPTED')){
  const snapshot=sim.snapshot as Simulation;const selected=snapshot.scenarios?.find(s=>s.id===sim.selected_scenario);const decision=raw.decisions.find(d=>d.id===sim.decision_id);if(!selected||!decision||!str(decision.decision_date))continue;
  const linked=raw.results.filter(r=>r.decision_id===sim.decision_id||(sim.plan_id&&r.plan_id===sim.plan_id)||(sim.experiment_id&&r.experiment_id===sim.experiment_id));
  for(const input of snapshot.extraction.inputs.filter(i=>i.kind!=='FACT'&&selected.assumption_ids.includes(i.id))){const key=sim.id+':'+input.id;if(seen.has(key))continue;const matched=assessAssumptions({...snapshot,extraction:{...snapshot.extraction,inputs:[input]}},linked.filter(r=>r.scope===input.value.scope) as unknown as ObservedResult[],input.value.scope,String(decision.decision_date))[0];if(!matched||matched.status==='UNKNOWN')continue;seen.add(key);const result=linked.find(r=>r.id===matched.result_id)!;assumptions.push({source:src('decision_simulations',sim),simulationId:sim.id,resultSource:src('execution_results',result),status:matched.status,scope:{...EMPTY_SCOPE,entity:sim.id},expected:matched.expected,observed:matched.observed,unit:input.value.unit,currency:input.value.currency,metric:key,accepted:true,material:true});}
 }
 return {company:raw.company,day,points,problems,capacities,watches:raw.watches,tasks,assumptions,limited:raw.limited,relevantScopes,changes};
}
export const radarWindow=(day:string)=>shiftDay(day,-C.historyDays);
