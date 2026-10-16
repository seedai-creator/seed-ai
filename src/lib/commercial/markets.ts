import type { Market, MarketCode } from "./contracts";
export const READINESS_CATEGORIES = ["configuration", "localization", "product", "pricing", "billing", "legal_tax", "privacy", "ai_cost_protection", "analytics", "testing", "emergency_controls"] as const;
export function validateMarketReadiness(market: Market, technical: { validPrice: boolean; providerConfigured: boolean; costProtectionReady: boolean }) {
  const missing = READINESS_CATEGORIES.filter(key => !market.readiness[key]?.pass || !market.readiness[key]?.evidence?.trim()).map(String);
  if (!technical.validPrice) missing.push("provider_price");
  if (!technical.providerConfigured) missing.push("billing_credentials");
  if (!technical.costProtectionReady) missing.push("ai_pricing_and_limits");
  if (!market.locale || !market.currency || !market.timezone) missing.push("market_configuration");
  return { ready: missing.length === 0, missing };
}
export function canActivateMarket(market: Market, readiness: ReturnType<typeof validateMarketReadiness>, environment: "test" | "production") {
  return market.status === "READY" && readiness.ready && (environment === "test" || market.code === "BR");
}
export function isSignupEnabled(market: Market) { return market.status === "ACTIVE" && market.signup_enabled && !market.disable_new_signups; }
export function isPlanAvailable(market: Market, plan: "FREE" | "PRO") { return market.status === "ACTIVE" && (plan === "FREE" ? market.free_enabled : market.pro_enabled && market.billing_enabled && !market.disable_new_subscriptions); }
export function resolveCommercialMarket(account: MarketCode | null, selected: MarketCode | null, verifiedBilling: MarketCode | null): MarketCode | null { return account ?? selected ?? verifiedBilling; }
export function canPreviewMarket(role: string | null) { return ["ADMIN_VIEWER", "ADMIN_OPERATOR", "SUPER_ADMIN"].includes(role ?? ""); }
