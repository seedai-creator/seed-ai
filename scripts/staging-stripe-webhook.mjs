// Real Stripe test Checkout + official CLI-signed delivery into the candidate
// Next handler and isolated Supabase. No public plans, AI or email are enabled.
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {createInterface} from 'node:readline';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {fileURLToPath} from 'node:url';
import {loadStagingEnvironment} from './staging-config.mjs';
import {stagingRuntimeEnvironment} from './staging-runtime.mjs';
import {validateEnvironment} from './environment.mjs';
import {stripeTestKey,fixtureMetadata,StripeCheckFailure} from './staging-stripe.mjs';
import {runStripeRenewals} from './staging-stripe-renewals.mjs';

const check=(ok,label)=>{if(!ok)throw new StripeCheckFailure(label);};
const data=(r,label)=>{check(!r.error,label);return r.data;};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label,ms=90000){
 const end=Date.now()+ms;
 do{const result=await fn();if(result)return result;await pause(1000);}while(Date.now()<end);
 throw new StripeCheckFailure(label);
}
async function stop(child){
 if(!child||child.exitCode!==null)return;
 const ended=new Promise(resolve=>child.once('exit',resolve));child.kill();
 await Promise.race([ended,pause(5000)]);
}
export async function runStagingStripeWebhook(stripe,admin,users,fixture,run,save){
 const {billingMetadata}=await import('../.test-build/src/lib/billing/metadata.js');
 const [a,b]=users,metadata=fixtureMetadata(run),dir=new URL('../.test-build/stripe-e2e/',import.meta.url);
 const target='http://127.0.0.1:3003',forward='http://127.0.0.1:3004/api/billing/webhook';
 const report={run,startedAt:new Date().toISOString(),steps:[],deliveries:[],realMoney:0,emailsSent:0,paidAiCalls:0};
 const passed=step=>{report.steps.push(step);console.log(JSON.stringify({stripeWebhook:step}));};
 const request=operation=>({idempotencyKey:'seed-phase13-webhook/'+run+'/'+operation});
 const plan=async user=>data(await admin.rpc('commercial_user_plan',{p_user:user.id}),'webhook_plan_read');
 const controls=async()=>({
  markets:data(await admin.from('commercial_markets').select('*').order('code'),'markets_snapshot'),
  plans:data(await admin.from('commercial_plans').select('*').order('code'),'plans_snapshot'),
  settings:data(await admin.from('commercial_settings').select('*').order('id'),'settings_snapshot'),
 });
 const before=await controls();
 let listener,app,proxy,browser,page,phase='preflight',secret,appLog='',listenerFailure;
 const captured=new Map(),pending=new Set();
 try{
  await mkdir(dir,{recursive:true});
  const staging=await loadStagingEnvironment(),local=parseEnv(await readFile(new URL('../.env.local',import.meta.url),'utf8'));
  const key=stripeTestKey(local.STRIPE_SECRET_KEY?.trim());
  check((await stripe.balance.retrieve()).livemode===false,'test_mode_required');
  // A scoped namespace is ignored by the older published handler. This test
  // never sends seed_user_id/seed_market/seed_price_id to the shared account.
  const scoped=billingMetadata({userId:a.id,market:'BR',priceId:fixture.priceId},'development');
  check(!scoped.seed_user_id&&!scoped.seed_market&&!scoped.seed_price_id,'production_metadata_refused');
  const events='checkout.session.completed,checkout.session.async_payment_succeeded,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.paid,invoice.payment_failed';
  proxy=createServer((req,res)=>{
   const task=(async()=>{
    if(req.method!=='POST'||req.url!=='/api/billing/webhook'){res.writeHead(404);res.end();return;}
    let raw='';for await(const part of req){raw+=part;check(Buffer.byteLength(raw)<=1000000,'proxy_body_limit');}
    let event;try{event=JSON.parse(raw);}catch{res.writeHead(400);res.end();return;}
    const object=event.data?.object;
    const owned=object?.metadata?.phase13_fixture===run||object?.parent?.subscription_details?.metadata?.phase13_fixture===run;
    // Do not persist or forward unrelated account events or their signatures.
    if(!owned){res.writeHead(200);res.end('{}');return;}
    check(event.livemode===false,'proxy_live_event_rejected');
    const signature=req.headers['stripe-signature'];
    if(!captured.has(event.id)){
     captured.set(event.id,{raw,signature,event});fixture.eventIds.push(event.id);await save();
    }
    const response=await fetch(target+'/api/billing/webhook',{method:'POST',headers:{'content-type':'application/json','stripe-signature':signature??''},body:raw,signal:AbortSignal.timeout(90000)});
    report.deliveries.push({id:event.id,type:event.type,status:response.status});
    res.writeHead(response.status,{'content-type':'application/json'});res.end(await response.text());
   })().catch(()=>{if(!res.headersSent)res.writeHead(503);res.end('{}');});
   pending.add(task);task.finally(()=>pending.delete(task));
  });
  await new Promise((resolve,reject)=>{proxy.once('error',reject);proxy.listen(3004,'127.0.0.1',resolve);});
  const cli=fileURLToPath(new URL('../../.stripe-tools/node_modules/@stripe/cli-win32-x64/bin/stripe.exe',import.meta.url));
  listener=spawn(cli,['listen','--skip-update','--events-from','@self','--events',events,'--forward-to',forward],{env:{...process.env,STRIPE_API_KEY:key},windowsHide:true,stdio:['ignore','pipe','pipe']});
  listener.on('error',()=>{listenerFailure=true;});
  for(const stream of [listener.stdout,listener.stderr])createInterface({input:stream}).on('line',line=>{
   const match=line.match(/\bwhsec_[A-Za-z0-9]+\b/);if(match)secret=match[0];
  });
  await until(()=>{check(!listenerFailure&&listener.exitCode===null,'stripe_listener_failed');return secret;},'stripe_listener_timeout',45000);
  const names=[];
  for(const name of ['.env','.env.local','.env.development','.env.development.local','.env.production','.env.production.local']){
   try{names.push(...Object.keys(parseEnv(await readFile(new URL('../'+name,import.meta.url),'utf8'))));}catch(e){if(e.code!=='ENOENT')throw e;}
  }
  const env=stagingRuntimeEnvironment(staging,names);
  Object.assign(env,{SEED_STAGING_CORE_ONLY:'false',SEED_STAGING_BILLING_ONLY:'true',STRIPE_SECRET_KEY:key,STRIPE_WEBHOOK_SECRET:secret,NEXT_PUBLIC_SITE_URL:target,NODE_ENV:'development'});
  validateEnvironment(env);
  app=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3003'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  for(const stream of [app.stdout,app.stderr])stream.on('data',chunk=>{appLog=(appLog+chunk.toString()).slice(-30000);});
  await until(async()=>{check(app.exitCode===null,'candidate_app_exited');try{return(await fetch(target+'/api/billing/webhook',{method:'POST',body:'{}',signal:AbortSignal.timeout(60000)})).status===400;}catch{return false;}},'candidate_app_timeout',120000);
  const bad=await fetch(target+'/api/billing/webhook',{method:'POST',headers:{'stripe-signature':'invalid'},body:'{}'});
  check(bad.status===400,'invalid_signature_accepted');passed('unsigned_and_invalid_signatures_rejected');
  phase='fixture_checkout';
  const product=await stripe.products.create({id:fixture.productId,name:'SeedAI — FICTITIOUS QA / NOT AN OFFER',metadata},request('product'));
  const price=await stripe.prices.create({product:product.id,currency:'brl',unit_amount:9999,recurring:{interval:'month'},metadata},request('price'));
  fixture.providerPriceId=price.id;await save();
  const customer=await stripe.customers.create({name:'FICTITIOUS SEEDAI QA',metadata},request('customer'));
  fixture.customerId=customer.id;await save();
  data(await admin.from('commercial_accounts').update({market_code:'BR'}).in('user_id',[a.id,b.id]),'fixture_market');
  data(await admin.from('commercial_prices').insert({id:fixture.priceId,plan_code:'PRO',market_code:'BR',currency:'BRL',amount_minor:9999,provider:'stripe',provider_price_id:price.id,status:'INACTIVE',is_planning_hypothesis:true,effective_from:new Date().toISOString(),effective_to:new Date(Date.now()+86400000).toISOString()}),'fixture_inactive_price');
  // The public startCheckout guard MUST reject this inactive offer. Fixture
  // insertion below grants only this synthetic account a test reconciliation.
  check((await admin.rpc('begin_checkout',{p_user:a.id,p_market:'BR',p_price:fixture.priceId})).error,'inactive_checkout_was_available');
  data(await admin.from('checkout_attempts').insert({user_id:a.id,market_code:'BR',price_id:fixture.priceId}),'fixture_attempt');
  if(process.argv.includes('--stripe-renewals')){
   phase='renewal_clock';
   report.renewal=await runStripeRenewals({stripe,admin,owner:a,other:b,fixture,run,save,scoped,request,until,plan,passed,deliveries:report.deliveries});
   check(JSON.stringify(await controls())===JSON.stringify(before),'commercial_controls_changed');
   passed('commercial_catalog_controls_and_plan_limits_preserved');
   report.passed=true;
   report.limitations=['Provider test clock/API and real signed delivery; not real money or elapsed calendar time.',
    'Only fixture invoices were finalized/paid if needed; production retry/grace settings remain a release decision.',
    'Refund handling, hosted delivery retries and mobile store purchases remain separate validation.'];
   return report;
  }
  const checkout=await stripe.checkout.sessions.create({mode:'subscription',customer:customer.id,client_reference_id:a.id,line_items:[{price:price.id,quantity:1}],payment_method_types:['card'],success_url:target+'/login?fixture=checkout-complete',cancel_url:target+'/login?fixture=checkout-canceled',locale:'en',metadata,subscription_data:{metadata:{...metadata,...scoped}}},request('checkout'));
  check(checkout.livemode===false&&checkout.url?.startsWith('https://checkout.stripe.com/'),'test_checkout_url_invalid');
  fixture.checkoutId=checkout.id;await save();
  check(await plan(a)==='FREE','checkout_creation_granted_access');passed('inactive_public_offer_rejected_and_checkout_creation_keeps_free');
  phase='checkout_browser';
  process.env.PLAYWRIGHT_BROWSERS_PATH=fileURLToPath(new URL('../.test-build/playwright-browsers',import.meta.url));
  const {chromium}=await import('@playwright/test');browser=await chromium.launch({headless:true});
  page=await browser.newPage({viewport:{width:1280,height:1000}});page.setDefaultTimeout(30000);
  await page.goto(checkout.url,{waitUntil:'domcontentloaded',timeout:90000});
  await page.locator('input[name="cardNumber"]').waitFor({timeout:60000});
  await page.locator('input[name="email"]').fill('seed-stripe-qa-'+run+'@example.invalid');
  await page.locator('input[name="cardNumber"]').fill('4000000000000002');
  await page.locator('input[name="cardExpiry"]').fill('12 / 30');
  await page.locator('input[name="cardCvc"]').fill('123');
  await page.locator('input[name="billingName"]').fill('FICTITIOUS SEEDAI QA');
  const country=page.locator('select[name="billingCountry"]');if(await country.count())await country.selectOption('BR');
  const postal=page.locator('input[name="billingPostalCode"]');if(await postal.isVisible())await postal.fill('35680347');
  await page.locator('button[type="submit"]').click();
  await page.getByText(/card was declined/i).first().waitFor({timeout:60000});
  check(await plan(a)==='FREE','declined_card_granted_access');passed('browser_declined_test_card_does_not_grant_access');
  await page.locator('input[name="cardNumber"]').fill('4242424242424242');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(url=>url.origin===target,{timeout:90000});
  const completed=await stripe.checkout.sessions.retrieve(checkout.id);
  check(completed.status==='complete'&&completed.payment_status==='paid','checkout_not_paid');
  fixture.subscriptionId=typeof completed.subscription==='string'?completed.subscription:completed.subscription?.id;await save();
  check(fixture.subscriptionId,'subscription_missing');
  passed('hosted_checkout_completed_with_test_card_in_browser');
  phase='signed_delivery';
  await until(async()=>await plan(a)==='PRO','signed_delivery_did_not_grant_fixture');
  check(await plan(b)==='FREE','second_account_plan_leak');
  check(data(await b.session.from('subscriptions').select('id').eq('provider_subscription_id',fixture.subscriptionId),'cross_tenant_query').length===0,'subscription_leaked');
  await until(()=>report.deliveries.some(d=>d.type==='invoice.paid'&&d.status===200)&&report.deliveries.some(d=>d.type==='checkout.session.completed'&&d.status===200),'missing_provider_delivery');
  passed('stripe_signed_network_events_grant_only_the_fixture_account');
  const invoiceEvent=[...captured.values()].find(c=>c.event.type==='invoice.paid');check(invoiceEvent,'invoice_event_not_captured');
  const replay=body=>fetch(target+'/api/billing/webhook',{method:'POST',headers:{'content-type':'application/json','stripe-signature':invoiceEvent.signature},body});
  check((await replay(invoiceEvent.raw+' ')).status===400,'tampered_body_accepted');
  for(const result of await Promise.all([replay(invoiceEvent.raw),replay(invoiceEvent.raw)]))check(result.status===200,'replay_failed');
  check(data(await admin.from('billing_events').select('provider_event_id').eq('provider_event_id',invoiceEvent.event.id),'replay_read').length===1,'duplicate_event_persisted');
  check(data(await admin.from('subscriptions').select('id').eq('provider_subscription_id',fixture.subscriptionId),'subscription_count').length===1,'duplicate_subscription');
  passed('tampered_payload_rejected_and_concurrent_replay_is_idempotent');
  phase='customer_portal';
  check(/^bpc_[A-Za-z0-9]+$/.test(local.STRIPE_PORTAL_CONFIGURATION_ID??''),'portal_configuration_missing');
  const configuration=await stripe.billingPortal.configurations.retrieve(local.STRIPE_PORTAL_CONFIGURATION_ID);
  check(configuration.active&&!configuration.livemode&&configuration.features.subscription_cancel.enabled&&configuration.features.subscription_cancel.mode==='at_period_end','portal_configuration_unsafe');
  const portal=await stripe.billingPortal.sessions.create({customer:customer.id,configuration:configuration.id,locale:'en',return_url:target+'/login?fixture=portal-return'},request('portal'));
  check(portal.url.startsWith('https://billing.stripe.com/'),'portal_url_invalid');
  await page.goto(portal.url,{waitUntil:'domcontentloaded',timeout:90000});
  await page.getByText(/^Cancel (subscription|plan)$/i).first().click();
  await page.getByRole('button',{name:/^(Cancel (subscription|plan)|Confirm cancellation)$/i}).last().click();
  await until(async()=>data(await admin.from('subscriptions').select('cancel_at_period_end').eq('provider_subscription_id',fixture.subscriptionId).single(),'scheduled_read').cancel_at_period_end,'scheduled_cancel_not_delivered');
  check(await plan(a)==='PRO','paid_period_lost_on_scheduled_cancel');
  passed('hosted_customer_portal_schedules_cancellation_without_cutting_paid_period');
  phase='cancellation';
  await stripe.subscriptions.cancel(fixture.subscriptionId,{invoice_now:false,prorate:false},request('cancel'));
  await until(async()=>await plan(a)==='FREE','effective_cancel_not_delivered');
  check(data(await a.session.from('company_facts').select('id').eq('company_id',a.company),'memory_read').length===1,'cancellation_deleted_memory');
  passed('signed_scheduled_and_effective_cancellation_preserve_memory');
  check(JSON.stringify(await controls())===JSON.stringify(before),'commercial_controls_changed');
  passed('commercial_catalog_controls_and_plan_limits_preserved');
  report.passed=true;
  report.limitations=['Browser Checkout uses a direct fixture session; public startCheckout remains blocked.',
   'CLI forwards authentic Stripe test events to the local candidate; hosted destination retry policy is not proved.',
   'Renewal, refunds, store purchases and live charging require separate release validation.'];
  return report;
 }catch(error){
  report.passed=false;report.failedPhase=phase;
  report.failedCheck=error instanceof StripeCheckFailure?error.message:error.name;
  if(page){
   try{report.browserText=(await page.locator('body').innerText()).slice(0,16000);report.browserInputs=await page.locator('input,select,button').evaluateAll(els=>els.map(e=>({tag:e.tagName,name:e.name,id:e.id,type:e.type,text:e.tagName==='BUTTON'?e.innerText:undefined})));await page.screenshot({path:fileURLToPath(new URL('failure-'+run+'.png',dir)),fullPage:true});}catch{}
  }
  throw new StripeCheckFailure('webhook_'+phase+'_'+report.failedCheck);
 }finally{
  if(browser)await browser.close();
  await stop(listener);
  await Promise.allSettled([...pending]);
  if(proxy)await new Promise(resolve=>{proxy.close(resolve);proxy.closeAllConnections();});
  await stop(app);
  report.finishedAt=new Date().toISOString();
  // Never save raw signed requests, listener secret or provider credentials.
  appLog=appLog.replace(/(?:sk|rk|pk)_(?:test|live)_[A-Za-z0-9_]+|whsec_[A-Za-z0-9_]+|sb_secret_[A-Za-z0-9_-]+/g,'[redacted]');
  await writeFile(new URL('app-'+run+'.log',dir),appLog);
  await writeFile(new URL('report-'+run+'.json',dir),JSON.stringify(report,null,2));
 }
}
