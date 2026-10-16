import { parseReliability, type Reliability } from "../reliability/contracts";
import type { ChatMessage } from "../chat/contracts";

export type Diagnosis = {
  reliability?: Reliability;
  situation: string;
  objective: string | null;
  main_bottleneck: string | null;
  secondary_bottlenecks: string[];
  evidence: { source: "USER_MESSAGE" | "CONFIRMED_MEMORY"; quote: string }[];
  hypotheses: string[];
  missing_data: string[];
  opportunities: string[];
  risks: string[];
  priorities: string[];
  confidence: "LOW" | "MEDIUM" | "HIGH";
};
const text = { type: "string", minLength: 1, maxLength: 700 };
const nullableText = { anyOf: [text, { type: "null" }] };
const list = { type: "array", items: text, maxItems: 3 };
export const DIAGNOSIS_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["situation", "objective", "main_bottleneck", "secondary_bottlenecks", "evidence", "hypotheses", "missing_data", "opportunities", "risks", "priorities", "confidence"],
  properties: {
    situation: text, objective: nullableText, main_bottleneck: nullableText,
    secondary_bottlenecks: list,
    evidence: { type: "array", maxItems: 5, items: {
      type: "object", additionalProperties: false, required: ["source", "quote"],
      properties: { source: { type: "string", enum: ["USER_MESSAGE", "CONFIRMED_MEMORY"] }, quote: text },
    } },
    hypotheses: list, missing_data: list, opportunities: list, risks: list, priorities: list,
    confidence: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
  },
} as const;
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid diagnosis object");
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 700) throw new Error("Invalid diagnosis text");
  return value.trim();
}
function strings(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 3) throw new Error("Invalid diagnosis list");
  return value.map(string);
}
export function parseDiagnosis(value: unknown): Diagnosis | null {
  if (value === null) return null;
  const data = { ...record(value) };
  const reliability = data.reliability === undefined ? undefined : parseReliability(data.reliability);
  delete data.reliability;
  if (Object.keys(data).length !== DIAGNOSIS_SCHEMA.required.length || DIAGNOSIS_SCHEMA.required.some(key => !(key in data))) throw new Error("Invalid diagnosis fields");
  if (!["LOW", "MEDIUM", "HIGH"].includes(String(data.confidence))) throw new Error("Invalid confidence");
  if (!Array.isArray(data.evidence) || data.evidence.length > 5) throw new Error("Invalid evidence");
  const evidence = data.evidence.map(item => {
    const entry = record(item);
    if (Object.keys(entry).length !== 2 || (entry.source !== "USER_MESSAGE" && entry.source !== "CONFIRMED_MEMORY")) throw new Error("Invalid evidence source");
    return { source: entry.source, quote: string(entry.quote) } as Diagnosis["evidence"][number];
  });
  const result: Diagnosis = {
    situation: string(data.situation), objective: data.objective === null ? null : string(data.objective),
    main_bottleneck: data.main_bottleneck === null ? null : string(data.main_bottleneck),
    secondary_bottlenecks: strings(data.secondary_bottlenecks), evidence,
    hypotheses: strings(data.hypotheses), missing_data: strings(data.missing_data),
    opportunities: strings(data.opportunities), risks: strings(data.risks), priorities: strings(data.priorities),
    confidence: data.confidence as Diagnosis["confidence"],
  };
  // Structural guardrails, not a statistical confidence score or proof of causality.
  if (!evidence.length && (result.main_bottleneck || result.secondary_bottlenecks.length || result.confidence !== "LOW")) throw new Error("Unsupported bottleneck");
  if (result.confidence === "HIGH" && (result.missing_data.length || !result.main_bottleneck || evidence.length < 2)) throw new Error("Unsupported confidence");
  return reliability ? { ...result, reliability } : result;
}
// A factual lookup need not invent a bottleneck to satisfy a confidence label.
// Lower only that label; schema, claimed bottlenecks and evidence remain strictly validated.
export function parseGeneratedDiagnosis(value:unknown):Diagnosis|null {
 if(value===null)return null;
 const data={...record(value)};
 if(['LOW','MEDIUM','HIGH'].includes(String(data.confidence))&&Array.isArray(data.evidence)&&Array.isArray(data.missing_data)){
  if(!data.evidence.length&&data.main_bottleneck===null&&Array.isArray(data.secondary_bottlenecks)&&!data.secondary_bottlenecks.length)data.confidence='LOW';
  else if(data.confidence==='HIGH'&&(data.missing_data.length||!data.main_bottleneck||data.evidence.length<2))data.confidence='MEDIUM';
 }
 return parseDiagnosis(data);
}

export function validateEvidence(diagnosis: Diagnosis | null, messages: ChatMessage[], memory: string) {
  if (!diagnosis) return;
  const facts: unknown = JSON.parse(memory);
  const values = Array.isArray(facts) ? facts.flatMap(item => item && item.kind !== "HYPOTHESIS" && typeof item.value === "string" ? [item.value] : []) : [];
  const userTexts = messages.filter(message => message.role === "user").map(message => message.content);
  for (const evidence of diagnosis.evidence) {
    const source = evidence.source === "USER_MESSAGE" ? userTexts : values;
    if (!source.some(value => value.includes(evidence.quote))) throw new Error("Ungrounded diagnosis evidence");
  }
}
