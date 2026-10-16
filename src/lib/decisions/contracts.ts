import { date } from "../strategies/contracts";
import type { Diagnosis } from "../diagnosis/contracts";
export type DecisionDraft = { decision: string; context: string; reason: string; hypothesis: string; baseline: string; decision_date: string; review_date: string | null };
export type Decision = DecisionDraft & { id: string; company_id: string; created_by: string | null; result: string; learning: string; reviewed_at: string | null; reviewed_by: string | null; version: number; created_at: string; updated_at: string };
export function draftDecision(diagnosis?: Diagnosis): DecisionDraft {
  return { decision: "", context: diagnosis?.situation ?? "", reason: "", hypothesis: diagnosis?.hypotheses.join("\n") ?? "", baseline: "", decision_date: "", review_date: null };
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid decision");
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number, required = false): string {
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) throw new Error("Invalid field");
  return value.trim();
}
export function parseDecision(value: unknown): DecisionDraft {
  const data = record(value), decisionDate = date(data.decision_date), reviewDate = date(data.review_date);
  if (!decisionDate || (reviewDate && reviewDate < decisionDate)) throw new Error("Invalid review date");
  return { decision: text(data.decision, 1000, true), context: text(data.context, 3000, true), reason: text(data.reason, 3000, true),
    hypothesis: text(data.hypothesis, 2000), baseline: text(data.baseline, 2000), decision_date: decisionDate, review_date: reviewDate };
}
export function parseReview(value: unknown): { result: string; learning: string } {
  const data = record(value);
  return { result: text(data.result, 4000, true), learning: text(data.learning, 4000, true) };
}
