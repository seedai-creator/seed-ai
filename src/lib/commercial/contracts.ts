export type PlanCode = "FREE" | "PRO" | "BUSINESS" | "PARTNER" | "ADVISORY" | "ENTERPRISE";
export type MarketCode = "BR" | "PT" | "ES" | "US";
export type UsageState = "NORMAL" | "APPROACHING_LIMIT" | "SOFT_LIMIT" | "HARD_LIMIT";
export type Feature = "chat" | "memory" | "diagnosis" | "strategies" | "decisions" | "experiments" | "advanced_analysis" | "growth_map" | "weekly_checkin" | "goals" | "metrics" | "reports";
export type Flags = Partial<Record<Feature, boolean>>;
export type UsagePolicy = {
  analysis_limit_mode?: 'count' | 'budget';
  window: "lifetime" | "month"; target_usd: number; approaching_usd: number;
  soft_usd: number; warning_usd: number; heavy_usd: number; hard_usd: number;
  interactions: number; diagnoses: number; max_concurrent: number; requests_per_minute: number;
  user_day_usd: number; user_month_usd: number; global_day_usd: number;
};
export type Plan = { code: PlanCode; available: boolean; company_limit: number; strategy_limit: number | null; flags: Flags; policy: UsagePolicy };
export type Market = {
  code: MarketCode; locale: string; currency: string; timezone: string;
  status: "DRAFT" | "READY" | "ACTIVE" | "PAUSED" | "DISABLED";
  signup_enabled: boolean; free_enabled: boolean; pro_enabled: boolean; billing_enabled: boolean;
  disable_new_signups: boolean; disable_new_subscriptions: boolean; disable_ai_requests: boolean;
  flags: Flags; readiness: Record<string, { pass: boolean; evidence: string }>;
};
export type Subscription = {
  plan_code: PlanCode; status: "free" | "trialing" | "active" | "past_due" | "canceled" | "incomplete" | "incomplete_expired" | "unpaid" | "paused";
  current_period_end: string | null; cancel_at_period_end: boolean;
};
export type Override = { expires_at: string; plan_code?: "PRO"; flags?: Flags; policy?: UsagePolicy; market_access?: boolean };
export function finiteNonnegative(value: number) { return Number.isFinite(value) && value >= 0; }
export function validatePolicy(p: UsagePolicy): UsagePolicy {
  if (p.analysis_limit_mode !== undefined && !['count','budget'].includes(p.analysis_limit_mode)) throw new Error('Invalid analysis limit mode');
  if (!["lifetime", "month"].includes(p.window)) throw new Error("Invalid policy window");
  const thresholds = [p.target_usd, p.approaching_usd, p.soft_usd, p.warning_usd, p.heavy_usd, p.hard_usd];
  if (thresholds.some((v, i) => !finiteNonnegative(v) || (i > 0 && v < thresholds[i - 1])) || p.hard_usd <= 0) throw new Error("Invalid thresholds");
  for (const value of [p.interactions, p.diagnoses, p.max_concurrent, p.requests_per_minute]) if (!Number.isSafeInteger(value) || value < 1) throw new Error("Invalid count limit");
  for (const value of [p.user_day_usd, p.user_month_usd, p.global_day_usd]) if (!finiteNonnegative(value) || value <= 0) throw new Error("Invalid circuit breaker");
  return p;
}
