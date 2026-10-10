import test from "node:test";
import assert from "node:assert/strict";
import { parseStructuredAnswer, makeProposals, factValueError, type CompanyFact } from "../src/lib/memory/contracts";
import { memoryContext } from "../src/lib/memory/context";
const fact: CompanyFact = { id: "fact-1", company_id: "company-a", key: "city", value: "Leiria", version: 1, confirmed_by: "alice", created_at: "2026-09-24T10:00:00Z", updated_at: "2026-09-24T10:00:00Z" };
test("valida saída estruturada e rejeita JSON inválido, campos desconhecidos e números ambíguos", () => {
  assert.throws(() => parseStructuredAnswer("Texto livre"));
  assert.throws(() => parseStructuredAnswer(JSON.stringify({ intent: "GENERAL", answer: "", facts_detected: [] })));
  for (const data of [
    { key: "password", value: "secret" }, { key: "monthly_revenue", value: "38 mil" },
    { key: "currency", value: "euros" }, { key: "team_size", value: "1.5" },
  ]) assert.throws(() => parseStructuredAnswer(JSON.stringify({ intent: "GENERAL", answer: "Olá", facts_detected: [{ ...data, evidence: "texto", certainty: "EXPLICIT" }] })));
  assert.equal(factValueError("monthly_revenue", "38000.50"), null);
  assert.equal(factValueError("monthly_revenue", "-100"), "Informe o valor sem símbolo ou separador de milhar. Use ponto nos centavos, por exemplo: 38000.50.");
});
test("somente declaração explícita com evidência literal vira proposta, nunca gravação", () => {
  const parsed = parseStructuredAnswer(JSON.stringify({ intent: "GENERAL", answer: "Vamos entender", facts_detected: [
    { key: "city", value: "Porto", evidence: "Porto", certainty: "EXPLICIT" },
    { key: "segment", value: "Pizzaria", evidence: "talvez", certainty: "AMBIGUOUS" },
    { key: "currency", value: "EUR", evidence: "euro", certainty: "EXPLICIT" },
  ] }));
  const proposals = makeProposals(parsed.facts_detected, "Agora estou no Porto, talvez.", [fact]);
  assert.deepEqual(proposals, [{ key: "city", value: "Porto", evidence: "Porto", expectedVersion: 1, previousValue: "Leiria" }]);
  assert.equal(fact.value, "Leiria");
});
test("não repete dado confirmado, não aceita evidência de turno anterior e elimina duplicatas", () => {
  const candidate = { key: "city" as const, value: "Leiria", evidence: "Leiria", certainty: "EXPLICIT" as const };
  assert.deepEqual(makeProposals([candidate], "Leiria", [fact]), []);
  assert.deepEqual(makeProposals([candidate], "Quero vender mais", []), []);
  assert.equal(makeProposals([candidate, candidate], "Leiria", []).length, 1);
});
test("contexto de nova conversa inclui só fatos confirmados da empresa solicitada", () => {
  const context = JSON.parse(memoryContext("company-a", [fact, { ...fact, id: "other", company_id: "company-b", value: "Segredo B" }]));
  assert.deepEqual(context, [{ key: "city", value: "Leiria", confirmed_at: fact.updated_at }]);
  assert.equal(JSON.stringify(context).includes("Segredo B"), false);
  assert.equal(memoryContext("unknown", [fact]), "[]");
});

