import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateHealth,healthAuthorized,healthResponse,backgroundJobsBlocked,queueHealthKeys} from '../src/lib/operations/health';
const token='fictitious_monitor_'.repeat(3),now=Date.parse('2026-10-15T20:00:00Z');
const good=()=>({database:true,lastCron:new Date(now-60000).toISOString(),alertDeliveryBlocked:false,backgroundJobsBlocked:false});
test('health fails closed when cron is absent, stale, invalid or implausibly in the future',()=>{
 assert.equal(evaluateHealth(good(),now).status,'ok');
 for(const value of [null,'invalid',new Date(now-300001).toISOString(),new Date(now+60001).toISOString()])
  assert.equal(evaluateHealth({...good(),lastCron:value},now).status,'degraded');
 assert.equal(evaluateHealth({...good(),database:false},now).status,'degraded');
 assert.equal(evaluateHealth({...good(),alertDeliveryBlocked:true},now).status,'degraded');
 assert.equal(evaluateHealth({...good(),backgroundJobsBlocked:true},now).status,'degraded');
});
test('queue health fails closed on partial or malformed evidence and detects each job family',()=>{
 const zero=Object.fromEntries(queueHealthKeys.map(key=>[key,0]));
 assert.equal(backgroundJobsBlocked(zero),false);
 for(const key of queueHealthKeys){
  assert.equal(backgroundJobsBlocked({...zero,[key]:1}),true);
  for(const value of [undefined,null,'0',-1,0.5,Infinity])assert.throws(()=>backgroundJobsBlocked({...zero,[key]:value}));
 }
 for(const value of [null,{},[],false])assert.throws(()=>backgroundJobsBlocked(value));
});
test('health token is separate, bounded and required before any database access',async()=>{
 assert.equal(healthAuthorized('Bearer '+token,token),true);
 for(const [header,key] of [[null,token],['Bearer '+token,''],['Bearer '+token,undefined],['Bearer wrong',token],['Bearer ü',token],['Bearer short','short']])
  assert.equal(healthAuthorized(header??null,key??undefined),false);
 const result=await healthResponse(new Request('https://example.invalid'),token,async()=>{throw Error('MUST_NOT_READ');});
 assert.equal(result.status,401);assert.equal(await result.text(),'');
});
test('health returns non-cacheable fixed status codes without leaking provider failures',async()=>{
 const request=new Request('https://example.invalid',{headers:{Authorization:'Bearer '+token}});
 const ok=await healthResponse(request,token,async()=>good(),now);
 assert.equal(ok.status,200);assert.equal(ok.headers.get('cache-control'),'no-store');
 const bad=await healthResponse(request,token,async()=>({...good(),lastCron:null}),now);
 assert.equal(bad.status,503);
 const failure=await healthResponse(request,token,async()=>{throw Error('PRIVATE_DATABASE_CONTENT');},now);
 assert.equal(failure.status,503);assert.doesNotMatch(await failure.text(),/PRIVATE/);
});
