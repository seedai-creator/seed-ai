import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDecisionIntent,parseExtraction,buildSimulation,applySimulationSufficiency,validateAssumption,type Extraction,type DecisionIntent} from '../src/lib/simulation/domain';
import {emptyReliability} from './reliability-fixtures';
const intent:DecisionIntent={type:'PRICING',materiality:'LOW',reversibility:'REVERSIBLE',quote:'E se aumentar 10%?'};
const extraction=():Extraction=>({inputs:[{id:'price',label:'Preço',kind:'FACT',source:'USER_MESSAGE',reference:'0',quote:'Preço 100 BRL',limitation:null,value:{min:100,max:100,approximate:false,unit:'MONEY_PER_UNIT',currency:'BRL',period:'ONCE',scope:'product:A'}},{id:'change',label:'Aumento',kind:'USER_ASSUMPTION',source:'USER_MESSAGE',reference:'0',quote:'aumentar 10%',limitation:'Cenário solicitado, não preço atual.',value:{min:.1,max:.1,approximate:false,unit:'RATIO',currency:null,period:'ONCE',scope:'product:A'}}],scenarios:[{id:'higher',label:'Aumento condicional',kind:'OPTION',assumption_ids:['change'],calculations:[{id:'new_price',formula:'CHANGED_PRICE',operands:[{name:'price',input_id:'price'},{name:'change_ratio',input_id:'change'}]}],qualitative_effects:[]}],missing_information:[],essential_missing:[],constraints:[],goals:[],dependencies:[],external_dependencies:[]});
const messages=[{role:'user' as const,content:'Preço 100 BRL. E se aumentar 10%?'}];
test('simulation intent: explicit provenance, null for non-decision and deterministic severity floors',()=>{
 assert.equal(parseDecisionIntent(null,'Ontem contratei alguém.'),null);
 assert.throws(()=>parseDecisionIntent(intent,'Olá'),/UNGROUNDED/);
 for(const type of ['HIRING','NEW_LOCATION','CAPACITY_EXPANSION','PAYMENT_TERMS'] as const){const r=parseDecisionIntent({...intent,type},messages[0].content)!;assert.equal(r.materiality,'HIGH');if(type==='NEW_LOCATION')assert.equal(r.reversibility,'HARD_TO_REVERSE');}
});
test('simulation extraction: quoted values and percentage conversion preserve user assumptions',()=>{
 const parsed=parseExtraction(extraction(),messages,'[]');assert.equal(parsed.inputs[1].kind,'USER_ASSUMPTION');
 const result=buildSimulation(intent,parsed);assert.equal(result.scenarios[0].results.length,1);assert.equal(result.readiness,'READY_WITH_LIMITATIONS');
 const bad=extraction();bad.inputs[0].value.min=200;bad.inputs[0].value.max=200;assert.throws(()=>parseExtraction(bad,messages,'[]'),/UNGROUNDED/);
});
test('simulation extraction: invented numbers, assistant sources and hidden assumptions are rejected',()=>{
 const a=extraction();a.inputs[0].source='ILLUSTRATIVE';assert.throws(()=>parseExtraction(a,messages,'[]'),/FABRICATED_FACT/);
 const b=extraction();b.scenarios[0].assumption_ids=[];assert.throws(()=>parseExtraction(b,messages,'[]'),/HIDDEN_ASSUMPTION/);
 assert.throws(()=>parseExtraction(extraction(),[{role:'assistant',content:messages[0].content}],'[]'),/SOURCE_INVALID/);
 const c=extraction();c.inputs[1].quote='Preço 100 BRL';c.inputs[1].value.min=1;c.inputs[1].value.max=1;assert.throws(()=>parseExtraction(c,messages,'[]'),/UNGROUNDED/);
});
test('simulation extraction: stale, conflicting, hypothetical and approximate memory cannot become exact baseline',()=>{
 for(const state of ['STALE','CONFLICTING','HISTORICAL','PROVISIONAL']){
  const e=extraction();e.inputs[0].source='MEMORY';e.inputs[0].reference='price';assert.throws(()=>parseExtraction(e,messages,JSON.stringify([{key:'price',value:'Preço 100 BRL',kind:'FACT',state}])),/UNRELIABLE_BASELINE/);
 }
 const e=extraction();e.inputs[0].source='MEMORY';e.inputs[0].reference='price';
 assert.throws(()=>parseExtraction(e,messages,JSON.stringify([{key:'price',value:'Preço 100 BRL',kind:'HYPOTHESIS'}])),/UNRELIABLE_BASELINE/);
 assert.throws(()=>parseExtraction(e,messages,JSON.stringify([{key:'price',value:'Preço 100 BRL',kind:'FACT',approximate:true}])),/FALSE_PRECISION/);
});
test('simulation: invalid math cannot fall back to an AI number or retain partial scenario outputs',()=>{
 const e=extraction();e.inputs[1].value.scope='other';const result=buildSimulation(intent,e);
 assert.equal(result.readiness,'NOT_READY');assert.equal(result.scenarios[0].results.length,0);assert.equal(result.errors[0].code,'SCOPE_MISMATCH');
 e.essential_missing=['Margem'];assert.equal(buildSimulation(intent,e).status,'WAITING_FOR_INFORMATION');
});
test('simulation: reliability insufficiency and conflicts override successful arithmetic',()=>{
 const simulation=buildSimulation(intent,extraction());
 assert.equal(applySimulationSufficiency(simulation,null).readiness,'NOT_READY');
 const r=emptyReliability();r.sufficiency='SUFFICIENT';r.conflicts=['Custos divergentes'];assert.equal(applySimulationSufficiency(simulation,r).readiness,'NOT_READY');
});
test('simulation: assumption validation is observed support, not causal proof; incompatible scopes unknown',()=>{
 const expected={...extraction().inputs[0].value,min:10,max:12};
 assert.equal(validateAssumption(expected,{...expected,min:12.5,max:12.5}),'NOT_SUPPORTED');
 assert.equal(validateAssumption(expected,{...expected,min:11,max:11}),'SUPPORTED');
 assert.equal(validateAssumption(expected,{...expected,min:11,max:13}),'UNKNOWN');
 assert.equal(validateAssumption(expected,{...expected,currency:'EUR'}),'UNKNOWN');
 assert.equal(validateAssumption(expected,{...expected,scope:'other'}),'UNKNOWN');
});
