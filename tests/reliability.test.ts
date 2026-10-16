import { parseDiagnosis } from "../src/lib/diagnosis/contracts";
import { routeAiModel } from "../src/lib/commercial/model-router";
import test from "node:test";
import assert from "node:assert/strict";
import { KNOWLEDGE_TYPES, parseReliability } from "../src/lib/reliability/contracts";
import { assessSufficiency, calculateDerived, renderCalculations, safeMemoryCandidates, validateProvenance } from "../src/lib/reliability/validate";
import { applyReliabilityGate, unsafeCertainty } from "../src/lib/reliability/gate";
import { parseStrategicRoute } from "../src/lib/reliability/routing";
import { runSeedAnalysis } from "../src/lib/openai/pipeline";
import { emptyReliability, metric, routeFixture } from "./reliability-fixtures";
const route = () => parseStrategicRoute(JSON.stringify(routeFixture()));
test("all knowledge types validate distinctly, with strict bounded schemas", () => {
 for(const kind of KNOWLEDGE_TYPES) assert.equal(parseReliability({...emptyReliability(), evidence:[{...metric("sample",1),kind}]}).evidence[0].kind,kind);
 for(const bad of [null,{}, {...emptyReliability(),confidence:"90%"},{...emptyReliability(),extra:true},{...emptyReliability(),evidence:[{...metric("x",1),numeric_value:NaN}]}]) assert.throws(()=>parseReliability(bad));
});
test("hypothesis/inference/assumption/observation cannot be promoted into remembered fact or metric",()=>{
 for(const kind of ["HYPOTHESIS","INFERENCE","ASSUMPTION","OBSERVATION"] as const){
  const evidence={...metric("price",1),kind,quote:"Acho que meu preço está alto."};
  const candidate={key:"price_high",kind:"FACT" as const,value:"Preço alto",evidence:evidence.quote,certainty:"EXPLICIT" as const,scope:"CURRENT_COMPANY" as const,observed_at:null,replaces_current:false};
  assert.equal(safeMemoryCandidates([candidate],[evidence],0).length,0);
 }
});
test("source trace rejects assistant text, invented numbers, duplicate ids and memory hypothesis promotion",()=>{
 const r={...emptyReliability(),evidence:[metric("leads",300)]};
 validateProvenance(r,[{role:"user",content:"300 leads"}],"[]");
 assert.throws(()=>validateProvenance(r,[{role:"assistant",content:"300 leads"}],"[]"));
 assert.throws(()=>validateProvenance({...r,evidence:[metric("leads",301,{quote:"300"})]},[{role:"user",content:"300"}],"[]"));
 assert.throws(()=>validateProvenance({...r,evidence:[r.evidence[0],r.evidence[0]]},[{role:"user",content:"300"}],"[]"));
 assert.throws(()=>validateProvenance({...r,evidence:[metric("leads",300,{source:"MEMORY",reference:"leads"})]},[],JSON.stringify([{key:"leads",kind:"HYPOTHESIS",value:"300"}])));
});
test("derived conversion is software calculated with trace, scope and period; unknown is not zero",()=>{
 const r={...emptyReliability(),evidence:[metric("sales",21),metric("leads",300)],calculations:[{id:"conversion",operation:"RATIO_PERCENT" as const,left:"sales",right:"leads"}]};
 const c=calculateDerived(r);assert.equal(c[0].value,7);assert.equal(c[0].kind,"DERIVED_METRIC");assert.equal(renderCalculations("Taxa {{calc:conversion}}",c,"pt-BR"),"Taxa 7%");
 for(const patch of [{numeric_value:null},{numeric_value:0},{scope:"other"},{period:"2025-09"},{unit:"EUR"}])assert.throws(()=>calculateDerived({...r,evidence:[r.evidence[0],{...r.evidence[1],...patch}]}));
 assert.equal(calculateDerived({...r,evidence:[metric("sales",0),metric("leads",300)]})[0].value,0);
});
test("discount gate requires costs or margin and contextual business data",()=>{
 const rt={...route(),profile:"DISCOUNT" as const};
 let r={...emptyReliability(),essential_missing:[],evidence:[metric("price",100)]};
 assert.equal(assessSufficiency(r,rt,"[]").state,"INSUFFICIENT");
 r={...r,evidence:[...r.evidence,metric("cost",60),metric("sales",100),metric("discount",20),metric("goal",120)]};
 assert.equal(assessSufficiency(r,rt,"[]").state,"SUFFICIENT");
 assert.equal(calculateDerived({...r,calculations:[{id:"net",operation:"DISCOUNTED_PRICE",left:"price",right:"discount"}],evidence:r.evidence.map(e=>e.key==="discount"?{...e,unit:"PERCENT"}:e)})[0].value,80);
});
test("conflict and stale memory reduce sufficiency; high confidence is not a probability",()=>{
 const r={...emptyReliability(),essential_missing:[],confidence:"HIGH" as const,evidence:[metric("sales",21,{source:"MEMORY",reference:"sales"})]};
 assert.equal(assessSufficiency(r,route(),JSON.stringify([{key:"sales",value:"21",observed_at:"2020-01-01"}])).confidence,"LOW");
 assert.equal(assessSufficiency({...r,conflicts:["Dados discordam"]},route(),"[]").state,"INSUFFICIENT");
 assert.ok(unsafeCertainty("90% de chance de sucesso"));assert.ok(!unsafeCertainty("Não sabemos se vai funcionar."));
});
test("short expansion/hiring/financial questions always receive high materiality",()=>{
 for(const profile of ["EXPANSION","HIRING","FINANCIAL"])assert.equal(parseStrategicRoute(JSON.stringify({...routeFixture(),profile})).materiality,"HIGH");
 assert.throws(()=>parseStrategicRoute(JSON.stringify({...routeFixture("EXPANSION"),task:"SOCIAL"})));
});
test("unsupported strong recommendation is withheld before response/memory persistence",()=>{
 const r={...emptyReliability(),sufficiency:"SUFFICIENT" as const};
 const result=applyReliabilityGate(r,{intent:"SALES",answer:"Isso certamente vai funcionar",facts_detected:[]},null,route(),[{role:"user",content:"vender mais"}],"[]","pt-BR");
 assert.equal(result.validation,"WITHHELD");assert.match(result.answer,/Dados do problema/);assert.deepEqual(result.memory_detected,[]);
});
test("pipeline rejects missing reliability and runs exactly two calls for a valid social response",async()=>{
 const calls: string[]=[];
 const result=await runSeedAnalysis(async request=>{calls.push(request.text!.format!.type);return {status:"completed",output_text:JSON.stringify(calls.length===1?{...routeFixture("GENERAL"),task:"SOCIAL"}:{intent:"GENERAL",answer:"De nada!",facts_detected:[],memory_detected:[],diagnosis:null,reliability:null})};},"test",[{role:"user",content:"Obrigado"}],"[]",new AbortController().signal);
 assert.equal(calls.length,2);assert.equal(result.answer,"De nada!");
 let n=0;await assert.rejects(runSeedAnalysis(async()=>({status:"completed",output_text:JSON.stringify(++n===1?{...routeFixture("GENERAL"),task:"SOCIAL"}:{intent:"GENERAL",answer:"texto",facts_detected:[],diagnosis:null})}),"test",[{role:"user",content:"Obrigado"}],"[]",new AbortController().signal));
});

test("stored diagnosis accepts new reliability and legacy contract without exposing internal fields",()=>{
 const diagnosis={situation:"Situação",objective:null,main_bottleneck:null,secondary_bottlenecks:[],evidence:[],hypotheses:[],missing_data:[],opportunities:[],risks:[],priorities:[],confidence:"LOW" as const};
 assert.equal(parseDiagnosis(diagnosis)?.confidence,"LOW");
 assert.deepEqual(parseDiagnosis({...diagnosis,reliability:emptyReliability()})?.reliability,emptyReliability());
 assert.throws(()=>parseDiagnosis({...diagnosis,reliability:{...emptyReliability(),confidence:"99%"}}));
});
test("same-period numeric conflict is detected even if model omitted conflicts",()=>{
 const r={...emptyReliability(),essential_missing:[],evidence:[metric("a",35,{key:"margin"}),metric("b",18,{key:"margin"})]};
 assert.equal(assessSufficiency(r,route(),"[]").state,"INSUFFICIENT");
 assert.equal(assessSufficiency({...r,evidence:[r.evidence[0],{...r.evidence[1],period:"2026-10"}]},route(),"[]").state,"SUFFICIENT");
});
test("materiality takes precedence over routine feature and social remains economy",()=>{
 const input={feature:"followup" as const,complexity:"LOW" as const,risk_level:"LOW" as const,market:"BR" as const,plan:"FREE" as const,usage_state:"NORMAL" as const,required_capabilities:["structured"]};
 const models={economy:{model:"economic-configured",capabilities:["structured"],max_output_tokens:800},strategic:{model:"strategic-configured",capabilities:["structured"],max_output_tokens:3800}};
 assert.equal(routeAiModel({...input,materiality:"HIGH"},models,true).tier,"strategic");
 assert.equal(routeAiModel({...input,materiality:"LOW"},models,true).tier,"economy");
});
test("a complete bounded discount scenario can calculate and suggest a test without predicting sales",()=>{
 const r={...emptyReliability(),sufficiency:"SUFFICIENT" as const,essential_missing:[],assumptions:["Desconto proposto para o cenário"],evidence:[metric("price",100,{unit:"BRL"}),metric("cost",60,{unit:"BRL"}),metric("sales",100),metric("goal",120),metric("discount",20,{kind:"ASSUMPTION",unit:"PERCENT"})],calculations:[{id:"price_test",operation:"DISCOUNTED_PRICE" as const,left:"price",right:"discount"}],recommendation:{action:"Teste limitado",rationale_summary:"Comparar com base informada",evidence_ids:["price","cost"],expected_signal:"Volume observado",indicator:"Vendas e contribuição",review:"Final da semana",risks:["Menor contribuição"],change_if:"Margem cair",mode:"TEST" as const}};
 const checked=applyReliabilityGate(r,{intent:"PRICING",answer:"Preço no cenário: {{calc:price_test}}. Teste sem garantia de vendas.",facts_detected:[]},null,{...route(),profile:"DISCOUNT",materiality:"HIGH"},[{role:"user",content:"100 60 120 20"}],"[]","pt-BR");
 assert.equal(checked.validation,"PASSED");assert.match(checked.answer,/80/);assert.equal(checked.reliability?.sufficiency,"PARTIALLY_SUFFICIENT");
});
test("spelled-out numbers preserve source text without inventing a verified numeric operand",()=>{
 const r={...emptyReliability(),evidence:[metric("hiring",2,{kind:"ASSUMPTION",quote:"dois vendedores"})]};
 validateProvenance(r,[{role:"user",content:"Quero contratar dois vendedores"}],"[]");
 assert.equal(r.evidence[0].numeric_value,null);assert.equal(r.evidence[0].quote,"dois vendedores");
});

test("scenario assumptions do not conflict with current facts while contradictory facts still block",()=>{
 const base=metric("current",100,{key:"price"});
 for(const kind of ["ASSUMPTION","HYPOTHESIS","INFERENCE"] as const){
  const r={...emptyReliability(),essential_missing:[],assumptions:["Scenario only"],evidence:[base,metric("scenario",110,{key:"price",kind})]};
  assert.equal(assessSufficiency(r,route(),"[]").state,"PARTIALLY_SUFFICIENT");
 }
 const contradictory={...emptyReliability(),essential_missing:[],evidence:[base,metric("other",110,{key:"price"})]};
 assert.equal(assessSufficiency(contradictory,route(),"[]").state,"INSUFFICIENT");
});
