import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluate,comparable,RULES} from '../src/lib/radar/rules';
import {relevance,cluster,materiallyChanged} from '../src/lib/radar/relevance';
import {EMPTY_SCOPE,scopeKey,type Point,type Snapshot,type Watch} from '../src/lib/radar/domain';
import {conversationSignals,weeklySignals} from '../src/lib/radar/context';
import {journalPoints,problemTopic,normalizeSnapshot,type RawSnapshot} from '../src/lib/radar/normalize';
import {normalizeWatches} from '../src/lib/radar/watches';
import {narrative,radarLabels} from '../src/lib/radar/narrative';
import {shiftDay} from '../src/lib/journal/domain';
import type {Entry} from '../src/lib/journal/domain';
import {extractionRequest} from '../src/lib/journal/requests';
const source=(n:number)=>({table:'business_journal_entries',id:'record-'+n,version:1});
const point=(value:number,i:number,metric='conversion'):Point=>({metric,value:{min:value,max:value,approximate:false},unit:'percent',currency:null,scope:{...EMPTY_SCOPE},start:shiftDay('2026-09-14',i*7),end:shiftDay('2026-09-20',i*7),complete:true,quality:'CONFIRMED',sources:[source(i)]});
const snapshot=(points:Point[]=[]):Snapshot=>({company:'company',day:'2026-10-08',points,problems:[],capacities:[],watches:[],tasks:[],assumptions:[],limited:false,relevantScopes:[],changes:[]});
const trend=()=>evaluate(snapshot([point(12,0),point(10,1),point(8,2)])).signals[0];
const watch=(patch:Partial<Watch>={}):Watch=>({id:'w',source:{table:'business_memories',id:'m',version:1},kind:'THRESHOLD',metric:'conversion',unit:'percent',currency:null,scope:{...EMPTY_SCOPE},period:'WEEK',bound:10,comparison:'LT',baseline:null,start:null,deadline:null,trajectory:'NONE',...patch});
test('Radar: three comparable periods make an evidenced trend; no automatic diagnosis',()=>{const s=trend();assert.equal(s.type,'TREND');assert.equal(s.direction,'DOWN');assert.equal(s.evidence.length,3);assert.equal(s.ruleVersion,RULES.METRIC_TREND);assert.equal(relevance(s).surface,true);assert.equal('diagnosis' in s,false);});
test('Radar: two periods are an observed change, not a surfaced trend',()=>{const s=evaluate(snapshot([point(12,0),point(10,1)])).signals[0];assert.equal(s.type,'CHANGE');assert.equal(relevance(s).surface,false);});
test('Radar: gaps, partial periods, currencies, scope and conflicting observations cannot create trends',()=>{
 for(const patch of [{start:'2026-09-30'},{complete:false},{currency:'EUR'},{scope:{...EMPTY_SCOPE,location:'B'}},{quality:'STALE' as const},{quality:'CONFLICTING' as const}])assert.ok(!evaluate(snapshot([point(12,0),point(10,1),{...point(8,2),...patch}])).signals.some(s=>s.type==='TREND'));
 assert.ok(!evaluate(snapshot([point(12,0),point(10,1),point(8,2),point(14,2)])).signals.some(s=>s.type==='TREND'));
 assert.equal(comparable(point(1,0),{...point(2,1),unit:'count'}),false);
});
test('Radar: stale latest period, future data and absent data stay silent',()=>{const s=snapshot([point(12,0),point(10,1),point(8,2)]);s.day='2027-01-01';assert.deepEqual(evaluate(s).signals,[]);s.day='2026-09-14';assert.deepEqual(evaluate(s).signals,[]);assert.deepEqual(evaluate(snapshot()).signals,[]);});
test('Radar: ranges never use midpoints; approximation propagates',()=>{const rows=[point(12,0),point(10,1),point(8,2)];rows[1].value={min:7,max:13,approximate:true};assert.ok(!evaluate(snapshot(rows)).signals.some(s=>s.type==='TREND'));rows[1].value={min:9,max:10,approximate:true};const s=evaluate(snapshot(rows)).signals[0];assert.equal(s.values[1].value.approximate,true);assert.match(narrative([s],'pt-BR').evidence[0].text,/≈/);});
test('Radar: known capacity requires compatible cadence and persistent approximate exceedance',()=>{const s=snapshot([point(76,0,'sales'),point(81,1,'sales'),point(84,2,'sales')]);s.points.forEach(p=>p.unit='count');s.capacities=[{value:{min:80,max:80,approximate:true},metric:'sales',unit:'count',period:'WEEK',currency:null,scope:{...EMPTY_SCOPE},source:source(4),quality:'CONFIRMED'}];assert.equal(relevance(evaluate(s).signals.find(x=>x.type==='CAPACITY_PRESSURE')!).surface,true);s.capacities[0].period='DAY';assert.ok(!evaluate(s).signals.some(x=>x.type==='CAPACITY_PRESSURE'));});
test('Radar: explicit threshold and risk have provenance; normalizing threshold resolves',()=>{const s=snapshot([point(8,0)]);s.watches=[watch()];assert.equal(evaluate(s).signals[0].type,'THRESHOLD');s.points[0].value={min:12,max:12,approximate:false};assert.equal(evaluate(s).recoveries.length,1);s.watches=[watch({metric:'share',bound:50,comparison:'GT'})];s.points=[point(70,0,'share')];assert.equal(evaluate(s).signals[0].type,'RISK');});
test('Radar: goal needs explicit dates and trajectory, never assumed linearity',()=>{const s=snapshot([point(20,0,'revenue'),point(22,1,'revenue'),point(23,2,'revenue')]);s.points.forEach(p=>{p.unit='money';p.currency='BRL';});s.watches=[watch({kind:'GOAL',metric:'revenue',unit:'money',currency:'BRL',baseline:10,bound:100,start:'2026-09-01',deadline:'2026-10-31'})];assert.ok(!evaluate(s).signals.some(x=>x.type==='GOAL_DEVIATION'));s.watches[0].trajectory='LINEAR_EXPLICIT';assert.equal(evaluate(s).signals.filter(x=>x.type==='GOAL_DEVIATION').length,1);s.watches[0].deadline=null;assert.ok(!evaluate(s).signals.some(x=>x.type==='GOAL_DEVIATION'));});
test('Radar: complaint repetition preserves independent occurrences, not duplicate extracts',()=>{const s=snapshot();s.problems=[0,1,2].map(i=>({topic:'delivery_delay',scope:{...EMPTY_SCOPE},day:shiftDay('2026-10-01',i),source:source(i),occurrence:'message-'+i,confidence:'HIGH'}));assert.equal(evaluate(s).signals[0].type,'REPETITION');s.problems.forEach(p=>p.occurrence='same-message');assert.deepEqual(evaluate(s).signals,[]);assert.notEqual(problemTopic('cliente reclamou do preço alto'),problemTopic('cliente reclamou do prazo alto'));});
test('Radar: critical blockers surface, isolated task delays do not; experiments wait for their horizon',()=>{const s=snapshot();s.tasks=[{source:source(1),kind:'ACTION',status:'BLOCKED',due:null,review:null,strategic:false,blocked:true,hasResult:false,scope:{...EMPTY_SCOPE}}];assert.equal(evaluate(s).signals.length,0);s.tasks[0].strategic=true;assert.equal(evaluate(s).signals[0].details.reason,'ACTION_BLOCKED');s.tasks[0]={...s.tasks[0],kind:'EXPERIMENT',status:'RUNNING',blocked:false,due:'2026-10-09'};assert.equal(evaluate(s).signals.length,0);s.tasks[0].due='2026-10-08';assert.equal(evaluate(s).signals[0].details.reason,'EXPERIMENT_ENDING');s.tasks[0].status='COMPLETED';assert.equal(evaluate(s).signals[0].details.reason,'RESULT_MISSING');});
test('Radar: accepted material assumption uses observed result; unknown comparisons remain silent',()=>{const s=snapshot();s.assumptions=[{source:source(1),simulationId:'s',resultSource:source(2),status:'NOT_SUPPORTED',scope:{...EMPTY_SCOPE},expected:{min:10,max:10,approximate:false},observed:{min:14,max:14,approximate:false},unit:'money',currency:'BRL',metric:'cpl',accepted:true,material:true}];assert.equal(evaluate(s).signals[0].type,'ASSUMPTION_DEVIATION');s.assumptions[0].status='UNKNOWN';assert.equal(evaluate(s).signals.length,0);});
test('Radar: opportunity requires recurring sales and repeat purchases plus user-defined healthy margin',()=>{const s=snapshot([...['sales','repeat_sales'].flatMap(m=>[point(10,0,m),point(20,1,m),point(30,2,m)]),point(40,2,'margin')]);assert.ok(!evaluate(s).signals.some(x=>x.type==='OPPORTUNITY'));s.watches=[watch({metric:'margin',bound:30,comparison:'GT'})];assert.ok(evaluate(s).signals.some(x=>x.type==='OPPORTUNITY'));});
test('Radar: anomaly uses a historical range, without turning one unusual value into a problem',()=>{const rows=[2,4,3,5,4,3,30].map((v,i)=>({...point(v,0),start:shiftDay('2026-09-20',i),end:shiftDay('2026-09-20',i)}));const anomaly=evaluate(snapshot(rows)).signals.find(s=>s.type==='ANOMALY')!;assert.equal(anomaly.baseline?.min,2);assert.equal(anomaly.baseline?.max,5);assert.equal(relevance(anomaly).surface,false);});
test('Radar: clustering shares scope, never leaks across locations',()=>{const a=trend(),b={...trend(),metric:'leads',direction:'UP' as const},c={...trend(),scope:{...EMPTY_SCOPE,location:'B'}};assert.equal(cluster([a,b]).length,1);assert.equal(cluster([a,c]).length,2);});
test('Radar: preferences, cooldown, prior display, dismiss and budget suppress interruptions',()=>{const base={enabled:true,muted:false,recentCount:0,seenVersion:false,dismissed:false,materialChange:false,cooling:false};for(const patch of [{enabled:false},{muted:true},{recentCount:2},{seenVersion:true},{dismissed:true},{cooling:true}])assert.equal(relevance(trend(),{...base,...patch}).surface,false);assert.equal(relevance({...trend(),quality:['CONFLICT']}).surface,false);});
test('Radar: passage of time alone never warrants resurfacing; new worsening evidence can',()=>{const a=trend(),b=structuredClone(a);assert.equal(materiallyChanged(a,b),false);b.current={min:6,max:6,approximate:false};b.evidence.push(source(7));assert.equal(materiallyChanged(a,b),true);});
test('Radar: deterministic narratives support four locales and expose no internal codes',()=>{for(const locale of ['pt-BR','pt-PT','es-ES','en-US'] as const){const text=narrative([trend()],locale);assert.ok(text.title&&text.summary&&text.evidence.length);assert.doesNotMatch(text.summary,/TREND|THRESHOLD|SIGNAL_/);assert.ok(radarLabels(locale).enabled);}});
test('Radar: Journal conversion calculated once from unique comparable counts',()=>{const e=(metric:string,value:number,id:string):Entry=>({id,company_id:'company',user_id:'user',source_message_id:null,entry_type:'METRIC',description:'Fixture',evidence:'Fixture',event_date:'2026-10-01',period_start:'2026-10-01',period_end:'2026-10-01',metric_type:metric,value,unit:'count',currency_code:null,channel:null,product:null,location:null,confidence:'HIGH',status:'ACTIVE',version:1,manual:false,created_at:'2026-10-01',metadata:{}});assert.equal(journalPoints([e('leads',500,'1'),e('sales',60,'2')],'2026-10-08').find(p=>p.metric==='conversion')?.value.min,12);assert.ok(!journalPoints([e('leads',500,'1'),e('leads',600,'3'),e('sales',60,'2')],'2026-10-08').some(p=>p.metric==='conversion'));});
test('Radar: watched canonical memories require exact source versions and literal numeric evidence',()=>{const m={id:'m',version:1,kind:'BUSINESS_PREFERENCE',value:'Conversão abaixo de 10%',evidence:'Conversão abaixo de 10%'};const w={memory_id:'m',memory_version:1,evidence:m.evidence,kind:'THRESHOLD',metric:'conversion',unit:'percent',currency:null,product:null,channel:null,location:null,period:'ANY',bound:10,comparison:'LT',baseline:null,start:null,deadline:null,trajectory:'NONE'};assert.equal(normalizeWatches([w],[m]).length,1);assert.throws(()=>normalizeWatches([{...w,bound:5}],[m]));assert.throws(()=>normalizeWatches([{...w,memory_version:2}],[m]));});
test('Radar: watch extraction reuses the existing structured call; absent flag preserves existing schema',()=>{const a=extractionRequest('configured', 'hello',[],{}),b=extractionRequest('configured','hello',[],{radar_memories:[]});assert.ok(!JSON.stringify(a.text).includes('radar_watches'));assert.ok(JSON.stringify(b.text).includes('radar_watches'));assert.equal(a.model,b.model);});
test('Radar: input adapter rejects a foreign tenant',()=>{const r={company:'c',timezone:'UTC',journal:[],entities:[{id:'x',company_id:'other'}],observations:[],relations:[],plans:[],actions:[],decisions:[],experiments:[],results:[],events:[],simulations:[],watches:[],limited:false} as unknown as RawSnapshot;assert.throws(()=>normalizeSnapshot(r),/SCOPE/);});
test('Radar: thousands of observations are bounded, deterministic, and require no AI',()=>{const rows=Array.from({length:1000},(_,i)=>[point(12,0),point(10,1),point(8,2)].map(p=>({...p,scope:{...p.scope,entity:String(i)}}))).flat();const started=performance.now(),a=evaluate(snapshot(rows)),b=evaluate(snapshot(rows));assert.deepEqual(a,b);assert.equal(a.complete,false);assert.ok(a.signals.length<=80);assert.ok(performance.now()-started<3000);assert.ok(scopeKey(rows[0].scope));});

test('Radar: incompatible time windows never cluster and rolling windows preserve identity',()=>{
 const a=trend(),b=structuredClone(a);b.metric='leads';b.fingerprint='leads';b.values=b.values.map(p=>({...p,start:shiftDay(p.start,-7),end:shiftDay(p.end,-7)}));assert.equal(cluster([a,b]).length,2);
 const before=cluster([a])[0].key;a.values=a.values.map(p=>({...p,start:shiftDay(p.start,7),end:shiftDay(p.end,7)}));assert.equal(cluster([a])[0].key,before);
});
test('Radar: distinct currencies and cadences retain distinct signal fingerprints',()=>{
 const s=snapshot(['BRL','EUR'].flatMap(currency=>[12,10,8].map((v,i)=>({...point(v,i,'revenue'),unit:'money',currency}))));
 const trends=evaluate(s).signals.filter(s=>s.type==='TREND');assert.equal(trends.length,2);assert.equal(new Set(trends.map(t=>t.fingerprint)).size,2);
});
test('Radar: an explicitly conflicting observation blocks an otherwise confirmed period',()=>{
 const rows=[point(12,0),point(10,1),point(8,2),{...point(9,2),quality:'CONFLICTING' as const}];assert.ok(!evaluate(snapshot(rows)).signals.some(s=>s.type==='TREND'));
});
test('Radar: arbitrary partial spans cannot impersonate complete recurring periods',()=>{
 const rows=[12,10,8].map((v,i)=>({...point(v,i),start:shiftDay('2026-10-01',i*2),end:shiftDay('2026-10-02',i*2)}));assert.deepEqual(evaluate(snapshot(rows)).signals,[]);
});
test('Radar: narrow conversation context remains inference, respects dismissals and size budget',()=>{
 const s=trend();const rows=[{id:'a',signals:[s]},{id:'b',signals:[s],dismissed:true}];
 assert.equal(conversationSignals(rows,'Como melhorar vendas?').length,1);assert.equal(conversationSignals(rows,'Contratar equipe?').length,0);
 assert.equal(conversationSignals(rows,'Analisar sinal','a')[0].kind,'INFERENCE');
 assert.equal(conversationSignals([{id:'large',signals:[{...s,details:{text:'x'.repeat(17000)}}]}],'vendas').length,0);
 assert.equal(conversationSignals([{id:'a',signals:[{...s,quality:['BOUNDED_CONTEXT']}]}],'vendas').length,0);
});
test('Radar: weekly context requires original evidence in the report window',()=>{
 const s=trend();assert.equal(weeklySignals([s],s.evidence.map(e=>e.id)).length,1);assert.equal(weeklySignals([s],['missing']).length,0);
 s.evidence.push({table:'business_memories',id:'goal',version:1});assert.equal(weeklySignals([s],s.evidence.map(e=>e.id)).length,0);
});
test('Radar: ambiguous thresholds and approximations do not become exact rules',()=>{
 const m={id:'m',version:1,kind:'BUSINESS_PREFERENCE',value:'Conversão abaixo de cerca de 10%',evidence:'Conversão abaixo de cerca de 10%'};
 const w={memory_id:'m',memory_version:1,evidence:m.evidence,kind:'THRESHOLD',metric:'conversion',unit:'percent',currency:null,product:null,channel:null,location:null,period:'ANY',bound:10,comparison:'LT',baseline:null,start:null,deadline:null,trajectory:'NONE'};
 assert.deepEqual(normalizeWatches([w],[m]),[]);m.value=m.evidence='Conversão de 10%';w.evidence=m.evidence;assert.deepEqual(normalizeWatches([w],[m]),[]);
});

test('Radar: an overlapping threshold range remains uncertain, not resolved',()=>{
 const s=snapshot([point(8,0)]);s.points[0].value={min:8,max:12,approximate:true};s.watches=[watch()];const r=evaluate(s);assert.equal(r.recoveries.length,0);assert.equal(r.signals.length,0);
});
test('Radar: an uncertain denominator cannot establish a confirmed conversion trend',()=>{
 const e=(metric:string,value:number,confidence:Entry['confidence']):Entry=>({id:metric,company_id:'c',user_id:'u',source_message_id:'m',entry_type:'METRIC',description:'fixture',evidence:'fixture',event_date:'2026-10-01',period_start:'2026-10-01',period_end:'2026-10-01',metric_type:metric,value,unit:'count',currency_code:null,channel:null,product:null,location:null,confidence,status:'ACTIVE',version:1,manual:false,created_at:'2026-10-01',metadata:{}});
 assert.equal(journalPoints([e('sales',60,'HIGH'),e('leads',500,'LOW')],'2026-10-08').find(p=>p.metric==='conversion')?.quality,'PROVISIONAL');
});
test('Radar: Journal approximations survive conversion and narrative',()=>{
 const e={id:'sale',company_id:'c',user_id:'u',source_message_id:'m',entry_type:'METRIC',description:'fixture',evidence:'cerca de 60 vendas',event_date:'2026-10-01',period_start:'2026-10-01',period_end:'2026-10-01',metric_type:'sales',value:60,unit:'count',currency_code:null,channel:null,product:null,location:null,confidence:'HIGH',status:'ACTIVE',version:1,manual:false,created_at:'2026-10-01',metadata:{}} as Entry;
 assert.equal(journalPoints([e],'2026-10-08')[0].value.approximate,true);
 const ratio=journalPoints([e,{...e,id:'leads',metric_type:'leads',value:500,evidence:'500 leads'}],'2026-10-08').find(p=>p.metric==='conversion');assert.equal(ratio?.value.approximate,true);
});

test('Radar: confirmed target attainment resolves the prior goal deviation',()=>{
 const s=snapshot([point(100,0,'revenue'),point(100,1,'revenue'),point(100,2,'revenue')]);s.points.forEach(p=>{p.unit='money';p.currency='BRL';});s.watches=[watch({kind:'GOAL',metric:'revenue',unit:'money',currency:'BRL',baseline:10,bound:100,start:'2026-09-01',deadline:'2026-10-31',trajectory:'LINEAR_EXPLICIT'})];const r=evaluate(s);assert.equal(r.signals.length,0);assert.equal(r.recoveries.length,1);
});
