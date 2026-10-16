import {validDate,shiftDay} from '../journal/domain';
import {RADAR_CONFIG as C,cleanSources,finiteRange,fingerprint,scopeKey,type Domain,type Point,type Signal,type SignalType,type Snapshot,type Evaluation,type Range} from './domain';
export const RULES={METRIC_CHANGE:'1',METRIC_TREND:'1',HISTORICAL_RANGE:'1',EXPLICIT_THRESHOLD:'1',REPETITION:'1',GOAL_DEVIATION:'1',CAPACITY_PRESSURE:'1',EXECUTION_RISK:'1',OPPORTUNITY:'1',ASSUMPTION_DEVIATION:'1',STRUCTURAL_CHANGE:'1'} as const;
const currencies=new Set(Intl.supportedValuesOf('currency'));
const days=(a:string,b:string)=>(Date.parse(b)-Date.parse(a))/86400000+1;
function period(p:Point){const n=days(p.start,p.end);if(n===1)return 'DAY';if(n===7)return 'WEEK:'+new Date(p.start+'T12:00:00Z').getUTCDay();const last=new Date(Date.UTC(Number(p.end.slice(0,4)),Number(p.end.slice(5,7)),0)).toISOString().slice(0,10);if(p.start.slice(8)==='01'&&p.end===last&&p.start.slice(0,7)===p.end.slice(0,7))return 'MONTH';if(p.start.endsWith('-01-01')&&p.end===p.start.slice(0,4)+'-12-31')return 'YEAR';return 'SPAN:'+n;}
export function comparable(a:Point,b:Point){return a.metric===b.metric&&a.unit===b.unit&&a.currency===b.currency&&scopeKey(a.scope)===scopeKey(b.scope)&&period(a)===period(b)&&shiftDay(a.end,1)===b.start;}
const domain=(metric:string):Domain=>['leads','cpl','cac','marketing_spend'].includes(metric)?'MARKETING':['margin','revenue','cost','cash','contribution','share'].includes(metric)?'FINANCE':['retention','repeat_sales','frequency'].includes(metric)?'CUSTOMERS':['capacity','orders'].includes(metric)?'CAPACITY':'SALES';
const direction=(a:Range,b:Range)=>b.min>a.max?'UP':b.max<a.min?'DOWN':null;
export function evaluate(snapshot:Snapshot):Evaluation{
 const signals:Signal[]=[],recoveries:string[]=[];const now=snapshot.day;
 if(!validDate(now))throw Error('RADAR_DAY_INVALID');
 const add=(type:SignalType,rule:keyof typeof RULES,metric:string,points:Point[],extra:Partial<Signal>={})=>{
  const base:Signal={type,rule,ruleVersion:RULES[rule],domain:domain(metric),scope:points[0]?.scope??{product:null,channel:null,location:null,entity:null},metric,direction:'DUE',evidence:cleanSources(points.flatMap(p=>p.sources)),values:points.slice(-6),baseline:points[0]?.value??null,current:points.at(-1)?.value??null,confidence:'MEDIUM',impact:'MODERATE',urgency:'LOW',actionable:true,strategic:points.some(p=>snapshot.relevantScopes.includes(scopeKey(p.scope))),persistence:points.length,quality:snapshot.limited?['BOUNDED_CONTEXT']:[],knowledge_source_scope:'INTERNAL',details:{},fingerprint:'',...extra};
  base.fingerprint=fingerprint(base);signals.push(base);return base;
 };
 const periodIdentity=(p:Point)=>JSON.stringify([p.metric,scopeKey(p.scope),p.unit,p.currency,p.start,p.end]);
 const conflicted=new Set(snapshot.points.filter(p=>p.quality==='CONFLICTING').map(periodIdentity));
 const eligible=snapshot.points.filter(p=>validDate(p.start)&&validDate(p.end)&&p.start<=p.end&&p.end<now&&p.complete&&!period(p).startsWith('SPAN:')&&!conflicted.has(periodIdentity(p))&&finiteRange(p.value)&&p.quality==='CONFIRMED'&&days(p.end,now)<=C.historyDays&&!!p.unit&&(p.unit!=='money'||!!p.currency&&currencies.has(p.currency)));
 const groups=new Map<string,Point[]>();
 for(const p of eligible){const key=JSON.stringify([p.metric,scopeKey(p.scope),p.unit,p.currency,period(p)]);groups.set(key,[...(groups.get(key)??[]),p]);}
 const series:Point[][]=[];
 for(const rows of groups.values()){
  const byPeriod=new Map<string,Point[]>();for(const p of rows){const key=p.start+':'+p.end;byPeriod.set(key,[...(byPeriod.get(key)??[]),p]);}
  const unique:Point[]=[];
  for(const duplicates of byPeriod.values()){
   // Overlapping bounds are not proof that inconsistent reports agree.
   if(duplicates.some(p=>p.value.min!==duplicates[0].value.min||p.value.max!==duplicates[0].value.max))continue;
   unique.push({...duplicates[0],sources:cleanSources(duplicates.flatMap(p=>p.sources))});
  }
  unique.sort((a,b)=>a.start.localeCompare(b.start));const last=unique.at(-1);if(!last||days(last.end,now)>C.staleDays)continue;
  // Only the contiguous suffix. Missing periods never masquerade as consecutive trends.
  const contiguous=[last];for(let i=unique.length-2;i>=0&&comparable(unique[i],contiguous[0]);i--)contiguous.unshift(unique[i]);
  series.push(contiguous);
  const tail=contiguous.slice(-C.minimumPeriods),prior=contiguous.at(-2);if(!prior)continue;
  const move=direction(prior.value,last.value);if(!move)continue;
  if(tail.length>=C.minimumPeriods&&tail.slice(1).every((p,i)=>direction(tail[i].value,p.value)===move))add('TREND','METRIC_TREND',last.metric,tail,{direction:move,details:{period:period(last)}});
  else add('CHANGE','METRIC_CHANGE',last.metric,[prior,last],{direction:move,actionable:false,details:{period:period(last)}});
  if(contiguous.length>=C.anomalyPeriods+1){const history=contiguous.slice(-C.anomalyPeriods-1,-1),range={min:Math.min(...history.map(p=>p.value.min)),max:Math.max(...history.map(p=>p.value.max)),approximate:history.some(p=>p.value.approximate)};if(last.value.min>range.max||last.value.max<range.min)add('ANOMALY','HISTORICAL_RANGE',last.metric,[...history,last],{direction:move,baseline:range,persistence:1,actionable:false,details:{baselinePeriods:C.anomalyPeriods}});}
 }
 for(const watch of snapshot.watches){
  const rows=series.find(s=>(watch.period==='ANY'||period(s[0]).startsWith(watch.period))&&s[0].metric===watch.metric&&s[0].unit===watch.unit&&s[0].currency===watch.currency&&scopeKey(s[0].scope)===scopeKey(watch.scope));if(!rows?.length)continue;
  const last=rows.at(-1)!;const hit=watch.comparison==='GT'?last.value.min>watch.bound:last.value.max<watch.bound;
  if(watch.kind==='THRESHOLD'){
   const s=add(watch.metric==='share'?'RISK':'THRESHOLD','EXPLICIT_THRESHOLD',watch.metric,[last],{direction:watch.comparison==='GT'?'UP':'DOWN',strategic:true,confidence:last.value.approximate?'MEDIUM':'HIGH',evidence:cleanSources([...last.sources,watch.source]),baseline:{min:watch.bound,max:watch.bound,approximate:false},details:{watchId:watch.id,period:period(last)}});
   if(!hit){signals.pop();if(watch.comparison==='GT'?last.value.max<=watch.bound:last.value.min>=watch.bound)recoveries.push(s.fingerprint);}
  }else{
   if(!watch.start||!watch.deadline||!validDate(watch.start)||!validDate(watch.deadline)||watch.start>=watch.deadline||watch.baseline===null)continue;
   const selected=rows.filter(p=>p.start>=watch.start!&&p.end<=watch.deadline!).slice(-3);if(selected.length<3)continue;
   const increasing=watch.bound>watch.baseline;const behind=(value:Range,target:number)=>increasing?value.max<target:value.min>target;
   const overdue=now>watch.deadline&&selected.at(-1)!.end===watch.deadline;
   const linear=watch.trajectory==='LINEAR_EXPLICIT'&&now<=watch.deadline&&selected.every(p=>behind(p.value,watch.baseline!+(watch.bound-watch.baseline!)*(days(watch.start!,p.end)-1)/(days(watch.start!,watch.deadline!)-1)));
   if((overdue&&behind(selected.at(-1)!.value,watch.bound))||linear)add('GOAL_DEVIATION','GOAL_DEVIATION',watch.metric,selected,{domain:'GOALS',strategic:true,direction:increasing?'DOWN':'UP',evidence:cleanSources([...selected.flatMap(p=>p.sources),watch.source]),baseline:{min:watch.bound,max:watch.bound,approximate:false},details:{watchId:watch.id,deadline:watch.deadline,linear_assumption:linear,period:period(selected.at(-1)!)},urgency:overdue?'HIGH':'MODERATE'});
   else if(selected.every(p=>increasing?p.value.min>=watch.bound:p.value.max<=watch.bound))recoveries.push(fingerprint({type:'GOAL_DEVIATION',domain:'GOALS',scope:selected[0].scope,metric:watch.metric,values:selected,details:{period:period(selected.at(-1)!)}}));
  }
 }
 for(const capacity of snapshot.capacities){
  if(capacity.quality!=='CONFIRMED'||!finiteRange(capacity.value))continue;
  const rows=series.find(s=>period(s[0]).startsWith(capacity.period)&&s[0].metric===capacity.metric&&s[0].unit===capacity.unit&&s[0].currency===capacity.currency&&scopeKey(s[0].scope)===scopeKey(capacity.scope));if(!rows?.length)continue;
  const tail=rows.slice(-3);const exceeds=tail.filter(p=>p.value.min>capacity.value.max).length;
  const s=add('CAPACITY_PRESSURE','CAPACITY_PRESSURE','capacity',tail,{domain:'CAPACITY',direction:'UP',baseline:capacity.value,strategic:true,impact:exceeds===3&&snapshot.relevantScopes.includes(scopeKey(capacity.scope))?'HIGH':'MODERATE',urgency:exceeds===3?'HIGH':'MODERATE',evidence:cleanSources([...tail.flatMap(p=>p.sources),...(capacity.sources??[capacity.source])]),details:{capacityMetric:capacity.metric,period:period(tail.at(-1)!)},quality:[...(snapshot.limited?['BOUNDED_CONTEXT']:[]),...(capacity.value.approximate&&exceeds<2?['APPROXIMATE_BOUNDARY']:[])]});
  if(!exceeds||tail.at(-1)!.value.max<capacity.value.min){signals.pop();if(tail.length>=3&&tail.every(p=>p.value.max<capacity.value.min))recoveries.push(s.fingerprint);}
 }
 const problems=new Map<string,typeof snapshot.problems>();
 for(const p of snapshot.problems.filter(p=>p.confidence!=='LOW'&&validDate(p.day)&&p.day<=now&&days(p.day,now)<=30)){const key=scopeKey(p.scope)+':'+p.topic;problems.set(key,[...(problems.get(key)??[]),p]);}
 for(const rows of problems.values()){
  const distinct=[...new Map(rows.map(p=>[p.occurrence,p])).values()];if(distinct.length<C.minimumRepetition||new Set(distinct.map(p=>p.day)).size<2)continue;
  add('REPETITION','REPETITION',rows[0].topic,[],{domain:rows[0].topic==='delivery_delay'?'OPERATIONS':'CUSTOMERS',scope:rows[0].scope,direction:'REPEATED',persistence:distinct.length,evidence:cleanSources(distinct.map(p=>p.source)),details:{dates:distinct.map(p=>p.day)}});
 }
 for(const task of snapshot.tasks){
  if(!task.strategic)continue;
  const due=task.due&&validDate(task.due)&&task.due<=now,review=task.review&&validDate(task.review)&&task.review<=now;
  const reason=task.kind==='ACTION'&&task.blocked?'ACTION_BLOCKED':task.kind==='ACTION'&&due&&!['COMPLETED','CANCELLED'].includes(task.status)?'ACTION_OVERDUE':task.kind==='EXPERIMENT'&&due&&task.status==='RUNNING'?'EXPERIMENT_ENDING':['EXPERIMENT','PLAN'].includes(task.kind)&&(due||review)&&['COMPLETED','ACTIVE'].includes(task.status)&&!task.hasResult?'RESULT_MISSING':task.kind==='DECISION'&&review&&!['REVIEWED','ABANDONED','REVERSED','SUPERSEDED'].includes(task.status)?'DECISION_REVIEW':null;
  const s=add('EXECUTION_RISK','EXECUTION_RISK',task.source.id,[],{domain:'EXECUTION',scope:task.scope,strategic:true,confidence:'HIGH',impact:task.blocked?'HIGH':'MODERATE',evidence:[task.source],urgency:due?'HIGH':'MODERATE',details:{reason,kind:task.kind,label:task.label??null,due:task.due,review:task.review}});
  if(!reason){signals.pop();recoveries.push(s.fingerprint);}
 }
 for(const a of snapshot.assumptions){
  if(!a.accepted||!a.material||a.status==='UNKNOWN'||!a.observed)continue;
  const s=add('ASSUMPTION_DEVIATION','ASSUMPTION_DEVIATION',a.metric,[],{domain:'EXECUTION',scope:a.scope,strategic:true,baseline:a.expected,current:a.observed,evidence:[a.source,a.resultSource],direction:a.observed.min>a.expected.max?'UP':'DOWN',details:{simulationId:a.simulationId,unit:a.unit,currency:a.currency},urgency:'MODERATE'});
  if(a.status==='SUPPORTED'){signals.pop();recoveries.push(s.fingerprint);}
 }
 // Opportunity needs independent recurring metrics and an explicit margin threshold, never an invented "healthy" benchmark.
 for(const sales of signals.filter(s=>s.type==='TREND'&&s.metric==='sales'&&s.direction==='UP')){
  const repeat=signals.find(s=>s.type==='TREND'&&s.metric==='repeat_sales'&&s.direction==='UP'&&scopeKey(s.scope)===scopeKey(sales.scope)&&s.values.at(-1)?.start===sales.values.at(-1)?.start&&s.values.at(-1)?.end===sales.values.at(-1)?.end);
  const healthy=snapshot.watches.find(w=>w.kind==='THRESHOLD'&&w.metric==='margin'&&w.comparison==='GT'&&scopeKey(w.scope)===scopeKey(sales.scope));
  const margin=series.find(s=>s[0].metric==='margin'&&scopeKey(s[0].scope)===scopeKey(sales.scope)&&s.at(-1)!.start===sales.values.at(-1)?.start&&s.at(-1)!.end===sales.values.at(-1)?.end)?.at(-1);
  if(repeat&&healthy&&margin&&margin.unit===healthy.unit&&margin.currency===healthy.currency&&margin.value.min>healthy.bound)add('OPPORTUNITY','OPPORTUNITY','sales',sales.values,{direction:'UP',strategic:true,evidence:cleanSources([...sales.evidence,...repeat.evidence,healthy.source,...margin.sources]),details:{marginThreshold:healthy.bound,period:sales.details.period}});
 }
 for(const change of snapshot.changes)if(change.related)add('CHANGE','STRUCTURAL_CHANGE',change.kind,[],{domain:'OPERATIONS',scope:change.scope,evidence:[change.source],actionable:false,strategic:true,details:{structural:true}});
 return {signals:[...new Map(signals.map(s=>[s.fingerprint,s])).values()].slice(0,C.maxSignals),recoveries,complete:!snapshot.limited&&signals.length<=C.maxSignals};
}

