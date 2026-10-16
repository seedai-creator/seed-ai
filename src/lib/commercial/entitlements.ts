import type { Feature, Flags, Market, Override, Plan, PlanCode, Subscription, UsagePolicy, UsageState } from "./contracts";
import { validatePolicy } from "./contracts";
export function effectivePlan(subscription: Subscription | null, override: Override | null, now: Date): PlanCode {
  if (override?.plan_code && Date.parse(override.expires_at) > now.getTime()) return override.plan_code;
  // Provider state is authoritative. Cancellation scheduled at period end retains access.
  if (subscription && ["active", "trialing"].includes(subscription.status) && subscription.current_period_end && Date.parse(subscription.current_period_end) > now.getTime()) return subscription.plan_code;
  return "FREE";
}
export function getPlanEntitlements(global: Flags, plan: Plan, market: Market, override: Override | null, now: Date): Flags {
  return { ...global, ...plan.flags, ...market.flags, ...(override && Date.parse(override.expires_at) > now.getTime() ? override.flags : {}) };
}
export function canUseFeature(flags: Flags, feature: Feature) { return flags[feature] === true; }
export function canCreateCompany(plan: Plan, existingCount: number) { return Number.isSafeInteger(existingCount) && existingCount >= 0 && existingCount < plan.company_limit; }
export function canRunDiagnosis(flags: Flags, count: number, policy: UsagePolicy) { return canUseFeature(flags, "diagnosis") && count < policy.diagnoses; }
export function canCreateExperiment(flags: Flags) { return canUseFeature(flags, "experiments"); }
// Existing records remain readable after downgrade; entitlement gates new work.
export function canAccessDecisionHistory(isMember: boolean) { return isMember; }
export function canUseAdvancedAnalysis(flags: Flags) { return canUseFeature(flags, "advanced_analysis"); }
export function getUsagePolicy(plan: Plan, override: Override | null, now: Date) {
  return validatePolicy(override?.policy && Date.parse(override.expires_at) > now.getTime() ? override.policy : plan.policy);
}
export function usageState(cost: number, interactions: number, policy: UsagePolicy, diagnoses = 0): UsageState {
  validatePolicy(policy);
  if (!Number.isFinite(cost) || cost < 0 || !Number.isSafeInteger(interactions) || interactions < 0) throw new Error("Invalid usage");
  if (!Number.isSafeInteger(diagnoses) || diagnoses < 0) throw new Error("Invalid diagnosis count");
  if (cost >= policy.hard_usd || interactions >= policy.interactions || diagnoses >= policy.diagnoses) return "HARD_LIMIT";
  if (cost >= policy.soft_usd) return "SOFT_LIMIT";
  if (cost >= policy.approaching_usd) return "APPROACHING_LIMIT";
  return "NORMAL";
}
export function isValueMoment(input: { hasCompany: boolean; diagnosis: boolean; bottleneck: string | null; action: string | null }) {
  return input.hasCompany && input.diagnosis && !!input.bottleneck?.trim() && !!input.action?.trim();
}
