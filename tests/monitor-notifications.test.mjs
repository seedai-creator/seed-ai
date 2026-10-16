import test from 'node:test';
import assert from 'node:assert/strict';
import {newMonitorState,prepareMonitorNotice,deliverMonitorNotice,validateMonitorState} from '../scripts/monitor-notifications.mjs';
const now=Date.parse('2026-10-16T20:00:00.000Z'),key='re_fictitious_monitor_key',config={from:'alertas@auth.appseedai.com',to:'seedtecnologias.suporte@gmail.com'};
const ok=()=>Response.json({id:'00000000-0000-4000-a000-000000000001'});
test('independent monitor sends one outage notice and one recovery, without repeated incident email',async()=>{
 let state=prepareMonitorNotice(newMonitorState(),true,now,config);assert.equal(state.pending,null);
 state=prepareMonitorNotice(state,false,now,config);let sent=0;
 const deliver=async(url,options)=>{sent++;assert.equal(url,'https://api.resend.com/emails');assert.equal(options.redirect,'error');assert.equal(JSON.parse(options.body).to[0],config.to);return ok();};
 state=(await deliverMonitorNotice(state,key,now,deliver)).state;
 assert.equal(state.notified,'unhealthy');
 state=prepareMonitorNotice(state,false,now+600000,config);assert.equal(state.pending,null);
 state=prepareMonitorNotice(state,true,now+1200000,config);
 state=(await deliverMonitorNotice(state,key,now+1200000,deliver)).state;
 assert.equal(state.notified,'healthy');assert.equal(sent,2);assert.equal(state.pending,null);
});
test('unknown delivery retains message/key and uses bounded backoff even if health recovers',async()=>{
 let state=prepareMonitorNotice(newMonitorState(),false,now,config),first;
 state=(await deliverMonitorNotice(state,key,now,async(u,o)=>{first=o;throw Error('PRIVATE_PROVIDER_ERROR');})).state;
 const waiting=await deliverMonitorNotice(state,key,now+1,()=>{throw Error('must not send');});assert.equal(waiting.code,'RETRY_WAIT');
 state=prepareMonitorNotice(state,true,now+600000,{...config,from:'changed@auth.appseedai.com'});
 state=(await deliverMonitorNotice(state,key,now+600000,async(u,o)=>{assert.equal(o.body,first.body);assert.equal(o.headers['Idempotency-Key'],first.headers['Idempotency-Key']);return ok();})).state;
 assert.equal(state.notified,'unhealthy');assert.equal(prepareMonitorNotice(state,true,now+600001,config).pending.target,'healthy');
});
test('permanent rejection, excessive attempts, expired/future delivery and corrupt state fail closed',async()=>{
 const pending=prepareMonitorNotice(newMonitorState(),false,now,config);
 const rejected=await deliverMonitorNotice(pending,key,now,async()=>new Response(null,{status:403}));assert.equal(rejected.code,'DELIVERY_REVIEW_REQUIRED');
 for(const p of [{...pending.pending,attempts:6},{...pending.pending,blocked:true},{...pending.pending,observedAt:new Date(now-24*3600000).toISOString()},{...pending.pending,observedAt:new Date(now+1).toISOString()}])assert.equal((await deliverMonitorNotice({...pending,pending:p},key,now,()=>{throw Error('must not send');})).code,'DELIVERY_REVIEW_REQUIRED');
 for(const state of [{}, {...pending,pending:{...pending.pending,to:'attacker@invalid.test'}},{...pending,pending:{...pending.pending,from:'user@gmail.com'}},{...pending,pending:{...pending.pending,extra:'unsafe'}},{...pending,pending:{...pending.pending,attempts:-1}}])assert.throws(()=>validateMonitorState(state));
});
