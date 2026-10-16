import "server-only";
import Stripe from "stripe";
export function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key || !/^(sk|rk)_test_/.test(key)) throw new Error("STRIPE_TEST_KEY_REQUIRED");
  return new Stripe(key, { maxNetworkRetries: 1, timeout: 20000 });
}
export function billingSite() {
  const site = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "");
  if (site.protocol !== "https:" && !(site.protocol === "http:" && ["127.0.0.1", "localhost"].includes(site.hostname))) throw new Error("INVALID_SITE_URL");
  return site.origin;
}
