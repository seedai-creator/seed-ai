import Stripe from "stripe";
import { stripeClient } from "@/lib/billing/stripe";
import { cancelsAtPeriodEnd, isBillingEvent, validateTestPrice } from "@/lib/billing/contracts";
import { commercialDatabase } from "@/lib/commercial/server";
import { verifyStripeWebhook } from "@/lib/billing/verify-webhook";
export const runtime = "nodejs";
const idOf = (value: string | { id: string } | null | undefined) => typeof value === "string" ? value : value?.id;
const iso = (seconds: number | null) => seconds === null ? null : new Date(seconds * 1000).toISOString();
export async function POST(request: Request) {
  let stripe: Stripe, event: Stripe.Event;
  try {
    stripe = stripeClient();
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret?.startsWith("whsec_")) return Response.json({ error: "Webhook unavailable" }, { status: 503 });
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 1_000_000) return Response.json({ error: "Too large" }, { status: 413 });
    event = verifyStripeWebhook(stripe, raw, request.headers.get("stripe-signature"), secret);
  } catch { return Response.json({ error: "Invalid webhook" }, { status: 400 }); }
  if (event.livemode) return Response.json({ error: "Test mode required" }, { status: 400 });
  if (!isBillingEvent(event.type)) return Response.json({ received: true });
  try {
    let subscriptionId: string | undefined;
    if (!("id" in event.data.object) || typeof event.data.object.id !== "string") throw new Error("INVALID_EVENT_OBJECT");
    if (event.type.startsWith("customer.subscription.")) subscriptionId = event.data.object.id;
    else if (event.type.startsWith("checkout.session.")) {
      const session = await stripe.checkout.sessions.retrieve(event.data.object.id);
      subscriptionId = idOf(session.subscription);
    } else {
      const invoice = await stripe.invoices.retrieve(event.data.object.id);
      subscriptionId = idOf(invoice.parent?.subscription_details?.subscription);
    }
    if (!subscriptionId) return Response.json({ received: true });
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (subscription.livemode || subscription.items.data.length !== 1) throw new Error("UNSUPPORTED_SUBSCRIPTION");
    const item = subscription.items.data[0];
    if (item.quantity !== 1) throw new Error("INVALID_QUANTITY");
    const { seed_user_id: userId, seed_market: market, seed_price_id: priceId } = subscription.metadata;
    // Foreign Stripe products are acknowledged without changing SEED access.
    if (!userId || !market || !priceId) return Response.json({ received: true });
    const db = commercialDatabase();
    const { data: price, error: priceError } = await db.from("commercial_prices").select("*").eq("id", priceId).single();
    if (priceError || !price || price.provider_price_id !== item.price.id) throw new Error("PRICE_MISMATCH");
    validateTestPrice({ ...item.price, active: true }, price); // Retired prices can remain on grandfathered subscriptions.
    const { error } = await db.rpc("apply_billing_event", { p_event_id: event.id, p_type: event.type, p_created: event.created, p_subscription: {
      user_id: userId, market_code: market, price_id: priceId, provider_price_id: item.price.id,
      provider_customer_id: idOf(subscription.customer), provider_subscription_id: subscription.id,
      status: subscription.status, currency: price.currency, amount_minor: price.amount_minor,
      current_period_start: iso(item.current_period_start), current_period_end: iso(item.current_period_end),
      cancel_at_period_end: cancelsAtPeriodEnd(subscription, item.current_period_end), canceled_at: iso(subscription.canceled_at),
    } });
    if (error) throw new Error("BILLING_PERSISTENCE_FAILED");
    return Response.json({ received: true });
  } catch { console.error("[seed:billing]", { code: "WEBHOOK_PROCESSING_FAILED", eventId: event.id }); return Response.json({ error: "Retry later" }, { status: 503 }); }
}
