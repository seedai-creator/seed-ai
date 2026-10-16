// Explicitly opt-in. Seeds only an EMPTY isolated staging project, without AI,
// email delivery, payment calls or production changes. Retain these fixtures
// until a provider backup includes them; preparing a baseline is NOT a restore.
import {createClient} from '@supabase/supabase-js';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import {loadStagingEnvironment,stagingDatabaseConfig} from './staging-config.mjs';

const directory=new URL('../.test-build/backup-drill/',import.meta.url);
const manifestPath=new URL('manifest.json',directory);
let state,phase='configuration';
class CheckFailure extends Error {}
function check(condition,label){if(!condition)throw new CheckFailure(label);}
function data(result,label){check(!result.error,label);return result.data;}
function canonical(value){
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
  return JSON.stringify(value);
}
function fingerprint(rows){return {count:rows.length,sha256:createHash('sha256').update(canonical(rows.map(canonical).sort())).digest('hex')};}
function client(config,key){return createClient(config.url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,redirect:'error',signal:AbortSignal.timeout(15000)})}});}
async function persist(){
  const temporary=new URL('manifest.tmp',directory);
  await writeFile(temporary,JSON.stringify(state,null,2)+'\n');
  await rename(temporary,manifestPath);
}
const companyTables=['company_members','company_facts','business_memories','business_journal_entries','strategies','actions','metric_definitions','goals','goal_events','goal_metric_links','subscriptions','ai_requests','usage_logs'];
const readableTables=['company_facts','business_memories','business_journal_entries','strategies','actions','metric_definitions','goals','goal_events','goal_metric_links','subscriptions'];

async function snapshot(admin){
  const result={};
  const companies=state.users.map(user=>user.company),ids=state.users.map(user=>user.id);
  for(const table of companyTables){
    const rows=data(await admin.from(table).select('*').in('company_id',companies).limit(200),'snapshot_'+table);
    check(rows.length<200,'snapshot_truncation_'+table);result[table]=fingerprint(rows);
  }
  for(const [table,column,values] of [['companies','id',companies],['profiles','id',ids],['beta_access','user_id',ids],['commercial_accounts','user_id',ids],['beta_invitations','email',state.emails]]){
    result[table]=fingerprint(data(await admin.from(table).select('*').in(column,values),'snapshot_'+table));
  }
  const users=[];
  for(const expected of state.users){
    const {user}=data(await admin.auth.admin.getUserById(expected.id),'snapshot_auth');
    check(user.email===expected.email,'snapshot_auth_identity');
    // Exclude sessions, tokens, password hashes and changing login timestamps.
    users.push({id:user.id,email:user.email,created_at:user.created_at,email_confirmed_at:user.email_confirmed_at});
  }
  result.auth_users=fingerprint(users);
  const buckets=data(await admin.storage.listBuckets(),'storage_inventory');
  check(buckets.length===0,'unexpected_storage_bucket');result.storage_buckets=fingerprint(buckets);
  return result;
}

async function validateIsolation(users){
  for(const [owner,other] of [[users[0],users[1]],[users[1],users[0]]]){
    for(const table of readableTables){
      const own=data(await owner.session.from(table).select('company_id').eq('company_id',owner.company),'own_'+table);
      check(own.length>0,'missing_own_'+table);
      check(data(await owner.session.from(table).select('company_id').eq('company_id',other.company),'foreign_'+table).length===0,'tenant_leak_'+table);
    }
    check(data(await owner.session.from('companies').update({name:'FORBIDDEN FIXTURE WRITE'}).eq('id',other.company).select('id'),'foreign_company_write').length===0,'tenant_write');
    const refused=await owner.session.rpc('save_company_fact',{p_company_id:other.company,p_key:'segment',p_value:'FORBIDDEN FIXTURE WRITE',p_expected_version:1});
    check(refused.error?.code==='42501','tenant_rpc_write');
  }
}

try{
  const mode=process.argv[2];
  check(process.argv.includes('--run')&&['prepare','verify'].includes(mode),'Use prepare or verify followed by --run.');
  const config=stagingDatabaseConfig(await loadStagingEnvironment()),admin=client(config,config.serverKey);
  await mkdir(directory,{recursive:true});
  const controls=data(await admin.from('operations_controls').select('*').eq('id',true).single(),'controls_read');
  check(controls.closed_beta&&controls.disable_ai&&controls.disable_uploads,'staging_must_remain_closed');
  check(data(await admin.rpc('operations_can_call_ai',{p_feature:'CHAT',p_model:'restore-fixture'}),'ai_pause')===false,'ai_not_paused');
  if(mode==='verify'){
    state=JSON.parse(await readFile(manifestPath,'utf8'));
    check(['awaiting_backup','restore_validated'].includes(state.status)&&state.project===config.project,'baseline_not_ready_for_this_project');
    check(canonical(controls)===canonical(state.controls),'controls_changed');
    phase='verify_baseline';const current=await snapshot(admin);
    for(const [table,expected] of Object.entries(state.baseline))check(canonical(current[table])===canonical(expected),'baseline_changed_'+table);
    console.log(JSON.stringify({baselineUnchanged:true,check:'source_baseline_only',restorePreviouslyVerified:state.restoreVerified===true,tables:Object.keys(current).length}));
  }else{
    try{await readFile(manifestPath);throw new CheckFailure('Existing drill manifest: do not overwrite or reseed.');}catch(error){if(error.code!=='ENOENT')throw error;}
    const existing=data(await admin.auth.admin.listUsers({page:1,perPage:1}),'empty_auth_check');
    check(existing.users.length===0,'staging_auth_not_empty');
    check(data(await admin.from('companies').select('id').limit(1),'empty_company_check').length===0,'staging_companies_not_empty');
    check(data(await admin.storage.listBuckets(),'empty_storage_check').length===0,'staging_storage_not_empty');
    const run=randomUUID(),expiresAt=new Date(Date.now()+7*86400000).toISOString();
    state={version:1,project:config.project,run,status:'preparing',startedAt:new Date().toISOString(),controls,expiresAt,emails:['a','b'].map(s=>`seed-restore-${run}-${s}@example.invalid`),users:[],restoreVerified:false};
    await persist();
    phase='fixture_users';
    data(await admin.from('beta_invitations').insert(state.emails.map(email=>({email,cohort:'RESTORE-FIXTURE-'+run,expires_at:expiresAt}))),'fixture_invitations');
    const users=[];
    for(const email of state.emails){
      const password=randomBytes(32).toString('base64url');
      const {user}=data(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:'RESTORE FIXTURE '+run}}),'fixture_signup');
      // Persist each identity immediately; exact emails allow recovery even if a
      // remote creation succeeds but the response times out. Never delete by prefix.
      const identity={id:user.id,email,company:null};state.users.push(identity);await persist();
      const session=client(config,config.publicKey);
      data(await session.auth.signInWithPassword({email,password}),'fixture_password_login');
      const memberships=data(await session.from('company_members').select('company_id,role'),'fixture_membership');
      check(memberships.length===1&&memberships[0].role==='owner','fixture_membership_count');
      identity.company=memberships[0].company_id;await persist();
      data(await admin.from('companies').update({name:'RESTORE FIXTURE '+(users.length?'B':'A')}).eq('id',identity.company),'fixture_company_name');
      data(await admin.from('commercial_accounts').update({market_code:'BR'}).eq('user_id',identity.id),'fixture_account_market');
      users.push({...identity,session});
    }
    phase='business_records';
    const now=new Date(),start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-1,1)).toISOString().slice(0,10),end=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),0)).toISOString().slice(0,10);
    const deadline=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
    const amount=value=>({value,min:null,max:null,approximate:false});
    for(const [index,owner] of users.entries()){
      const label='RESTORE FIXTURE '+(index?'B':'A'),value=index?700:500;
      data(await owner.session.rpc('save_company_fact',{p_company_id:owner.company,p_key:'segment',p_value:label+' — fictitious business',p_expected_version:null}),'fixture_memory');
      data(await admin.from('business_journal_entries').insert({company_id:owner.company,user_id:owner.id,entry_type:'LEARNING',description:label+' — synthetic learning for backup verification',evidence:'Fictitious fixture; not an observed business result.',confidence:'HIGH',source_type:'MANUAL',manual:true,identity_key:'restore-learning-'+run}),'fixture_journal');
      const strategy=randomUUID();
      data(await owner.session.rpc('save_strategy',{p_company_id:owner.company,p_id:strategy,p_draft:{name:label+' plan',objective:'Validate recovery of synthetic business records',situation:'Isolated staging fixture',bottleneck:'Fictitious bottleneck',hypothesis:'Fictitious hypothesis',strategy:'Preserve and compare the backup baseline',review_date:deadline,actions:[{title:label+' action',description:'Compare restored synthetic records',reason:'Verify backup integrity',responsible:'Fictitious owner',deadline,metric:'Matched records',target:'All baseline records'}]}}),'fixture_strategy');
      data(await admin.from('metric_definitions').insert({company_id:owner.company,code:'revenue',name:label+' revenue',unit:'money',metric_type:'CURRENCY',aggregation_method:'SUM'}),'fixture_metric_definition');
      const spec={title:label+' revenue goal',description:'Fictitious backup fixture',type:'GROWTH',direction:'INCREASE',baseline:amount(value),target:amount(value+100),unit:'money',currency:'BRL',period:'MONTH',baseline_start:start,baseline_end:end,start:now.toISOString().slice(0,10),deadline,review_on:null,scope:{type:'COMPANY',id:null},primary_metric:'revenue',primary:true,parent_id:null,plan_id:strategy,reason:'Fictitious backup fixture',success:null,consistency_periods:1,milestones:[],links:[]};
      data(await admin.rpc('save_goal',{p_user:owner.id,p_company:owner.company,p_id:null,p_version:0,p_spec:spec,p_status:'ACTIVE',p_reason:'Fictitious backup fixture',p_source:null,p_key:'restore-goal-'+run,p_timezone:'America/Sao_Paulo',p_locale:'pt-BR'}),'fixture_goal');
      const observation={metric:'revenue',amount:amount(value),boolean:null,text:null,unit:'money',currency:'BRL',period:'MONTH',start,end,complete:true,scope:{type:'COMPANY',id:null},confidence:'HIGH',source:'MANUAL_EDIT',quality:'VALID',attribution:null};
      data(await admin.rpc('record_goal_metric',{p_user:owner.id,p_company:owner.company,p_id:null,p_version:0,p_data:observation,p_description:label+' synthetic revenue',p_evidence:'Fictitious backup fixture',p_source:null,p_key:'restore-metric-'+run}),'fixture_metric');
      const account=data(await admin.from('commercial_accounts').select('market_code').eq('user_id',owner.id).single(),'fixture_market');
      data(await admin.from('subscriptions').insert({user_id:owner.id,company_id:owner.company,plan_code:'FREE',market_code:account.market_code,provider:'manual',provider_subscription_id:'RESTORE_FIXTURE_'+run+'_'+index,status:'canceled',currency:'BRL',amount_minor:0,livemode:false}),'fixture_subscription');
      const request=randomUUID();
      data(await admin.from('ai_requests').insert({id:request,user_id:owner.id,company_id:owner.company,plan_code:'FREE',market_code:account.market_code,status:'COMPLETED',feature:'RESTORE_FIXTURE',fingerprint:run,reserved_usd:0.000001,accounted_usd:0,completed_at:new Date().toISOString()}),'fixture_request');
      data(await admin.from('usage_logs').insert({request_id:request,user_id:owner.id,company_id:owner.company,plan_code:'FREE',market_code:account.market_code,feature:'RESTORE_FIXTURE',provider:'fixture',model:'restore-fixture-no-ai',input_tokens:0,output_tokens:0,total_tokens:0,estimated_total_cost_usd:0,cost_status:'ESTIMATED',status:'FIXTURE',router_decision:{fixture:true,run}}),'fixture_usage');
    }
    phase='isolation';await validateIsolation(users);
    check(canonical(data(await admin.from('operations_controls').select('*').eq('id',true).single(),'controls_after'))===canonical(controls),'controls_changed');
    for(const user of users)data(await user.session.auth.signOut(),'fixture_signout');
    phase='baseline';state.baseline=await snapshot(admin);
    state.lastWriteBeforeBackup=new Date().toISOString();state.status='awaiting_backup';
    state.checks=['two_real_password_logins','business_records_created','ten_tables_isolated_both_directions','cross_tenant_updates_and_rpc_rejected','controls_unchanged','no_storage_buckets','no_ai_email_or_payment_calls'];
    await persist();
    console.log(JSON.stringify({prepared:true,project:config.project,companies:2,tables:Object.keys(state.baseline).length,restoreVerified:false,lastWriteBeforeBackup:state.lastWriteBeforeBackup,manifest:'.test-build/backup-drill/manifest.json'}));
  }
}catch(error){
  if(state?.status==='preparing'){state.status='preparation_failed';state.failedPhase=phase;await persist();}
  console.error(JSON.stringify({failedPhase:phase,failedCheck:error instanceof CheckFailure?error.message:undefined,note:'Secrets and remote response omitted. Inspect the private manifest before retrying.'}));process.exitCode=1;
}
