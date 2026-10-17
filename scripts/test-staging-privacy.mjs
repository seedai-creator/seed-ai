// Fictional staging rehearsal only. NOT a production erasure procedure or a
// retention policy. Never accepts user/company IDs, credentials or a target URL.
import {createClient} from '@supabase/supabase-js';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {loadStagingEnvironment,stagingDatabaseConfig} from './staging-config.mjs';
import {inspectPrivacyRequest} from './privacy-review.mjs';

const directory=new URL('../.test-build/privacy-drill/',import.meta.url);
const manifest=new URL('state.json',directory),reportPath=new URL('report.json',directory);
const report={startedAt:new Date().toISOString(),checks:[],passed:false,cleanup:false,
 limitations:['Fictional records only; no real retention or erasure decision.',
  'Direct foreign keys are inventoried; embedded content, backups, providers and Storage need separate review.',
  'Existing access JWTs may remain valid until expiry; data access must also be revoked.',
  'Shared facts are preserved with a null confirmer; private conversations are explicitly removed only under the fixture scenario.']};
let admin,state,phase='configuration';
class CheckFailure extends Error {}
const check=(value,label)=>{if(!value)throw new CheckFailure(label);};
const data=(result,label)=>{check(!result.error,label);return result.data;};
const pass=label=>{report.checks.push(label);console.log(JSON.stringify({passed:label}));};
const save=()=>writeFile(manifest,JSON.stringify(state,null,2)+'\n');
const client=(config,key,token)=>createClient(config.url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{
 ...(token?{headers:{Authorization:'Bearer '+token}}:{}),
 fetch:(url,init)=>fetch(url,{...init,redirect:'error',signal:AbortSignal.timeout(15000)})}});

async function removeFixtureFinancialRows(user){
 // All rows belong to identities created by this run. No Stripe/AI provider was called.
 for(const [table,column] of [['usage_logs','user_id'],['ai_requests','user_id'],['subscriptions','user_id'],['admin_audit_log','actor'],['commercial_events','user_id'],['operational_events','user_id']]){
  data(await admin.from(table).delete().eq(column,user.id),'fixture_cleanup_'+table);
 }
}
async function clean(){
 if(!state||!admin)return;
 // Exact randomized emails also recover an Auth creation whose response timed out.
 const found=data(await admin.auth.admin.listUsers({page:1,perPage:1000}),'cleanup_lookup').users;
 check(found.length<1000,'cleanup_lookup_truncated');
 const ours=found.filter(user=>state.emails.includes(user.email));
 const ids=ours.map(u=>u.id);
 const memberships=ids.length?data(await admin.from('company_members').select('company_id').in('user_id',ids),'cleanup_memberships'):[];
 const companies=[...new Set([...state.users.map(u=>u.company).filter(Boolean),...memberships.map(m=>m.company_id)])];
 if(companies.length){
  const all=data(await admin.from('company_members').select('user_id').in('company_id',companies),'cleanup_company_owners');
  check(all.every(m=>ids.includes(m.user_id)),'cleanup_nonfixture_member_refused');
 }
 for(const user of ours)await removeFixtureFinancialRows(user);
 if(companies.length)data(await admin.from('companies').delete().in('id',companies),'cleanup_companies');
 for(const user of ours)data(await admin.auth.admin.deleteUser(user.id),'cleanup_auth');
 data(await admin.from('beta_invitations').delete().in('email',state.emails),'cleanup_invitations');
 const after=data(await admin.auth.admin.listUsers({page:1,perPage:1000}),'cleanup_auth_verify').users;
 check(after.length<1000&&!after.some(u=>state.emails.includes(u.email)),'cleanup_auth_remaining');
 check(state.baselineUserIds.every(id=>after.some(u=>u.id===id)),'existing_auth_changed');
 check(JSON.stringify(data(await admin.from('operations_controls').select('*').eq('id',true).single(),'cleanup_controls'))===JSON.stringify(state.controls),'controls_changed');
 state.status='cleaned';await save();report.cleanup=true;
}

try{
 check(process.argv.length===3&&process.argv[2]==='--run','explicit_run_required');
 const config=stagingDatabaseConfig(await loadStagingEnvironment());
 admin=client(config,config.serverKey);
 await mkdir(directory,{recursive:true});
 try{
  const previous=JSON.parse(await readFile(manifest,'utf8'));
  check(previous.status==='cleaned','previous_cleanup_required');
  // Preserve even failed test evidence before a new, fully cleaned rehearsal.
  if(/^[0-9a-f-]{36}$/i.test(previous.run))await writeFile(new URL(previous.run+'.json',directory),await readFile(reportPath));
 }catch(error){if(error.code!=='ENOENT')throw error;}
 const controls=data(await admin.from('operations_controls').select('*').eq('id',true).single(),'controls');
 check(controls.closed_beta&&controls.disable_ai&&controls.disable_uploads,'staging_not_paused');
 const existing=data(await admin.auth.admin.listUsers({page:1,perPage:1000}),'baseline_users').users;
 check(existing.length<990,'baseline_lookup_truncated');
 const run=randomUUID();
 state={project:config.project,run,status:'running',controls,baselineUserIds:existing.map(u=>u.id),
  emails:['a','b'].map(s=>`seed-privacy-${run}-${s}@example.invalid`),users:[]};await save();
 data(await admin.from('beta_invitations').insert(state.emails.map(email=>({email,cohort:'PRIVACY-FIXTURE-'+run,expires_at:new Date(Date.now()+3600000).toISOString()}))),'invitations');
 const users=[];
 phase='fictional_accounts';
 for(const email of state.emails){
  const password=randomBytes(32).toString('base64url');
  const {user}=data(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:'PRIVACY FIXTURE'}}),'create_user');
  const identity={id:user.id,email,company:null};state.users.push(identity);await save();
  const db=client(config,config.publicKey);
  const {session}=data(await db.auth.signInWithPassword({email,password}),'password_login');
  const membership=data(await db.from('company_members').select('company_id,role'),'membership');
  check(membership.length===1&&membership[0].role==='owner','sole_owner_expected');
  identity.company=membership[0].company_id;await save();
  users.push({...identity,db,session});
 }
 const [leaving,remaining]=users,shared=remaining.company;
 data(await admin.from('company_members').insert({company_id:shared,user_id:leaving.id,role:'member'}),'shared_membership');
 const fact=randomUUID(),privateConversation=randomUUID(),sharedConversation=randomUUID(),aiRequest=randomUUID();
 data(await admin.from('company_facts').insert({id:fact,company_id:shared,key:'segment',value:'FICTIONAL_SHARED_FACT',confirmed_by:leaving.id}),'shared_fact');
 data(await admin.from('conversations').insert([{id:privateConversation,company_id:shared,user_id:leaving.id,title:'FICTIONAL_PRIVATE_CHAT'},
  {id:sharedConversation,company_id:shared,user_id:remaining.id,title:'FICTIONAL_REMAINING_CHAT'}]),'fixture_conversations');
 data(await admin.from('commercial_accounts').update({market_code:'BR'}).eq('user_id',leaving.id),'fixture_market');
 data(await admin.from('ai_requests').insert({id:aiRequest,user_id:leaving.id,company_id:leaving.company,plan_code:'FREE',market_code:'BR',status:'RESERVED',reserved_usd:0.000001,feature:'PRIVACY_FIXTURE_NO_AI'}),'fixture_request');
 data(await admin.from('subscriptions').insert({user_id:leaving.id,company_id:leaving.company,plan_code:'FREE',market_code:'BR',provider:'manual',provider_subscription_id:'PRIVACY_FIXTURE_'+run,status:'canceled',currency:'BRL',amount_minor:0,livemode:false}),'fixture_subscription');
 const request=data(await leaving.db.rpc('submit_support_request',{p_company:null,p_category:'DELETE_ACCOUNT',p_description:'Fictional staging privacy rehearsal only.'}),'deletion_request');
 phase='inventory';
 const inventory=await inspectPrivacyRequest(admin,request);
 check(inventory.automaticDeletionAllowed===false&&inventory.activeJobCount===1&&inventory.subscriptionCount===1,'dependency_inventory');
 check(inventory.companies.find(c=>c.companyId===shared)?.handling==='PRESERVE_SHARED_COMPANY','shared_company_review');
 check(inventory.requiredReviews.includes('REVIEW_FINANCIAL_RETENTION'),'financial_retention_review');
 check(inventory.dependencies.foreignKeys.some(d=>d.table==='conversations'&&d.count===1),'authorship_inventory');
 await writeFile(new URL('inventory.json',directory),JSON.stringify(inventory,null,2)+'\n');
 const outsider=await remaining.db.rpc('privacy_deletion_dependencies',{p_request:request});
 check(outsider.error?.code==='42501','inventory_client_access_refused');
 pass('real_auth_inventory_detects_financial_work_shared_authorship_and_blocks_client_inspection');
 const refused=await admin.auth.admin.deleteUser(leaving.id);
 check(Boolean(refused.error),'unreviewed_deletion_must_fail');
 check(Boolean(data(await admin.auth.admin.getUserById(leaving.id),'subject_still_exists').user),'failed_deletion_preserves_account');
 check(data(await admin.from('conversations').select('id').eq('id',privateConversation),'private_chat_after_failure').length===1,'failed_delete_preserves_content');
 pass('financial_foreign_keys_prevent_blind_deletion_and_preserve_data');
 phase='revoke_fixture_access';
 const oldAccess=client(config,config.publicKey,leaving.session.access_token);
 data(await admin.from('beta_access').update({disabled:true}).eq('user_id',leaving.id),'disable_fixture');
 const signout=await admin.auth.admin.signOut(leaving.session.access_token,'global');
 check(!signout.error,'revoke_refresh_sessions');
 check(data(await oldAccess.from('company_facts').select('id').eq('company_id',shared),'revoked_jwt_read').length===0,'revoked_jwt_leaks');
 check(Boolean((await oldAccess.rpc('save_company_fact',{p_company_id:shared,p_key:'city',p_value:'FORBIDDEN FIXTURE',p_expected_version:null})).error),'revoked_jwt_write');
 pass('existing_access_jwt_cannot_read_or_write_business_data_after_revocation');
 phase='restore_suppression_replay';
 // Logical snapshot rehearsal, separate from the earlier physical restore.
 // Keep the minimal suppression ledger OUTSIDE the database being restored.
 const snapshot=data(await admin.from('conversations').select('*').eq('id',privateConversation).single(),'snapshot_private_fixture');
 const suppression={version:1,project:config.project,userId:leaving.id,conversationId:privateConversation,companyId:shared};
 const ledger=new URL('suppression-'+run+'.json',directory);
 await writeFile(ledger,JSON.stringify(suppression,null,2)+'\n');
 data(await admin.from('conversations').delete().eq('id',privateConversation).eq('user_id',leaving.id),'suppress_before_restore');
 data(await admin.from('conversations').insert(snapshot),'restore_old_private_fixture');
 // Never reopen access between restoration and replay. Production restoration
 // must also remain behind the public gate with jobs disabled throughout.
 const replay=JSON.parse(await readFile(ledger,'utf8'));
 check(replay.project===config.project&&replay.userId===leaving.id&&replay.conversationId===privateConversation&&replay.companyId===shared,'suppression_scope_mismatch');
 data(await admin.from('beta_access').update({disabled:true}).eq('user_id',replay.userId),'replay_disabled_access');
 data(await admin.from('conversations').delete().eq('id',replay.conversationId).eq('user_id',replay.userId).eq('company_id',replay.companyId),'replay_private_erasure');
 check(data(await admin.from('conversations').select('id').eq('id',privateConversation),'verify_replayed_erasure').length===0,'restored_private_content_remains');
 check(data(await oldAccess.from('company_facts').select('id').eq('company_id',shared),'verify_replayed_access').length===0,'restored_access_leaks');
 check(data(await remaining.db.from('conversations').select('id').eq('id',sharedConversation),'verify_unaffected_shared_chat').length===1,'restore_replay_deleted_other_member');
 pass('logical_snapshot_suppression_replayed_from_external_ledger_with_access_closed_and_shared_chat_preserved');
 phase='reviewed_fixture_cleanup';
 // This deliberately disposes fictitious financial rows. Real financial retention
 // and provider subscriptions require an independently approved manual decision.
 await removeFixtureFinancialRows(leaving);
 // Conversations use a restrictive author FK. The fixture owner explicitly
 // removes only this private test chat; never reassign authorship to another user.
 data(await admin.from('conversations').delete().eq('id',privateConversation).eq('user_id',leaving.id),'delete_private_fixture_chat');
 data(await admin.from('company_members').delete().eq('company_id',shared).eq('user_id',leaving.id),'leave_shared');
 check(data(await admin.from('company_members').select('user_id').eq('company_id',leaving.company),'exclusive_company_check').every(m=>m.user_id===leaving.id),'exclusive_company_became_shared');
 data(await admin.from('companies').delete().eq('id',leaving.company),'delete_exclusive_fixture');
 data(await admin.auth.admin.deleteUser(leaving.id),'delete_fixture_account');
 const preserved=data(await remaining.db.from('company_facts').select('value,confirmed_by').eq('id',fact).single(),'remaining_member_fact');
 check(preserved.value==='FICTIONAL_SHARED_FACT'&&preserved.confirmed_by===null,'shared_fact_changed');
 check(data(await remaining.db.from('conversations').select('id').eq('id',sharedConversation),'remaining_chat').length===1,'remaining_chat_missing');
 check(data(await admin.from('conversations').select('id').eq('id',privateConversation),'deleted_private_chat').length===0,'private_chat_remains');
 check(data(await oldAccess.from('company_facts').select('id').eq('company_id',shared),'deleted_jwt').length===0,'deleted_jwt_leaks');
 const refreshed=await client(config,config.publicKey).auth.refreshSession({refresh_token:leaving.session.refresh_token});
 check(Boolean(refreshed.error)&&!refreshed.data.session,'deleted_session_refresh');
 const anonymous=client(config,config.publicKey);
 const anonInventory=await anonymous.rpc('privacy_deletion_dependencies',{p_request:request});
 check(anonInventory.error?.code==='42501','anonymous_inventory_refused');
 pass('shared_company_fact_and_other_member_chat_preserved_after_account_deletion');
 pass('deleted_private_chat_and_refresh_session_removed_old_jwt_has_no_business_access');
 report.passed=true;
}catch(error){
 report.failure={phase,check:error instanceof CheckFailure?error.message:'Remote detail omitted'};
 process.exitCode=1;
}finally{
 try{await clean();}catch(error){report.cleanupFailure=error instanceof CheckFailure?error.message:'Cleanup failed; inspect private manifest';process.exitCode=1;}
 report.finishedAt=new Date().toISOString();
 await mkdir(directory,{recursive:true});await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
 if(state)await writeFile(new URL(state.run+'.json',directory),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}
