import OpenAI from "openai";
import nextEnv from "@next/env";
import { writeFile, mkdir } from "node:fs/promises";
import { runSeedAnalysis } from "../.test-build/src/lib/openai/pipeline.js";
import { buildMarketContext } from "../.test-build/src/lib/i18n/market.js";
nextEnv.loadEnvConfig(process.cwd());
const model = process.env.OPENAI_MODEL?.trim();
if (!model || !process.env.OPENAI_API_KEY) { console.error("Configure modelo e chave no servidor."); process.exit(1); }
const client = new OpenAI({ timeout: 45000, maxRetries: 0 });
const results = [];
for (const locale of ["pt-BR", "pt-PT", "en-US", "es-ES"]) {
  // Synthetic American business, independent of interface language. No database writes.
  const facts = [{ key: "country", value: "US" }, { key: "currency", value: "USD" }, { key: "segment", value: "Bakery" }];
  const market = buildMarketContext(locale, { locale: "en-US", preferred_language: "en-US", timezone: "America/New_York" }, facts);
  try {
    const answer = await runSeedAnalysis((request, signal) => client.responses.create(request, { signal }),
      model, [{ role: "user", content: "Quero entender como vender mais. O que devemos investigar primeiro?" }],
      JSON.stringify(facts), AbortSignal.timeout(45000), market);
    results.push({ locale, market, answer: answer.answer, intent: answer.intent });
    console.log(locale + ": OK");
  } catch { results.push({ locale, error: "Falha de chamada ou validação." }); console.log(locale + ": ERROR"); }
}
await mkdir("evals", { recursive: true });
await writeFile("evals/i18n-results.json", JSON.stringify({ date: new Date().toISOString(), model, review: "Verificar idioma e separação do mercado americano; amostra sintética.", results }, null, 2) + "\n");
if (results.some(r => r.error)) process.exitCode = 1;
