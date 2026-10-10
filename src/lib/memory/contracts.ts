import { parseMemoryCandidates, type MemoryCandidate } from "./automatic";
import { formatCurrency, formatNumber } from "../i18n/format";
import { DEFAULT_LOCALE, type Locale } from "../i18n/config";
import { INTENTS, isIntent, type Intent } from "../intent/router";
export const FACT_KEYS = ["company_name", "segment", "city", "country", "business_model", "products_services", "target_audience", "monthly_revenue", "currency", "average_ticket", "team_size", "business_objective"] as const;
export type FactKey = typeof FACT_KEYS[number];
export type CompanyFact = { id: string; company_id: string; key: FactKey; value: string; version: number; confirmed_by: string | null; created_at: string; updated_at: string };
export type FactCandidate = { key: FactKey; value: string; evidence: string; certainty: "EXPLICIT" | "AMBIGUOUS" };
export type FactProposal = { key: FactKey; value: string; evidence: string; expectedVersion: number | null; previousValue: string | null };
export type StructuredAnswer = { intent: Intent; answer: string; facts_detected: FactCandidate[]; memory_detected?: MemoryCandidate[] };
export function isFactKey(key: unknown): key is FactKey { return typeof key === "string" && (FACT_KEYS as readonly string[]).includes(key); }
export function factValueError(key: FactKey, value: string): string | null {
  if (!value.trim() || value.length > 500) return "Use entre 1 e 500 caracteres.";
  if (["monthly_revenue", "average_ticket"].includes(key) && !/^(0|[1-9][0-9]{0,11})(\.[0-9]{1,2})?$/.test(value))
    return "Informe o valor sem símbolo ou separador de milhar. Use ponto nos centavos, por exemplo: 38000.50.";
  if (key === "team_size" && !/^(0|[1-9][0-9]{0,6})$/.test(value)) return "Informe um número inteiro de pessoas.";
  if (key === "country" && !/^[A-Z]{2}$/.test(value)) return "Use o código do país, como BR, PT, US ou ES.";
  if (key === "currency" && !/^[A-Z]{3}$/.test(value)) return "Use o código da moeda, como BRL, EUR ou USD.";
  return null;
}
export function formatFactValue(key: FactKey, value: string, locale: Locale = DEFAULT_LOCALE, currency?: string) {
  if (["monthly_revenue", "average_ticket"].includes(key) && currency && /^[A-Z]{3}$/.test(currency) && !factValueError(key, value)) return formatCurrency(Number(value), currency, locale);
  if (["monthly_revenue", "average_ticket", "team_size"].includes(key) && !factValueError(key, value))
    return formatNumber(Number(value), locale);
  return value;
}
export const MEMORY_RESPONSE_SCHEMA = {
  type: "object", additionalProperties: false, required: ["intent", "answer", "facts_detected"],
  properties: {
    intent: { type: "string", enum: [...INTENTS] },
    answer: { type: "string" },
    facts_detected: {
      type: "array", maxItems: 12,
      items: { type: "object", additionalProperties: false, required: ["key", "value", "evidence", "certainty"],
        properties: { key: { type: "string", enum: [...FACT_KEYS] }, value: { type: "string" }, evidence: { type: "string" }, certainty: { type: "string", enum: ["EXPLICIT", "AMBIGUOUS"] } },
      },
    },
  },
} as const;
export function parseStructuredAnswer(raw: string): StructuredAnswer {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || !("intent" in parsed) || !isIntent(parsed.intent) || !("answer" in parsed) || typeof parsed.answer !== "string" ||
    !parsed.answer.trim() || parsed.answer.length > 12000 || !("facts_detected" in parsed) ||
    !Array.isArray(parsed.facts_detected) || parsed.facts_detected.length > 12) throw new Error("Invalid structured response");
  const facts = parsed.facts_detected.map((fact: unknown): FactCandidate => {
    if (!fact || typeof fact !== "object" || !("key" in fact) || !isFactKey(fact.key) ||
      !("value" in fact) || typeof fact.value !== "string" ||
      !("evidence" in fact) || typeof fact.evidence !== "string" || !fact.evidence.trim() || fact.evidence.length > 500 ||
      !("certainty" in fact) || !["EXPLICIT", "AMBIGUOUS"].includes(String(fact.certainty)) ||
      factValueError(fact.key, fact.value.trim())) throw new Error("Invalid fact");
    return { key: fact.key, value: fact.value.trim(), evidence: fact.evidence, certainty: fact.certainty as FactCandidate["certainty"] };
  });
  return { intent: parsed.intent, answer: parsed.answer.trim(), facts_detected: facts, memory_detected: parseMemoryCandidates("memory_detected" in parsed ? parsed.memory_detected : undefined) };
}
export function makeProposals(candidates: FactCandidate[], lastUserMessage: string, confirmed: CompanyFact[]): FactProposal[] {
  const proposals: FactProposal[] = [];
  for (const candidate of candidates) {
    if (candidate.certainty !== "EXPLICIT" || !lastUserMessage.includes(candidate.evidence) ||
      proposals.some(p => p.key === candidate.key)) continue;
    const current = confirmed.find(f => f.key === candidate.key);
    if (current?.value === candidate.value) continue;
    proposals.push({ key: candidate.key, value: candidate.value, evidence: candidate.evidence, expectedVersion: current?.version ?? null, previousValue: current?.value ?? null });
  }
  return proposals;
}



