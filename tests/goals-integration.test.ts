import test from 'node:test';
import assert from 'node:assert/strict';
import {buildGoalContext} from '../src/lib/goals/context';
import {executionObservation} from '../src/lib/goals/execution';
import {goalProgress} from '../src/lib/goals/calculation';
import {EMPTY_AMOUNT,COMPANY_SCOPE,type Goal,type Observation} from '../src/lib/goals/domain';
import {weeklyMetrics} from '../src/lib/journal/weekly';
import {journalPoints} from '../src/lib/radar/normalize';
import {goalLabels} from '../src/lib/goals/labels';
import type {Entry} from '../src/lib/journal/domain';
import {goalSignals} from '../src/lib/goals/signals';
import {relevance} from '../src/lib/radar/relevance';
const amount=(value:number)=>({...EMPTY_AMOUNT,value});
const goal:Goal={id:'g',company_id:'c',version:1,status:'ACTIVE',timezone:'Europe/Lisbon',locale:'pt-PT',created_at:'2026-07-01',updated_at:'2026-07-01',spec:{title:'Receita100',description:null,type:'GROWTH',direction:'INCREASE',baseline:amount(80),target:amount(100),unit:'money',currency:'EUR',period:'MONTH',baseline_start:null,baseline_end:null,start:'2026-07-01',deadline:'2026-12-31',review_on:null,scope:COMPANY_SCOPE,primary_metric:'revenue',primary:true,parent_id:null,plan_id:null,reason:null,success:null,consistency_periods:1,milestones:[],links:[]}};
const o:Observation={id:'m',company_id:'c',version:1,metric:'revenue',amount:amount(90),boolean:null,text:null,unit:'money',currency:'EUR',period:'MONTH',start:'2026-08-01',end:'2026-08-31',complete:true,scope:COMPANY_SCOPE,confidence:'HIGH',source:'CHAT',quality:'VALID',attribution:null,observed_at:'2026-08-31',source_message_id:'msg',source_table:'business_journal_entries'};
test('context separates commitment, observed result and software calculation; bounded primary priority',()=>{
 const p=goalProgress(goal,[o],'2026-09-01');const rows=buildGoalContext([{goal,progress:p}],[o],[],'receita');
 assert.equal(rows[0].kind,'GOAL');assert.ok(rows.some(r=>r.kind==='METRIC'));const derived=rows.filter(r=>r.kind==='DERIVED_METRIC').map(r=>JSON.parse(r.value));assert.deepEqual(derived.map(v=>v.value),[50,10]);assert.ok(derived.every(v=>v.formula&&v.inputs.length));
 const many=buildGoalContext(Array.from({length:50},(_,i)=>({goal:{...goal,id:'g'+i,spec:{...goal.spec,primary:i===25}},progress:p})),[o],[],'receita');assert.equal(many[0].source_id,'g25');assert.ok(many.length<=8);
});
test('execution results preserve plan/experiment scope, prevent double counting and never imply company results',()=>{
 const result={id:'r',company_id:'c',plan_id:'plan',experiment_id:null,metric_type:'revenue',observed_value:90,unit:'money',currency_code:'EUR',period_start:'2026-08-01',period_end:'2026-08-31',status:'COLLECTED',confidence:'HIGH' as const,version:1,source_message_id:'msg',created_at:'2026-09-01'};
 assert.equal(executionObservation(result,[o]),null);const observation=executionObservation(result,[])!;assert.equal(observation.scope.type,'PLAN');assert.equal(goalProgress(goal,[observation],'2026-09-01').progress,null);
 assert.equal(goalProgress({...goal,spec:{...goal.spec,scope:{type:'PLAN',id:'plan'}}},[observation],'2026-09-01').progress?.value,50);
});
test('legacy weekly arithmetic excludes provisional/approximate/nonadditive typed metrics',()=>{
 const e={id:'e',company_id:'c',user_id:'u',source_message_id:'msg',entry_type:'METRIC',description:'Resultado',evidence:'90',event_date:'2026-08-31',period_start:o.start,period_end:o.end,metric_type:'revenue',value:90,unit:'money',currency_code:'EUR',channel:null,product:null,location:null,confidence:'HIGH',status:'ACTIVE',version:1,manual:false,created_at:'2026-09-01',metadata:{},metric_data:{...o,amount:{...o.amount,value:null}}} as Entry;
 const window={start:'2026-08-01',end:'2026-08-31'};assert.equal(weeklyMetrics([e],window).length,1);
 for(const d of [{...e.metric_data!,quality:'PROVISIONAL' as const},{...e.metric_data!,complete:false},{...e.metric_data!,amount:{...e.metric_data!.amount,approximate:true}},{...e.metric_data!,source:'EXTERNAL' as const}])assert.equal(weeklyMetrics([{...e,metric_data:d}],window).length,0);
 assert.equal(weeklyMetrics([{...e,metric_type:'conversion',unit:'percent',currency_code:null}],window).length,0);
});
test('Radar adapter preserves range, scope and provenance instead of claiming exact numbers',()=>{
 const e:Entry={id:'e',company_id:'c',user_id:'u',source_message_id:'msg',entry_type:'METRIC',description:'Resultado',evidence:'80 a 90',event_date:'2026-08-31',period_start:o.start,period_end:o.end,metric_type:'revenue',value:null,unit:'money',currency_code:'EUR',channel:null,product:null,location:null,confidence:'HIGH',status:'ACTIVE',version:2,manual:false,created_at:'2026-09-01',metadata:{},metric_data:{...o,scope:{type:'LOCATION',id:'shop'},amount:{value:null,min:80,max:90,approximate:true},quality:'PROVISIONAL'}};
 const p=journalPoints([e],'2026-09-01');assert.equal(p.length,1);assert.equal(p[0].value.min,80);assert.equal(p[0].value.max,90);assert.equal(p[0].quality,'PROVISIONAL');assert.equal(p[0].scope.entity,'shop');assert.equal(p[0].sources[0].version,2);
});
test('labels cover four locales and preserve numeric formatting outside storage',()=>{for(const locale of ['pt-BR','pt-PT','en-US','es-ES'] as const){const l=goalLabels(locale);assert.ok(l.reference&&l.INSUFFICIENT_DATA&&l.scope_mismatch);assert.ok(Object.values(l).every(v=>typeof v==='string'&&v.length>0));}assert.notEqual(goalLabels('pt-BR').save,goalLabels('pt-PT').save);});
test('goal Radar emits traceable attainment and due milestones; missing data cannot surface as confident alarm',()=>{
 const missing=goalSignals([{goal,progress:goalProgress(goal,[],'2026-09-01')}],'2026-09-01')[0];assert.equal(missing.details.goalState,'MISSING');assert.equal(relevance(missing).surface,false);
 const done=goalSignals([{goal,progress:goalProgress(goal,[{...o,amount:amount(100)}],'2026-09-01')}],'2026-09-01')[0];assert.equal(done.details.goalState,'ACHIEVED');assert.equal(done.evidence[0].id,goal.id);
 const qualitative={...goal,spec:{...goal.spec,direction:'COMPLETE' as const,success:'Launch',milestones:[{id:'m',title:'Training',done:false,deadline:'2026-08-01',weight:null}]}};
 assert.equal(goalSignals([{goal:qualitative,progress:goalProgress(qualitative,[],'2026-09-01')}],'2026-09-01')[0].details.goalState,'MILESTONE');
});
