import type { Reliability, Evidence } from "../src/lib/reliability/contracts";
export const emptyReliability = (): Reliability => ({ evidence: [], missing_information: [], essential_missing: ["Dados do problema"], conflicts: [], sufficiency: "INSUFFICIENT", confidence: "LOW", assumptions: [], recommendation: null, alternatives: [], calculations: [], revision: null });
export const metric = (id: string, n: number, overrides: Partial<Evidence> = {}): Evidence => ({id, key:id, kind:"METRIC", text:String(n), source:"USER_MESSAGE", reference:"0", quote:String(n), scope:"company", period:"2026-09", numeric_value:n, unit:"COUNT", ...overrides});
export const routeFixture = (intent = "SALES") => ({ intent, materiality: "LOW", task: "STRATEGIC", profile: "GENERAL" });
