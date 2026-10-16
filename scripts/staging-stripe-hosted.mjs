// Opt-in HTTPS delivery test against the separately prepared private preview.
import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify,parseEnv} from 'node:util';
import {fileURLToPath} from 'node:url';
import {stripeTestKey,fixtureMetadata,StripeCheckFailure} from './staging-stripe.mjs';
const execute=promisify(execFile);
const check=(ok,label)=>{if(!ok)throw new StripeCheckFailure(label);};
const data=(r,label)=>{check(!r.error,label);return r.data;};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label){const end=Date.now()+120000;do{const result=await fn();if(result)return result;await sleep(1500);}while(Date.now()<end);throw new StripeCheckFailure(label);}

export async function runStagingStripeHosted(stripe,admin,users,fixture,run,save){
 const state=JSON.parse(await readFile(new URL('../.test-build/hosted-stripe/state.json',import.meta.url),'utf8'));
 check(state.project==='prj_KAfjyIcUYGfIKexl2QTsZHPwcIHv'&&state.status==='connected','hosted_fixture_not_ready');
 const url=new URL(state.url);
 check(url.protocol==='https:'&&url.hostname.startsWith('seed-ai-staging-')&&url.hostname.endsWith('-joao13jgc-5689.vercel.app')&&!url.search&&!url.hash&&!url.username&&!url.password&&url.pathname==='/','hosted_origin_guard');
 const endpoint=await stripe.webhookEndpoints.retrieve(state.endpoint);
 check(!endpoint.livemode&&endpoint.metadata.phase13_hosted===state.run&&endpoint.url===url.origin+'/api/billing/webhook?x-vercel-protection-bypass='+encodeURIComponent(state.bypass),'hosted_endpoint_guard');
 const [a,b]=users,metadata=fixtureMetadata(run),steps=[];
 const {billingMetadata}=await import('../.test-build/src/lib/billing/metadata.js');
 const scoped=billingMetadata({userId:a.id,market:'BR',priceId:fixture.priceId},'staging');
 const request=operation=>({idempotencyKey:'seed-phase13-hosted/'+run+'/'+operation});
 const plan=async user=>data(await admin.rpc('commercial_user_plan',{p_user:user.id}),'hosted_plan_read');
 const controls=async()=>({markets:data(await admin.from('commercial_markets').select('*').order('code'),'markets'),plans:data(await admin.from('commercial_plans').select('*').order('code'),'plans'),settings:data(await admin.from('commercial_settings').select('*').order('id'),'settings')});
 const baseline=await controls();
 const passed=step=>{steps.push(step);console.log(JSON.stringify({hostedStripe:step}));};
 const local=parseEnv(await readFile(new URL('../.env.local',import.meta.url),'utf8'));
 const key=stripeTestKey(local.STRIPE_SECRET_KEY.trim());
 const cli=fileURLToPath(new URL('../../.stripe-tools/node_modules/@stripe/cli-win32-x64/bin/stripe.exe',import.meta.url));
 const resend=async event=>{
  check(/^evt_[A-Za-z0-9]+$/.test(event),'invalid_provider_event');
  try{await execute(cli,['events','resend',event,'--webhook-endpoint',state.endpoint,'--confirm'],{env:{...process.env,STRIPE_API_KEY:key},windowsHide:true,timeout:60000,maxBuffer:1000000});}
  catch{throw new StripeCheckFailure('provider_resend_failed_details_suppressed');}
 };
 try{
  check([401,302,307].includes((await fetch(url.origin+'/login',{redirect:'manual',signal:AbortSignal.timeout(15000)})).status),'hosted_anonymous_access');
  const bad=await fetch(url.origin+'/api/billing/webhook',{method:'POST',headers:{'x-vercel-protection-bypass':state.bypass,'stripe-signature':'invalid'},body:'{}',signal:AbortSignal.timeout(60000)});
  check(bad.status===400,'hosted_invalid_signature');passed('private_preview_and_invalid_signature_rejected');
  const product=await stripe.products.create({id:fixture.productId,name:'SeedAI HOSTED FICTITIOUS QA — NOT AN OFFER',metadata},request('product'));
  const price=await stripe.prices.create({product:product.id,currency:'brl',unit_amount:9999,recurring:{interval:'month'},metadata},request('price'));
  fixture.providerPriceId=price.id;await save();
  const customer=await stripe.customers.create({name:'FICTITIOUS HOSTED SEEDAI QA',payment_method:'pm_card_visa',invoice_settings:{default_payment_method:'pm_card_visa'},metadata},request('customer'));
  fixture.customerId=customer.id;await save();
  data(await admin.from('commercial_accounts').update({market_code:'BR'}).in('user_id',[a.id,b.id]),'hosted_market');
  // Only this inactive fixture is deliberately inconsistent to make the real
  // handler fail closed. No global plan, grant or availability is changed.
  data(await admin.from('commercial_prices').insert({id:fixture.priceId,plan_code:'PRO',market_code:'BR',currency:'BRL',amount_minor:9999,provider:'stripe',provider_price_id:'price_fixture_not_ready_'+run.replaceAll('-',''),status:'INACTIVE',is_planning_hypothesis:true,effective_from:new Date().toISOString(),effective_to:new Date(Date.now()+86400000).toISOString()}),'hosted_price');
  check((await admin.rpc('begin_checkout',{p_user:a.id,p_market:'BR',p_price:fixture.priceId})).error,'inactive_public_checkout_allowed');
  data(await admin.from('checkout_attempts').insert({user_id:a.id,market_code:'BR',price_id:fixture.priceId}),'hosted_attempt');
  const failuresBefore=data(await admin.from('operational_events').select('id').eq('feature','billing').eq('code','WEBHOOK_PROCESSING_FAILED'),'failures_before').map(r=>r.id);
  const subscription=await stripe.subscriptions.create({customer:customer.id,items:[{price:price.id}],payment_behavior:'error_if_incomplete',metadata:{...metadata,...scoped}},request('subscription'));
  check(subscription.status==='active'&&!subscription.livemode,'hosted_subscription_unpaid');fixture.subscriptionId=subscription.id;await save();
  const created=await until(async()=>{const events=await stripe.events.list({type:'customer.subscription.created',created:{gte:fixture.started},limit:100});return events.data.find(e=>e.data.object.id===subscription.id&&e.data.object.metadata?.phase13_fixture===run);},'created_event_missing');
  fixture.eventIds.push(created.id);await save();
  await until(async()=>data(await admin.from('operational_events').select('id').eq('feature','billing').eq('code','WEBHOOK_PROCESSING_FAILED'),'failures_after').some(r=>!failuresBefore.includes(r.id)),'initial_delivery_failure_not_recorded');
  check(await plan(a)==='FREE','failed_delivery_granted_pro');
  check(data(await admin.from('billing_events').select('provider_event_id').eq('provider_event_id',created.id),'failed_receipt').length===0,'failed_event_marked_done');
  passed('real_signed_https_delivery_failed_closed_without_plan_grant');
  data(await admin.from('commercial_prices').update({provider_price_id:price.id}).eq('id',fixture.priceId),'hosted_fixture_repair');
  await resend(created.id);
  await until(async()=>await plan(a)==='PRO','resend_did_not_restore');
  check(await plan(b)==='FREE','hosted_other_user_upgraded');
  check(data(await b.session.from('subscriptions').select('id').eq('provider_subscription_id',subscription.id),'hosted_rls').length===0,'hosted_cross_tenant_leak');
  passed('provider_resend_to_same_https_endpoint_grants_only_fixture_account');
  await Promise.all([resend(created.id),resend(created.id)]);await sleep(4000);
  check(data(await admin.from('billing_events').select('provider_event_id').eq('provider_event_id',created.id),'duplicate_receipts').length===1,'duplicate_receipts_created');
  check(data(await admin.from('subscriptions').select('id').eq('provider_subscription_id',subscription.id),'duplicate_subscriptions').length===1,'duplicate_subscriptions_created');
  passed('concurrent_provider_resends_are_idempotent');
  await stripe.subscriptions.cancel(subscription.id,{invoice_now:false,prorate:false},request('cancel'));
  await until(async()=>await plan(a)==='FREE','cancellation_not_delivered');
  const canceled=(await stripe.events.list({type:'customer.subscription.deleted',created:{gte:fixture.started},limit:100})).data.find(e=>e.data.object.id===subscription.id);
  check(canceled,'deleted_event_missing');fixture.eventIds.push(canceled.id);await save();
  await resend(created.id);await sleep(3000);check(await plan(a)==='FREE','old_event_resurrected_subscription');
  check(data(await a.session.from('company_facts').select('id').eq('company_id',a.company),'hosted_memory').length===1,'hosted_memory_deleted');
  passed('cancellation_and_late_replay_preserve_free_and_business_memory');
  check(JSON.stringify(await controls())===JSON.stringify(baseline),'hosted_controls_changed');passed('commercial_controls_prices_and_allowances_unchanged');
  return {passed:true,steps,realHostedDelivery:true,retry:'Explicit resend by Stripe CLI after real failure, not elapsed automatic backoff.',realMoney:0,emailsSent:0,paidAiCalls:0,productionChanged:false};
 }finally{await stripe.webhookEndpoints.update(state.endpoint,{disabled:true});}
}
