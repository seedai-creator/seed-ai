import test from 'node:test';
import assert from 'node:assert/strict';
import {runSeedAnalysis} from '../src/lib/openai/pipeline';
import {emptyReliability} from './reliability-fixtures';
import {DECISION_TYPES,type Simulation} from '../src/lib/simulation/domain';
import {extractionRequest,renderSimulationAnswer} from '../src/lib/simulation/requests';
const diagnosis={situation:'Faltam dados.',objective:null,main_bottleneck:null,secondary_bottlenecks:[],evidence:[],hypotheses:[],missing_data:['Custos'],opportunities:[],risks:[],priorities:['Confirmar custos'],confidence:'LOW'};
const extraction={inputs:[],scenarios:[],missing_information:['Qual o custo?'],essential_missing:['Custos'],constraints:[],goals:[],dependencies:[],external_dependencies:[]};
const message={role:'user' as const,content:'E se eu mudar?'};
const route={intent:'DECISION',task:'STRATEGIC',profile:'GENERAL',materiality:'LOW'};
const final={intent:'DECISION',answer:'Precisamos confirmar os custos.',facts_detected:[],diagnosis,reliability:emptyReliability()};
test('decision pipeline: grouped extraction, all categories, durable calculations and interpretation-only retry',async t=>{
 const previous=process.env.SEED_SIMULATOR_ENABLED;process.env.SEED_SIMULATOR_ENABLED='true';
 try{
 await t.test('all thirteen types reuse the same three-call pipeline and never create unsupported scenarios',async()=>{
  for(const type of DECISION_TYPES){let count=0;const result=await runSeedAnalysis(async req=>{
   count++;if(count===1){assert.ok(JSON.stringify(req.text).includes('decision_simulation'));return {status:'completed',output_text:JSON.stringify({...route,decision_simulation:{type,materiality:'LOW',reversibility:'REVERSIBLE',quote:message.content}})};}
   if(count===2){assert.equal(req.metadata?.simulation_feature,'DECISION_SCENARIO_EXTRACTION');return {status:'completed',output_text:JSON.stringify(extraction)};}
   assert.equal(req.metadata?.simulation_feature,'DECISION_STRATEGIC_ANALYSIS');return {status:'completed',output_text:JSON.stringify(final)};
  },'fixture',[message],'[]',new AbortController().signal);
  assert.equal(count,3);assert.equal(result.simulation?.readiness,'NOT_READY');assert.equal(result.simulation?.scenarios.length,0);}
 });
 await t.test('historical report does not trigger extraction and keeps the normal pipeline',async()=>{
  let calls=0;const r=await runSeedAnalysis(async()=>({status:'completed',output_text:JSON.stringify(++calls===1?{...route,decision_simulation:null}:final)}),'fixture',[{role:'user',content:'Ontem contratei um vendedor.'}],'[]',new AbortController().signal);
  assert.equal(calls,2);assert.equal(r.simulation,null);
 });
 await t.test('provider failure after calculations preserves them; retry skips routing and extraction',async()=>{
  let prepared:Simulation|undefined;let count=0;
  await assert.rejects(runSeedAnalysis(async()=>{count++;if(count===3)throw Error('PROVIDER_FAILURE');return {status:'completed',output_text:JSON.stringify(count===1?{...route,decision_simulation:{type:'GENERAL_STRATEGIC_DECISION',materiality:'LOW',reversibility:'REVERSIBLE',quote:message.content}}:extraction)};},'fixture',[message],'[]',new AbortController().signal,undefined,undefined,undefined,false,{calculated:async s=>{prepared=structuredClone(s);}}));
  assert.ok(prepared);let retryCalls=0;
  const retry=await runSeedAnalysis(async req=>{retryCalls++;assert.equal(req.metadata?.simulation_feature,'DECISION_STRATEGIC_ANALYSIS');return {status:'completed',output_text:JSON.stringify(final)};},'fixture',[message],'[]',new AbortController().signal,undefined,undefined,undefined,false,{prepared,calculated:async()=>{}});
  assert.equal(retryCalls,1);assert.equal(retry.simulation?.readiness,'NOT_READY');
 });
 await t.test('schema, prompts and answer replacement do not enable tool access or unknown numerical outputs',()=>{
  const req=extractionRequest('fixture',[message],'[]',{type:'PRICING',materiality:'LOW',reversibility:'REVERSIBLE',quote:message.content},'es-ES');assert.equal(req.store,false);assert.equal(req.tools,undefined);assert.ok(req.instructions?.includes('es-ES'));
  assert.throws(()=>renderSimulationAnswer('{{scenario:x:y}}',{scenarios:[]} as unknown as Simulation,'pt-BR'),/UNKNOWN_RESULT/);
 });
 }finally{if(previous===undefined)delete process.env.SEED_SIMULATOR_ENABLED;else process.env.SEED_SIMULATOR_ENABLED=previous;}
});
