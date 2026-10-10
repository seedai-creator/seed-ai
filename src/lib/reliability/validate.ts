import type { ChatMessage } from "../chat/contracts";
import type { MemoryCandidate } from "../memory/automatic";
import type { Reliability, Evidence } from "./contracts";
import type { StrategicRoute } from "./routing";

type MemorySource = { key: string; value: string; kind?: string; observed_at?: string; manual?: boolean; state?:string; approximate?:boolean };
export function memorySources(memory: string): MemorySource[] {
  const values: unknown = JSON.parse(memory);
  if (!Array.isArray(values)) throw Error("INVALID_CONTEXT");
  return values;
}
const factual = new Set(["FACT", "METRIC", "RESULT", "DECISION", "DERIVED_METRIC"]);
export function validateProvenance(r: Reliability, messages: ChatMessage[], memory: string) {
  const rows = memorySources(memory), ids = new Set<string>();
  for (const e of r.evidence) {
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(e.id) || ids.has(e.id)) throw Error("DUPLICATE_EVIDENCE");
    ids.add(e.id);
    let source: string | undefined;
    if (e.source === "USER_MESSAGE") {
      const index = Number(e.reference);
      if (!Number.isInteger(index) || String(index) !== e.reference || messages[index]?.role !== "user") throw Error("INVALID_SOURCE");
      source = messages[index].content;
    } else {
      const row = rows.find(x => x.key === e.reference);
      source = row?.value;
      if(row?.state&&row.state!=='CONFIRMED'&&factual.has(e.kind))e.kind='OBSERVATION';
      if (row?.kind && !["FACT", "METRIC", "RESULT", "DECISION", "DERIVED_METRIC"].includes(row.kind) && factual.has(e.kind)) throw Error("MEMORY_SEMANTICS_CHANGED");
      if(row?.kind==='DERIVED_METRIC'&&e.kind!=='DERIVED_METRIC')throw Error('MEMORY_SEMANTICS_CHANGED');
      if(row?.key.startsWith('business_')&&row.approximate){const value=JSON.parse(row.value);if(value.min!==null&&value.min!==undefined)e.numeric_value=null;}
    }
    if (!source?.includes(e.quote)) throw Error("UNGROUNDED_EVIDENCE");
    if (e.kind === "DERIVED_METRIC") {
      const row=rows.find(x=>x.key===e.reference);
      if(e.source!=='MEMORY'||row?.kind!=='DERIVED_METRIC'||JSON.parse(row.value).value!==e.numeric_value)throw Error("MODEL_CALCULATION_FORBIDDEN");
    }
    // Numerical evidence is literal; ambiguous decimal/grouping conventions are rejected.
    if (e.numeric_value !== null && !/\d/.test(e.quote)) e.numeric_value = null;
    if (e.numeric_value !== null && !literalNumber(e.quote, e.numeric_value)) throw Error("UNGROUNDED_NUMBER");
  }
  for (const id of r.recommendation?.evidence_ids ?? []) if (!ids.has(id)) throw Error("UNKNOWN_EVIDENCE_REFERENCE");
}
export function literalNumber(quote: string, value: number): boolean {
  const tokens = quote.match(/-?\d+(?:[.,]\d+)*/g) ?? [];
  return tokens.some(token => {
    if (/^[+-]?\d+$/.test(token)) return Number(token) === value;
    // A single 3-digit group is ambiguous (1.000); ask or supply unambiguous source.
    if (/^\d{1,3}[.,]\d{3}$/.test(token)) return false;
    if (/^-?\d+[.,]\d{1,2}$/.test(token)) return Number(token.replace(",", ".")) === value;
    return false;
  });
}
const requirements: Record<StrategicRoute["profile"], string[][]> = {
  GENERAL: [], DISCOUNT: [["price"], ["cost", "margin"], ["sales"], ["goal"], ["discount"]],
  HIRING: [["leads", "demand"], ["capacity"], ["cost"], ["cash"], ["goal"]],
  ADS: [["leads"], ["sales"], ["capacity"], ["margin", "cost"], ["goal"]],
  EXPANSION: [["demand"], ["capital"], ["cash"], ["margin"], ["operations"], ["owner_dependence"], ["goal"]],
  FINANCIAL: [["cash"], ["cost"], ["goal"]],
};
export function assessSufficiency(r: Reliability, route: StrategicRoute, memory: string, now = Date.now()) {
  const rows = memorySources(memory);
  // Different periods may describe a change, not a contradiction.
  const conflicts = r.evidence.filter((e, i) => r.evidence.slice(i + 1).some(other =>
    factual.has(e.kind) && factual.has(other.kind) && other.key === e.key && other.scope === e.scope && other.period === e.period &&
    e.numeric_value !== null && other.numeric_value !== null && e.numeric_value !== other.numeric_value));
  const usable = r.evidence.filter(e => {
    if (!factual.has(e.kind) && !(e.key === "goal" && e.kind === "OBSERVATION") && !(e.key === "discount" && e.kind === "ASSUMPTION")) return false;
    if (["METRIC","DERIVED_METRIC"].includes(e.kind) && (!e.period || !e.scope || e.numeric_value === null)) return false;
    const row = e.source === "MEMORY" ? rows.find(x => x.key === e.reference) : null;
    if(row?.state&&row.state!=='CONFIRMED')return false;
    return !row || e.kind !== "METRIC" || (!!row.observed_at && Number.isFinite(Date.parse(row.observed_at)) && now - Date.parse(row.observed_at) <= 180 * 86400000);
  });
  const missing = requirements[route.profile].filter(group => !group.some(key => usable.some(e => e.key === key && (!['price','cost','margin','cash','capital'].includes(key)||e.numeric_value!==null)))).map(group => group.join("/"));
  const state: Reliability["sufficiency"] = r.essential_missing.length || r.conflicts.length || conflicts.length || missing.length ? "INSUFFICIENT" : !usable.length || r.missing_information.length || r.assumptions.length ? "PARTIALLY_SUFFICIENT" : "SUFFICIENT";
  const distinct = new Set(usable.map(e => e.source + ":" + e.reference + ":" + e.quote));
  const confidence: Reliability["confidence"] = state === "INSUFFICIENT" || !usable.length ? "LOW" : state !== "SUFFICIENT" || distinct.size < 2 ? "MEDIUM" : r.confidence;
  return { state, confidence, missing, usable };
}
export function calculateDerived(r: Reliability, memory = '[]') {
  const sources=memorySources(memory);
  const seen = new Set<string>();
  return r.calculations.map(c => {
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(c.id) || seen.has(c.id)) throw Error("INVALID_CALCULATION_ID");
    seen.add(c.id);
    const a = r.evidence.find(e => e.id === c.left), b = r.evidence.find(e => e.id === c.right);
    if (!a || !b || a.kind !== "METRIC" || (b.kind !== "METRIC" && !(c.operation === "DISCOUNTED_PRICE" && b.kind === "ASSUMPTION")) || [a, b].some(e => e.numeric_value === null || !e.unit || !e.period || !e.scope)) throw Error("UNKNOWN_OPERAND");
    if (a.scope !== b.scope || a.period !== b.period) throw Error("INCOMPARABLE_OPERANDS");
    if (c.operation !== "DISCOUNTED_PRICE" && a.unit !== b.unit) throw Error("INCOMPATIBLE_UNITS");
    if (c.operation === "DISCOUNTED_PRICE" && (b.unit !== "PERCENT" || b.numeric_value! < 0 || b.numeric_value! > 100)) throw Error("INVALID_DISCOUNT");
    if (c.operation === "RATIO_PERCENT" && b.numeric_value === 0) throw Error("ZERO_DENOMINATOR");
    const value = c.operation === "RATIO_PERCENT" ? a.numeric_value! / b.numeric_value! * 100 : c.operation === "DIFFERENCE" ? a.numeric_value! - b.numeric_value! : a.numeric_value! * (1 - b.numeric_value! / 100);
    if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) throw Error("CALCULATION_OVERFLOW");
    return { ...c, kind: "DERIVED_METRIC" as const, approximate:[a,b].some(e=>e.source==='MEMORY'&&sources.some(s=>s.key===e.reference&&s.approximate)), scenario: b.kind === "ASSUMPTION", inputs: [a.numeric_value, b.numeric_value], value: Number(value.toPrecision(14)), scope: a.scope, period: a.period, unit: c.operation === "RATIO_PERCENT" ? "PERCENT" : a.unit };
  });
}
export function renderCalculations(answer: string, calculations: ReturnType<typeof calculateDerived>, locale: string) {
  return answer.replace(/\{\{calc:([a-z0-9_]+)\}\}/g, (_, id: string) => {
    const c = calculations.find(x => x.id === id);
    if (!c) throw Error("UNKNOWN_CALCULATION_REFERENCE");
    return (c.approximate?'≈ ':'') + new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(c.value) + (c.unit === "PERCENT" ? "%" : "");
  });
}
// Memory must agree with independently typed evidence, not merely a literal quote.
export function safeMemoryCandidates(candidates: MemoryCandidate[], evidence: Evidence[], lastIndex: number) {
  return candidates.filter(c => {
    const matching = evidence.filter(e => e.source === "USER_MESSAGE" && e.reference === String(lastIndex) && e.quote === c.evidence);
    if (!matching.length) return false;
    const allowed: Record<string, string[]> = { FACT: ["FACT"], METRIC: ["METRIC"], HYPOTHESIS: ["HYPOTHESIS"], RESULT: ["RESULT"], DECISION: ["DECISION"], LEARNING: ["LEARNING"], GOAL: ["OBSERVATION"], BUSINESS_PREFERENCE: ["OBSERVATION"], CONSTRAINT: ["FACT", "OBSERVATION"] };
    return matching.every(e => allowed[c.kind]?.includes(e.kind));
  });
}

