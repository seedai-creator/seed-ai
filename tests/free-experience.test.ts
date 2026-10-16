import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement, type ComponentType, type PropsWithChildren } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { firstAnalysisMessage, firstValue, freeAnalysisInstructions, freeExperienceState } from '../src/lib/commercial/free-experience';
import { FreeContextPrompt, FreeValueCard, FreeLimitNotice } from '../src/components/free-experience';
import { I18nProvider } from '../src/lib/i18n/provider';
import { LOCALES, type Locale } from '../src/lib/i18n/config';
import { parseDiagnosis, validateEvidence } from '../src/lib/diagnosis/contracts';
import { runSeedAnalysis } from '../src/lib/openai/pipeline';
import { applyReliabilityGate } from '../src/lib/reliability/gate';
import { validateProvenance } from '../src/lib/reliability/validate';
import { EMPTY_MARKET } from '../src/lib/i18n/market';
import { emptyReliability, routeFixture } from './reliability-fixtures';

import {freePolicy,freeMessage,usefulDiagnosis} from './free-experience-fixtures';
const Provider = I18nProvider as ComponentType<PropsWithChildren<{ locale: Locale }>>;

test('two local context answers compose one bounded user message without asserting missing facts',()=>{
  assert.equal(firstAnalysisMessage('Meu problema','Não sei','Não tenho números'), 'Meu problema\n\nNão sei\n\nNão tenho números');
  for(const parts of [['','',''],['Problema','Empresa',' '],['x'.repeat(4000),'y','z'],['x','y'.repeat(601),'z']])assert.throws(()=>firstAnalysisMessage(...parts as [string,string,string]));
  const html=renderToStaticMarkup(createElement(FreeContextPrompt,{problem:'problema',onAnalyze:()=>{},onCancel:()=>{}}));
  assert.equal((html.match(/<textarea/g)??[]).length,2);assert.doesNotMatch(html,/href="\/billing"|Conhecer o PRO/);
});
test('FREE keeps existing lifetime and financial limits, including unknown costs accounted by SQL',()=>{
  assert.deepEqual(freeExperienceState({cost:0,diagnoses:0},freePolicy),{used:0,limit:3,remaining:3,limited:false});
  assert.equal(freeExperienceState({cost:.01,diagnoses:3},freePolicy).limited,true);
  assert.equal(freeExperienceState({cost:.25,diagnoses:0},freePolicy).limited,true);
  assert.equal(freeExperienceState({cost:.24,diagnoses:2},freePolicy).limited,false);
  for(const n of [NaN,-1,Infinity])assert.throws(()=>freeExperienceState({cost:n,diagnoses:0},freePolicy));
  assert.throws(()=>freeExperienceState({cost:0,diagnoses:1.2},freePolicy));
});
test('a grounded investigative next step is useful without fabricating a bottleneck or sufficient data',()=>{
  const d=parseDiagnosis(usefulDiagnosis())!;
  validateEvidence(d,[{role:'user',content:freeMessage}],'[]');validateProvenance(d.reliability!,[{role:'user',content:freeMessage}],'[]');
  const value=firstValue(d)!;
  assert.equal(value.investigative,true);assert.ok(value.action);assert.ok(value.indicator);assert.ok(value.review);
  assert.equal(d.main_bottleneck,null);assert.equal(d.reliability?.sufficiency,'INSUFFICIENT');
});
test('no invitation for greetings, questions only, withheld or unsupported recommendations, conflicts or false certainty',()=>{
  assert.equal(firstValue(null),null);
  const d=usefulDiagnosis(), r=d.reliability!;
  for(const candidate of [
    {...d,objective:null}, {...d,reliability:emptyReliability()},
    {...d,reliability:{...r,recommendation:null}}, {...d,reliability:{...r,evidence:[]}},
    {...d,reliability:{...r,conflicts:['Informações conflitantes']}},
    {...d,reliability:{...r,evidence:r.evidence.map(e=>({...e,kind:'HYPOTHESIS' as const}))}},
    {...d,reliability:{...r,evidence:r.evidence.map(e=>({...e,key:'goal'}))}},
    {...d,reliability:{...r,recommendation:{...r.recommendation!,mode:'COMMIT' as const}}},
    {...d,reliability:{...r,recommendation:{...r.recommendation!,evidence_ids:['unknown']}}},
    {...d,reliability:{...r,recommendation:{...r.recommendation!,review:''}}},
    {...d,situation:'Isso certamente vai funcionar.'},
    {...d,situation:'Taxa {{calc:not_validated}}'},
  ])assert.equal(firstValue(candidate),null);
});
test('unsafe high-materiality commitment remains withheld and never becomes an upgrade success',()=>{
  const d=usefulDiagnosis(),r={...d.reliability!,recommendation:{...d.reliability!.recommendation!,mode:'COMMIT' as const}};
  const checked=applyReliabilityGate(r,{intent:'DECISION',answer:'Contrate agora.',facts_detected:[]},d,{intent:'DECISION',profile:'HIRING',materiality:'HIGH',task:'STRATEGIC'},[{role:'user',content:freeMessage}],'[]','pt-BR');
  assert.equal(checked.validation,'WITHHELD');assert.equal(firstValue(checked.diagnosis),null);
});
test('invitation is below the complete useful result; all supported locales have readable copy',()=>{
  for(const locale of LOCALES){
    const value=firstValue(usefulDiagnosis())!;
    const html=renderToStaticMarkup(createElement(Provider,{locale},createElement(FreeValueCard,{value})));
    assert.ok(html.indexOf(value.action)<html.indexOf('href="/billing"'));
    assert.ok(html.includes(value.indicator));assert.ok(html.includes(value.review));assert.doesNotMatch(html,/free\.(value|invite|upgrade)|undefined/);
    const exhausted=freeExperienceState({cost:.25,diagnoses:1},freePolicy);
    const notice=renderToStaticMarkup(createElement(Provider,{locale},createElement(FreeLimitNotice,{state:exhausted,hasValue:false})));
    assert.match(notice,/href="mailto:suporte@appseedai\.com"/);assert.doesNotMatch(notice,/href="\/billing"/);
  }
});
test('FREE pipeline provides bounded first-value instructions and skips automatic simulation/execution; paid pipeline unchanged',async()=>{
  const old=process.env.SEED_SIMULATOR_ENABLED;process.env.SEED_SIMULATOR_ENABLED='true';
  try{
    let calls=0;
    const d=usefulDiagnosis();const {reliability,...diagnosis}=d;
    const response=await runSeedAnalysis(async request=>{
      calls++;
      if(calls===1){assert.doesNotMatch(JSON.stringify(request.text),/decision_simulation/);return {status:'completed',output_text:JSON.stringify(routeFixture('SALES'))};}
      assert.match(request.instructions!,/PRIMEIRA EXPERIÊNCIA FREE/);assert.match(request.instructions!,/Esta é a última/);
      assert.equal(request.metadata?.free_experience,'first_value_v1');assert.equal(request.max_output_tokens,3800);
      return {status:'completed',output_text:JSON.stringify({intent:'SALES',answer:'Comece por revisar os orçamentos pendentes.',facts_detected:[],memory_detected:[],diagnosis,reliability})};
    },'fixture',[{role:'user',content:freeMessage}],'[]',AbortSignal.timeout(10000),EMPTY_MARKET,null,undefined,false,undefined,freeExperienceState({cost:.04,diagnoses:2},freePolicy));
    assert.equal(calls,2);assert.ok(firstValue(response.diagnosis));assert.equal(response.simulation,null);assert.deepEqual(response.execution_commands,[]);
    let touched=false;
    await assert.rejects(runSeedAnalysis(async()=>{touched=true;throw Error('must not call');},'fixture',[{role:'user',content:'oi'}],'[]',AbortSignal.timeout(1000),EMPTY_MARKET,null,undefined,false,undefined,freeExperienceState({cost:.25,diagnoses:0},freePolicy)));
    assert.equal(touched,false);
  }finally{if(old===undefined)delete process.env.SEED_SIMULATOR_ENABLED;else process.env.SEED_SIMULATOR_ENABLED=old;}
});
test('last available turn guidance does not require an invented result or disable reliability',()=>{
  const guide=freeAnalysisInstructions(freeExperienceState({cost:.1,diagnoses:2},freePolicy));
  assert.match(guide,/no máximo duas perguntas/i);assert.match(guide,/não tente contorná-la/);assert.match(guide,/não deixe uma promessa/);
});
