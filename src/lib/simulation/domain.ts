import {obj,str,nullable,list} from '../journal/domain';
import {validateSchema,type Reliability} from '../reliability/contracts';
import {memorySources} from '../reliability/validate';
import {supportedNumber} from '../business-model/domain';
import type {ChatMessage} from '../chat/contracts';
import type {StrategicRoute} from '../reliability/routing';
import {calculate,quantity,FORMULAS,CALCULATION_VERSION,type Quantity,type Calculation,type Formula} from './calculation';

export const DECISION_TYPES=['PRICING','DISCOUNT','MARKETING_INVESTMENT','HIRING','CAPACITY_EXPANSION','NEW_PRODUCT','PRODUCT_REMOVAL','NEW_LOCATION','COST_REDUCTION','SALES_STRATEGY','OFFER_CHANGE','PAYMENT_TERMS','GENERAL_STRATEGIC_DECISION'] as const;
export type DecisionType=typeof DECISION_TYPES[number];
export const MATERIALITIES=['LOW','MEDIUM','HIGH','CRITICAL'] as const;
export const REVERSIBILITIES=['REVERSIBLE','PARTIALLY_REVERSIBLE','HARD_TO_REVERSE','IRREVERSIBLE'] as const;
const en=(values:readonly string[])=>({type:'string',enum:values});
const id={type:'string',pattern:'^[a-z][a-z0-9_]{0,39}$',minLength:1,maxLength:40};
const num={type:'number',minimum:-1e15,maximum:1e15};
export const DECISION_INTENT_SCHEMA=obj({type:en(DECISION_TYPES),materiality:en(MATERIALITIES),reversibility:en(REVERSIBILITIES),quote:str});
export type DecisionIntent={type:DecisionType;materiality:typeof MATERIALITIES[number];reversibility:typeof REVERSIBILITIES[number];quote:string};
export function parseDecisionIntent(raw:unknown,message:string):DecisionIntent|null {
 if(raw===null||raw===undefined)return null;
 if(!validateSchema(raw,DECISION_INTENT_SCHEMA))throw Error('SIMULATION_INTENT_INVALID');
 const d={...raw as DecisionIntent};if(!message.includes(d.quote))throw Error('SIMULATION_INTENT_UNGROUNDED');
 if(['HIRING','NEW_LOCATION','CAPACITY_EXPANSION','PAYMENT_TERMS'].includes(d.type)&&MATERIALITIES.indexOf(d.materiality)<2)d.materiality='HIGH';
 if(['HARD_TO_REVERSE','IRREVERSIBLE'].includes(d.reversibility)&&MATERIALITIES.indexOf(d.materiality)<2)d.materiality='HIGH';
 if(d.type==='NEW_LOCATION'&&REVERSIBILITIES.indexOf(d.reversibility)<2)d.reversibility='HARD_TO_REVERSE';
 return d;
}
export const QUANTITY_SCHEMA=obj({min:num,max:num,approximate:{type:'boolean'},unit:en(['MONEY','MONEY_PER_UNIT','UNITS','RATIO']),currency:nullable({type:'string',pattern:'^[A-Z]{3}$'}),period:en(['ONCE','DAY','WEEK','MONTH','YEAR']),scope:str});
const INPUT_SCHEMA=obj({id,label:str,kind:en(['FACT','USER_ASSUMPTION','SCENARIO_ASSUMPTION']),value:QUANTITY_SCHEMA,source:en(['USER_MESSAGE','MEMORY','ILLUSTRATIVE']),reference:str,quote:str,limitation:nullable(str)});
const CALC_SCHEMA=obj({id,formula:en(Object.keys(FORMULAS)),operands:list(obj({name:str,input_id:id}),3)});
const SCENARIO_SCHEMA=obj({id,label:str,kind:en(['STATUS_QUO','OPTION','SENSITIVITY']),assumption_ids:list(id,12),calculations:list(CALC_SCHEMA,12),qualitative_effects:list(str,4)});
export const EXTRACTION_SCHEMA=obj({inputs:list(INPUT_SCHEMA,24),scenarios:list(SCENARIO_SCHEMA,4),missing_information:list(str,3),essential_missing:list(str,6),constraints:list(str,5),goals:list(str,3),dependencies:list(str,4),external_dependencies:list(str,3)});
export type SimulationInput={id:string;label:string;kind:'FACT'|'USER_ASSUMPTION'|'SCENARIO_ASSUMPTION';value:Quantity;source:'USER_MESSAGE'|'MEMORY'|'ILLUSTRATIVE';reference:string;quote:string;limitation:string|null};
export type Scenario={id:string;label:string;kind:'STATUS_QUO'|'OPTION'|'SENSITIVITY';assumption_ids:string[];calculations:{id:string;formula:Formula;operands:{name:string;input_id:string}[]}[];qualitative_effects:string[]};
export type Extraction={inputs:SimulationInput[];scenarios:Scenario[];missing_information:string[];essential_missing:string[];constraints:string[];goals:string[];dependencies:string[];external_dependencies:string[]};
export type Simulation={reliability?:Reliability|null;route?:StrategicRoute;intent:DecisionIntent;calculation_version:string;status:'WAITING_FOR_INFORMATION'|'READY';readiness:'NOT_READY'|'READY_WITH_LIMITATIONS'|'READY';extraction:Extraction;scenarios:(Scenario&{results:(Calculation&{id:string})[]})[];errors:{scenario:string;code:string}[];limitations:string[]};
export type SimulationLifecycle={prepared?:Simulation;calculated:(simulation:Simulation)=>Promise<void>};
function groundedNumber(quote:string,q:Quantity) {
 // Ratios use explicit percentages or decimals; bare 10 must not prove 10%.
 const present=(n:number)=>supportedNumber(quote,n)||q.unit==='RATIO'&&quote.includes('%')&&supportedNumber(quote,n*100);
 return present(q.min)&&present(q.max);
}
export function parseExtraction(raw:unknown,messages:ChatMessage[],memory:string):Extraction {
 if(!validateSchema(raw,EXTRACTION_SCHEMA))throw Error('SIMULATION_EXTRACTION_INVALID');
 const e=structuredClone(raw as Extraction),ids=new Set<string>(),rows=memorySources(memory);
 for(const input of e.inputs){
  if(ids.has(input.id))throw Error('SIMULATION_DUPLICATE_INPUT');ids.add(input.id);quantity(input.value);
  if(input.kind!=='FACT'&&!input.limitation)throw Error('SIMULATION_ASSUMPTION_UNLABELED');
  if(input.source==='ILLUSTRATIVE'){
   if(input.kind!=='SCENARIO_ASSUMPTION'||input.reference!=='illustrative')throw Error('SIMULATION_FABRICATED_FACT');
  }else{
   let source:string|undefined;
   if(input.source==='USER_MESSAGE'){
    const index=Number(input.reference);if(String(index)!==input.reference||messages[index]?.role!=='user')throw Error('SIMULATION_SOURCE_INVALID');
    source=messages[index].content;
   }else{
    const row=rows.find(r=>r.key===input.reference);source=row?.value;
    if(input.kind==='FACT'&&(!row||!['FACT','METRIC','RESULT','DERIVED_METRIC'].includes(row.kind??'')||row.state&&row.state!=='CONFIRMED'))throw Error('SIMULATION_UNRELIABLE_BASELINE');
    if(row?.approximate&&!input.value.approximate)throw Error('SIMULATION_FALSE_PRECISION');
    if(row?.key.startsWith('business_')){
     try{const v=JSON.parse(row.value);if(v.min!==null&&v.min!==undefined&&(input.value.min!==v.min||input.value.max!==v.max))throw Error('SIMULATION_RANGE_CHANGED');}catch(err){if(err instanceof SyntaxError){/* Non-numeric context cannot establish a number below. */}else throw err;}
    }
   }
   if(!source?.includes(input.quote)||!groundedNumber(input.quote,input.value))throw Error('SIMULATION_NUMBER_UNGROUNDED');
  }
 }
 const scenarioIds=new Set<string>();
 for(const s of e.scenarios){
  if(scenarioIds.has(s.id))throw Error('SIMULATION_DUPLICATE_SCENARIO');scenarioIds.add(s.id);
  if(s.assumption_ids.some(x=>!e.inputs.some(i=>i.id===x&&i.kind!=='FACT')))throw Error('SIMULATION_ASSUMPTION_INVALID');
  if(s.kind==='STATUS_QUO'&&s.assumption_ids.length)throw Error('SIMULATION_BASELINE_HAS_ASSUMPTIONS');
  const available=new Set(ids);
  for(const c of s.calculations){
   if(available.has(c.id)||c.operands.some(o=>!available.has(o.input_id))||new Set(c.operands.map(o=>o.name)).size!==c.operands.length)throw Error('SIMULATION_CALCULATION_REFERENCE');
   for(const o of c.operands){const input=e.inputs.find(i=>i.id===o.input_id);if(input&&input.kind!=='FACT'&&!s.assumption_ids.includes(input.id))throw Error('SIMULATION_HIDDEN_ASSUMPTION');}
   available.add(c.id);
  }
 }
 return e;
}
export function buildSimulation(intent:DecisionIntent,extraction:Extraction):Simulation {
 const errors:Simulation['errors']=[],limitations=new Set<string>();
 const scenarios=extraction.scenarios.map(s=>{
  const operands=new Map(extraction.inputs.map(i=>[i.id,i.value]));const results:(Calculation&{id:string})[]=[];
  try{for(const call of s.calculations){const input:Record<string,Quantity>={};for(const o of call.operands){const v=operands.get(o.input_id);if(!v)throw Error('MISSING_CALCULATION_INPUT');input[o.name]=v;}
   const result=calculate(call.formula,input);results.push({...result,id:call.id});operands.set(call.id,result.output);result.limitations.forEach(l=>limitations.add(l));
  }}catch(err){errors.push({scenario:s.id,code:err instanceof Error?err.message:'CALCULATION_FAILED'});results.length=0;}
  return {...s,results};
 });
 const blocked=!!extraction.essential_missing.length||!!errors.length;
 if(extraction.inputs.some(i=>i.value.approximate||i.value.min!==i.value.max))limitations.add('APPROXIMATE_OR_RANGE_INPUTS');
 if(extraction.inputs.some(i=>i.kind!=='FACT'))limitations.add('CONDITIONAL_ASSUMPTIONS');
 if(extraction.external_dependencies.length)limitations.add('EXTERNAL_VALIDATION_REQUIRED');
 return {intent,calculation_version:CALCULATION_VERSION,status:blocked?'WAITING_FOR_INFORMATION':'READY',readiness:blocked?'NOT_READY':limitations.size||extraction.missing_information.length?'READY_WITH_LIMITATIONS':'READY',extraction,scenarios,errors,limitations:[...limitations]};
}
/** The existing reliability gate can lower readiness, never be bypassed by a successful formula. */
export function applySimulationSufficiency(simulation:Simulation,reliability:Reliability|null):Simulation {
 if(!reliability||reliability.sufficiency==='INSUFFICIENT'||reliability.conflicts.length)return {...simulation,status:'WAITING_FOR_INFORMATION',readiness:'NOT_READY'};
 if(reliability.sufficiency==='PARTIALLY_SUFFICIENT'&&simulation.readiness==='READY')return {...simulation,readiness:'READY_WITH_LIMITATIONS'};
 return simulation;
}
export function validateAssumption(expected:Quantity,observed:Quantity):'SUPPORTED'|'NOT_SUPPORTED'|'UNKNOWN' {
 try{quantity(expected);quantity(observed);}catch{return 'UNKNOWN';}
 if(expected.unit!==observed.unit||expected.currency!==observed.currency||expected.scope!==observed.scope||expected.period!==observed.period)return 'UNKNOWN';
 if(observed.max<expected.min||observed.min>expected.max)return 'NOT_SUPPORTED';
 if(observed.min>=expected.min&&observed.max<=expected.max)return 'SUPPORTED';
 return 'UNKNOWN';
}
