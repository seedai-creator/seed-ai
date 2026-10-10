export const BILLING_PROVIDERS = ["stripe", "apple", "google", "manual", "future_provider"] as const;
export type BillingProvider = typeof BILLING_PROVIDERS[number];
export const BILLING_EVENTS = ["checkout.session.completed", "checkout.session.async_payment_succeeded", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "invoice.paid", "invoice.payment_failed"] as const;
export function isBillingEvent(type: string) { return (BILLING_EVENTS as readonly string[]).includes(type); }
export function checkoutCanActivatePlan() { return false; }
export function cancelsAtPeriodEnd(subscription: { cancel_at_period_end: boolean; cancel_at: number | null }, periodEnd: number) {
  return subscription.cancel_at_period_end || (subscription.cancel_at !== null && subscription.cancel_at === periodEnd);
}
export function validateTestPrice(price: { active: boolean; livemode: boolean; currency: string; unit_amount: number | null; recurring: { interval: string; interval_count: number; usage_type: string } | null }, expected: { currency: string; amount_minor: number }) {
  if (!price.active || price.livemode || price.currency.toUpperCase() !== expected.currency || price.unit_amount !== expected.amount_minor || price.recurring?.interval !== "month" || price.recurring.interval_count !== 1 || price.recurring.usage_type !== "licensed") throw new Error("STRIPE_PRICE_MISMATCH");
}
