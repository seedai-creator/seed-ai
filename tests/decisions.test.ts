import test from "node:test";
import assert from "node:assert/strict";
import { draftDecision, parseDecision, parseReview } from "../src/lib/decisions/contracts";
test("rascunho não transforma recomendação em decisão tomada nem inventa baseline", () => {
  const draft = draftDecision({ situation: "Sem dados", objective: "Crescer", main_bottleneck: null, secondary_bottlenecks: [], evidence: [], hypotheses: ["Testar acompanhamento"], missing_data: [], opportunities: [], risks: [], priorities: ["Investigar"], confidence: "LOW" });
  assert.equal(draft.decision, ""); assert.equal(draft.reason, ""); assert.equal(draft.baseline, ""); assert.equal(draft.decision_date, "");
  assert.equal(draft.context, "Sem dados"); assert.equal(draft.hypothesis, "Testar acompanhamento");
});
test("valida datas e campos da decisão e exige resultado e aprendizado na revisão", () => {
  const draft = { ...draftDecision(), decision: "Testar atendimento", context: "Há atrasos", reason: "Medir efeito", decision_date: "2026-09-27", review_date: "2026-10-04" };
  assert.deepEqual(parseDecision(draft), draft);
  for (const invalid of [{...draft,review_date:"2026-09-26"},{...draft,decision_date:"2026-02-30"},{...draft,decision:" "},{...draft,baseline:"x".repeat(2001)},{...draft,reason:42}]) assert.throws(()=>parseDecision(invalid));
  assert.deepEqual(parseReview({result:" Sem conclusão ",learning:" Medir por mais tempo "}),{result:"Sem conclusão",learning:"Medir por mais tempo"});
  assert.throws(()=>parseReview({result:"",learning:"Nada"}));
  assert.throws(()=>parseReview({result:"Observado",learning:"x".repeat(4001)}));
});
