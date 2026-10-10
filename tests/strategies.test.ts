import test from "node:test";
import assert from "node:assert/strict";
import { draftFromDiagnosis, parseStrategy } from "../src/lib/strategies/contracts";
const diagnosis = { situation: "Sem dados comerciais", objective: "Vender mais", main_bottleneck: null,
  secondary_bottlenecks: [], evidence: [], hypotheses: [], missing_data: ["Conversão"], opportunities: [], risks: [],
  priorities: ["Medir oportunidades"], confidence: "LOW" as const };
test("conversão cria rascunho editável sem inventar responsáveis, datas ou métricas", () => {
  const draft = draftFromDiagnosis(diagnosis);
  assert.equal(draft.bottleneck, ""); assert.equal(draft.review_date, null);
  assert.equal(draft.actions[0].title, "Medir oportunidades");
  for (const key of ["responsible", "metric", "target"] as const) assert.equal(draft.actions[0][key], "");
  assert.deepEqual(parseStrategy(draft), draft);
});
test("validação rejeita dados excessivos, datas inexistentes e planos sem ação", () => {
  const draft = draftFromDiagnosis(diagnosis);
  for (const invalid of [{ ...draft, name: " " }, { ...draft, actions: [] }, { ...draft, actions: Array(11).fill(draft.actions[0]) },
    { ...draft, review_date: "2026-02-30" }, { ...draft, objective: "a".repeat(2001) },
    { ...draft, actions: [{ ...draft.actions[0], deadline: "tomorrow" }] }, { ...draft, actions: [{ ...draft.actions[0], reason: "" }] }]) assert.throws(() => parseStrategy(invalid));
  assert.equal(parseStrategy({ ...draft, review_date: "2028-02-29" }).review_date, "2028-02-29");
  assert.equal("company_id" in parseStrategy({ ...draft, company_id: "forged" }), false);
});
