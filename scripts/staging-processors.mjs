// Deterministic provider-output fixtures exercise actual hosted persistence,
// locking and recovery. They do not claim to test AI extraction or web search.
import {randomUUID} from 'node:crypto';
import {WorkerCheckFailure} from './staging-workers.mjs';
const check=(ok,label)=>{if(!ok)throw new WorkerCheckFailure(label);};
const data=(r,label)=>{check(!r.error,label);return r.data;};
export async function runStagingProcessors(admin,[owner,other]){
 const {candidate}=await import('../.test-build/tests/journal-fixtures.js');
 const {normalizeExtraction}=await import('../.test-build/src/lib/journal/domain.js');
 const checks=[],samples=[];
 const company=owner.company,conversation=randomUUID();let version=0;
 const journalClaim=()=>admin.rpc('claim_journal_job',{p_company:company});
 const modelProcess=()=>admin.rpc('process_business_model_job',{p_company:company});
 async function compete(call,label,one=true){
  const start=performance.now();const rows=(await Promise.all(Array.from({length:4},call))).map(r=>data(r,label));
  samples.push({label,ms:performance.now()-start});
  if(one){const flat=rows.flat();check(flat.length===1,label+'_duplicate_claim');return flat[0];}
  return rows;
 }
 async function turn(message,skip=false){
  const request=randomUUID();
  data(await admin.rpc('commit_seed_turn_v93',{p_user:owner.id,p_company:company,p_conversation:conversation,p_request:request,p_version:version++,p_message:message,p_answer:'FICTITIOUS PROCESSOR QA',p_diagnosis:null,p_memories:[],p_skip_journal:skip}),'processor_turn');
  return data(await admin.from('messages').select('id,created_at').eq('conversation_id',conversation).eq('request_id',request).eq('role','user').single(),'processor_message');
 }
 const model={entities:[{key:'t',scope:'CURRENT_COMPANY',type:'TEAM',name:'Equipe comercial',canonical_name:'equipe comercial',reference_id:null,existing_id:null,version:null,evidence:'Equipe comercial 4'}],observations:[{entity:'t',attribute:'count',data:{text:null,value:4,min:null,max:null,unit:'people',currency:null,approximate:false,period_start:null,period_end:null},kind:'FACT',confidence:'HIGH',evidence:'Equipe comercial 4',operation:'NEW',observed_on:null,structural:true,memory_id:null}],relationships:[]};
 // claim_journal_job also marks old running work UNKNOWN globally. Refuse to
 // touch a staging run with any unrelated expired work rather than mutate it.
 check(data(await admin.from('journal_jobs').select('id').eq('status','RUNNING').lt('locked_at',new Date(Date.now()-300000).toISOString()),'expired_preflight').length===0,'unrelated_expired_journal_work');
 for(const [rpc,args] of [['claim_journal_job',{p_company:company}],['process_business_model_job',{p_company:company}],['claim_external_job',{p_run:randomUUID()}]])check((await owner.session.rpc(rpc,args)).error?.code==='42501','processor_rpc_exposed');
 checks.push('all_three_processor_rpcs_refuse_client_access');
 for(let round=0;round<4;round++){
  const text='18 interessados. Equipe comercial 4',message=await turn(text);
  const job=await compete(journalClaim,'journal_concurrency');check(job.company_id===company&&job.source_message_id===message.id,'journal_source_mismatch');
  const payload=normalizeExtraction({entries:[candidate]},text,new Date(message.created_at),'UTC',[]);
  data(await admin.from('journal_jobs').update({payload,model_payload:model}).eq('id',job.id).eq('company_id',company),'journal_payload');
  const apply=lease=>admin.rpc('apply_journal_extraction',{p_job:job.id,p_lease:lease});
  check(!!(await apply(randomUUID())).error,'journal_wrong_lease_accepted');
  for(const result of await Promise.all([apply(job.lease_token),apply(job.lease_token)]))data(result,'journal_apply_replay');
  const outcomes=await compete(modelProcess,'model_concurrency',false);
  check(outcomes.filter(value=>value==='COMPLETED').length===1&&outcomes.every(value=>['COMPLETED','EMPTY'].includes(value)),'model_duplicate_processing');
 }
 const entries=data(await admin.from('business_journal_entries').select('id,value').eq('company_id',company),'journal_result');
 check(entries.length===1&&Number(entries[0].value)===18,'journal_duplicate_metric');
 const observations=data(await admin.from('business_observations').select('id,data').eq('company_id',company).eq('is_current',true),'model_result');
 check(observations.length===1&&observations[0].data.value===4,'model_duplicate_observation');
 checks.push('four_rounds_concurrent_journal_to_model_exact_source_no_duplicate_metric');
 const invalidSource=await turn('Equipe comercial 4',true),bad=structuredClone(model);bad.entities[0].scope='OTHER_COMPANY';
 const badJob=data(await admin.from('business_model_jobs').insert({company_id:company,user_id:owner.id,source_message_id:invalidSource.id,payload:bad}).select('id').single(),'invalid_model_fixture');
 check(data(await modelProcess(),'model_retry')==='RETRY','invalid_model_not_retried');
 const retry=data(await admin.from('business_model_jobs').select('status,attempts,available_at').eq('id',badJob.id).single(),'model_retry_state');
 check(retry.status==='QUEUED'&&retry.attempts===1&&Date.parse(retry.available_at)>Date.now(),'model_retry_backoff_missing');
 check(data(await modelProcess(),'model_backoff')==='EMPTY','model_backoff_ignored');
 data(await admin.from('business_model_jobs').update({payload:model,available_at:new Date(Date.now()-1000).toISOString()}).eq('id',badJob.id).eq('company_id',company),'model_correct_fixture');
 check(data(await modelProcess(),'model_recovery')==='COMPLETED','model_recovery_failed');
 checks.push('invalid_model_rolls_back_waits_and_recovers_after_valid_correction');
 await turn('18 interessados');const expired=data(await journalClaim(),'expired_claim')[0];
 data(await admin.from('journal_jobs').update({locked_at:new Date(Date.now()-360000).toISOString(),payload:[]}).eq('id',expired.id).eq('company_id',company),'expire_own_lease');
 check(data(await journalClaim(),'expired_retry').length===0,'unknown_provider_call_repeated');
 check(data(await admin.from('journal_jobs').select('status').eq('id',expired.id).single(),'unknown_read').status==='UNKNOWN','expired_work_not_unknown');
 check(!!(await admin.rpc('apply_journal_extraction',{p_job:expired.id,p_lease:expired.lease_token})).error,'expired_journal_writer_accepted');
 checks.push('expired_journal_call_becomes_unknown_without_automatic_second_charge');
 for(let round=0;round<3;round++){
  const run=randomUUID();
  // Insert clearly marked, isolated worker fixtures: live research remains off.
  data(await admin.from('external_research_runs').insert({id:run,company_id:company,user_id:owner.id,request_id:randomUUID(),trigger_type:'PRICE_CHECK',depth:'QUICK',sanitized_query:'FICTITIOUS QUEUE QA '+round,cache_key:'fixture-'+run,locale:'pt-BR',market_code:'BR'}),'external_fixture');
  data(await admin.from('external_research_jobs').insert({run_id:run,company_id:company,plan:{fixture:true},internal_context:'FICTITIOUS PRIVATE CONTEXT'}),'external_job_fixture');
  const claim=()=>admin.rpc('claim_external_job',{p_run:run});
  const old=await compete(claim,'external_concurrency');
  data(await admin.from('external_research_jobs').update({lease_until:new Date(Date.now()-1000).toISOString()}).eq('run_id',run).eq('company_id',company),'external_expiry');
  const current=await compete(claim,'external_recovery');check(old.lease_token!==current.lease_token,'external_token_reused');
  const report={sources:[{id:'S1',url:'https://example.invalid/fixture'}],claims:[{id:'C1',text:'FICTITIOUS',sourceIds:['S1']}],partial:true};
  const finish=(lease,payload)=>admin.rpc('finish_external_job',{p_run:run,p_lease:lease,p_report:payload,p_answer:'FICTITIOUS QA',p_ttl:0});
  check(!!(await finish(old.lease_token,report)).error,'external_old_writer_accepted');
  const invalid={...report,claims:[{...report.claims[0],sourceIds:['MISSING']}]};
  check(!!(await finish(current.lease_token,invalid)).error,'orphan_citation_accepted');
  check(data(await admin.from('external_sources').select('id').eq('research_run_id',run),'external_rollback').length===0,'invalid_report_partial_write');
  data(await finish(current.lease_token,report),'external_finish');
  const done=data(await admin.from('external_research_jobs').select('internal_context,provider_state,evidence,lease_token').eq('run_id',run).single(),'external_done');
  check(done.internal_context===''&&done.provider_state===null&&done.evidence===null&&done.lease_token===null,'external_private_context_retained');
  check(data(await claim(),'external_repeat').length===0,'external_completed_reclaimed');
 }
 checks.push('three_external_rounds_leases_rollback_citations_and_private_context_erasure');
 for(const table of ['business_journal_entries','business_entities','business_observations','external_research_runs','external_sources','external_claims'])check(data(await other.session.from(table).select('*').eq('company_id',company),'processor_cross_tenant').length===0,'processor_result_leak');
 checks.push('all_processor_results_remain_isolated');
 return {passed:true,checks,samples,paidCalls:0,globalControlChanges:0,limitations:['Deterministic, explicitly fictional provider outputs; AI extraction and live research are not executed.', 'Four contenders, four journal/model rounds and three research rounds; not a production capacity guarantee.', 'Queue scheduler deployment, upload handling and migration ledger remain separate checks.']};
}
