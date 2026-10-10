import { emptyReliability, routeFixture } from "./reliability-fixtures";
import test from "node:test";
import assert from "node:assert/strict";
import { parseDiagnosis, validateEvidence, type Diagnosis } from "../src/lib/diagnosis/contracts";
import { runSeedAnalysis } from "../src/lib/openai/pipeline";
export const initialDiagnosis: Diagnosis = {
  situation: "Objetivo de crescimento, sem dados operacionais.", objective: "Vender mais",
  main_bottleneck: null, secondary_bottlenecks: [], evidence: [], hypotheses: [],
  missing_data: ["Oportunidades e vendas no mesmo período"], opportunities: [], risks: [],
  priorities: ["Medir oportunidades e vendas antes de investir"], confidence: "LOW",
};
test("diagnóstico com poucos dados mantém gargalo desconhecido e baixa confiança", () => {
  assert.deepEqual(parseDiagnosis(initialDiagnosis), initialDiagnosis);
  assert.equal(parseDiagnosis(null), null);
  for (const bad of [undefined, {}, { ...initialDiagnosis, confidence: "CERTAIN" },
    { ...initialDiagnosis, main_bottleneck: "Marketing" }, { ...initialDiagnosis, secondary_bottlenecks: ["Marketing"] },
    { ...initialDiagnosis, confidence: "HIGH" }, { ...initialDiagnosis, priorities: ["a","b","c","d"] },
    { ...initialDiagnosis, extra: true }, { ...initialDiagnosis, situation: " " }]) assert.throws(() => parseDiagnosis(bad));
});
test("valida proveniência literal sem aceitar fala da IA ou outra empresa", () => {
  const data = { ...initialDiagnosis, evidence: [{ source: "USER_MESSAGE" as const, quote: "Tenho poucas vendas" }] };
  validateEvidence(data, [{ role: "user", content: "Tenho poucas vendas" }], "[]");
  assert.throws(() => validateEvidence(data, [{ role: "assistant", content: "Tenho poucas vendas" }], "[]"));
  const memoryEvidence = { ...data, evidence: [{ source: "CONFIRMED_MEMORY" as const, quote: "Padaria" }] };
  validateEvidence(memoryEvidence, [], '[{"key":"segment","value":"Padaria"}]');
  assert.throws(() => validateEvidence(memoryEvidence, [], '[{"key":"segment","value":"Pizzaria"}]'));
  assert.throws(() => validateEvidence(memoryEvidence, [], '[]'));
});
test("confiança alta exige evidências, gargalo e ausência de dados críticos faltantes", () => {
  const evidence: Diagnosis["evidence"] = [{ source: "USER_MESSAGE", quote: "100 contatos" }, { source: "USER_MESSAGE", quote: "5 vendas" }];
  const data = { ...initialDiagnosis, main_bottleneck: "Conversão", evidence, confidence: "HIGH" };
  assert.throws(() => parseDiagnosis(data));
  assert.equal(parseDiagnosis({ ...data, missing_data: [] })?.confidence, "HIGH");
  assert.throws(() => parseDiagnosis({ ...data, missing_data: [], evidence: evidence.slice(0, 1) }));
});
test("pipeline rejeita diagnóstico ausente e evidência inventada; aceita diagnóstico válido", async () => {
  for (const diagnosis of [undefined, null, { ...initialDiagnosis, evidence: [{ source: "USER_MESSAGE", quote: "Dado inventado" }] }, initialDiagnosis]) {
    let calls = 0;
    const result = runSeedAnalysis(async () => ({ status: "completed", output_text: JSON.stringify(++calls === 1 ? routeFixture("SALES") : {
      intent: "SALES", answer: "Vamos medir antes de investir.", facts_detected: [], reliability: emptyReliability(), diagnosis,
    }) }), "test-model", [{ role: "user", content: "Quero vender mais" }], "[]", new AbortController().signal);
    if (diagnosis === initialDiagnosis) assert.deepEqual((await result).diagnosis, {...initialDiagnosis,reliability:emptyReliability()});
    else await assert.rejects(result);
  }
});

test('generated factual lookup lowers overstated confidence without inventing a bottleneck or relaxing evidence',async()=>{
 const {parseGeneratedDiagnosis}=await import('../src/lib/diagnosis/contracts');
 const lookup={...initialDiagnosis,situation:'Preço atual informado: 249.',evidence:[{source:'USER_MESSAGE' as const,quote:'Preço 249'}],missing_data:[],confidence:'HIGH'};
 assert.equal(parseGeneratedDiagnosis(lookup)?.confidence,'MEDIUM');
 assert.equal(parseGeneratedDiagnosis({...initialDiagnosis,confidence:'HIGH'})?.confidence,'LOW');
 assert.throws(()=>parseGeneratedDiagnosis({...initialDiagnosis,confidence:'HIGH',main_bottleneck:'Marketing'}));
 assert.throws(()=>validateEvidence(parseGeneratedDiagnosis(lookup),[{role:'user',content:'Não informei preço'}],'[]'));
 assert.throws(()=>parseGeneratedDiagnosis({...lookup,confidence:'CERTAIN'}));
});
