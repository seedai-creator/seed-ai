import test from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import {verifyStripeWebhook} from "../src/lib/billing/verify-webhook";
import {cancelsAtPeriodEnd} from "../src/lib/billing/contracts";
test("portal cancellation accepts explicit period-end date as well as legacy flag",()=>{
 assert.equal(cancelsAtPeriodEnd({cancel_at_period_end:false,cancel_at:200},200),true);
 assert.equal(cancelsAtPeriodEnd({cancel_at_period_end:true,cancel_at:null},200),true);
 assert.equal(cancelsAtPeriodEnd({cancel_at_period_end:false,cancel_at:null},200),false);
 assert.equal(cancelsAtPeriodEnd({cancel_at_period_end:false,cancel_at:150},200),false);
});
test("webhook requires valid signature, unchanged raw body and test mode",()=>{
 const stripe=new Stripe("sk_test_fixture_not_a_real_key"),secret="whsec_fixture_not_a_real_secret";
 const raw=JSON.stringify({id:"evt_fixture",type:"customer.subscription.updated",livemode:false,data:{object:{id:"sub_fixture"}}});
 const signature=stripe.webhooks.generateTestHeaderString({payload:raw,secret});
 assert.equal(verifyStripeWebhook(stripe,raw,signature,secret).id,"evt_fixture");
 assert.throws(()=>verifyStripeWebhook(stripe,raw+" ",signature,secret));
 assert.throws(()=>verifyStripeWebhook(stripe,raw,null,secret));
 assert.throws(()=>verifyStripeWebhook(stripe,raw,signature,"whsec_other"));
 const live=raw.replace('"livemode":false','"livemode":true');
 assert.throws(()=>verifyStripeWebhook(stripe,live,stripe.webhooks.generateTestHeaderString({payload:live,secret}),secret));
 const old=stripe.webhooks.generateTestHeaderString({payload:raw,secret,timestamp:1});assert.throws(()=>verifyStripeWebhook(stripe,raw,old,secret));
});
