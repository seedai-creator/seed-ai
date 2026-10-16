import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
export class StagingLoadFailure extends Error {}

// Small, fixed rehearsal. Authenticated tenant clients are mandatory; service
// credentials seed fixtures but are never used to measure customer reads.
export async function runBoundedStagingLoad(admin,users){
 const check=(v,label)=>{if(!v)throw new StagingLoadFailure(label);};
 const data=(r,label)=>{check(!r.error,label);return r.data;};
 check(users.length===2&&users[0].company!==users[1].company,'two_isolated_fixtures_required');
 const fixtures=[];
 for(const user of users){
  const conversation=randomUUID();fixtures.push({...user,conversation});
  data(await admin.from('conversations').insert({id:conversation,company_id:user.company,user_id:user.id,title:'BOUNDED LOAD FIXTURE'}),'load_conversation');
  // 500 messages + 100 journal entries per company; no model, billing or email.
  for(let batch=0;batch<5;batch++)data(await admin.from('messages').insert(Array.from({length:100},()=>({conversation_id:conversation,request_id:randomUUID(),role:'user',content:'FICTITIOUS LOAD TEST MESSAGE'}))),'load_messages');
  data(await admin.from('business_journal_entries').insert(Array.from({length:100},(_,i)=>({company_id:user.company,user_id:user.id,entry_type:'LEARNING',description:'FICTITIOUS LOAD TEST LEARNING',confidence:'HIGH',source_type:'MANUAL',manual:true,identity_key:'load-'+i}))),'load_journal');
 }
 const samples=[],started=performance.now();
 // At most four simultaneous requests, at most four starts per second, 96 total.
 for(let batch=0;batch<24;batch++){
  const start=performance.now();
  const results=await Promise.all(fixtures.flatMap((owner,i)=>{
   const other=fixtures[1-i];
   const scenario=batch%3;
   const queries=scenario===0?[
    ['own_message_page',()=>owner.session.from('messages').select('id').eq('conversation_id',owner.conversation).order('id').limit(50),50],
    ['cross_tenant_message_page',()=>owner.session.from('messages').select('id').eq('conversation_id',other.conversation).limit(50),0],
   ]:scenario===1?[
    ['own_journal_page',()=>owner.session.from('business_journal_entries').select('id').eq('company_id',owner.company).order('id').limit(50),50],
    ['cross_tenant_journal_page',()=>owner.session.from('business_journal_entries').select('id').eq('company_id',other.company).limit(50),0],
   ]:[
    ['own_company',()=>owner.session.from('companies').select('id').eq('id',owner.company),1],
    ['cross_tenant_company',()=>owner.session.from('companies').select('id').eq('id',other.company),0],
   ];
   return queries.map(async([kind,query,expected])=>{
    const at=performance.now();
    const result=await query();
    check(!result.error&&result.data?.length===expected,'load_isolation_or_response_failed');
    return {kind,durationMs:performance.now()-at};
   });
  }));
  samples.push(...results);
  if(batch<23)await delay(Math.max(0,1000-(performance.now()-start)));
 }
 // Two tabs send the same expected version; exactly one update may succeed.
 const conflicts=await Promise.all(['TAB_A','TAB_B'].map(value=>users[0].session.rpc('save_company_fact',{
  p_company_id:users[0].company,p_key:'segment',p_value:'FICTITIOUS '+value,p_expected_version:1,
 })));
 if(conflicts.filter(r=>!r.error).length!==1||conflicts.filter(r=>r.error?.code==='PT409'&&r.status===409).length!==1){
  const failure=new StagingLoadFailure('lost_update_or_missing_conflict');
  failure.diagnostics=conflicts.map(r=>({status:r.status,code:typeof r.error?.code==='string'&&/^[A-Z0-9]{5,12}$/.test(r.error.code)?r.error.code:null,success:!r.error,
   transportCodes:[...new Set((String(r.error?.details??'')+' '+String(r.error?.message??'')).match(/\b(?:UND_ERR_[A-Z_]+|ECONNRESET|ETIMEDOUT|ENOTFOUND|AbortError|TimeoutError|TypeError)\b/g)??[])],
  }));
  throw failure;
 }
 const fact=data(await users[0].session.from('company_facts').select('version').eq('company_id',users[0].company).eq('key','segment').single(),'load_version');
 check(fact.version===2,'unexpected_update_version');
 const groups=Object.fromEntries([...new Set(samples.map(s=>s.kind))].map(kind=>{
  const times=samples.filter(s=>s.kind===kind).map(s=>s.durationMs).sort((a,b)=>a-b);
  return [kind,{requests:times.length,p50Ms:times[Math.ceil(times.length*.5)-1],p95Ms:times[Math.ceil(times.length*.95)-1],maxMs:times.at(-1)}];
 }));
 return {passed:true,requests:samples.length,concurrency:4,maxStartsPerSecond:4,fixtureCompanies:2,fixtureMessages:1000,fixtureJournalEntries:200,
  elapsedMs:performance.now()-started,groups,conflictingUpdates:'one_committed_one_rejected',paidCalls:0,
  limitations:['Small Auth/PostgREST test with two real staging sessions; not a capacity certification.',
   'Round-trip timings include the local network to staging; not server query durations or production latency.',
   'App rendering, Cockpit, uploads, queue workers, webhooks, Radar and Weekly batches require separate load exercises.']};
}
