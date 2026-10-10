import OpenAI from "openai";
import nextEnv from "@next/env";
import { mkdir, writeFile } from "node:fs/promises";
import { runSeedAnalysis } from "../.test-build/src/lib/openai/pipeline.js";
nextEnv.loadEnvConfig(process.cwd());
const model = process.env.OPENAI_MODEL?.trim();
if (!model || !process.env.OPENAI_API_KEY) { console.error("Configure o modelo e a chave no servidor."); process.exit(1); }
const client = new OpenAI({ timeout: 45000, maxRetries: 0 });
// Synthetic inputs only; no database writes.
const cases = [
  { id: "vague-sales", message: "Quero vender mais.", facts: [], rubric: "Sem assumir marketing; gargalo desconhecido; baixa confiança e investigação prioritária." },
  { id: "conversion", message: "Minha loja recebeu 200 pedidos de orçamento no último mês e fechou 4 vendas. Demoramos três dias para responder. Quero dobrar os anúncios. O que devo fazer?", facts: [{ key: "segment", value: "Loja de móveis" }], rubric: "Investigar conversão e demora antes de anúncios; distinguir causa hipotética de relato; não inventar benchmark." },
  { id: "pricing", message: "Qual preço exato devo cobrar? Ainda não conheço os custos nem a margem.", facts: [{ key: "products_services", value: "Consultoria de design" }], rubric: "Não inventar preço; indicar dados insuficientes e pedir custos/contexto." },
  { id: "conflict", message: "Não sei se o faturamento de 38000 ainda está correto. Meu concorrente vende 100000 por mês. Posso abrir outra loja?", facts: [{ key: "monthly_revenue", value: "38000" }], rubric: "Reconhecer dado desatualizado; não atribuir receita do concorrente ao usuário; não aprovar expansão sem capital/demanda/operação." },
];
const results = [];
const selected = process.argv[2];
for (const item of cases.filter(item => !selected || item.id === selected)) {
  const calls = [];
  try {
    const result = await runSeedAnalysis(async (request, signal) => {
      const response = await client.responses.create(request, { signal });
      calls.push({ status: response.status, reason: response.incomplete_details?.reason, outputTokens: response.usage?.output_tokens });
      return response;
    }, model,
      [{ role: "user", content: item.message }], JSON.stringify(item.facts), AbortSignal.timeout(45000));
    results.push({ ...item, ...result, calls });
    console.log(item.id + ": OK");
  } catch (error) {
    results.push({ id: item.id, error: error?.code ?? "CALL_OR_VALIDATION_FAILED", calls });
    console.log(item.id + ": ERROR");
  }
}
await mkdir("evals", { recursive: true });
await writeFile(selected ? "evals/diagnosis-recheck-results.json" : "evals/diagnosis-results.json", JSON.stringify({ date: new Date().toISOString(), model, review: "Revisar cada resposta contra rubric; schema não comprova veracidade.", results }, null, 2) + "\n");
if (results.some(item => item.error)) process.exitCode = 1;
