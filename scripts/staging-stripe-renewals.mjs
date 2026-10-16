import {StripeCheckFailure,fixtureMetadata} from './staging-stripe.mjs';
const check=(ok,label)=>{if(!ok)throw new StripeCheckFailure(label);};
export async function runStripeRenewals({stripe,admin,owner,other,fixture,run,save,scoped,request,until,plan,passed,deliveries}){
 const metadata={...fixtureMetadata(run),...scoped};
 const clock=await stripe.testHelpers.testClocks.create({frozen_time:Math.floor(Date.now()/1000),name:'SeedAI FIXTURE '+run},request('clock'));
 fixture.clockId=clock.id;await save();
 check(!clock.livemode,'clock_not_test');
 const customer=await stripe.customers.create({name:'FICTITIOUS RENEWAL QA',test_clock:clock.id,payment_method:'pm_card_visa',invoice_settings:{default_payment_method:'pm_card_visa'},metadata:fixtureMetadata(run)},request('clock-customer'));
 fixture.clockCustomerId=customer.id;await save();
 const goodMethod=customer.invoice_settings.default_payment_method;
 check(typeof goodMethod==='string','clock_payment_method_missing');
 let subscription=await stripe.subscriptions.create({customer:customer.id,items:[{price:fixture.providerPriceId}],metadata,payment_behavior:'error_if_incomplete'},request('clock-subscription'));
 fixture.subscriptionId=subscription.id;await save();
 await until(async()=>await plan(owner)==='PRO','initial_clock_payment_not_delivered');
 check(await plan(other)==='FREE','initial_clock_plan_leak');
 passed('test_clock_initial_payment_delivered');
 const advance=async(end,label)=>{
  await stripe.testHelpers.testClocks.advance(clock.id,{frozen_time:end},request(label));
  await until(async()=>(await stripe.testHelpers.testClocks.retrieve(clock.id)).status==='ready','clock_advance_timeout',120000);
 };
 const snapshot=async()=>{
  const result=await admin.from('subscriptions').select('*').eq('provider_subscription_id',subscription.id).single();
  check(!result.error,'clock_subscription_read');return result.data;
 };
 const initialEnd=subscription.items.data[0].current_period_end;
 await advance(initialEnd+7200,'renewal');
 subscription=await stripe.subscriptions.retrieve(subscription.id);
 const renewedEnd=subscription.items.data[0].current_period_end;
 check(renewedEnd>initialEnd,'provider_cycle_not_advanced');
 const renewalInvoice=await stripe.invoices.retrieve(subscription.latest_invoice);
 // Account-specific automatic finalization grace may exceed the clock step.
 // Finalize/pay this exact fixture invoice rather than changing global settings.
 if(renewalInvoice.status==='draft')await stripe.invoices.finalizeInvoice(renewalInvoice.id,{},request('finalize-renewal'));
 const renewal=await stripe.invoices.retrieve(renewalInvoice.id);
 if(renewal.status==='open')await stripe.invoices.pay(renewal.id,{},request('pay-renewal'));
 await until(async()=>Date.parse((await snapshot()).current_period_end)===renewedEnd*1000&&await plan(owner)==='PRO','renewal_not_reconciled');
 check((await stripe.invoices.retrieve(renewal.id)).status==='paid','renewal_invoice_unpaid');
 passed('real_monthly_renewal_updates_cycle_and_keeps_access');
 const declined=await stripe.paymentMethods.attach('pm_card_chargeCustomerFail',{customer:customer.id},request('declining-method'));
 await stripe.subscriptions.update(subscription.id,{default_payment_method:declined.id},request('declining-subscription'));
 await advance(renewedEnd+7200,'failed-renewal');
 subscription=await stripe.subscriptions.retrieve(subscription.id);
 let unpaid=await stripe.invoices.retrieve(subscription.latest_invoice);
 if(unpaid.status==='draft')unpaid=await stripe.invoices.finalizeInvoice(unpaid.id,{},request('finalize-failed-renewal'));
 if(unpaid.status==='open'&&!unpaid.attempted){
  try{await stripe.invoices.pay(unpaid.id,{},request('declined-renewal-charge'));}catch(error){check(error.type==='StripeCardError','unexpected_payment_failure');}
 }
 await until(async()=>deliveries.some(d=>d.type==='invoice.payment_failed'&&d.status===200)&&(await snapshot()).status==='past_due'&&await plan(owner)==='FREE','failed_renewal_not_reconciled');
 passed('failed_renewal_removes_paid_access_via_signed_event');
 await stripe.subscriptions.update(subscription.id,{default_payment_method:goodMethod},request('restore-method'));
 const recovered=await stripe.invoices.pay(unpaid.id,{payment_method:goodMethod},request('recover-payment'));
 check(recovered.status==='paid','recovery_payment_failed');
 await until(async()=>await plan(owner)==='PRO','recovery_not_reconciled');
 check(await plan(other)==='FREE','recovery_plan_leak');
 passed('payment_recovery_restores_only_the_paying_fixture');
 await stripe.subscriptions.cancel(subscription.id,{invoice_now:false,prorate:false},request('clock-cancel'));
 await until(async()=>await plan(owner)==='FREE','clock_cancellation_not_delivered');
 const memory=await owner.session.from('company_facts').select('id').eq('company_id',owner.company);
 check(!memory.error&&memory.data.length===1,'clock_cancellation_deleted_memory');
 passed('renewal_fixture_canceled_and_business_memory_preserved');
 return {initialEnd,renewedEnd,invoiceFinalization:'Exact fixture invoices finalized/paid if account grace deferred automation; global settings unchanged.'};
}
