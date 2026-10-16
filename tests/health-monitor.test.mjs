import test from 'node:test';
import assert from 'node:assert/strict';
import {checkOperationalHealth} from '../scripts/check-operational-health.mjs';
const env={SEED_HEALTH_URL:'https://appseedai.com/api/internal/health',SEED_HEALTH_TOKEN:'fictitious_monitor_'.repeat(3)};
const good=()=>({status:'ok',checks:['DATABASE','SCHEDULER','ALERT_DELIVERY','BACKGROUND_JOBS'].map(code=>({code,healthy:true}))});
test('external checker cannot transmit its token to an arbitrary host, query, path or redirect',async()=>{
 for(const url of ['https://attacker.invalid/api/internal/health','https://appseedai.com.evil.invalid/api/internal/health','https://appseedai.com/api/internal/journal',env.SEED_HEALTH_URL+'?token=secret'])
  await assert.rejects(checkOperationalHealth({...env,SEED_HEALTH_URL:url},()=>{throw Error('MUST_NOT_FETCH');}));
 const result=await checkOperationalHealth(env,async(url,options)=>{assert.equal(options.redirect,'error');assert.ok(options.signal);return Response.json(good());});
 assert.equal(result.healthy,true);
});
test('external checker rejects maintenance/login HTML, partial success, duplicates and network failures',async()=>{
 for(const response of [new Response('private login HTML'),Response.json({status:'ok'}),Response.json({...good(),checks:[good().checks[0],good().checks[0],good().checks[1]]}),new Response('private',{status:503})])
  assert.equal((await checkOperationalHealth(env,async()=>response)).healthy,false);
 const result=await checkOperationalHealth(env,async()=>{throw Error('PRIVATE_KEY');});
 assert.deepEqual(result,{healthy:false,code:'UNREACHABLE'});
});
