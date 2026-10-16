import Stripe from "stripe";
export function verifyStripeWebhook(client: Stripe, raw: string, signature: string | null, secret: string): Stripe.Event {
  if (!secret.startsWith("whsec_") || !signature || Buffer.byteLength(raw)>1_000_000) throw new Error("INVALID_WEBHOOK");
  const event=client.webhooks.constructEvent(raw,signature,secret);
  if(event.livemode)throw new Error("LIVE_EVENT_REJECTED");
  return event;
}
