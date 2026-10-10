import { isIntent, type Intent } from "../intent/router";
export const PROFILES = ["GENERAL", "DISCOUNT", "HIRING", "ADS", "EXPANSION", "FINANCIAL"] as const;
export type StrategicRoute = { intent: Intent; materiality: "LOW" | "HIGH"; task: "SOCIAL" | "STRATEGIC"; profile: typeof PROFILES[number] };
export function parseStrategicRoute(raw: string): StrategicRoute {
  const v = JSON.parse(raw);
  if (!v || Object.keys(v).length !== 4 || !isIntent(v.intent) || !["LOW", "HIGH"].includes(v.materiality) || !["SOCIAL", "STRATEGIC"].includes(v.task) || !PROFILES.includes(v.profile)) throw Error("INVALID_STRATEGIC_ROUTE");
  if (v.task === "SOCIAL" && (v.intent !== "GENERAL" || v.materiality !== "LOW" || v.profile !== "GENERAL")) throw Error("INVALID_SOCIAL_ROUTE");
  // Expansion and financial commitments never receive the routine route.
  if (["EXPANSION", "FINANCIAL", "HIRING"].includes(v.profile) || v.intent === "EXPANSION") v.materiality = "HIGH";
  return v;
}
