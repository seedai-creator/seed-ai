"use server";
import { redirect } from "next/navigation";
import { commercialContext, commercialDatabase } from "@/lib/commercial/server";
import { currentUser } from "@/lib/auth/context";
import { billingSite, stripeClient } from "@/lib/billing/stripe";
import { validateTestPrice } from "@/lib/billing/contracts";
import { isPlanAvailable } from "@/lib/commercial/markets";
import { getLocale } from "@/lib/i18n/server";
import { billingMetadata } from "@/lib/billing/metadata";
export async function startCheckout(form: FormData) {
  let destination: string;
  try {
    const c = await commercialContext();
    if(!process.env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_"))throw new Error("WEBHOOK_NOT_CONFIGURED");
    if (c.plan.code !== "FREE" || !isPlanAvailable(c.market, "PRO")) throw new Error("CHECKOUT_DISABLED");
    const offerId = form.get("offer_id");
    if (typeof offerId !== "string" || !/^PRO_[135]_V[1-9][0-9]*$/.test(offerId)) throw new Error("OFFER_REQUIRED");
    const offer = await c.db.from("commercial_offers").select("id").eq("id", offerId).eq("market_code",c.market.code).eq("available",true).single();
    if (offer.error || !offer.data) throw new Error("OFFER_UNAVAILABLE");
    const { data: price, error } = await c.db.from("commercial_prices").select("*").eq("offer_id",offerId).eq("market_code", c.market.code).eq("plan_code", "PRO").eq("provider", "stripe").eq("status", "ACTIVE").is("effective_to", null).lte("effective_from", new Date().toISOString()).single();
    if (error || !price) throw new Error("PRICE_UNAVAILABLE");
    const stripe = stripeClient(), priceId = price.provider_price_id;
    if (!priceId) throw new Error("PRICE_UNAVAILABLE");
    validateTestPrice(await stripe.prices.retrieve(priceId), price);
    let { data: attempt, error: attemptError } = await c.db.rpc("begin_checkout", { p_user: c.user.id, p_market: c.market.code, p_price: price.id });
    if (attemptError || !attempt) throw new Error("CHECKOUT_PENDING");
    let reusableUrl: string | null = null;
    if (attempt.provider_session_id) {
      const previous = await stripe.checkout.sessions.retrieve(attempt.provider_session_id);
      if (previous.livemode || previous.client_reference_id !== c.user.id) throw new Error("CHECKOUT_MISMATCH");
      if (previous.status === "open") {
        if (!previous.url) throw new Error("INVALID_CHECKOUT");
        reusableUrl = previous.url;
      } else {
        const closed = await c.db.rpc("update_checkout_attempt", {p_user:c.user.id,p_id:attempt.id,p_session:previous.id,p_closed:true});
        if(closed.error) throw new Error("CHECKOUT_CLOSE_FAILED");
        const next=await c.db.rpc("begin_checkout",{p_user:c.user.id,p_market:c.market.code,p_price:price.id});
        attempt=next.data;attemptError=next.error;if(attemptError||!attempt)throw new Error("CHECKOUT_PENDING");
      }
    }
    if (reusableUrl) {
      destination = reusableUrl;
    } else {
    const locale = await getLocale();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription", client_reference_id: c.user.id,
      expires_at: Math.floor(Date.parse(attempt.expires_at)/1000),
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { metadata: billingMetadata({userId:c.user.id,market:c.market.code,priceId:price.id},process.env.SEED_ENV) },
      metadata: { seed_attempt_id: attempt.id },
      success_url: billingSite() + "/billing?checkout=returned", cancel_url: billingSite() + "/billing?checkout=canceled",
      locale: locale.startsWith("pt") ? (locale === "pt-BR" ? "pt-BR" : "pt") : locale.startsWith("es") ? "es" : "en",
      integration_identifier: "seed_web_pro_abcdefgh",
    }, { idempotencyKey: "seed-checkout-" + attempt.id });
    if (!session.url || session.livemode) throw new Error("INVALID_CHECKOUT");
    const bound=await c.db.rpc("update_checkout_attempt",{p_user:c.user.id,p_id:attempt.id,p_session:session.id,p_closed:false});
    if(bound.error)throw new Error("CHECKOUT_BIND_FAILED");
    destination = session.url;
    }
  } catch { redirect("/billing?error=checkout"); }
  redirect(destination);
}
export async function openCustomerPortal() {
  let destination: string;
  try {
    const { user } = await currentUser(); const db = commercialDatabase();
    const { data, error } = await db.from("subscriptions").select("provider_customer_id").eq("user_id", user.id).eq("provider", "stripe").order("updated_at", { ascending: false }).limit(1).single();
    if (error || !data?.provider_customer_id) throw new Error("CUSTOMER_UNAVAILABLE");
    const configuration = process.env.STRIPE_PORTAL_CONFIGURATION_ID?.trim();
    if (!configuration || !/^bpc_[a-zA-Z0-9]+$/.test(configuration)) throw new Error("PORTAL_NOT_CONFIGURED");
    const stripe = stripeClient();
    const portal = await stripe.billingPortal.configurations.retrieve(configuration);
    if (!portal.active || portal.livemode || portal.features.subscription_update.enabled || !portal.features.subscription_cancel.enabled || portal.features.subscription_cancel.mode !== "at_period_end") throw new Error("PORTAL_CONFIGURATION_INVALID");
    const session = await stripe.billingPortal.sessions.create({ customer: data.provider_customer_id, configuration, return_url: billingSite() + "/billing" });
    destination = session.url;
  } catch { redirect("/billing?error=portal"); }
  redirect(destination);
}
export async function selectBillingCountry(form:FormData) {
  try {
    const {user}=await currentUser();const country=String(form.get("country"));
    if(!["BR","PT","ES","US"].includes(country))throw new Error("INVALID_COUNTRY");
    const {error}=await commercialDatabase().rpc("set_commercial_country",{p_user:user.id,p_market:country});
    if(error)throw new Error("COUNTRY_REJECTED");
  } catch {redirect("/billing?error=country");}
  redirect("/billing");
}
