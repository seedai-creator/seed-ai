// Opt-in integration test. Uses only the isolated staging project and fictitious
// accounts; never contacts OpenAI or production. The explicit --stripe-network
// option contacts Stripe test mode only. Passwords stay in memory.
import {createClient} from '@supabase/supabase-js';
import {randomUUID,randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {loadStagingEnvironment,stagingDatabaseConfig} from './staging-config.mjs';
import {runStagingWorkers,WorkerCheckFailure} from './staging-workers.mjs';
import {runBoundedStagingLoad,StagingLoadFailure} from './staging-load.mjs';
import {runStagingCommercial,CommercialCheckFailure} from './staging-commercial.mjs';
import {stripeFixtureClient,runStagingStripe,cleanupStripeFixture,StripeCheckFailure} from './staging-stripe.mjs';
import {runStagingStripeWebhook} from './staging-stripe-webhook.mjs';
import {runStagingStripeHosted} from './staging-stripe-hosted.mjs';
import {runStagingProcessors} from './staging-processors.mjs';

const manifestPath=new URL('../.test-build/staging-integration-state.json',import.meta.url);
const workersMode=process.argv.includes('--workers');
const processorsMode=process.argv.includes('--processors');
const loadMode=process.argv.includes('--load');
const commercialMode=process.argv.includes('--commercial');
const webhookMode=process.argv.includes('--stripe-webhook');
const hostedMode=process.argv.includes('--stripe-hosted');
const stripeMode=hostedMode||webhookMode||process.argv.includes('--stripe-network');
const reportName=hostedMode?'staging-stripe-hosted-report.json':processorsMode?'staging-processors-report.json':process.argv.includes('--stripe-renewals')?'staging-stripe-renewals-report.json':webhookMode?'staging-stripe-webhook-report.json':workersMode?'staging-workers-report.json':stripeMode?'staging-stripe-report.json':commercialMode?'staging-commercial-report.json':loadMode?'staging-load-report.json':'staging-integration-report.json';
const reportPath=new URL('../.test-build/'+reportName,import.meta.url);
const report={startedAt:new Date().toISOString(),checks:[],cleanup:false};
let phase='configuration',admin,state,stripe;
class CheckFailure extends Error {}
function requireTrue(value,label){if(!value)throw new CheckFailure(label);}
function data(result,label){requireTrue(!result.error,label);return result.data;}
function denied(result,label){requireTrue(result.error?.code==='42501',label);}
function passed(label){report.checks.push(label);console.log(JSON.stringify({passed:label}));}
async function saveState(){await writeFile(manifestPath,JSON.stringify(state,null,2)+'\n');}
function client(url,key){return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,redirect:'error',signal:AbortSignal.timeout(15000)})}});}

async function cleanup(){
 phase='cleanup';
 if(state.commercial?.stripe){
  report.stripeCleanup=await cleanupStripeFixture(stripe,state.commercial,state.run);
 }
 // Also recover an account whose creation response timed out. Never delete by
 // prefix or user-provided ID alone: match the exact fixture email manifest.
 const fixtures=[];
 for(let page=1;page<=10;page++){
  const list=data(await admin.auth.admin.listUsers({page,perPage:200}),'cleanup_user_lookup');
  fixtures.push(...list.users.filter(user=>state.emails.includes(user.email)));
  if(list.users.length<200)break;
  requireTrue(page<10,'cleanup_user_scan_limit');
 }
 const ids=fixtures.map(user=>user.id);
 if(state.commercial){
  const records=data(await admin.from('subscriptions').select('id,user_id').eq('price_id',state.commercial.priceId),'cleanup_fixture_subscriptions');
  requireTrue(records.every(r=>ids.includes(r.user_id)),'cleanup_foreign_subscription_refused');
  const attempts=data(await admin.from('checkout_attempts').select('id,user_id').eq('price_id',state.commercial.priceId),'cleanup_fixture_checkouts');
  requireTrue(attempts.every(r=>ids.includes(r.user_id)),'cleanup_foreign_checkout_refused');
  data(await admin.from('subscriptions').delete().eq('price_id',state.commercial.priceId),'cleanup_subscriptions');
  data(await admin.from('checkout_attempts').delete().eq('price_id',state.commercial.priceId),'cleanup_checkouts');
  data(await admin.from('commercial_events').delete().in('dedupe_key',state.commercial.eventIds),'cleanup_commercial_events');
  data(await admin.from('billing_events').delete().in('provider_event_id',state.commercial.eventIds),'cleanup_billing_events');
  data(await admin.from('commercial_prices').delete().eq('id',state.commercial.priceId),'cleanup_price');
  requireTrue(data(await admin.from('commercial_prices').select('id').eq('id',state.commercial.priceId),'cleanup_price_check').length===0,'cleanup_price_remaining');
 }
 if(ids.length){
  const memberships=data(await admin.from('company_members').select('company_id').in('user_id',ids),'cleanup_memberships');
  const companyIds=[...new Set(memberships.map(row=>row.company_id))];
  if(companyIds.length){
   const allMembers=data(await admin.from('company_members').select('user_id').in('company_id',companyIds),'cleanup_ownership');
   requireTrue(allMembers.every(row=>ids.includes(row.user_id)),'cleanup_shared_company_refused');
   data(await admin.from('companies').delete().in('id',companyIds),'cleanup_companies');
  }
  // Only audit rows produced by these synthetic users, never operational audit
  // history from real staging participants or any production account.
  data(await admin.from('admin_audit_log').delete().in('actor',ids),'cleanup_fixture_audit');
  for(const user of fixtures)data(await admin.auth.admin.deleteUser(user.id),'cleanup_auth_user');
  const remaining=data(await admin.from('profiles').select('id').in('id',ids),'cleanup_profiles');
  requireTrue(remaining.length===0,'cleanup_profiles_remaining');
  if(companyIds.length)requireTrue(data(await admin.from('companies').select('id').in('id',companyIds),'cleanup_company_verify').length===0,'cleanup_companies_remaining');
 }
 data(await admin.from('beta_invitations').delete().in('email',state.emails),'cleanup_invitations');
 requireTrue(data(await admin.from('beta_invitations').select('email').in('email',state.emails),'cleanup_invite_verify').length===0,'cleanup_invitations_remaining');
 const controls=data(await admin.from('operations_controls').select('*').eq('id',true).single(),'cleanup_controls');
 requireTrue(JSON.stringify(controls)===JSON.stringify(state.controls),'controls_changed_during_test');
 state.status='cleaned';await saveState();report.cleanup=true;
}

try{
 requireTrue(process.argv.includes('--run'),'Use --run to execute the isolated integration test.');
 requireTrue(!process.argv.includes('--stripe-renewals')||webhookMode,'renewals_require_stripe_webhook_mode');
 requireTrue([hostedMode,webhookMode,process.argv.includes('--stripe-network')].filter(Boolean).length<=1,'stripe_modes_are_exclusive');
 requireTrue([loadMode,commercialMode,stripeMode,workersMode,processorsMode].filter(Boolean).length<=1,'run_integration_modes_separately');
 const config=stagingDatabaseConfig(await loadStagingEnvironment());
 report.project=config.project;
 await mkdir(new URL('../.test-build/',import.meta.url),{recursive:true});
 try{const previous=JSON.parse(await readFile(manifestPath,'utf8'));requireTrue(previous.status==='cleaned','previous_test_cleanup_required');}catch(error){if(error.code!=='ENOENT')throw error;}
 admin=client(config.url,config.serverKey);
 if(stripeMode)stripe=await stripeFixtureClient();
 const controls=data(await admin.from('operations_controls').select('*').eq('id',true).single(),'controls_read');
 requireTrue(controls.closed_beta&&controls.disable_ai&&controls.disable_uploads,'staging_must_remain_closed');
 requireTrue(data(await admin.rpc('operations_can_call_ai',{p_feature:'CHAT',p_model:'fixture-model'}),'ai_pause_check')===false,'ai_pause_failed');
 const run=randomUUID();
 state={project:config.project,run,status:'running',controls,emails:['a','b','denied'].map(s=>`seed-fixture-${run}-${s}@example.invalid`)};
 await saveState();
 passed('staging_closed_and_ai_paused');
 phase='fixture_registration';
 const refused=await admin.auth.admin.createUser({email:state.emails[2],password:randomBytes(32).toString('base64url'),email_confirm:true});
 requireTrue(refused.error&&[400,422,500].includes(refused.error.status),'registration_without_invitation_was_not_rejected');
 passed('registration_requires_invitation');
 data(await admin.from('beta_invitations').insert(state.emails.slice(0,2).map(email=>({email,cohort:'FIXTURE-'+run,expires_at:new Date(Date.now()+3600000).toISOString()}))),'fixture_invitations');
 const users=[];
 for(const email of state.emails.slice(0,2)){
  const password=randomBytes(32).toString('base64url');
  const created=data(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:'SEED FIXTURE '+run}}),'fixture_signup');
  const session=client(config.url,config.publicKey);
  data(await session.auth.signInWithPassword({email,password}),'fixture_password_login');
  const profile=data(await session.from('profiles').select('id'),'own_profile');
  requireTrue(profile.length===1&&profile[0].id===created.user.id,'own_profile_isolation');
  const members=data(await session.from('company_members').select('company_id,user_id,role'),'own_membership');
  requireTrue(members.length===1&&members[0].user_id===created.user.id&&members[0].role==='owner','own_membership_isolation');
  requireTrue(data(await session.rpc('operations_user_allowed'),'invitation_access')===true,'invitation_access_failed');
  users.push({id:created.user.id,company:members[0].company_id,session});
 }
 passed('two_real_logins_profiles_memberships_and_invitations');
 const [a,b]=users;
 requireTrue(a.company!==b.company,'companies_must_differ');
 if(process.argv.includes('--password-policy')){
  phase='password_policy';
  const weak=await a.session.auth.updateUser({password:'password123'});
  requireTrue(weak.error?.code==='weak_password','known_leaked_password_not_rejected');
  passed('known_leaked_password_rejected_by_real_auth');
 }
 phase='tenant_isolation';
 const anonymous=client(config.url,config.publicKey);
 denied(await anonymous.from('companies').select('id'),'anonymous_company_read');
 for(const [owner,other] of [[a,b],[b,a]]){
  const own=data(await owner.session.from('companies').select('id'),'own_company_read');
  requireTrue(own.length===1&&own[0].id===owner.company,'own_company_visibility');
  requireTrue(data(await owner.session.from('companies').select('id').eq('id',other.company),'cross_company_read').length===0,'cross_company_leak');
  requireTrue(data(await owner.session.from('companies').update({name:'FORBIDDEN FIXTURE UPDATE'}).eq('id',other.company).select('id'),'cross_company_update').length===0,'cross_company_write');
  denied(await owner.session.from('company_members').insert({company_id:other.company,user_id:owner.id,role:'owner'}),'self_membership_escalation');
 }
 passed('anonymous_and_cross_tenant_reads_writes_denied');
 data(await a.session.rpc('save_company_fact',{p_company_id:a.company,p_key:'segment',p_value:'FICTITIOUS STAGING TEST',p_expected_version:null}),'own_fact_save');
 requireTrue(data(await a.session.from('company_facts').select('id').eq('company_id',a.company),'own_fact_read').length===1,'own_fact_missing');
 requireTrue(data(await b.session.from('company_facts').select('id').eq('company_id',a.company),'cross_fact_read').length===0,'cross_fact_leak');
 denied(await b.session.rpc('save_company_fact',{p_company_id:a.company,p_key:'segment',p_value:'FORBIDDEN',p_expected_version:1}),'cross_fact_rpc_write');
 passed('confirmed_memory_rpc_and_tenant_isolation');
 if(stripeMode){
  phase='stripe_test_network';
  state.commercial={stripe:true,started:Math.floor(Date.now()/1000),productId:'prod_seed_fixture_'+run.replaceAll('-',''),priceId:randomUUID(),eventIds:Array.from({length:3},(_,i)=>'evt_fixture_network_'+run+'_'+i)};
  await saveState();
  report.stripe=await (hostedMode?runStagingStripeHosted:webhookMode?runStagingStripeWebhook:runStagingStripe)(stripe,admin,users,state.commercial,run,saveState);
  passed('stripe_test_network_checkout_subscription_cancellation');
 }
 if(commercialMode){
  phase='commercial_reconciliation';
  state.commercial={priceId:randomUUID(),providerPriceId:'price_fixture_'+run,customerId:'cus_fixture_'+run,
   subscriptionId:'sub_fixture_'+run,eventIds:Array.from({length:7},(_,i)=>'evt_fixture_'+run+'_'+i)};
  await saveState();
  report.commercial=await runStagingCommercial(admin,users,state.commercial);
  passed('real_database_billing_replay_failure_cancellation_and_isolation');
 }
 if(workersMode){phase='worker_coordination';report.workers=await runStagingWorkers(admin,users);passed('bounded_real_worker_concurrency_recovery_and_isolation');}
 if(processorsMode){phase='processor_recovery';report.processors=await runStagingProcessors(admin,users);passed('journal_model_external_persistence_recovery_and_isolation');}
 if(loadMode){
  phase='bounded_load';
  report.load=await runBoundedStagingLoad(admin,users);
  passed('bounded_authenticated_load_isolation_and_concurrent_version_conflicts');
 }
 phase='operations_authorization';
 denied(await a.session.from('operations_controls').update({disable_ai:false}).eq('id',true),'client_cannot_unpause_ai');
 denied(await a.session.rpc('operations_change',{p_actor:a.id,p_kind:'controls',p_key:'disable_ai',p_value:false,p_version:controls.version,p_reason:'FORBIDDEN FIXTURE CHANGE'}),'client_cannot_call_admin_rpc');
 passed('administrative_controls_cannot_be_changed_by_user');
 phase='support_and_revocation';
 const support=data(await a.session.rpc('submit_support_request',{p_company:a.company,p_category:'BUG',p_description:'FICTITIOUS STAGING SUPPORT TEST'}),'own_support');
 requireTrue(data(await b.session.from('support_requests').select('id').eq('id',support),'cross_support_read').length===0,'cross_support_leak');
 denied(await b.session.rpc('submit_support_request',{p_company:a.company,p_category:'BUG',p_description:'FORBIDDEN OTHER COMPANY REQUEST'}),'cross_support_write');
 passed('support_requests_isolated');
 data(await admin.from('beta_access').update({disabled:true}).eq('user_id',a.id),'fixture_revoke');
 requireTrue(data(await a.session.rpc('operations_user_allowed'),'revoked_check')===false,'revoked_access_still_allowed');
 requireTrue(data(await a.session.from('companies').select('id'),'revoked_read').length===0,'revoked_data_still_visible');
 denied(await a.session.rpc('create_company',{company_name:'FORBIDDEN REVOKED FIXTURE'}),'revoked_create_rpc');
 denied(await a.session.rpc('save_company_fact',{p_company_id:a.company,p_key:'segment',p_value:'FORBIDDEN',p_expected_version:1}),'revoked_fact_rpc');
 data(await a.session.rpc('submit_support_request',{p_company:null,p_category:'EXPORT_DATA',p_description:'FICTITIOUS PRIVACY REQUEST AFTER REVOCATION'}),'privacy_after_revocation');
 passed('revocation_blocks_reads_and_rpcs_preserves_privacy_requests');
 data(await admin.from('beta_access').update({expires_at:new Date(Date.now()-60000).toISOString()}).eq('user_id',b.id),'fixture_expiry');
 requireTrue(data(await b.session.rpc('operations_user_allowed'),'expired_check')===false,'expired_access_still_allowed');
 requireTrue(data(await b.session.from('companies').select('id'),'expired_read').length===0,'expired_data_still_visible');
 passed('expired_access_denied');
 report.passed=true;
}catch(error){
 report.passed=false;report.failedPhase=phase;process.exitCode=1;
 if(error instanceof CheckFailure||error instanceof StagingLoadFailure||error instanceof CommercialCheckFailure||error instanceof StripeCheckFailure||error instanceof WorkerCheckFailure)report.failedCheck=error.message;
 if(error instanceof StagingLoadFailure&&error.diagnostics)report.diagnostics=error.diagnostics;
 console.error(JSON.stringify({failedPhase:phase,failedCheck:report.failedCheck,note:'Remote response and credentials omitted.'}));
}finally{
 if(state){try{await cleanup();}catch(error){report.passed=false;report.cleanup=false;state.status='cleanup_required';await saveState();process.exitCode=1;console.error(JSON.stringify({failedPhase:'cleanup',failedCheck:error instanceof CheckFailure?error.message:undefined,note:'Inspect the private fixture manifest before another run.'}));}}
 report.finishedAt=new Date().toISOString();
 await mkdir(new URL('../.test-build/',import.meta.url),{recursive:true});
 await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({checks:report.checks.length,passed:report.passed===true,cleanup:report.cleanup,report:'.test-build/'+reportName}));
}
