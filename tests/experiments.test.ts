import test from "node:test";
import assert from "node:assert/strict";
import {draftExperiment,parseExperiment,parseExperimentResult,canTransition,EXPERIMENT_STATUSES,formatExperimentNumber,experimentNumber} from "../src/lib/experiments/contracts";
const draft={...draftExperiment(),name:"Teste",problem:"Demora",hypothesis:"Resposta mais rápida ajuda",action:"Rever fila",baseline:"3",target:"1",metric:"Dias para responder",start_date:"2026-09-27",end_date:"2026-10-04"};
test("plano exige hipótese, indicador e números sem presumir que maior é melhor",()=>{
 assert.deepEqual(parseExperiment(draft),draft);
 assert.equal(draftExperiment().baseline,"");assert.equal(draftExperiment().target,"");
 for(const bad of [{...draft,target:"1,5"},{...draft,baseline:"NaN"},{...draft,end_date:"2026-09-26"},{...draft,start_date:"2026-02-30"},{...draft,hypothesis:" "}])assert.throws(()=>parseExperiment(bad));
 for(const value of ["1e3","Infinity","1.234.567","9999999999","0.1234567"])assert.throws(()=>experimentNumber(value));
 assert.equal(experimentNumber("-12.123456"),"-12.123456");
 assert.equal(formatExperimentNumber("12.123456","pt-BR"),"12,123456");
});
test("somente inconclusivo permite resultado ausente; aprendizado obrigatório",()=>{
 assert.deepEqual(parseExperimentResult({status:"INCONCLUSIVE",result:"",learning:"Sem amostra"}),{status:"INCONCLUSIVE",result:null,learning:"Sem amostra"});
 assert.equal(parseExperimentResult({status:"VALIDATED",result:"0",learning:"Observado"}).result,"0");
 for(const bad of [{status:"VALIDATED",result:null,learning:"Aprendi"},{status:"INVALIDATED",result:"",learning:"Aprendi"},{status:"INCONCLUSIVE",result:null,learning:""},{status:"RUNNING",result:"1",learning:"Texto"}])assert.throws(()=>parseExperimentResult(bad));
});
test("máquina de estados impede pular execução, reiniciar ou reabrir encerrado",()=>{
 const allowed=new Set(["PLANNED:RUNNING","RUNNING:VALIDATED","RUNNING:INVALIDATED","RUNNING:INCONCLUSIVE"]);
 for(const from of EXPERIMENT_STATUSES)for(const to of EXPERIMENT_STATUSES)assert.equal(canTransition(from,to),allowed.has(from+":"+to));
});
