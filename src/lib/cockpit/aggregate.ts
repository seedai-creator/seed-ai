import type {Locale} from '../i18n/config';
import {type Goal,type Scope} from '../goals/domain';
import type {Progress} from '../goals/calculation';
import {goalLabels} from '../goals/labels';
import {nextStep,EMPTY_EXECUTION,type ExecutionSnapshot,type ExecutionRow} from '../execution/domain';
import type {Diagnosis} from '../diagnosis/contracts';
import type {Snapshot as GrowthSnapshot} from '../growth/domain';
import {growthLabels} from '../growth/labels';
import type {Signal} from '../radar/domain';
import {relevance} from '../radar/relevance';
import {narrative} from '../radar/narrative';
import {amountText,cockpitText,compactText,dateText} from './format';
import {expires,isFresh,REFRESH_MS,type Candidate,type ContextRow,type HomeState,type Item,type Priority,type Source,type ViewModel} from './domain';
import {prioritize} from './priority';

export type RadarRecord={id:string;company_id:string;version:number;updated_at:string;attention:string;payload:{signals:Signal[]}};
export type WeeklyRecord={id:string;company_id:string;generated_at:string;period_start:string;period_end:string;confidence:string;source_ids:string[];structured_report:{partial?:boolean;report?:{summary?:{text:string};next_priority?:{text:string}}}};
export type DiagnosisRecord={id:string;company_id:string;conversation_id:string;created_at:string;diagnosis:Diagnosis};
export type ConversationRecord={id:string;title:string;version:number;updated_at:string};
export type AggregationInput={company:string;locale:Locale;now:Date;known:boolean;partial:boolean;canConverse:boolean;goals:{goal:Goal;progress:Progress}[];scopes:{id:string;name:string}[];execution:ExecutionSnapshot|null;actionsLimited:boolean;growth:GrowthSnapshot|null;radar:RadarRecord[];weekly:WeeklyRecord[];diagnosis:DiagnosisRecord|null;conversation:ConversationRecord|null};
const sourceKeys=(rows:{table:string;id:string;version:number}[])=>rows.map(r=>'source:'+r.table+':'+r.id);
const scopeKey=(s:Scope)=>s.type+':'+(s.id??'company');
const metricKey=(metric:string|null,scope:Scope)=>'metric:'+scopeKey(scope)+':'+metric;
const value=(r:ExecutionRow,key:string)=>typeof r[key]==='string'?String(r[key]):'';
const context=(type:Source,id:string,version:number,updatedAt:string,kind:string,data:unknown):ContextRow[]=>[{key:'cockpit_'+type.toLowerCase(),source_id:id,version,kind,value:JSON.stringify(data),observed_at:updatedAt}];

export function aggregateCandidates(input:AggregationInput):Candidate[]{
 const {company,locale,now}=input,l=cockpitText(locale),all:Candidate[]=[];
 const add=(type:Source,id:string,version:string,updatedAt:string,days:number,priority:Priority,title:string,summary:string,ctx:ContextRow[],keys:string[]=[])=>{
  if(!isFresh(updatedAt,days,now)||!summary.trim())return null;
  const item:Item={ref:{type,id,version},title:compactText(title,150),summary:compactText(summary),eyebrow:l(type==='PLAN'?'continuity':type==='GOAL'?'goal':type==='GROWTH'?'growth':type==='WEEKLY'?'weekly':type==='RESULT'?'result':type==='DECISION'?'decision':type==='CONVERSATION'?'conversation':'attention'),note:null,updatedAt,cta:l('continue'),destination:'chat',facts:[],progress:null,progressLabel:null,dismissible:false};
  const candidate:Candidate={company,item,priority,storyKeys:keys,expiresAt:expires(updatedAt,days),acknowledged:false,context:ctx};all.push(candidate);return candidate;
 };
 const execution=input.execution??EMPTY_EXECUTION;
 for(const rows of [execution.plans,execution.actions,execution.results,execution.learnings,execution.decisions])if(rows.some(row=>row.company_id!==company))throw Error('COCKPIT_TENANT_MISMATCH');
 if(input.goals.some(row=>row.goal.company_id!==company)||input.growth&&input.growth.company_id!==company)throw Error('COCKPIT_TENANT_MISMATCH');
 const active=execution.plans.filter(p=>p.status==='ACTIVE');
 const next=nextStep({...execution,plans:active},now),plan=next?.plan;
 if(plan){
  if(plan.company_id!==company)throw Error('COCKPIT_TENANT_MISMATCH');
  const actions=execution.actions.filter(a=>a.strategy_id===plan.id&&a.status!=='CANCELLED');
  const time=[value(plan,'updated_at')||value(plan,'created_at'),...actions.map(a=>value(a,'updated_at')||value(a,'created_at'))].sort().at(-1)!;
  const old=!isFresh(time,45,now),title=value(plan,'current_focus')||value(plan,'name'),summary=value(next.action??plan,'title')||value(plan,'objective');
  const c=add('PLAN',plan.id,String(plan.version),time,365,old?'REVIEW':next.blocked?'BLOCKED':next.review?'REVIEW':'NEXT_STEP',title,summary,context('PLAN',plan.id,plan.version,time,'ACTION',{planId:plan.id,focus:title,objective:value(plan,'objective'),nextAction:next.action?{id:next.action.id,version:next.action.version,status:next.action.status,title:value(next.action,'title'),reason:value(next.action,'block_reason')}:null,needsReview:old||next.review}),['plan:'+plan.id]);
  if(c){c.planId=plan.id;c.item.note=old?l('stale'):next.blocked?l('blocked'):null;c.item.cta=l(old||next.review?'openPlan':'continue');
   if(old||next.review||input.actionsLimited)c.item.destination='plan';
   if(input.actionsLimited)c.item.progressLabel=l('planIncomplete');else if(actions.length)c.item.progressLabel=actions.filter(a=>a.status==='COMPLETED').length+' / '+actions.length+' '+l('completedActions');
   const review=value(plan,'review_date');if(review)c.item.facts.push({label:l('review'),value:dateText(review,locale)});
  }
 }
 const selected=input.goals.filter(g=>g.goal.status==='ACTIVE').sort((a,b)=>Number(b.goal.spec.primary)-Number(a.goal.spec.primary)||Number(b.goal.spec.plan_id===plan?.id)-Number(a.goal.spec.plan_id===plan?.id)||(a.goal.spec.deadline??'9999').localeCompare(b.goal.spec.deadline??'9999')||a.goal.id.localeCompare(b.goal.id))[0];
 if(selected){
  const {goal:g,progress:p}=selected,s=g.spec;if(g.company_id!==company)throw Error('COCKPIT_TENANT_MISMATCH');
  const risk=['AT_RISK','MISSED'].includes(p.trajectory),stale=p.limitations.includes('stale'),labels=goalLabels(locale),scope=s.scope.id?input.scopes.find(x=>x.id===s.scope.id)?.name??l('selectedScope'):l('companyScope');
  const c=add('GOAL',g.id,String(g.version),now.toISOString(),1,risk?'GOAL_RISK':'GOAL',s.title,labels[p.trajectory],context('GOAL',g.id,g.version,g.updated_at,'GOAL',{spec:s,progress:p}),['goal:'+g.id,metricKey(s.primary_metric,s.scope),...sourceKeys(p.sources)]);
  if(c){c.item.updatedAt=p.asOf??g.updated_at;c.item.note=stale?l('stale'):p.reference!==null?l('reference'):p.confidence==='LOW'?l('unknown'):null;
   c.item.facts=[{label:l('current'),value:amountText(p.current,s.unit,s.currency,locale)},{label:l('target'),value:amountText(s.target,s.unit,s.currency,locale)},{label:l('scope'),value:scope}];
   if(s.deadline)c.item.facts.push({label:l('deadline'),value:dateText(s.deadline,locale)});
   if(p.asOf)c.item.facts.push({label:l('period'),value:dateText(p.asOf,locale)});
   const percent=p.progress?.value;c.item.progress=percent!==null&&percent!==undefined&&!p.progress?.approximate&&p.confidence!=='LOW'&&percent>=0&&percent<=100?percent:null;
   c.item.destination=risk&&plan?'plan':stale?'company':'diagnosis';c.item.cta=l(risk&&plan?'openPlan':stale?'update':'openGoal');c.planId=risk?plan?.id:undefined;
  }
 }
 for(const row of input.radar){
  if(row.company_id!==company)throw Error('COCKPIT_TENANT_MISMATCH');
  const signals=row.payload.signals.filter(s=>relevance(s).surface);if(!signals.length)continue;
  const signal=signals[0],n=narrative(signals,locale),external=signal.knowledge_source_scope==='EXTERNAL_INTELLIGENCE';
  const rscope:Scope=signal.scope.entity?{type:signal.scope.product?'PRODUCT':signal.scope.location?'LOCATION':'CHANNEL',id:signal.scope.entity}:{type:'COMPANY',id:null};
  const c=add('RADAR',row.id,String(row.version),row.updated_at,2,row.attention==='HIGH_ATTENTION'?'HIGH_ATTENTION':signal.type==='OPPORTUNITY'?'OPPORTUNITY':'ATTENTION',n.evidence[0]?.label??n.title,n.summary,context('RADAR',row.id,row.version,row.updated_at,'INFERENCE',{signals}),['attention',metricKey(signal.metric,rscope),...sourceKeys(signals.flatMap(s=>s.evidence))]);
  if(c){c.item.note=external?l('external'):n.why;c.item.facts=n.evidence.slice(0,1).map(e=>({label:e.label,value:e.text}));c.item.links=n.evidence.flatMap(e=>e.externalSources).slice(0,2);c.item.cta=l('continue');c.item.dismissible=true;c.radarVersion=row.version;}
 }
 const d=input.diagnosis;
 if(d&&d.diagnosis.main_bottleneck&&d.diagnosis.evidence.length){
  if(d.company_id!==company)throw Error('COCKPIT_TENANT_MISMATCH');
  const c=add('DIAGNOSIS',d.id,d.created_at,d.created_at,14,'ATTENTION',d.diagnosis.main_bottleneck,d.diagnosis.situation,context('DIAGNOSIS',d.id,1,d.created_at,'INFERENCE',{diagnosis:d.diagnosis}),['attention',...(plan?['plan:'+plan.id]:[])]);
  if(c){c.item.note=l('preliminary');c.item.cta=l('understand');c.item.destination='conversation';c.conversationId=d.conversation_id;}
 }
 const growth=input.growth,g=growth?.payload;
 if(growth&&g&&g.company===company&&g.primary&&growth.status!=='SUPERSEDED'){
  const d=g.dimensions.find(d=>d.dimension===g.primary),labels=growthLabels(locale);
  if(d&&d.confidence!=='LOW'&&d.current){
   const c=add('GROWTH',growth.id,growth.input_fingerprint,growth.created_at,1,d.status==='OPPORTUNITY'?'OPPORTUNITY':'GROWTH',labels[d.dimension],labels[d.status],context('GROWTH',growth.id,1,growth.created_at,'INFERENCE',{dimension:d.dimension,status:d.status,confidence:d.confidence,notice:'Interpretation only. Numerical evidence must come from the canonical metric context.'}),['attention',metricKey(d.metric,g.scope),...sourceKeys(d.evidence)]);
   if(c){c.item.note=l('preliminary');c.item.facts=[{label:l('current'),value:amountText(d.current.amount,d.current.unit,d.current.currency,locale)},{label:l('period'),value:dateText(d.current.start,locale)+' – '+dateText(d.current.end,locale)}];c.item.destination='diagnosis';c.item.cta=l('openGrowth');c.growthDimension=d.dimension;}
  }
 }
 for(const w of input.weekly.slice(0,1)){
  if(w.company_id!==company)throw Error('COCKPIT_TENANT_MISMATCH');
  const report=w.structured_report.report;if(!report?.summary?.text||!w.source_ids.length)continue;
  const c=add('WEEKLY',w.id,w.generated_at,w.generated_at,9,'WEEKLY',l('weekly'),report.summary.text,context('WEEKLY',w.id,1,w.generated_at,'INFERENCE',{summary:report.summary.text,next:report.next_priority?.text,period:[w.period_start,w.period_end],sourceIds:w.source_ids}),w.source_ids.map(id=>'source:business_journal_entries:'+id));
  if(c){c.item.note=w.structured_report.partial||w.confidence==='LOW'?l('preliminary'):null;c.item.facts=[{label:l('period'),value:dateText(w.period_start,locale)+' – '+dateText(w.period_end,locale)}];c.item.destination='diagnosis';c.item.cta=l('openWeekly');c.item.dismissible=true;}
 }
 for(const r of execution.results.filter(r=>['COLLECTED','VALIDATED','ANALYZED'].includes(r.status)).slice(0,1)){
  const at=value(r,'updated_at')||value(r,'created_at'),learning=execution.learnings.find(x=>x.result_id===r.id&&x.status==='ACTIVE');
  const c=add('RESULT',r.id,String(r.version),at,14,'RESULT',l('result'),value(r,'description'),context('RESULT',r.id,r.version,at,'RESULT',{description:r.description,status:r.status,baseline:r.baseline_value,observed:r.observed_value,unit:r.unit,currency:r.currency_code,period:[r.period_start,r.period_end]}),r.plan_id?['plan:'+String(r.plan_id)]:[]);
  if(c){
   if(learning)c.context.push({key:'cockpit_learning',source_id:learning.id,version:learning.version,kind:'LEARNING',value:JSON.stringify({statement:learning.statement,evidence_level:learning.evidence_level}),observed_at:value(learning,'updated_at')||at});
   c.item.note=l('causality');c.planId=typeof r.plan_id==='string'?r.plan_id:undefined;
   if(typeof r.observed_value==='number'&&Number.isFinite(r.observed_value))c.item.facts.push({label:l('current'),value:amountText({value:r.observed_value,min:null,max:null,approximate:false},value(r,'unit'),value(r,'currency_code')||null,locale)});
   if(r.period_start&&r.period_end)c.item.facts.push({label:l('period'),value:dateText(String(r.period_start),locale)+' – '+dateText(String(r.period_end),locale)});
  }
 }
 for(const d of execution.decisions.filter(d=>(d.cockpit_material===true||execution.plans.some(p=>p.id===d.plan_id&&p.status==='ACTIVE'))&&!['REVIEWED','ABANDONED','SUPERSEDED','REVERSED'].includes(String(d.execution_status))&&!d.reviewed_at&&typeof d.review_date==='string'&&d.review_date<=now.toISOString().slice(0,10)).slice(0,1)){
  const at=value(d,'updated_at')||value(d,'created_at');const c=add('DECISION',d.id,String(d.version),at,365,'REVIEW',l('decision'),value(d,'decision'),context('DECISION',d.id,d.version,at,'DECISION',{decision:d.decision,reason:d.reason,hypothesis:d.hypothesis,review_date:d.review_date}),['decision:'+d.id]);if(c)c.item.note=l('preliminary');
 }
 if(input.conversation){const c=input.conversation;const x=add('CONVERSATION',c.id,String(c.version),c.updated_at,30,'CONTINUITY',l('conversation'),c.title,[],['conversation:'+c.id]);if(x){x.item.destination='conversation';x.item.cta=l('resume');x.conversationId=c.id;}}
 return all;
}
export function viewModel(input:AggregationInput,candidates:Candidate[]):ViewModel{
 const items=prioritize(candidates,input.company,input.now).map(c=>c.item),states:HomeState[]=[];
 if(!input.known&&!candidates.length)states.push('NEW_USER');else if(!candidates.length)states.push('LOW_CONTEXT');else states.push('ACTIVE_BUSINESS');
 states.push(candidates.some(c=>c.item.ref.type==='PLAN')?'ACTIVE_PLAN':'NO_ACTIVE_PLAN');
 if(!candidates.some(c=>c.item.ref.type==='GOAL'))states.push('NO_ACTIVE_GOAL');
 if(candidates.some(c=>c.priority==='GOAL_RISK'))states.push('GOAL_AT_RISK');
 if(candidates.some(c=>['HIGH_ATTENTION','ATTENTION','BLOCKED'].includes(c.priority)))states.push('ATTENTION_REQUIRED');
 if(candidates.some(c=>c.item.ref.type==='RESULT'))states.push('RECENT_RESULT');
 if(candidates.some(c=>c.item.ref.type==='WEEKLY'&&!c.acknowledged))states.push('WEEKLY_REVIEW_AVAILABLE');
 return {companyId:input.company,generatedAt:input.now.toISOString(),refreshAfterMs:REFRESH_MS,states,items,partial:input.partial,canConverse:input.canConverse};
}
