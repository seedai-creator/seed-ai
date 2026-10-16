import test from 'node:test';
import assert from 'node:assert/strict';
import {goalProgress,deriveMetric} from '../src/lib/goals/calculation';
import {normalizeIngestion,supportedGoalDate} from '../src/lib/goals/ingestion';
import {validateGoal,validateObservation,goalMissing,businessDay,EMPTY_AMOUNT,COMPANY_SCOPE,type Goal,type Observation,type GoalSpec} from '../src/lib/goals/domain';
const amount=(value:number)=>({...EMPTY_AMOUNT,value});
const spec:GoalSpec={title:'Chegar a R$100 mil/mês',description:null,type:'GROWTH',direction:'INCREASE',baseline:amount(80000),target:amount(100000),unit:'money',currency:'BRL',period:'MONTH',baseline_start:'2026-06-01',baseline_end:'2026-06-30',start:'2026-07-01',deadline:'2026-10-31',review_on:null,scope:COMPANY_SCOPE,primary_metric:'revenue',primary:true,parent_id:null,plan_id:null,reason:null,success:null,consistency_periods:1,milestones:[],links:[]};
const goal:Goal={id:'g',company_id:'a',version:1,status:'ACTIVE',spec,timezone:'America/Sao_Paulo',locale:'pt-BR',created_at:'2026-07-01',updated_at:'2026-07-01'};
const obs=(value:number,start='2026-08-01',end='2026-08-31'):Observation=>({id:'o'+start,company_id:'a',version:1,metric:'revenue',amount:amount(value),boolean:null,text:null,unit:'money',currency:'BRL',period:'MONTH',start,end,complete:true,scope:COMPANY_SCOPE,confidence:'HIGH',source:'CHAT',quality:'VALID',attribution:null,observed_at:end,source_message_id:null,source_table:'business_journal_entries'});
test('goal schema and sufficiency retain missing data instead of inventing values',()=>{
 assert.deepEqual(validateGoal(spec),spec);assert.deepEqual(goalMissing(spec),[]);
 assert.ok(goalMissing({...spec,baseline:EMPTY_AMOUNT,deadline:null}).includes('baseline'));assert.ok(goalMissing({...spec,deadline:null}).includes('deadline'));
 assert.throws(()=>validateGoal({...spec,direction:'DECREASE'}));assert.throws(()=>validateGoal({...spec,currency:'EUR',unit:'count'}));
});
test('revenue baseline80 target100 current90 has progress50, gap10 and no unsupported forecast',()=>{
 const p=goalProgress(goal,[obs(90000)],'2026-09-01');assert.equal(p.progress?.value,50);assert.equal(p.gap?.value,10000);assert.equal(p.trajectory,'INSUFFICIENT_DATA');assert.equal(p.observedPace,null);assert.equal(p.reference,null);
});
test('two complete periods produce a reference trajectory, no precise forecast',()=>{
 const p=goalProgress(goal,[obs(84000,'2026-07-01','2026-07-31'),obs(87000)],'2026-09-01');assert.equal(p.progress?.value,35);assert.equal(p.gap?.value,13000);assert.equal(p.coverage,'SUFFICIENT');assert.ok(p.reference!>89000);assert.equal('forecast' in p,false);
});
test('operational decrease5to3 current4 is50percent',()=>{const g={...goal,spec:{...spec,direction:'DECREASE' as const,baseline:amount(5),target:amount(3),unit:'days',currency:null,primary_metric:'delivery_time'}};const p=goalProgress(g,[{...obs(4),metric:'delivery_time',unit:'days',currency:null}],'2026-09-01');assert.equal(p.progress?.value,50);assert.equal(p.gap?.value,1);});
test('conversion10to15 preserves percentage points and relative change',()=>{const g={...goal,spec:{...spec,baseline:amount(10),target:amount(15),unit:'percent',currency:null,primary_metric:'conversion'}};const p=goalProgress(g,[{...obs(15),metric:'conversion',unit:'percent',currency:null}],'2026-09-01');assert.equal(p.percentagePoints,5);assert.equal(p.relativeChange,50);assert.equal(p.trajectory,'ACHIEVED');});
test('range goal uses within-range, qualitative goal uses explicit weights only',()=>{
 const r=goalProgress({...goal,spec:{...spec,direction:'RANGE',target:{...EMPTY_AMOUNT,min:80,max:100}}},[obs(90)],'2026-09-01');assert.equal(r.range,'WITHIN_RANGE');assert.equal(r.progress,null);
 const s={...spec,direction:'COMPLETE' as const,success:'Preparar expansão',milestones:[{id:'m',title:'Validar demanda',done:false,deadline:null,weight:null}]};assert.equal(goalProgress({...goal,spec:s},[],'2026-09-01').progress,null);assert.equal(goalProgress({...goal,spec:{...s,milestones:[{...s.milestones[0],done:true}]}},[],'2026-09-01').trajectory,'ACHIEVED');
});
test('unknown, stale, provisional, conflict, foreign tenant and partial periods never become progress',()=>{
 for(const rows of [[],[{...obs(90),company_id:'b'}],[{...obs(90),quality:'CONFLICTING' as const}],[{...obs(90),quality:'PROVISIONAL' as const}],[{...obs(90),complete:false}],[{...obs(90),scope:{type:'LOCATION' as const,id:'loc'}}],[{...obs(90),currency:'EUR'}],[{...obs(90),period:'WEEK' as const}],[{...obs(90),source:'EXTERNAL' as const}],[obs(90,'2025-01-01','2025-01-31')]])assert.equal(goalProgress(goal,rows,'2026-09-01').progress,null);
 const conflict=goalProgress(goal,[obs(90),{...obs(91),id:'other'}],'2026-09-01');assert.ok(conflict.limitations.includes('conflict'));
});
test('ranges and approximation propagate without midpoint or false confidence',()=>{
 const p=goalProgress(goal,[{...obs(0),amount:{value:null,min:85000,max:95000,approximate:true}}],'2026-09-01');assert.equal(p.current?.value,null);assert.equal(p.progress?.min,25);assert.equal(p.progress?.max,75);assert.equal(p.confidence,'LOW');assert.equal(p.trajectory,'INSUFFICIENT_DATA');
});
test('sustained target needs distinct periods; deadline with missing result is not automatically missed',()=>{
 const g={...goal,spec:{...spec,consistency_periods:2}};assert.notEqual(goalProgress(g,[obs(110000),{...obs(110000),id:'dup'}],'2026-09-01').trajectory,'ACHIEVED');
 assert.equal(goalProgress(goal,[obs(90000,'2026-10-01','2026-10-31')],'2026-11-01').trajectory,'MISSED');
 assert.notEqual(goalProgress(goal,[obs(90000)],'2026-11-01').trajectory,'MISSED');
});
test('guardrail margin breach is independent of revenue progress',()=>{
 const p=goalProgress({...goal,spec:{...spec,links:[{metric:'gross_margin',role:'GUARDRAIL',timing:'LAGGING',min:30,max:null}]}},[obs(100000),{...obs(20),metric:'gross_margin',unit:'percent',currency:null}],'2026-09-01');assert.equal(p.trajectory,'ACHIEVED');assert.equal(p.guardrails[0].status,'BREACH');assert.ok(p.limitations.includes('guardrail_breach'));
});
test('formulas enforce definitions, attribution, denominator, tenant, scope, periods and currency',()=>{
 const sales={...obs(10),id:'sales',metric:'sales',unit:'count',currency:null},leads={...sales,id:'leads',metric:'leads',amount:amount(100)};
 assert.equal(deriveMetric('conversion',sales,leads)?.amount.value,10);assert.equal(deriveMetric('average_ticket',obs(1000),sales)?.amount.value,100);
 assert.equal(deriveMetric('cac',{...obs(1000),metric:'acquisition_spend'},{...sales,metric:'new_customers'})?.amount.value,100);
 assert.equal(deriveMetric('roas',{...obs(1000),metric:'attributed_revenue'},{...obs(200),id:'ad',metric:'ad_spend'}),null);
 assert.equal(deriveMetric('roas',{...obs(1000),metric:'attributed_revenue',attribution:'Campanha A'},{...obs(200),id:'ad',metric:'ad_spend'})?.amount.value,5);
 for(const bad of [{...leads,amount:amount(0)},{...leads,company_id:'b'},{...leads,start:'2026-09-01'},{...leads,complete:false},{...leads,quality:'STALE' as const},{...leads,scope:{type:'LOCATION' as const,id:'loc'}}])assert.equal(deriveMetric('conversion',sales,bad),null);
 assert.equal(deriveMetric('capacity_utilization',{...sales,metric:'actual_volume'},{...leads,metric:'known_capacity'})?.amount.value,10);
 assert.equal(deriveMetric('conversion',sales,leads)?.trace?.inputs.length,2);
});
test('period shape validation and local boundaries prevent monthly/day mismatches',()=>{
 const {id:_id,company_id:_co,version:_v,observed_at:_at,source_message_id:_m,source_table:_t,...o}=obs(10);void [_id,_co,_v,_at,_m,_t];
 assert.doesNotThrow(()=>validateObservation(o));assert.throws(()=>validateObservation({...o,end:'2026-08-02'}));assert.equal(businessDay('America/Sao_Paulo',new Date('2026-09-01T01:00:00Z')),'2026-08-31');
});
test('date resolver supports stated horizons and rejects invented deadlines',()=>{assert.equal(supportedGoalDate('2026-12-31','até dezembro','2026-10-09'),true);assert.equal(supportedGoalDate('2027-01-07','em 90 dias','2026-10-09'),true);assert.equal(supportedGoalDate('2026-12-31','quero crescer','2026-10-09'),false);});
test('conversational normalization preserves explicit ranges, rejects fabricated values and hypothetical companies',()=>{
 const message='Quero sair de R$80 mil para R$100 mil por mês até dezembro';const c={id:null,version:0,evidence:message,scope:'CURRENT_COMPANY',spec:{...spec,baseline_start:null,baseline_end:null,start:null,deadline:'2026-12-31'},status:'ACTIVE'};
 const ctx={goals:[],observations:[],memories:[],timezone:'America/Sao_Paulo',at:'2026-10-09T12:00:00Z',document:false};
 assert.equal(normalizeIngestion({goals:[c],observations:[]},message,ctx).goals.length,1);
 assert.equal(normalizeIngestion({goals:[{...c,spec:{...c.spec,target:amount(120000)}}],observations:[]},message,ctx).goals.length,0);
 assert.equal(normalizeIngestion({goals:[{...c,scope:'SIMULATION'}],observations:[]},message,ctx).goals.length,0);
 assert.equal(normalizeIngestion({goals:[c],observations:[]},message,{...ctx,document:true}).goals[0].status,'DRAFT');
 assert.equal(normalizeIngestion({goals:[{...c,version:1}],observations:[]},message,ctx).goals[0].version,0);
 assert.equal(normalizeIngestion({goals:[{...c,spec:{...c.spec,links:[{metric:'gross_margin',role:'GUARDRAIL',timing:'LAGGING',min:30,max:null}]}}],observations:[]},message,ctx).goals.length,0);
});
test('uncertain attainment and conflicting protection indicators do not claim certainty',()=>{
 assert.notEqual(goalProgress(goal,[{...obs(100000),amount:{...amount(100000),approximate:true}}],'2026-09-01').trajectory,'ACHIEVED');
 const guardrail={...goal,spec:{...spec,links:[{metric:'gross_margin',role:'GUARDRAIL' as const,timing:'LAGGING' as const,min:30,max:null}]}};
 const margin={...obs(20),id:'margin1',metric:'gross_margin',unit:'percent',currency:null};
 assert.equal(goalProgress(guardrail,[obs(100000),margin,{...margin,id:'margin2',amount:amount(40)}],'2026-09-01').guardrails[0].status,'UNKNOWN');
 const {id,company_id,version,observed_at,source_message_id,source_table,...data}=margin;void [id,company_id,version,observed_at,source_message_id,source_table];
 assert.doesNotThrow(()=>validateObservation({...data,amount:amount(-20)}));
 assert.throws(()=>validateObservation({...data,metric:'conversion',amount:amount(-20)}));
});

test('derived confidence never promotes a low-confidence input; ratio arithmetic avoids binary percentage noise',()=>{const leads={...obs(150),id:'l',metric:'leads',unit:'count',currency:null},sales={...leads,id:'s',metric:'sales',amount:amount(21)};assert.equal(deriveMetric('conversion',sales,leads)?.amount.value,14);assert.equal(deriveMetric('conversion',{...sales,confidence:'LOW'},leads)?.confidence,'LOW');});
