import {literalNumber} from '../reliability/validate';
import {obj,str,nullable,list,validDate} from '../journal/domain';
import {validateSchema,type Reliability} from '../reliability/contracts';
import type {Diagnosis} from '../diagnosis/contracts';
import {validId} from '../auth/validation';
export const EXECUTION_SCHEMA=obj({commands:list(obj({
 kind:{type:'string',enum:['ACCEPT','ACTION','DECISION','DECISION_STATUS','EXPERIMENT','EXPERIMENT_STATUS','RESULT','REVIEW']},
 target_type:{type:'string',enum:['RECOMMENDATION','ACTION','DECISION','EXPERIMENT','PLAN']},
 target_id:nullable(str),version:nullable({type:'number'}),simulation_id:nullable(str),
 scope:{type:'string',enum:['CURRENT_COMPANY','OTHER','SIMULATION','AMBIGUOUS']},
 assertion:{type:'string',enum:['EXPLICIT','AMBIGUOUS','HYPOTHETICAL']},quote:str,
 status:nullable(str),description:nullable(str),reason:nullable(str),hypothesis:nullable(str),indicator:nullable(str),
 baseline:nullable({type:'number'}),observed:nullable({type:'number'}),target:nullable({type:'number'}),
 unit:nullable(str),currency:nullable(str),start:nullable(str),end:nullable(str)
}),3)});
export type ExecutionCommand={kind:'ACCEPT'|'ACTION'|'DECISION'|'DECISION_STATUS'|'EXPERIMENT'|'EXPERIMENT_STATUS'|'RESULT'|'REVIEW';target_type:'RECOMMENDATION'|'ACTION'|'DECISION'|'EXPERIMENT'|'PLAN';target_id:string|null;version:number|null;scope:string;assertion:string;quote:string;status:string|null;description:string|null;reason:string|null;hypothesis:string|null;indicator:string|null;baseline:number|null;observed:number|null;target:number|null;unit:string|null;currency:string|null;start:string|null;end:string|null};
export type ExecutionRow={id:string;company_id:string;version:number;status:string;[key:string]:unknown};
export type ExecutionSnapshot={allowed_operations?:string[];simulations?:ExecutionRow[];recommendations:ExecutionRow[];plans:ExecutionRow[];actions:ExecutionRow[];decisions:ExecutionRow[];experiments:ExecutionRow[];results:ExecutionRow[];learnings:ExecutionRow[];weekly:Record<string,unknown>[]};
export const EMPTY_EXECUTION:ExecutionSnapshot={recommendations:[],plans:[],actions:[],decisions:[],experiments:[],results:[],learnings:[],weekly:[]};
const targets={RECOMMENDATION:'recommendations',ACTION:'actions',DECISION:'decisions',EXPERIMENT:'experiments',PLAN:'plans'} as const;
export function parseExecution(raw:unknown,message:string,snapshot:ExecutionSnapshot,reliability:Reliability|null,attachment=false):ExecutionCommand[]{
 if(raw===undefined)return []; // old stored fixtures remain readable
 if(raw&&typeof raw==='object'&&'commands' in raw&&Array.isArray(raw.commands))raw={...raw,commands:raw.commands.map(c=>c&&typeof c==='object'?{simulation_id:null,...c}:c)};
 if(!validateSchema(raw,EXECUTION_SCHEMA))throw Error('EXECUTION_SCHEMA_INVALID');
 if(attachment)return [];
 // Withheld strategic advice must not turn a normal clarification into an HTTP
 // failure. Keep explicit factual updates, but defer unapproved strategic review.
 return (raw as {commands:ExecutionCommand[]}).commands.filter(c=>c.scope==='CURRENT_COMPANY'&&c.assertion==='EXPLICIT'&&(!snapshot.allowed_operations||snapshot.allowed_operations.includes(c.kind))&&(c.kind!=='REVIEW'||reliability!==null)).map(input=>{
  const c={...input} as ExecutionCommand&{simulation_id?:string|null};
  if(c.simulation_id&&(!['ACCEPT','EXPERIMENT'].includes(c.kind)||!snapshot.simulations?.some(s=>s.id===c.simulation_id&&s.status==='ACCEPTED')))throw Error('SIMULATION_EXECUTION_REFERENCE');
  if(!c.quote.trim()||!message.includes(c.quote))throw Error('EXECUTION_EVIDENCE_INVALID');
  const row=c.target_id?snapshot[targets[c.target_type]].find(r=>r.id===c.target_id):null;
  if(c.target_id&&(!validId(c.target_id)||!row||row.version!==c.version))throw Error('EXECUTION_TARGET_CHANGED');
  if(!['DECISION','EXPERIMENT'].includes(c.kind)&&!row)throw Error('EXECUTION_TARGET_REQUIRED');
  for(const n of [c.baseline,c.observed,c.target])if(n!==null&&(!literalNumber(c.quote,n)||Math.abs(n)>999999999))throw Error('EXECUTION_NUMBER_UNSUPPORTED');
  // Dates describe result/test intervals, not a lifecycle event. The database
  // timestamps lifecycle transitions. An action may separately set its deadline.
  if(c.kind==='ACTION'){
   if(c.end!==null&&!validDate(c.end))throw Error('EXECUTION_PERIOD_INVALID');
   c.start=null;
  }else if(c.kind==='EXPERIMENT'||c.kind==='RESULT'){
   if((c.start===null)!==(c.end===null)||c.start&&(!validDate(c.start)||!validDate(c.end!)||c.start>c.end!))throw Error('EXECUTION_PERIOD_INVALID');
  }else{c.start=null;c.end=null;}
  if(c.currency&&!/^[A-Z]{3}$/.test(c.currency))throw Error('EXECUTION_CURRENCY_INVALID');
  if(c.kind==='ACCEPT'&&(c.target_type!=='RECOMMENDATION'||row?.status!=='PROPOSED'))throw Error('EXECUTION_ACCEPT_INVALID');
  if(c.kind==='ACTION'&&(c.target_type!=='ACTION'||!['TODO','IN_PROGRESS','BLOCKED','COMPLETED','CANCELLED'].includes(c.status??'')||(c.status==='BLOCKED'&&!c.reason)))throw Error('EXECUTION_ACTION_INVALID');
  if(c.kind==='EXPERIMENT'&&(!c.hypothesis||!c.description||!c.indicator||c.baseline===null||c.target===null||!c.start))throw Error('EXECUTION_TEST_INCOMPLETE');
  // Both words mean an explicit start, but existing experiments use RUNNING.
  if(c.kind==='EXPERIMENT_STATUS'&&c.status==='IN_PROGRESS')c.status='RUNNING';
  if(c.kind==='EXPERIMENT_STATUS'&&(c.target_type!=='EXPERIMENT'||!['RUNNING','CANCELLED','COMPLETED'].includes(c.status??'')))throw Error('EXECUTION_TEST_STATE_INVALID',{cause:{kind:c.kind,target_type:c.target_type,status:c.status}});
  if(c.kind==='RESULT'&&(!c.description||c.target_type==='RECOMMENDATION'||!['PARTIAL','COLLECTED'].includes(c.status??'')))throw Error('EXECUTION_RESULT_INVALID');
  if(c.kind==='DECISION_STATUS'&&(c.target_type!=='DECISION'||!['IMPLEMENTED','ABANDONED','REVERSED','SUPERSEDED'].includes(c.status??'')))throw Error('EXECUTION_DECISION_STATE_INVALID');
  if(c.kind==='DECISION'&&(!c.description||!c.reason))throw Error('EXECUTION_DECISION_INVALID');
  if(c.kind==='REVIEW'&&(!reliability?.revision||!reliability.evidence.length||!['RESOLVED','SUPERSEDED','ACTIVE'].includes(c.status??'')||!['PLAN','RECOMMENDATION'].includes(c.target_type)))throw Error('EXECUTION_REVIEW_UNSUPPORTED');
  return c;
 });
}
export function recommendationFromDiagnosis(d:Diagnosis|null){
 const r=d?.reliability?.recommendation;
 if(!d||!r||!d.objective||!d.priorities.length)return null;
 return {title:r.action.slice(0,120),recommendation:r.action,rationale_summary:r.rationale_summary,expected_outcome:r.expected_signal,primary_indicator:r.indicator,confidence:d.reliability!.confidence,
  draft:{name:r.action.slice(0,120),objective:d.objective,situation:d.situation,bottleneck:d.main_bottleneck??'',hypothesis:d.hypotheses.join('\n'),strategy:r.action,review_date:null,
   actions:d.priorities.slice(0,3).map(p=>({title:p.slice(0,160),description:p,reason:r.rationale_summary,responsible:'',deadline:null,metric:r.indicator,target:''}))},reliability:d.reliability};
}
export function nextStep(snapshot:ExecutionSnapshot,at=new Date()){
 const plan=snapshot.plans.find(p=>p.status==='ACTIVE')??snapshot.plans.find(p=>p.status==='DRAFT');if(!plan)return null;
 const actions=snapshot.actions.filter(a=>a.strategy_id===plan.id);
 const open=actions.filter(a=>!['COMPLETED','CANCELLED'].includes(a.status));
 // No invented impact scores: approved order, explicit blockers and dependencies win.
 const runnable=open.filter(a=>a.status!=='BLOCKED'&&(!Array.isArray(a.depends_on)||a.depends_on.every(id=>actions.some(b=>b.id===id&&b.status==='COMPLETED'))));
 const action=runnable.sort((a,b)=>Number(b.status==='IN_PROGRESS')-Number(a.status==='IN_PROGRESS')||Number(a.position)-Number(b.position))[0]??open[0];
 const due=typeof plan.review_date==='string'&&plan.review_date<=at.toISOString().slice(0,10);
 const weekly=snapshot.weekly.some(w=>typeof w.generated_at==='string'&&w.generated_at>String(plan.updated_at)&&Array.isArray(w.source_ids)&&w.source_ids.length>0);
 const result=snapshot.results.some(r=>r.plan_id===plan.id&&r.status!=='ANALYZED');
 return {plan,action:action??null,review:due||result||weekly||!open.length,blocked:!!action&&(action.status==='BLOCKED'||!runnable.some(r=>r.id===action.id)),overdue:typeof action?.deadline==='string'&&action.deadline<at.toISOString().slice(0,10)};
}
export function relevantExecution(snapshot:ExecutionSnapshot,message:string){
 const terms=message.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter(s=>s.length>3);
 const relevant=(rows:ExecutionRow[])=>rows.filter(r=>terms.some(w=>JSON.stringify(r).toLocaleLowerCase().includes(w))).slice(0,4);
 const compact=(r:ExecutionRow):ExecutionRow=>Object.fromEntries(Object.entries(r).filter(([k])=>!["draft","reliability","request_hash","structured_report","model_metadata"].includes(k))) as ExecutionRow;
 const orderedPlans=[...snapshot.plans.filter(p=>['ACTIVE','DRAFT'].includes(p.status)),...snapshot.plans.filter(p=>!['ACTIVE','DRAFT'].includes(p.status))];
 const bounded={...snapshot,recommendations:snapshot.recommendations.slice(0,3),plans:orderedPlans.slice(0,2),actions:snapshot.actions.filter(a=>orderedPlans.slice(0,2).some(p=>p.id===a.strategy_id)).slice(0,12),experiments:snapshot.experiments.filter(e=>!['ANALYZED','CANCELLED'].includes(String(e.execution_status))).slice(0,3),learnings:relevant(snapshot.learnings),results:snapshot.results.slice(0,5),decisions:relevant(snapshot.decisions),weekly:snapshot.weekly.slice(0,1),next:nextStep(snapshot)};
 return {...bounded,recommendations:bounded.recommendations.map(compact),plans:bounded.plans.map(compact),actions:bounded.actions.map(compact),decisions:bounded.decisions.map(compact),experiments:bounded.experiments.map(compact),weekly:bounded.weekly.map(w=>({id:w.id,summary:w.summary,next_priority:w.next_priority,generated_at:w.generated_at,confidence:w.confidence})),next:undefined};
}
