import { date } from "../strategies/contracts";
import type { Diagnosis } from "../diagnosis/contracts";
import type { Locale } from "../i18n/config";
export const EXPERIMENT_STATUSES = ["PLANNED", "RUNNING", "VALIDATED", "INVALIDATED", "INCONCLUSIVE"] as const;
export const OUTCOMES = ["VALIDATED", "INVALIDATED", "INCONCLUSIVE"] as const;
export type Outcome = typeof OUTCOMES[number];
export type ExperimentDraft = { name: string; problem: string; hypothesis: string; action: string; baseline: string; target: string; metric: string; start_date: string; end_date: string };
export type Experiment = ExperimentDraft & { id: string; company_id: string; created_by: string | null; status: typeof EXPERIMENT_STATUSES[number]; execution_status?: 'DRAFT'|'READY'|'RUNNING'|'COMPLETED'|'ANALYZED'|'CANCELLED'; result: string | null; learning: string; started_at: string | null; finished_at: string | null; finished_by: string | null; version: number; created_at: string; updated_at: string };
export const NUMBER_PATTERN = /^-?(0|[1-9][0-9]{0,8})(\.[0-9]{1,6})?$/;
export function experimentNumber(value: unknown): string {
  if (typeof value !== "string" || !NUMBER_PATTERN.test(value.trim())) throw new Error("Invalid experiment number");
  return value.trim();
}
export function formatExperimentNumber(value: string, locale: Locale) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(Number(experimentNumber(value)));
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid experiment");
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error("Invalid field");
  return value.trim();
}
export function draftExperiment(diagnosis?: Diagnosis): ExperimentDraft {
  return { name: "", problem: diagnosis?.main_bottleneck ?? diagnosis?.situation ?? "", hypothesis: diagnosis?.hypotheses[0] ?? "",
    action: diagnosis?.priorities[0] ?? "", baseline: "", target: "", metric: "", start_date: "", end_date: "" };
}
export function parseExperiment(value: unknown): ExperimentDraft {
  const data = record(value), start = date(data.start_date), end = date(data.end_date);
  if (!start || !end || end < start) throw new Error("Invalid experiment dates");
  return { name: text(data.name, 160), problem: text(data.problem, 2000), hypothesis: text(data.hypothesis, 2000), action: text(data.action, 2000),
    baseline: experimentNumber(data.baseline), target: experimentNumber(data.target), metric: text(data.metric, 300), start_date: start, end_date: end };
}
export function parseExperimentResult(value: unknown): { status: Outcome; result: string | null; learning: string } {
  const data = record(value);
  if (!(OUTCOMES as readonly unknown[]).includes(data.status)) throw new Error("Invalid outcome");
  const result = data.result === null || data.result === "" ? null : experimentNumber(data.result);
  if (result === null && data.status !== "INCONCLUSIVE") throw new Error("Missing result");
  return { status: data.status as Outcome, result, learning: text(data.learning, 4000) };
}
export function canTransition(from: Experiment["status"], to: Experiment["status"]) {
  return (from === "PLANNED" && to === "RUNNING") || (from === "RUNNING" && (OUTCOMES as readonly string[]).includes(to));
}
