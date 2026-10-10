import type { Diagnosis } from "../diagnosis/contracts";
export const STRATEGY_STATUSES = ["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"] as const;
export const ACTION_STATUSES = ["TODO", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export type StrategyStatus = typeof STRATEGY_STATUSES[number];
export type ActionStatus = typeof ACTION_STATUSES[number];
export type ActionDraft = { title: string; description: string; reason: string; responsible: string; deadline: string | null; metric: string; target: string };
export type StrategyDraft = { name: string; objective: string; situation: string; bottleneck: string; hypothesis: string; strategy: string; review_date: string | null; actions: ActionDraft[] };
export type Strategy = Omit<StrategyDraft, "actions"> & { id: string; company_id: string; created_by: string | null; status: StrategyStatus; version: number; created_at: string; updated_at: string };
export type StrategyAction = ActionDraft & { id: string; company_id: string; strategy_id: string; position: number; status: ActionStatus; version: number; created_at: string; updated_at: string };
export function draftFromDiagnosis(diagnosis: Diagnosis): StrategyDraft {
  const recommendation = diagnosis.reliability?.recommendation;
  return { name: (diagnosis.objective ?? "").slice(0, 120), objective: diagnosis.objective ?? "",
    situation: diagnosis.situation, bottleneck: diagnosis.main_bottleneck ?? "", hypothesis: diagnosis.hypotheses.join("\n"),
    strategy: recommendation?.action ?? diagnosis.priorities.join("\n"), review_date: null,
    actions: (diagnosis.priorities.length ? diagnosis.priorities : [""]).map(priority => ({ title: priority.slice(0, 160),
      description: priority, reason: diagnosis.main_bottleneck ?? diagnosis.situation, responsible: "", deadline: null, metric: recommendation?.indicator ?? "", target: "" })),
  };
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid draft");
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number, required = false): string {
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) throw new Error("Invalid field");
  return value.trim();
}
export function date(value: unknown): string | null {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01" || value > "9999-12-31" ||
    !Number.isFinite(Date.parse(value + "T00:00:00Z")) || new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value) throw new Error("Invalid date");
  return value;
}
export function parseStrategy(value: unknown): StrategyDraft {
  const data = object(value);
  if (!Array.isArray(data.actions) || data.actions.length < 1 || data.actions.length > 10) throw new Error("Invalid actions");
  return {
    name: text(data.name, 120, true), objective: text(data.objective, 2000, true), situation: text(data.situation, 2000, true),
    bottleneck: text(data.bottleneck, 2000), hypothesis: text(data.hypothesis, 2000), strategy: text(data.strategy, 4000, true),
    review_date: date(data.review_date), actions: data.actions.map(value => {
      const item = object(value);
      return { title: text(item.title, 160, true), description: text(item.description, 2000, true), reason: text(item.reason, 2000, true),
        responsible: text(item.responsible, 120), deadline: date(item.deadline), metric: text(item.metric, 500), target: text(item.target, 500) };
    }),
  };
}
