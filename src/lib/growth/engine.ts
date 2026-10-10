import {bounds,sameScope,type Goal,type Observation,type Amount} from '../goals/domain';
import {goalProgress} from '../goals/calculation';
import {effectiveState} from '../business-model/domain';
import {METRIC_MAPPING,RULES,STALE_DAYS,dimensionFor,type Mapping} from './registry';
import {DIMENSIONS,RULE_SET_VERSION,SCHEMA_VERSION,source,cleanSources,type GrowthInput,type GrowthMap,type Assessment,type Dimension,type Applicability,type Guardrail,type MetricPoint,type Source} from './domain';

const dayDiff=(a:string,b:string)=>(Date.parse(b)-Date.parse(a))/86400000;
const canon=(s:string)=>s.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase();
const rule=(r:{id:string;version:string})=>({id:r.id,version:r.version});
function structural(input:GrowthInput){
 return input.structural.filter(o=>o.company_id===input.company&&o.is_current&&effectiveState(o,Date.parse(input.day+'T12:00:00Z'))==='CONFIRMED'&&!['HYPOTHESIS','INFERENCE'].includes(o.kind)&&o.confidence!=='LOW'&&input.entities.some(e=>e.id===o.entity_id&&e.company_id===input.company&&e.status==='ACTIVE'&&(input.scope.type==='COMPANY'||e.type==='COMPANY'||e.id===input.scope.id)));
}
export function businessApplicability(input:GrowthInput,d:Dimension):{value:Applicability;reason:string;sources:Source[];subscription:boolean}{
 const rows=structural(input).filter(o=>['business_type','description'].includes(o.attribute)&&input.entities.some(e=>e.id===o.entity_id&&(e.type==='COMPANY'||e.id===input.scope.id)));
 const texts=rows.map(o=>canon(o.data.text??''));
 const once=texts.some(s=>/\b(one.time.project|one.off.project|projeto.unico|proyecto.unico)\b/.test(s)&&/sem recorrencia|sin recurrencia|non.recurring|no repeat|compra unica|one.time.project/.test(s));
 const recurring=texts.some(s=>/\b(subscription|assinatura|subscricao|suscripcion|recurring service)\b/.test(s));
 const known=texts.some(s=>/\b(retail|varejo|retalho|restaurant|restaurante|clinic|clinica|b2b|industry|industria|consultancy|consultoria|agency|agencia|subscription|assinatura|subscricao|suscripcion)\b/.test(s));
 const sources=rows.map(o=>({table:'business_observations',id:o.id,version:o.version,kind:o.kind}));
 if(once&&recurring)return {value:'UNKNOWN',reason:'APPLICABILITY_CONFLICT',sources,subscription:false};
 if(['FREQUENCY','RETENTION'].includes(d)&&once)return {value:'NOT_APPLICABLE',reason:'EXPLICIT_NON_RECURRING_MODEL',sources,subscription:false};
 if(['FREQUENCY','RETENTION'].includes(d)&&texts.some(s=>/consultancy|consultoria|b2b/.test(s))&&!recurring)return {value:'PARTIALLY_APPLICABLE',reason:'VERIFY_REPEAT_DEFINITION',sources,subscription:false};
 return {value:known||recurring||once?'APPLICABLE':'UNKNOWN',reason:known||recurring||once?'BUSINESS_MODEL':'BUSINESS_MODEL_MISSING',sources,subscription:recurring};
}
function selectedGoal(input:GrowthInput){
 const active=input.goals.filter(g=>g.company_id===input.company&&g.status==='ACTIVE'&&sameScope(g.spec.scope,input.scope));
 const g=input.goalId?active.find(g=>g.id===input.goalId):active.find(g=>g.spec.primary)??(active.length===1?active[0]:undefined);
 return {goal:g??null,active,ambiguous:!g&&active.length>1};
}
function point(o:Observation):MetricPoint{return {amount:o.amount,start:o.start!,end:o.end!,unit:o.unit,currency:o.currency,sources:source(o),kind:o.source==='SYSTEM_DERIVED'?'DERIVED_METRIC':'METRIC',formula:o.trace?.formula??null};}
function movement(a:Amount,b:Amount,unit:string){
 const before=bounds(a),after=bounds(b);if(!before||!after)return 0;
 const tolerance=unit==='percent'?RULES.trend.percentagePointTolerance:Math.max(Math.abs(before.min),Math.abs(before.max))*RULES.trend.relativeTolerance;
 return after.min>before.max+tolerance?1:after.max<before.min-tolerance?-1:0;
}
function goalSources(g:Goal):Source[]{return [{table:'goals',id:g.id,version:g.version,kind:'OBSERVATION'},{table:'business_memories',id:g.id,version:g.version,kind:'OBSERVATION'}];}
function comparable(a:Observation,b:Observation){return a.period===b.period&&a.unit===b.unit&&a.currency===b.currency&&sameScope(a.scope,b.scope)&&a.complete&&b.complete&&!!a.start&&!!b.end&&dayDiff(b.end,a.start)===1&&(a.period!=='CUSTOM_RANGE'||dayDiff(a.start,a.end!)===dayDiff(b.start!,b.end));}
function resolveMetric(input:GrowthInput,d:Dimension,goal:Goal|null,subscription:boolean){
 const mappings=METRIC_MAPPING[d];
 const available=mappings.filter(m=>input.observations.some(o=>o.company_id===input.company&&sameScope(o.scope,input.scope)&&o.metric===m.code));
 const explicit=goal&&mappings.find(m=>m.code===goal.spec.primary_metric);
 const linked=goal?.spec.links.filter(l=>l.role==='PRIMARY').map(l=>mappings.find(m=>m.code===l.metric)).filter((m):m is Mapping=>!!m)??[];
 const otherGoals=[...new Set(selectedGoal(input).active.map(g=>g.spec.primary_metric))].flatMap(code=>mappings.filter(m=>m.code===code));
 const contextual=subscription&&d==='RETENTION'?available.find(m=>m.code==='churn')??available.find(m=>m.code==='retention'):undefined;
 return {metric:explicit??(linked.length===1?linked[0]:undefined)??(otherGoals.length===1?otherGoals[0]:undefined)??contextual??(available.length===1?available[0]:null),reason:explicit||linked.length===1||otherGoals.length===1?'GOAL_METRIC':contextual?'SUBSCRIPTION_DEFINITION':available.length===1?'ONLY_MATCHING_DEFINITION':available.length?'AMBIGUOUS_METRIC':'METRIC_MISSING'};
}
export function evaluateDimension(input:GrowthInput,d:Dimension):Assessment{
 const selected=selectedGoal(input),app=businessApplicability(input,d),resolved=resolveMetric(input,d,selected.goal,app.subscription);
 const a:Assessment={dimension:d,applicability:app.value,status:'INSUFFICIENT_DATA',trend:'UNKNOWN',sufficiency:'INSUFFICIENT',confidence:'LOW',metric:resolved.metric?.code??null,metricDefinition:resolved.metric?.definition??null,current:null,baseline:null,target:null,gap:null,goalId:null,reason:resolved.reason,missing:[],quality:[],evidence:app.sources,rules:[rule(RULES.applicability),rule(RULES.availability)],opportunity:false};
 if(app.reason==='APPLICABILITY_CONFLICT'){a.reason=app.reason;a.missing.push(app.reason);return a;}
 if(app.value==='NOT_APPLICABLE'){a.status='NOT_APPLICABLE';a.reason=app.reason;a.confidence='MEDIUM';return a;}
 if(!resolved.metric){a.missing.push(resolved.reason);return a;}
 const mapping=resolved.metric;
 if(a.applicability==='UNKNOWN')a.applicability='PARTIALLY_APPLICABLE';
 const all=input.observations.filter(o=>o.company_id===input.company&&o.metric===mapping.code&&sameScope(o.scope,input.scope)&&o.source!=='EXTERNAL');
 const period=selected.goal?.spec.period!=='UNKNOWN'?selected.goal?.spec.period:undefined;
 const currency=mapping.unit==='money'?(selected.goal?.spec.currency??input.currency):null;
 const candidates=all.filter(o=>o.unit===mapping.unit&&(!period||o.period===period)&&(o.unit!=='money'||!currency||o.currency===currency));
 if(new Set(candidates.map(o=>o.currency)).size>1){a.missing.push('CURRENCY_CONFLICT');return a;}
 if(!period&&new Set(candidates.map(o=>o.period)).size>1){a.missing.push('PERIOD_DEFINITION');return a;}
 const rows=candidates.filter(o=>o.start&&o.end&&o.end<=input.day).sort((a,b)=>b.end!.localeCompare(a.end!)||b.observed_at.localeCompare(a.observed_at)||Number(a.source==='SYSTEM_DERIVED')-Number(b.source==='SYSTEM_DERIVED')||a.id.localeCompare(b.id));
 const latest=rows[0];if(!latest){a.missing.push(all.length?'SCOPE_PERIOD_CURRENCY':'METRIC_MISSING');return a;}
 a.evidence.push(...source(latest));
 const conflicts=(o:Observation)=>rows.filter(r=>r.start===o.start&&r.end===o.end).some(r=>r.quality==='CONFLICTING'||JSON.stringify(bounds(r.amount))!==JSON.stringify(bounds(o.amount)));
 if(conflicts(latest)){a.quality.push('CONFLICT');a.missing.push('CORRECT_CONFLICT');return a;}
 if(!latest.complete||latest.quality!=='VALID'||latest.confidence==='LOW'||!bounds(latest.amount)){a.quality.push('UNVERIFIED_OR_PARTIAL');a.missing.push('COMPLETE_COMPARABLE_PERIOD');return a;}
 if(dayDiff(latest.end!,input.day)>STALE_DAYS[latest.period]){a.quality.push('STALE');a.missing.push('CURRENT_OBSERVATION');return a;}
 a.current=point(latest);
 const goalOptions=selected.active.filter(g=>g.spec.primary_metric===mapping.code&&g.spec.period===latest.period&&g.spec.currency===latest.currency);
 const goal=goalOptions.find(g=>g.id===selected.goal?.id)??(goalOptions.length===1?goalOptions[0]:null);
 const higher=goal?.spec.direction==='DECREASE'?false:goal?.spec.direction==='INCREASE'?true:mapping.higherIsBetter;
 const dedup=rows.filter((o,i)=>o.complete&&o.quality==='VALID'&&o.confidence!=='LOW'&&!conflicts(o)&&rows.findIndex(r=>r.start===o.start&&r.end===o.end)===i);
 const previous=dedup.find(o=>o.end!<latest.start!&&comparable(latest,o));
 a.sufficiency=previous?'SUFFICIENT':'PARTIALLY_SUFFICIENT';a.confidence=previous&&latest.confidence==='HIGH'&&previous.confidence==='HIGH'?'HIGH':'MEDIUM';
 if(previous){
  a.baseline=point(previous);a.evidence.push(...source(previous));a.rules.push(rule(RULES.comparison),rule(RULES.trend));
  const change=movement(previous.amount,latest.amount,latest.unit)*(higher?1:-1);
  const older=dedup.find(o=>o.end!<previous.start!&&comparable(previous,o));
  const earlier=older?movement(older.amount,previous.amount,latest.unit)*(higher?1:-1):0;
  a.trend=change&&earlier&&change!==earlier?'VOLATILE':change>0?'IMPROVING':change<0?'DETERIORATING':'STABLE';
  if(older)a.evidence.push(...source(older));
  a.status=a.trend==='DETERIORATING'||a.trend==='VOLATILE'?'ATTENTION':'STABLE';a.reason=a.trend==='DETERIORATING'?'INTERNAL_DECLINE':a.trend==='VOLATILE'?'INTERNAL_VOLATILITY':a.trend==='IMPROVING'?'INTERNAL_IMPROVEMENT':'INTERNAL_STABILITY';
 }else{a.reason='HISTORY_MISSING';a.missing.push('COMPARABLE_HISTORY');}
 if(goal){
  const p=goalProgress(goal,rows,input.day,input.limited);a.target=goal.spec.target;a.gap=p.gap;a.goalId=goal.id;a.evidence.push(...goalSources(goal));a.rules.push(rule(RULES.goal));
  if(a.sufficiency==='SUFFICIENT'&&!p.limitations.some(x=>['stale','conflict','bounded_history','approximate'].includes(x))){
   if(['AT_RISK','MISSED'].includes(p.trajectory)){a.status='ATTENTION';a.reason='GOAL_REFERENCE_GAP';}
   else if(['ACHIEVED','AHEAD_OF_REFERENCE','ON_REFERENCE'].includes(p.trajectory)&&['IMPROVING','STABLE'].includes(a.trend)){a.status='HEALTHY';a.reason='GOAL_ALIGNED';}
   if(a.status==='HEALTHY'&&a.trend==='IMPROVING'&&p.gap&&bounds(p.gap)!.min>0){a.opportunity=true;a.reason='GOAL_LINKED_OPPORTUNITY';}
  }
 }else if(goalOptions.length>1){a.quality.push('GOAL_CONFLICT');a.confidence='LOW';}
 if(latest.amount.approximate||latest.amount.min!==null||previous&&(previous.amount.approximate||previous.amount.min!==null)){a.quality.push('APPROXIMATE_OR_RANGE');a.confidence='LOW';a.sufficiency='PARTIALLY_SUFFICIENT';a.opportunity=false;if(a.status==='HEALTHY')a.status='STABLE';}
 if(['CONVERSION','RETENTION'].includes(d)){
  const denominator:Record<string,string>={conversion:'leads',proposal_close_rate:'proposals',visitor_conversion:'store_visitors',appointment_conversion:'requested_appointments',retention:'eligible_customers',churn:'eligible_customers',renewal_rate:'eligible_contracts',repeat_purchase_rate:'eligible_customers'};
  const samples=input.observations.filter(o=>o.company_id===input.company&&sameScope(o.scope,input.scope)&&o.start===latest.start&&o.end===latest.end&&o.metric===denominator[mapping.code]);
  if(!samples.length||new Set(samples.map(o=>JSON.stringify(bounds(o.amount)))).size!==1||samples.some(o=>!o.complete||o.quality!=='VALID'||o.confidence==='LOW'||o.amount.approximate||!bounds(o.amount)||bounds(o.amount)!.min<30)){a.quality.push('SAMPLE_LIMITED');a.sufficiency='PARTIALLY_SUFFICIENT';a.confidence='LOW';a.opportunity=false;if(a.status==='HEALTHY')a.status='STABLE';}
 }
 if(input.limited){a.quality.push('BOUNDED_HISTORY');a.sufficiency='PARTIALLY_SUFFICIENT';a.confidence='LOW';a.opportunity=false;}
 a.evidence=cleanSources(a.evidence);return a;
}
export function evaluateGuardrails(input:GrowthInput,dimensions:Assessment[]):Guardrail[]{
 const out:Guardrail[]=[];
 const capacityRows=input.observations.filter(o=>o.company_id===input.company&&sameScope(o.scope,input.scope)&&o.metric==='capacity_utilization'&&o.unit==='percent'&&o.end&&o.end<=input.day&&dayDiff(o.end,input.day)<=STALE_DAYS[o.period]).sort((a,b)=>b.end!.localeCompare(a.end!));
 const capacity=capacityRows[0];
 if(capacity&&bounds(capacity.amount)&&bounds(capacity.amount)!.max>=100)out.push({kind:'CAPACITY',state:bounds(capacity.amount)!.min>=100&&!capacity.amount.approximate&&capacity.complete&&capacity.quality==='VALID'&&capacity.confidence!=='LOW'&&!capacityRows.some(o=>o.start===capacity.start&&o.end===capacity.end&&JSON.stringify(bounds(o.amount))!==JSON.stringify(bounds(capacity.amount)))?'BREACH':'UNKNOWN',reason:'CAPACITY_BOUND',sources:capacityRows.filter(o=>o.start===capacity.start&&o.end===capacity.end).flatMap(source),scope:capacity.scope,period:[capacity.start,capacity.end]});
 const margin=dimensions.find(d=>d.dimension==='MARGIN');
 if(margin?.status==='ATTENTION')out.push({kind:'MARGIN',state:margin.confidence==='LOW'?'UNKNOWN':'BREACH',reason:'MARGIN_PRESSURE',sources:margin.evidence,scope:input.scope,period:[margin.current?.start??null,margin.current?.end??null]});
 for(const goal of input.goals.filter(g=>g.company_id===input.company&&g.status==='ACTIVE'&&sameScope(g.spec.scope,input.scope))){
  // A protective limit must still be evaluated when the goal's main result is missing.
  for(const link of goal.spec.links.filter(l=>l.role==='GUARDRAIL')){
   const records=input.observations.filter(o=>o.company_id===input.company&&o.metric===link.metric&&sameScope(o.scope,input.scope)&&o.period===goal.spec.period&&o.end&&o.end<=input.day&&o.source!=='EXTERNAL'&&(o.unit!=='money'||o.currency===goal.spec.currency)).sort((a,b)=>b.end!.localeCompare(a.end!));
   const o=records[0],v=o?bounds(o.amount):null;if(!o||!v)continue;
   const same=records.filter(r=>r.start===o.start&&r.end===o.end);
   const uncertain=!o.complete||o.quality!=='VALID'||o.confidence==='LOW'||o.amount.approximate||dayDiff(o.end!,input.day)>STALE_DAYS[o.period]||same.some(r=>r.quality!=='VALID'||JSON.stringify(bounds(r.amount))!==JSON.stringify(v));
   if(link.min!==null&&v.min<link.min||link.max!==null&&v.max>link.max)out.push({kind:link.metric.includes('margin')?'MARGIN':link.metric.includes('capacity')?'CAPACITY':'CONSTRAINT',state:!uncertain&&(link.min!==null&&v.max<link.min||link.max!==null&&v.min>link.max)?'BREACH':'UNKNOWN',reason:'EXPLICIT_GUARDRAIL',sources:[...goalSources(goal),...same.flatMap(source)],scope:input.scope,period:[o.start,o.end]});
  }
 }
 for(const c of input.constraints.slice(0,8)){
  const t=canon(c.value),kind=/cash|caixa|capital|caja/.test(t)?'CASH':/equipe|equipa|team|equipo/.test(t)?'TEAM':/quality|qualidade|calidad|atras|complaint|reclam/.test(t)?'QUALITY':/proprietario|owner|dueno|fundador/.test(t)?'OWNER_DEPENDENCY':'CONSTRAINT';
  out.push({kind,state:'CONTEXT',reason:'REPORTED_CONSTRAINT',sources:[{table:'business_memories',id:c.id,version:c.version,kind:'OBSERVATION'}],scope:input.scope,period:[null,null]});
 }
 for(const o of structural(input).filter(o=>['constraint','owner_dependence'].includes(o.attribute)).slice(0,6)){
  out.push({kind:o.attribute==='owner_dependence'?'OWNER_DEPENDENCY':'CONSTRAINT',state:'CONTEXT',reason:'STRUCTURAL_CONSTRAINT',sources:[{table:'business_observations',id:o.id,version:o.version,kind:o.kind}],scope:input.scope,period:[o.data.period_start,o.data.period_end]});
 }
 return out.slice(0,10);
}
export function evaluateGrowth(input:GrowthInput):GrowthMap{
 const chosen=selectedGoal(input),dimensions=DIMENSIONS.map(d=>evaluateDimension(input,d)),guardrails=evaluateGuardrails(input,dimensions),limitations:string[]=[];
 if(!chosen.goal)limitations.push(chosen.ambiguous?'MULTIPLE_GOALS':'NO_ACTIVE_GOAL');
 if(input.limited)limitations.push('BOUNDED_HISTORY');
 if(dimensions.some(d=>d.sufficiency!=='SUFFICIENT'&&d.status!=='NOT_APPLICABLE'))limitations.push('PARTIAL_MAP');
 const windows=[...new Set(dimensions.flatMap(d=>d.current?[d.current.start+':'+d.current.end]:[]))];
 if(windows.length>1)limitations.push('MIXED_PERIODS');
 const currencies=[...new Set(dimensions.flatMap(d=>d.current?.currency?[d.current.currency]:[]))];if(currencies.length>1)limitations.push('MIXED_CURRENCIES');
 const opposing=chosen.active.some(a=>chosen.active.some(b=>a.id!==b.id&&a.spec.primary_metric===b.spec.primary_metric&&a.spec.direction!==b.spec.direction));
 if(opposing)limitations.push('GOAL_CONFLICT');
 const blocked=guardrails.some(g=>g.state==='BREACH'||['CASH','TEAM','OWNER_DEPENDENCY','CONSTRAINT'].includes(g.kind));
 for(const d of dimensions){if(blocked)d.opportunity=false;else if(d.opportunity)d.status='OPPORTUNITY';}
 const candidates=dimensions.filter(d=>d.status==='ATTENTION'&&d.sufficiency==='SUFFICIENT'&&d.confidence!=='LOW'&&d.trend!=='VOLATILE');
 let eligible=candidates.filter(d=>!(d.dimension==='ACQUISITION'&&(blocked||dimensions.some(other=>other.dimension==='CONVERSION'&&other.status==='ATTENTION'))));
 const direct=dimensionFor(chosen.goal?.spec.primary_metric??null);
 if(direct&&eligible.some(d=>d.dimension===direct))eligible=eligible.filter(d=>d.dimension===direct);
 const growthObjective=chosen.goal&&['GROWTH','SALES','MARKETING','PROFITABILITY','CUSTOMER'].includes(chosen.goal.spec.type);
 let primary:Dimension|null=null;
 if(chosen.goal&&!opposing&&!chosen.ambiguous&&windows.length<=1&&!input.limited&&eligible.length===1&&(direct===eligible[0].dimension||growthObjective))primary=eligible[0].dimension;
 if(primary){dimensions.find(d=>d.dimension===primary)!.status='CONSTRAINING';dimensions.find(d=>d.dimension===primary)!.rules.push(rule(RULES.bottleneck));}
 const secondary=candidates.filter(d=>d.dimension!==primary).map(d=>d.dimension).slice(0,2);
 const focusReason=opposing?'GOAL_CONFLICT':blocked?'GUARDRAIL_FIRST':primary?'SUPPORTED_FOCUS':secondary.length>1?'MULTIPLE_ATTENTION':!chosen.goal?'GOAL_NEEDED':'NO_UNIQUE_BOTTLENECK';
 const sources=cleanSources([...dimensions.flatMap(d=>d.evidence),...guardrails.flatMap(g=>g.sources),...(chosen.goal?goalSources(chosen.goal):[]),...input.context]);
 return {schemaVersion:SCHEMA_VERSION,ruleSetVersion:RULE_SET_VERSION,summaryVersion:1,company:input.company,scope:input.scope,goalId:chosen.goal?.id??null,periodStart:windows.length===1?windows[0].split(':')[0]:null,periodEnd:windows.length===1?windows[0].split(':')[1]:null,status:limitations.length?'LIMITED':'READY',dimensions,guardrails,primary,secondary,focusReason,nextStep:blocked?'CHECK_GUARDRAIL':primary||secondary.length?'INVESTIGATE':!chosen.goal?'CLARIFY_GOAL':limitations.length?'COMPLETE_DATA':'MONITOR',confidence:primary?dimensions.find(d=>d.dimension===primary)!.confidence:'LOW',limitations,sources,external:input.external.slice(0,3),generatedDay:input.day};
}
