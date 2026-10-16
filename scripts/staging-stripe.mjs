// Opt-in, real Stripe TEST API + isolated Supabase. No emails, real payments,
// customer identities or SeedAI production subscription metadata are sent.
import Stripe from 'stripe';
import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';

export class StripeCheckFailure extends Error {}
const check=(ok,label)=>{if(!ok)throw new StripeCheckFailure(label);};
const data=(r,label)=>{check(!r.error,label);return r.data;};
export function stripeTestKey(key){
 check(typeof key==='string'&&/^(sk|rk)_test_[A-Za-z0-9]+$/.test(key),'stripe_test_key_required');
 return key;
}
export async function stripeFixtureClient(){
 // Select only this TEST key. Never inherit the production database or runtime.
 const env=parseEnv(await readFile(new URL('../.env.local',import.meta.url),'utf8'));
 const client=new Stripe(stripeTestKey(env.STRIPE_SECRET_KEY?.trim()),{maxNetworkRetries:1,timeout:15000});
 check((await client.balance.retrieve()).livemode===false,'stripe_mode_preflight_failed');
 return client;
}
export function fixtureMetadata(run){
 check(/^[a-f0-9-]{36}$/.test(run),'invalid_fixture_run');
 // The published webhook ignores subscriptions without seed_user_id, seed_market
 // and seed_price_id. Keep those production routing fields OUT of provider data.
 return {phase13_fixture:run,purpose:'staging-network-test'};
}
function owned(record,run){
 check(record&&record.livemode===false&&record.metadata?.phase13_fixture===run,'stripe_fixture_ownership_failed');
 return record;
}
export async function cleanupStripeFixture(stripe,fixture,run){
 if(fixture.clockId){
  const clock=await stripe.testHelpers.testClocks.retrieve(fixture.clockId);
  check(clock.livemode===false&&clock.name==='SeedAI FIXTURE '+run,'stripe_clock_ownership_failed');
  const clockCustomers=await stripe.customers.list({test_clock:clock.id,limit:100});
  check(!clockCustomers.has_more,'stripe_clock_cleanup_limit');
  for(const customer of clockCustomers.data)owned(customer,run);
  check((await stripe.testHelpers.testClocks.del(clock.id)).deleted===true,'stripe_clock_cleanup_failed');
 }
 // Find even a customer whose creation succeeded but whose response timed out.
 const customers=await stripe.customers.list({created:{gte:fixture.started},limit:100});
 check(!customers.has_more,'stripe_cleanup_scan_limit');
 for(const customer of customers.data.filter(row=>row.metadata?.phase13_fixture===run)){
  owned(customer,run);
  const sessions=await stripe.checkout.sessions.list({customer:customer.id,limit:100});
  check(!sessions.has_more,'stripe_cleanup_session_limit');
  for(const session of sessions.data){
   owned(session,run);
   if(session.status==='open')await stripe.checkout.sessions.expire(session.id);
  }
  // Removing this fictional customer also cancels any unfinished subscription.
  check((await stripe.customers.del(customer.id)).deleted===true,'stripe_customer_cleanup');
 }
 let product;
 try{product=await stripe.products.retrieve(fixture.productId);}catch(error){if(error.statusCode!==404)throw error;}
 if(product){
  owned(product,run);
  const prices=await stripe.prices.list({product:product.id,limit:100});
  check(!prices.has_more,'stripe_cleanup_price_limit');
  for(const price of prices.data){owned(price,run);if(price.active)await stripe.prices.update(price.id,{active:false});}
  if(product.active)await stripe.products.update(product.id,{active:false});
  check(!(await stripe.products.retrieve(product.id)).active,'stripe_product_cleanup');
 }
 return {customersDeleted:true,openSessionsExpired:true,subscriptionsCanceled:true,pricesAndProductArchived:true,
  retained:'Stripe retains test invoices, events and canceled subscriptions; they are not real charges.'};
}
export async function runStagingStripe(stripe,admin,users,fixture,run,save){
 const {validateTestPrice,cancelsAtPeriodEnd}=await import('../.test-build/src/lib/billing/contracts.js');
 const [a,b]=users,metadata=fixtureMetadata(run),steps=[];
 check(users.length===2&&a.id!==b.id&&a.company!==b.company,'stripe_isolated_users_required');
 const request=operation=>({idempotencyKey:'seed-phase13/'+run+'/'+operation});
 const product=owned(await stripe.products.create({id:fixture.productId,name:'SeedAI — FICTITIOUS PHASE 13 TEST',metadata},request('product')),run);
 const price=owned(await stripe.prices.create({product:product.id,currency:'brl',unit_amount:100,recurring:{interval:'month'},metadata},request('price')),run);
 fixture.providerPriceId=price.id;await save();
 validateTestPrice(price,{currency:'BRL',amount_minor:100});
 const customer=owned(await stripe.customers.create({name:'FICTITIOUS PHASE 13 TEST',payment_method:'pm_card_visa',invoice_settings:{default_payment_method:'pm_card_visa'},metadata},request('customer')),run);
 fixture.customerId=customer.id;await save();
 data(await admin.from('commercial_accounts').update({market_code:'BR'}).in('user_id',[a.id,b.id]),'stripe_fixture_market');
 data(await admin.from('commercial_prices').insert({id:fixture.priceId,plan_code:'PRO',market_code:'BR',currency:'BRL',amount_minor:100,provider:'stripe',provider_price_id:price.id,status:'INACTIVE',is_planning_hypothesis:true,effective_from:new Date().toISOString(),effective_to:new Date(Date.now()+86400000).toISOString()}),'stripe_fixture_price');
 data(await admin.from('checkout_attempts').insert({user_id:a.id,market_code:'BR',price_id:fixture.priceId}),'stripe_fixture_checkout');
 const plan=async user=>data(await admin.rpc('commercial_user_plan',{p_user:user.id}),'stripe_plan_read');
 const checkout=owned(await stripe.checkout.sessions.create({mode:'subscription',customer:customer.id,line_items:[{price:price.id,quantity:1}],success_url:'https://example.invalid/success',cancel_url:'https://example.invalid/cancel',metadata,subscription_data:{metadata}},request('checkout')),run);
 fixture.checkoutId=checkout.id;await save();
 check(checkout.status==='open'&&await plan(a)==='FREE','checkout_does_not_grant_access');
 check((await stripe.checkout.sessions.expire(checkout.id)).status==='expired','checkout_expiry_failed');
 steps.push('real_checkout_created_expired_without_granting_access');
 let subscription=owned(await stripe.subscriptions.create({customer:customer.id,items:[{price:price.id}],payment_behavior:'error_if_incomplete',metadata},request('subscription')),run);
 fixture.subscriptionId=subscription.id;await save();
 check(subscription.status==='active','test_subscription_not_active');
 const invoiceId=typeof subscription.latest_invoice==='string'?subscription.latest_invoice:subscription.latest_invoice?.id;
 check(invoiceId,'test_invoice_missing');
 const invoice=await stripe.invoices.retrieve(invoiceId);
 check(!invoice.livemode&&invoice.status==='paid'&&invoice.amount_paid===100,'test_invoice_not_paid');
 const apply=async(snapshot,index,type)=>{
  owned(snapshot,run);check(snapshot.items.data.length===1,'unexpected_subscription_items');
  const item=snapshot.items.data[0];validateTestPrice({...item.price,active:true},{currency:'BRL',amount_minor:100});
  check(item.price.id===price.id&&item.quantity===1,'subscription_price_mismatch');
  // Local fixture association only. These synthetic event IDs/snapshots exercise
  // DB reconciliation; they do not claim real webhook delivery or signatures.
  return admin.rpc('apply_billing_event',{p_event_id:fixture.eventIds[index],p_type:type,p_created:fixture.started+index,p_subscription:{
   user_id:a.id,market_code:'BR',price_id:fixture.priceId,provider_price_id:price.id,provider_customer_id:customer.id,provider_subscription_id:snapshot.id,
   status:snapshot.status,currency:'BRL',amount_minor:100,current_period_start:new Date(item.current_period_start*1000).toISOString(),
   current_period_end:new Date(item.current_period_end*1000).toISOString(),cancel_at_period_end:cancelsAtPeriodEnd(snapshot,item.current_period_end),
   canceled_at:snapshot.canceled_at===null?null:new Date(snapshot.canceled_at*1000).toISOString(),
  }});
 };
 for(const result of await Promise.all([apply(subscription,0,'invoice.paid'),apply(subscription,0,'invoice.paid')]))data(result,'stripe_snapshot_apply');
 check(await plan(a)==='PRO'&&await plan(b)==='FREE','stripe_plan_isolation');
 check(data(await b.session.from('subscriptions').select('id').eq('provider_subscription_id',subscription.id),'stripe_cross_tenant_read').length===0,'stripe_subscription_leak');
 steps.push('real_test_payment_snapshot_idempotent_and_isolated');
 subscription=owned(await stripe.subscriptions.update(subscription.id,{cancel_at_period_end:true},request('scheduled-cancel')),run);
 data(await apply(subscription,1,'customer.subscription.updated'),'stripe_scheduled_cancel_apply');
 check(await plan(a)==='PRO','scheduled_cancel_cut_paid_period');
 subscription=owned(await stripe.subscriptions.cancel(subscription.id,{invoice_now:false,prorate:false},request('cancel')),run);
 check(subscription.status==='canceled','provider_cancel_failed');
 data(await apply(subscription,2,'customer.subscription.deleted'),'stripe_cancel_apply');
 check(await plan(a)==='FREE','canceled_plan_still_active');
 check(data(await a.session.from('company_facts').select('id').eq('company_id',a.company),'stripe_preserved_memory').length===1,'stripe_cancel_deleted_memory');
 steps.push('real_scheduled_and_effective_cancellation_preserves_memory');
 return {passed:true,steps,testMode:true,realProviderNetwork:true,realDatabase:true,realMoney:0,emailsSent:0,productionSubscriptionMetadata:false,
  limitations:['Checkout was created and expired, not completed in a browser.',
   'Provider snapshots were associated locally with synthetic event IDs; delivery of signed webhooks and live billing remain untested.',
   'Renewals, refunds and store purchases require separate release validation.']};
}
