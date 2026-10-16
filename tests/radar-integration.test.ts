import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSnapshot,type RawSnapshot} from '../src/lib/radar/normalize';
import {evaluate} from '../src/lib/radar/rules';
import {relevance} from '../src/lib/radar/relevance';
import {conversationSignals} from '../src/lib/radar/context';
import {narrative} from '../src/lib/radar/narrative';
import {EMPTY_SCOPE,type Watch} from '../src/lib/radar/domain';
import {shiftDay,type Entry} from '../src/lib/journal/domain';
import {EMPTY_VALUE,type Entity,type StoredObservation,type Relationship} from '../src/lib/business-model/domain';
import type {Simulation} from '../src/lib/simulation/domain';
import {assessAssumptions,type ObservedResult} from '../src/lib/simulation/outcomes';
const at=new Date('2026-10-08T15:00:00Z');
const raw=():RawSnapshot=>({company:'c',timezone:'America/Sao_Paulo',journal:[],entities:[],observations:[],relations:[],plans:[],actions:[],decisions:[],experiments:[],results:[],events:[],simulations:[],watches:[],limited:false});
const entry=(metric:string,value:number,i:number,patch:Partial<Entry>={}):Entry=>({id:metric+i,company_id:'c',user_id:'u',source_message_id:metric+i,entry_type:'METRIC',description:'FICTITIOUS FIXTURE',evidence:'FICTITIOUS FIXTURE',event_date:shiftDay('2026-09-14',7*i),period_start:shiftDay('2026-09-14',7*i),period_end:shiftDay('2026-09-20',7*i),metric_type:metric,value,unit:'count',currency_code:null,channel:null,product:null,location:null,confidence:'HIGH',status:'ACTIVE',version:1,manual:false,created_at:'2026-10-01',metadata:{},...patch});
const entity=(id:string,type:Entity['type'],name:string):Entity=>({id,type,name,company_id:'c',canonical_name:name,version:1,reference_id:null,reference_table:null,status:'ACTIVE'});
const observation=(patch:Partial<StoredObservation>&{operation?:string;supersedes?:string}={}):StoredObservation=>({id:'obs',company_id:'c',entity_id:'capacity',attribute:'capacity',data:{...EMPTY_VALUE,value:80,unit:'orders/week',approximate:true},kind:'FACT',state:'CONFIRMED',confidence:'HIGH',observed_at:'2026-10-01T12:00:00Z',source_type:'CHAT',source_message_id:'m',memory_id:null,version:1,is_current:true,scope_key:'capacity',...patch});
const watch=(patch:Partial<Watch>={}):Watch=>({id:'watch',source:{table:'business_memories',id:'goal',version:1},kind:'GOAL',metric:'revenue',unit:'money',currency:'BRL',scope:{...EMPTY_SCOPE},period:'WEEK',bound:100,comparison:'LT',baseline:10,start:'2026-09-01',deadline:'2026-10-31',trajectory:'LINEAR_EXPLICIT',...patch});
test('Radar integration: canonical weekly counts -> conversion -> Home evidence -> conversation',()=>{
 const r=raw();r.journal=[...Array.from({length:3},(_,i)=>entry('leads',500,i)),...[60,50,40].map((v,i)=>entry('sales',v,i))];
 const signals=evaluate(normalizeSnapshot(r,at)).signals;const conversion=signals.find(s=>s.metric==='conversion')!;assert.deepEqual(conversion.values.map(v=>v.value.min),[12,10,8]);assert.equal(conversion.evidence.length,6);assert.equal(relevance(conversion).surface,true);
 for(const locale of ['pt-BR','pt-PT','en-US','es-ES'] as const)assert.ok(narrative([conversion],locale).evidence[0].text.includes('8'));
 assert.equal(conversationSignals([{id:'insight',signals:[conversion]}],'Quero analisar','insight').length,1);
});
test('Radar integration: current-week evidence stays partial even after its reporting day',()=>{
 const r=raw();r.journal=[0,1,2].map(i=>entry('sales',50-i*5,i,{metadata:{period:'THIS_WEEK'} as Entry['metadata']}));assert.equal(evaluate(normalizeSnapshot(r,at)).signals.length,0);
});
test('Radar integration: three independent delivery reports retain scope and dates',()=>{
 const r=raw();r.journal=[0,1,2].map(i=>entry('sales',0,i,{entry_type:'PROBLEM',value:null,metric_type:null,period_start:null,period_end:null,event_date:shiftDay('2026-10-01',i),description:'Cliente reclamou do atraso na entrega',location:'Loja A'}));const s=evaluate(normalizeSnapshot(r,at)).signals[0];assert.equal(s.type,'REPETITION');assert.equal(s.scope.location,'Loja A');assert.equal(s.persistence,3);
 r.journal[2].location='Loja B';assert.equal(evaluate(normalizeSnapshot(r,at)).signals.length,0);
});
test('Radar integration: capacity needs a confirmed graph link and never converts weekly to daily',()=>{
 const r=raw();r.entities=[entity('p','PRODUCT_SERVICE','Pizza'),entity('capacity','CAPACITY','Forno')];r.journal=[76,81,84].map((n,i)=>entry('sales',n,i,{product:'Pizza'}));r.observations=[observation()];r.relations=[{id:'link',company_id:'c',source_id:'p',target_id:'capacity',type:'CONSUMES',kind:'FACT',status:'ACTIVE',confidence:'HIGH'} as Relationship];
 let s=evaluate(normalizeSnapshot(r,at)).signals.find(s=>s.type==='CAPACITY_PRESSURE')!;assert.ok(s);assert.ok(s.evidence.some(e=>e.table==='business_relationships'));assert.equal(s.baseline?.approximate,true);
 r.observations[0].data.unit='orders/day';assert.ok(!evaluate(normalizeSnapshot(r,at)).signals.some(s=>s.type==='CAPACITY_PRESSURE'));
 r.observations[0].data.unit='orders/week';r.relations[0].kind='HYPOTHESIS';s=evaluate(normalizeSnapshot(r,at)).signals.find(s=>s.type==='CAPACITY_PRESSURE')!;assert.equal(s,undefined);
});
test('Radar integration: explicit canonical goal and blocked critical plan action',()=>{
 const r=raw();r.watches=[watch()];r.journal=[20,22,23].map((v,i)=>entry('revenue',v,i,{unit:'money',currency_code:'BRL'}));r.plans=[{id:'plan',company_id:'c',name:'Plano fictício',objective:'Validar follow-up',status:'ACTIVE'}];r.actions=[{id:'action',company_id:'c',strategy_id:'plan',title:'Follow-up fictício',status:'BLOCKED',position:0,deadline:'2026-10-06'}];
 const signals=evaluate(normalizeSnapshot(r,at)).signals;assert.ok(signals.some(s=>s.type==='GOAL_DEVIATION'));const action=signals.find(s=>s.type==='EXECUTION_RISK')!;assert.equal(relevance(action).attention,'HIGH_ATTENTION');assert.equal(narrative([action],'pt-BR').evidence[0].label,'Follow-up fictício');
 r.actions[0].status='COMPLETED';assert.ok(evaluate(normalizeSnapshot(r,at)).recoveries.includes(action.fingerprint));
});
test('Radar integration: accepted and explicitly compared assumption watches observed result, not simulated future',()=>{
 const r=raw();const simulation={extraction:{inputs:[{id:'cpl',label:'CPL',kind:'USER_ASSUMPTION',value:{min:10,max:10,approximate:false,unit:'MONEY_PER_UNIT',currency:'BRL',period:'ONCE',scope:'ads:meta'}}]},scenarios:[{id:'chosen',assumption_ids:['cpl']}]} as unknown as Simulation;
 const result:ObservedResult={id:'result',metric_type:'CPL',description:'Fictício',observed_value:12.5,unit:'MONEY_PER_UNIT',currency_code:'BRL',period_start:null,period_end:null,created_at:'2026-10-07T12:00:00Z'};
 const assessment=assessAssumptions(simulation,[result],'ads:meta','2026-10-06')[0];r.simulations=[{id:'sim',company_id:'c',status:'ACCEPTED',snapshot:simulation,selected_scenario:'chosen',decision_id:'decision'}];r.decisions=[{id:'decision',company_id:'c',decision_date:'2026-10-06',execution_status:'ACTIVE'}];r.results=[{...result,company_id:'c',decision_id:'decision'}];r.events=[{id:'assessment',company_id:'c',operation:'assumption_assessed',entity_id:'sim',after_state:assessment,created_at:'2026-10-07T13:00:00Z'}];
 assert.ok(evaluate(normalizeSnapshot(r,at)).signals.some(s=>s.type==='ASSUMPTION_DEVIATION'));
 r.results[0].currency_code='EUR';assert.ok(!evaluate(normalizeSnapshot(r,at)).signals.some(s=>s.type==='ASSUMPTION_DEVIATION'));
});
test('Radar integration: actual structural change is contextual; corrections are not new business changes',()=>{
 const r=raw();r.entities=[entity('team','TEAM','Equipe'),entity('operation','OPERATION','Entrega')];r.relations=[{id:'r',company_id:'c',source_id:'team',target_id:'operation',type:'OPERATES',kind:'FACT',status:'ACTIVE',confidence:'HIGH'} as Relationship];r.observations=[observation({entity_id:'team',attribute:'count',data:{...EMPTY_VALUE,value:3,unit:'count'},operation:'CHANGE'})];let signals=evaluate(normalizeSnapshot(r,at)).signals;assert.equal(signals[0].rule,'STRUCTURAL_CHANGE');assert.equal(relevance(signals[0]).surface,false);
 r.observations=[observation({entity_id:'team',attribute:'count',data:{...EMPTY_VALUE,value:3,unit:'count'},operation:'CORRECTION'})];signals=evaluate(normalizeSnapshot(r,at)).signals;assert.equal(signals.length,0);
});
