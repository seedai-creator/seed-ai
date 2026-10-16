// Reusable, bounded contract. This is business justification, never private reasoning.
export const KNOWLEDGE_TYPES = ["FACT", "METRIC", "DERIVED_METRIC", "OBSERVATION", "HYPOTHESIS", "INFERENCE", "ASSUMPTION", "DIAGNOSIS", "RECOMMENDATION", "DECISION", "ACTION", "RESULT", "LEARNING"] as const;
export type KnowledgeType = typeof KNOWLEDGE_TYPES[number];
export type Evidence = { id: string; key: string; kind: KnowledgeType; text: string; source: "USER_MESSAGE" | "MEMORY"; reference: string; quote: string; scope: string | null; period: string | null; numeric_value: number | null; unit: string | null };
export type Reliability = {
  evidence: Evidence[];
  missing_information: string[];
  essential_missing: string[];
  conflicts: string[];
  sufficiency: "SUFFICIENT" | "PARTIALLY_SUFFICIENT" | "INSUFFICIENT";
  confidence: "LOW" | "MEDIUM" | "HIGH";
  assumptions: string[];
  recommendation: null | { action: string; rationale_summary: string; evidence_ids: string[]; expected_signal: string; indicator: string; review: string; risks: string[]; change_if: string; mode: "INVESTIGATE" | "TEST" | "COMMIT" };
  alternatives: string[];
  calculations: { id: string; operation: "RATIO_PERCENT" | "DIFFERENCE" | "DISCOUNTED_PRICE"; left: string; right: string }[];
  revision: string | null;
};
const text = { type: "string", minLength: 1, maxLength: 500 };
const nullable = (schema: object) => ({ anyOf: [schema, { type: "null" }] });
const list = (items: object, maxItems = 3) => ({ type: "array", items, maxItems });
const object = (properties: Record<string, object>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
export const RELIABILITY_SCHEMA = object({
  evidence: list(object({ id: text, key: text, kind: { type: "string", enum: KNOWLEDGE_TYPES }, text,
    source: { type: "string", enum: ["USER_MESSAGE", "MEMORY"] }, reference: text, quote: text,
    scope: nullable(text), period: nullable(text), numeric_value: nullable({ type: "number" }), unit: nullable(text) }), 10),
  missing_information: list(text), essential_missing: list(text), conflicts: list(text),
  sufficiency: { type: "string", enum: ["SUFFICIENT", "PARTIALLY_SUFFICIENT", "INSUFFICIENT"] },
  confidence: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] }, assumptions: list(text),
  recommendation: nullable(object({ action: text, rationale_summary: text, evidence_ids: list(text, 5), expected_signal: text, indicator: text, review: text, risks: list(text), change_if: text, mode: { type: "string", enum: ["INVESTIGATE", "TEST", "COMMIT"] } })),
  alternatives: list(text), calculations: list(object({ id: text, operation: { type: "string", enum: ["RATIO_PERCENT", "DIFFERENCE", "DISCOUNTED_PRICE"] }, left: text, right: text })), revision: nullable(text),
});
type Schema = { anyOf?: Schema[]; type?: string; enum?: readonly unknown[]; properties?: Record<string, Schema>; required?: string[]; items?: Schema; maxItems?: number; minLength?: number; maxLength?: number; minimum?:number; maximum?:number; pattern?:string };
// Same JSON schema validates provider outputs and persisted reliability summaries.
export function validateSchema(value: unknown, schema: Schema): boolean {
  if (schema.anyOf) return schema.anyOf.some(s => validateSchema(value, s));
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (schema.type === "null") return value === null;
  if (schema.type === "string") return typeof value === "string" && value.trim().length >= (schema.minLength ?? 0) && value.length <= (schema.maxLength ?? Infinity) && (!schema.pattern || new RegExp(schema.pattern).test(value));
  if (schema.type === "boolean") return typeof value === 'boolean';
  if (schema.type === "number" || schema.type === 'integer') return typeof value === "number" && Number.isFinite(value) && (schema.type!=='integer'||Number.isSafeInteger(value)) && value >= (schema.minimum??-Infinity) && value <= (schema.maximum??Infinity);
  if (schema.type === "array") return Array.isArray(value) && value.length <= (schema.maxItems ?? Infinity) && value.every(v => validateSchema(v, schema.items!));
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const data = value as Record<string, unknown>, props = schema.properties!;
    return Object.keys(data).length === Object.keys(props).length && Object.entries(props).every(([k, s]) => Object.hasOwn(data, k) && validateSchema(data[k], s));
  }
  return false;
}
export function parseReliability(value: unknown): Reliability {
  if (!validateSchema(value, RELIABILITY_SCHEMA)) throw new Error("RELIABILITY_SCHEMA_INVALID");
  return value as Reliability;
}
