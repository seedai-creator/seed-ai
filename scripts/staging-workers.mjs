import {createHash,randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

export class WorkerCheckFailure extends Error {}
const check=(ok,label)=>{if(!ok)throw new WorkerCheckFailure(label);};
const data=(result,label)=>{check(!result.error,label);return result.data;};

// Bounded coordination rehearsal against the real staging database. Every claim
// is scoped to a manifest-owned fictional company; never claim a global queue.
// No AI providers, plans, global settings, cron or production data are changed.
export async function runStagingWorkers(admin,users){
 check(users.length===2&&users[0].company!==users[1].company,'worker_fixture_isolation');
 const {evaluateGrowth}=await import('../.test-build/src/lib/growth/engine.js');
 const [owner,other]=users,checks=[],samples=[];
 const pass=name=>checks.push(name);
 const queue=()=>admin.rpc('request_growth_map',{p_company:owner.company,p_user:owner.id,p_goal:null,p_scope:'COMPANY',p_scope_id:null,p_manual:false});
 const claim=()=>admin.rpc('claim_growth_map',{p_company:owner.company});
 const radarClaim=()=>admin.rpc('claim_radar_job',{p_company:owner.company});
 const input={company:owner.company,day:'2026-10-16',timezone:'America/Sao_Paulo',scope:{type:'COMPANY',id:null},goalId:null,goals:[],observations:[],entities:[],structural:[],relations:[],constraints:[],context:[],external:[],limited:false,currency:null};
 const payload=evaluateGrowth(input),hash=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
 check(payload.status==='LIMITED'&&payload.dimensions.every(d=>d.current===null),'empty_fixture_fabricates_metrics');
 const finish=(job)=>admin.rpc('finish_growth_map',{p_request:job.id,p_lease:job.lease_token,p_generation:job.generation,p_hash:hash,p_payload:payload,p_latency:0});
 const finishRadar=job=>admin.rpc('apply_radar_job',{p_company:owner.company,p_lease:job.lease_token,p_generation:job.generation,p_signals:[],p_insights:[],p_recoveries:[],p_complete:true,p_latency:0});
 async function contenders(fn,label){
  const start=performance.now();const responses=await Promise.all(Array.from({length:4},()=>fn()));
  const rows=responses.flatMap(r=>data(r,label));samples.push({kind:label,ms:performance.now()-start});
  check(rows.length===1,label+'_one_lease_required');
  check(rows[0].company_id===owner.company,label+'_wrong_tenant');
  return rows[0];
 }
 for(const rpc of ['claim_growth_map','claim_radar_job']){
  const denied=await owner.session.rpc(rpc,{p_company:owner.company});check(denied.error?.code==='42501','worker_rpc_exposed_to_customer');
 }
 pass('worker_claims_require_server_role');
 let requestId,snapshot;
 for(let round=0;round<8;round++){
  requestId=data(await queue(),'queue_growth');
  const job=await contenders(claim,'growth_concurrency');
  const result=data(await finish(job),'growth_finish');snapshot??=result;
  check(result===snapshot,'same_input_duplicate_snapshot');
  // At most four competing claims per second; each round is bounded and awaited.
  if(round<7)await delay(1000);
 }
 check(data(await admin.from('growth_map_snapshots').select('id').eq('company_id',owner.company),'snapshot_count').length===1,'growth_duplicate_persistence');
 pass('eight_rounds_four_workers_one_owner_and_one_reused_snapshot');
 data(await queue(),'queue_expiry');const old=data(await claim(),'claim_before_expiry')[0];check(old,'missing_old_lease');
 data(await admin.from('growth_map_requests').update({lease_until:new Date(Date.now()-1000).toISOString()}).eq('id',requestId).eq('company_id',owner.company),'expire_fixture_growth_lease');
 const retry=await contenders(claim,'growth_recovery');check(old.lease_token!==retry.lease_token,'growth_token_reused');
 check(!!(await finish(old)).error,'expired_growth_writer_accepted');data(await finish(retry),'recovered_growth_finish');
 pass('expired_growth_lease_recovers_and_rejects_old_writer');
 data(await queue(),'queue_changed_generation');const outdated=data(await claim(),'claim_changed_generation')[0];
 data(await queue(),'invalidate_inflight_generation');check(data(await finish(outdated),'outdated_finish')===null,'outdated_generation_committed');
 const refreshed=data(await claim(),'claim_new_generation')[0];check(refreshed?.generation>outdated.generation,'new_generation_not_requeued');data(await finish(refreshed),'finish_new_generation');
 pass('changed_inputs_discard_outdated_work_and_requeue');
 data(await queue(),'queue_backoff');data(await admin.from('growth_map_requests').update({next_at:new Date(Date.now()+60000).toISOString()}).eq('id',requestId).eq('company_id',owner.company),'future_backoff');
 check(data(await claim(),'claim_future').length===0,'future_retry_claimed');
 data(await admin.from('growth_map_requests').update({next_at:new Date(Date.now()-1000).toISOString(),attempts:4}).eq('id',requestId).eq('company_id',owner.company),'retry_ceiling');
 check(data(await claim(),'claim_exhausted').length===0,'retry_limit_ignored');
 pass('retry_delay_and_attempt_ceiling_respected');
 for(let round=0;round<4;round++){
  data(await admin.from('radar_company_state').upsert({company_id:owner.company,next_scan_at:new Date(Date.now()-1000).toISOString()}),'queue_radar');
  const job=await contenders(radarClaim,'radar_concurrency');
  check(!!(await finishRadar({...job,lease_token:randomUUID()})).error,'wrong_radar_token_accepted');data(await finishRadar(job),'finish_radar');
  if(round<3)await delay(1000);
 }
 pass('four_radar_rounds_one_owner_wrong_token_rejected');
 data(await admin.from('radar_company_state').update({next_scan_at:new Date(Date.now()-1000).toISOString()}).eq('company_id',owner.company),'queue_radar_expiry');
 const oldRadar=data(await radarClaim(),'claim_radar_old')[0];
 data(await admin.from('radar_company_state').update({lease_until:new Date(Date.now()-1000).toISOString()}).eq('company_id',owner.company),'expire_radar_lease');
 const newRadar=await contenders(radarClaim,'radar_recovery');check(oldRadar.lease_token!==newRadar.lease_token,'radar_token_reused');
 check(!!(await finishRadar(oldRadar)).error,'expired_radar_writer_accepted');data(await finishRadar(newRadar),'finish_radar_retry');
 check(data(await radarClaim(),'radar_not_due').length===0,'completed_radar_immediate_repeat');
 pass('expired_radar_recovers_and_preserves_next_schedule');
 check(data(await other.session.from('growth_map_snapshots').select('id').eq('company_id',owner.company),'foreign_growth_read').length===0,'worker_result_cross_tenant_leak');
 check(data(await admin.from('radar_insights').select('id').eq('company_id',owner.company),'no_false_insights').length===0,'empty_fixture_created_insight');
 pass('results_remain_tenant_isolated_and_no_invented_insights');
 return {passed:true,checks,rounds:12,contendingWorkers:4,claimAttempts:samples.length*4,paidCalls:0,planChanges:0,samples,
  limitations:['Database worker coordination and deterministic Growth calculation, not complete scheduler/provider execution.',
   'Two fictional companies and limited concurrency; not a user capacity or latency guarantee.',
   'Journal, external research, Business Model processing and file-upload saturation remain separate release checks.']};
}
