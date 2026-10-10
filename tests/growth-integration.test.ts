import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateGrowth} from '../src/lib/growth/engine';
import {mapContext} from '../src/lib/growth/context';
import {annotateGrowthSignals} from '../src/lib/growth/radar';
import {growthLabels,growthReason} from '../src/lib/growth/labels';
import {buildSeedRequest} from '../src/lib/openai/request';
import {weeklyRequest} from '../src/lib/journal/requests';
import {validateProvenance} from '../src/lib/reliability/validate';
import {emptyReliability,metric} from './reliability-fixtures';
import {deriveMetric} from '../src/lib/goals/calculation';
import {EMPTY_AMOUNT,COMPANY_SCOPE,type Observation} from '../src/lib/goals/domain';
import type {Snapshot,GrowthInput} from '../src/lib/growth/domain';
import {EMPTY_SCOPE,type Signal} from '../src/lib/radar/domain';
const base:GrowthInput={company:'c',day:'2026-10-09',timezone:'Europe/Lisbon',scope:COMPANY_SCOPE,goalId:null,goals:[],observations:[],entities:[],structural:[],relations:[],constraints:[],context:[],external:[],limited:false,currency:'EUR'};
const obs:Observation={id:'leads',company_id:'c',version:1,metric:'leads',amount:{...EMPTY_AMOUNT,value:100},boolean:null,text:null,unit:'count',currency:null,period:'MONTH',start:'2026-09-01',end:'2026-09-30',complete:true,scope:COMPANY_SCOPE,confidence:'HIGH',source:'CHAT',quality:'VALID',attribution:null,observed_at:'2026-10-01',source_message_id:null,source_table:'business_journal_entries'};
const derived=deriveMetric('conversion',{...obs,id:'sales',metric:'sales',amount:{...EMPTY_AMOUNT,value:12}},obs)!;
const snapshot:Snapshot={id:'snapshot',request_id:'request',company_id:'c',goal_id:null,scope_type:'COMPANY',scope_id:null,status:'LIMITED',payload:evaluateGrowth({...base,observations:[obs,derived]}),input_fingerprint:'test',created_at:'2026-10-09T12:00:00Z'};
test('map context distinguishes inference from real derived metrics and prohibits factual promotion',()=>{
 const rows=mapContext(snapshot,'CONVERSION');assert.equal(rows.length,2);assert.equal(rows[0].kind,'INFERENCE');assert.equal(rows[1].kind,'DERIVED_METRIC');assert.equal(JSON.parse(rows[1].value).value,12);assert.equal(JSON.parse(rows[1].value).inputs.length,2);
 const r={...emptyReliability(),evidence:[metric('conversion',12,{source:'MEMORY',reference:rows[1].key,quote:'"value":12',kind:'DERIVED_METRIC'})]};assert.doesNotThrow(()=>validateProvenance(r,[],JSON.stringify(rows)));
 assert.throws(()=>validateProvenance({...r,evidence:[{...r.evidence[0],kind:'METRIC'}]},[],JSON.stringify(rows)),/SEMANTICS/);
 assert.throws(()=>validateProvenance({...r,evidence:[{...r.evidence[0],kind:'FACT',reference:'growth_map'}]},[],JSON.stringify(rows)),/SEMANTICS/);
});
test('interpretation reuses existing request and metadata; weekly has no independent map call',()=>{
 const memory=JSON.stringify(mapContext(snapshot,'CONVERSION'));const r=buildSeedRequest('configured-model',[{role:'user',content:'Revisar conversão'}],memory,'SALES');assert.equal(r.metadata?.growth_map_feature,'GROWTH_MAP_SUMMARY');assert.equal(r.store,false);
 const plain=buildSeedRequest('configured-model',[{role:'user',content:'Olá'}],'[]','GENERAL');assert.equal(plain.metadata?.growth_map_feature,undefined);
 const weekly=weeklyRequest('configured-model',[],{start:'2026-09-01',end:'2026-09-07'},{growth:mapContext(snapshot)});assert.equal(weekly.metadata?.growth_map_feature,'GROWTH_MAP_SUMMARY');assert.match(weekly.instructions!,/original event IDs/);
});
test('Radar annotation keeps the same fingerprint, count, original evidence and surfacing thresholds',()=>{
 const s:Signal={fingerprint:'existing',type:'TREND',domain:'SALES',rule:'TREND',ruleVersion:'1',scope:EMPTY_SCOPE,metric:'conversion',direction:'DOWN',evidence:[{table:obs.source_table,id:obs.id,version:1}],values:[],baseline:null,current:null,confidence:'MEDIUM',impact:'MODERATE',urgency:'LOW',actionable:true,strategic:false,persistence:2,quality:[],knowledge_source_scope:'INTERNAL',details:{}};
 const r=annotateGrowthSignals([s],snapshot);assert.equal(r.length,1);assert.equal(r[0].fingerprint,s.fingerprint);assert.deepEqual(r[0].evidence,s.evidence);assert.equal(r[0].strategic,false);assert.ok(r[0].details.growth);assert.deepEqual(annotateGrowthSignals([s],{...snapshot,status:'SUPERSEDED'}),[s]);
 assert.deepEqual(annotateGrowthSignals([{...s,evidence:[{...s.evidence[0],version:2}]}],snapshot),[{...s,evidence:[{...s.evidence[0],version:2}]}]);
});
test('four locales explain missing information, estimates, scope and definitions',()=>{for(const locale of ['pt-BR','pt-PT','en-US','es-ES'] as const){const l=growthLabels(locale);assert.ok(Object.values(l).every(v=>typeof v==='string'&&v.length>0));assert.notEqual(l.UNKNOWN,l.NOT_APPLICABLE);for(const code of ['SAMPLE_LIMITED','MIXED_PERIODS','APPROXIMATE_OR_RANGE','CORRECT_CONFLICT','CURRENT_OBSERVATION','EXPLICIT_NON_RECURRING_MODEL'])assert.notEqual(growthReason(code,locale),l.unknownReason);}assert.notEqual(growthLabels('pt-BR').TEAM,growthLabels('pt-PT').TEAM);});
test('map remains a deterministic partial read model without goal or external facts',()=>{const a=evaluateGrowth(base),b=evaluateGrowth(base);assert.deepEqual(a,b);assert.equal(a.primary,null);assert.ok(a.limitations.includes('NO_ACTIVE_GOAL'));assert.ok(a.dimensions.every(d=>d.current===null));});
