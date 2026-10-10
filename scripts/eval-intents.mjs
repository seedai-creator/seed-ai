import OpenAI from "openai";
import nextEnv from "@next/env";
import { writeFile, mkdir } from "node:fs/promises";
import { buildIntentRequest, parseIntent } from "../.test-build/src/lib/openai/request.js";

import { intentCases } from "../.test-build/tests/fixtures/intent-cases.js";

// Opt-in: calls the real paid API, using only synthetic fixtures. No database access.
nextEnv.loadEnvConfig(process.cwd());
const model = process.env.OPENAI_MODEL?.trim();
if (!model || !process.env.OPENAI_API_KEY?.trim()) {
  console.error("Configure OPENAI_MODEL e OPENAI_API_KEY em .env.local.");
  process.exit(1);
}
const client = new OpenAI({ timeout: 45000, maxRetries: 0 });
const results = [];
let index = 0;
let inputTokens = 0;
let outputTokens = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
  while (index < intentCases.length) {
    const fixture = intentCases[index++];
    let actual = null;
    let error = null;
    try {
      const response = await client.responses.create(buildIntentRequest(model, fixture.messages));
      inputTokens += response.usage?.input_tokens ?? 0;
      outputTokens += response.usage?.output_tokens ?? 0;
      if (response.status !== "completed") throw new Error("Incomplete");
      actual = parseIntent(response.output_text);
    } catch { error = "Falha na chamada ou validação; detalhes e credenciais omitidos."; }
    const passed = actual === fixture.expected;
    results.push({ id: fixture.id, expected: fixture.expected, actual, passed, ...(error ? { error } : {}) });
    console.log(`${passed ? "PASS" : "FAIL"} ${fixture.id}: ${actual ?? "ERROR"} (esperado ${fixture.expected})`);
  }
}));
results.sort((a, b) => a.id.localeCompare(b.id));
const passed = results.filter(r => r.passed).length;
await mkdir("evals", { recursive: true });
await writeFile("evals/intent-results.json", JSON.stringify({ date: new Date().toISOString(), model, passed, total: results.length, inputTokens, outputTokens, results }, null, 2) + "\n");
console.log(`${passed}/${results.length} classificações corretas. Relatório: evals/intent-results.json`);
if (passed !== results.length) process.exitCode = 1;

