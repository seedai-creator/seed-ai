import { emptyReliability, routeFixture } from "./reliability-fixtures";
import test from "node:test";
import assert from "node:assert/strict";
import { retrieveBrain } from "../src/lib/brain/retrieve";
import { INTENTS, type Intent } from "../src/lib/intent/router";
import { runSeedAnalysis, type Complete } from "../src/lib/openai/pipeline";
import { buildIntentRequest } from "../src/lib/openai/request";
const messages = [{ role: "user" as const, content: "Quero definir meu preço" }];
const signal = () => new AbortController().signal;
const done = (data: unknown) => ({ status: "completed", output_text: JSON.stringify(data) });

test("retrieval limita conteúdo, mantém núcleo e seleciona somente temas pertinentes", () => {
  for (const intent of INTENTS) {
    const brain = retrieveBrain(intent);
    assert.ok(brain.moduleIds.includes("identity") && brain.moduleIds.includes("method-seed") && brain.moduleIds.includes("limits"));
    assert.ok(brain.text.length <= 10000);
    assert.ok(brain.moduleIds.length <= 5);
    assert.equal(new Set(brain.moduleIds).size, brain.moduleIds.length);
  }
  assert.deepEqual(retrieveBrain("PRICING").moduleIds, ["identity", "method-seed", "limits", "pricing"]);
  assert.equal(retrieveBrain("PRICING").text.includes("[expansion]"), false);
  assert.throws(() => retrieveBrain("../private" as Intent));
  assert.throws(() => retrieveBrain("toString" as Intent));
  const result = retrieveBrain("SALES");
  result.moduleIds.push("expansion");
  assert.equal(retrieveBrain("SALES").moduleIds.includes("expansion"), false);
});
test("pipeline classifica antes de recuperar e responder; memória só vai para a segunda chamada", async () => {
  const calls: Parameters<Complete>[0][] = [];
  const memory = '[{"key":"city","value":"Leiria"}]';
  const result = await runSeedAnalysis(async (request, passedSignal) => {
    assert.ok(passedSignal instanceof AbortSignal);
    calls.push(request);
    return calls.length === 1 ? done(routeFixture("PRICING")) : done({ intent: "PRICING", answer: "Vamos avaliar custos.", facts_detected: [], reliability: emptyReliability(), diagnosis: {
      situation: "Preço a definir", objective: null, main_bottleneck: null, secondary_bottlenecks: [], evidence: [],
      hypotheses: [], missing_data: ["Custos"], opportunities: [], risks: [], priorities: ["Levantar custos"], confidence: "LOW",
    } });
  }, "configured-model", messages, memory, signal());
  assert.equal(calls.length, 2);
  assert.equal(JSON.stringify(calls[0]).includes("Leiria"), false);
  assert.equal(JSON.stringify(calls[1]).includes("Leiria"), true);
  assert.ok(calls[1].instructions?.includes("[pricing]"));
  assert.equal(calls[1].instructions?.includes("[marketing]"), false);
  assert.equal(result.intent, "PRICING");
  assert.deepEqual(buildIntentRequest("model", messages).input, messages);
});
test("classificação inválida ou incompleta impede segunda chamada", async () => {
  for (const response of [done({ intent: "UNKNOWN" }), done({ intent: "SALES", extra: 1 }), { status: "incomplete", output_text: "" }]) {
    let count = 0;
    await assert.rejects(runSeedAnalysis(async () => { count++; return response; }, "model", messages, "[]", signal()));
    assert.equal(count, 1);
  }
});
test("cancelamento entre etapas impede cobrança de segunda chamada", async () => {
  const controller = new AbortController();
  let count = 0;
  await assert.rejects(runSeedAnalysis(async () => { count++; controller.abort(); return done(routeFixture("SALES")); }, "model", messages, "[]", controller.signal));
  assert.equal(count, 1);
});
test("rejeita resposta final com intenção divergente ou saída incompleta", async () => {
  for (const final of [done({ intent: "EXPANSION", answer: "texto", facts_detected: [] }), { status: "incomplete", output_text: "" }]) {
    let count = 0;
    await assert.rejects(runSeedAnalysis(async () => ++count === 1 ? done(routeFixture("SALES")) : final, "model", messages, "[]", signal()));
  }
});
