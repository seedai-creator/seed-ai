import type { MarketCode, PlanCode, UsageState } from "./contracts";
export type ModelOption = { model: string; capabilities: string[]; max_output_tokens: number };
export type RoutingInput = { materiality?: "LOW" | "HIGH"; feature: "classification" | "extraction" | "summary" | "followup" | "diagnosis" | "strategy" | "decision" | "expansion"; complexity: "LOW" | "HIGH"; plan: PlanCode; market: MarketCode; usage_state: UsageState; required_capabilities: string[]; risk_level: "LOW" | "HIGH" };
export function routeAiModel(input: RoutingInput, models: { economy: ModelOption; strategic: ModelOption }, marketEnabled: boolean) {
  if (!marketEnabled || input.usage_state === "HARD_LIMIT") throw new Error("AI_ACCESS_BLOCKED");
  const strategic = input.materiality === "HIGH" || input.risk_level === "HIGH" || input.complexity === "HIGH" || ["diagnosis", "strategy", "decision", "expansion"].includes(input.feature);
  const tier = strategic ? "strategic" : "economy", selected = models[tier];
  if (!selected.model.trim() || !Number.isSafeInteger(selected.max_output_tokens) || selected.max_output_tokens < 1 || !input.required_capabilities.every(c => selected.capabilities.includes(c))) throw new Error("MODEL_CAPABILITY_UNAVAILABLE");
  return { ...selected, tier, reason: strategic ? "STRATEGIC_QUALITY_REQUIRED" : "ROUTINE_TASK", market: input.market, plan: input.plan, usage_state: input.usage_state };
}
