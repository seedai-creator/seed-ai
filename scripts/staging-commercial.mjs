// Real Auth/PostgREST/RLS; synthetic provider events. Never calls Stripe or
// grants access to a real account. All IDs are recorded before the first write.
export class CommercialCheckFailure extends Error {}
export async function runStagingCommercial(admin,users,fixture) {
 const checks=[];
 const check=(condition,label)=>{if(!condition)throw new CommercialCheckFailure(label);};
 const data=(r,label)=>{check(!r.error,label);return r.data;};
 const [a,b]=users;
 check(users.length===2&&a.id!==b.id&&a.company!==b.company,'commercial_isolated_users_required');
 data(await admin.from('commercial_accounts').update({market_code:'BR'}).in('user_id',[a.id,b.id]),'fixture_market');
 const start=new Date(),end=new Date(start.getTime()+86400000);
 data(await admin.from('commercial_prices').insert({id:fixture.priceId,plan_code:'PRO',market_code:'BR',currency:'BRL',amount_minor:100,
  provider:'stripe',provider_price_id:fixture.providerPriceId,status:'INACTIVE',is_planning_hypothesis:true,
  effective_from:start.toISOString(),effective_to:end.toISOString()}),'fixture_price');
 const payload={user_id:a.id,market_code:'BR',price_id:fixture.priceId,provider_price_id:fixture.providerPriceId,
  provider_customer_id:fixture.customerId,provider_subscription_id:fixture.subscriptionId,status:'active',currency:'BRL',amount_minor:100,
  current_period_start:start.toISOString(),current_period_end:end.toISOString(),cancel_at_period_end:false,canceled_at:null};
 const apply=(who,eventIndex,type,created,overrides={})=>who.rpc('apply_billing_event',{
  p_event_id:fixture.eventIds[eventIndex],p_type:type,p_created:created,p_subscription:{...payload,...overrides}});
 const plan=async user=>data(await admin.rpc('commercial_user_plan',{p_user:user.id}),'effective_plan');
 check((await a.session.rpc('commercial_user_plan',{p_user:b.id})).error?.code==='42501','client_cannot_inspect_other_plan');
 check(await plan(a)==='FREE','initial_plan_must_be_free');
 check((await apply(a.session,0,'invoice.paid',100)).error?.code==='42501','client_cannot_apply_billing');
 check((await apply(admin,0,'invoice.paid',100)).error,'missing_checkout_must_fail');
 data(await admin.from('checkout_attempts').insert(users.map(u=>({user_id:u.id,market_code:'BR',price_id:fixture.priceId}))),'fixture_checkout');
 checks.push('forged_event_and_missing_checkout_rejected');
 // The browser success URL does not call this RPC; a checkout record alone
 // also cannot activate access. Provider confirmation is still required.
 check(await plan(a)==='FREE','checkout_alone_cannot_activate');
 const duplicate=await Promise.all([apply(admin,0,'invoice.paid',100),apply(admin,0,'invoice.paid',100)]);
 check(duplicate.every(r=>!r.error),'concurrent_duplicate_failed');
 const stored=()=>admin.from('subscriptions').select('user_id,status,provider_updated_at,cancel_at_period_end').eq('provider_subscription_id',fixture.subscriptionId).single();
 check(data(await stored(),'subscription_read').user_id===a.id,'wrong_subscription_owner');
 check(await plan(a)==='PRO'&&await plan(b)==='FREE','plan_isolation_failed');
 check(data(await admin.from('billing_events').select('provider_event_id').in('provider_event_id',fixture.eventIds),'receipt_read').length===1,'duplicate_receipt');
 check(data(await b.session.from('subscriptions').select('id').eq('provider_subscription_id',fixture.subscriptionId),'other_tenant_read').length===0,'billing_cross_tenant_leak');
 check((await apply(admin,1,'customer.subscription.updated',150,{user_id:b.id})).error,'cannot_transfer_subscription');
 check((await apply(admin,1,'invoice.paid',150,{amount_minor:200})).error,'price_mismatch_must_fail');
 checks.push('duplicate_delivery_and_cross_tenant_billing_isolation');
 data(await apply(admin,2,'invoice.payment_failed',200,{status:'past_due'}),'payment_failure');
 check(await plan(a)==='FREE','failed_payment_access');
 data(await apply(admin,3,'invoice.paid',50),'late_event');
 check(data(await stored(),'late_read').status==='past_due','late_event_restored_access');
 data(await apply(admin,4,'invoice.paid',300),'payment_recovery');
 check(await plan(a)==='PRO','payment_recovery_access');
 data(await apply(admin,5,'customer.subscription.updated',400,{cancel_at_period_end:true}),'scheduled_cancellation');
 check(await plan(a)==='PRO','scheduled_cancellation_removed_paid_period');
 data(await apply(admin,6,'customer.subscription.deleted',500,{status:'canceled',canceled_at:start.toISOString()}),'effective_cancellation');
 check(await plan(a)==='FREE','cancellation_access');
 check(data(await a.session.from('company_facts').select('id').eq('company_id',a.company),'preserved_memory').length===1,'downgrade_deleted_memory');
 checks.push('payment_failure_recovery_out_of_order_and_cancellation');
 return {passed:true,checks,provider:'synthetic_events_only',realAuth:true,realDatabase:true,paidCalls:0,
  limitations:['Does not test Stripe network delivery, Checkout UI, refunds or store purchases. No global plan, market or budget changed.']};
}
