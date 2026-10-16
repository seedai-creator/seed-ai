import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { completePasswordRecovery, confirmRecovery, validRecoveryToken } from '../src/lib/auth/recovery';
import { recoveryCopy } from '../src/lib/operations/recovery-copy';

function fake(options: { anonymous?: boolean; verifyFailed?: boolean; updateFailed?: boolean; logoutFailed?: boolean } = {}) {
  const calls: Array<{ method: string; args?: unknown }> = [];
  const client = { auth: {
    verifyOtp: async (args: unknown) => { calls.push({method:'verify',args});return {data:options.verifyFailed?{}:{user:{id:'fixture'},session:{}},error:options.verifyFailed?{}:null}; },
    getUser: async () => { calls.push({method:'user'});return {data:{user:options.anonymous?null:{id:'fixture'}},error:null}; },
    updateUser: async () => { calls.push({method:'update'});return {error:options.updateFailed?{}:null}; },
    signOut: async (args: unknown) => { calls.push({method:'logout',args});return {error:options.logoutFailed?{}:null}; },
  }} as unknown as SupabaseClient;
  return {client,calls};
}

test('recovery rejects missing, duplicate, oversized and unsafe tokens before contacting auth', async () => {
  const {client,calls}=fake();
  for (const token of [undefined,null,'',[],['a'.repeat(64)],'a'.repeat(257),'<script>', 'a b'.repeat(20)]) {
    assert.equal(validRecoveryToken(token),false);assert.equal(await confirmRecovery(client,token),false);
  }
  assert.equal(calls.length,0);
});
test('confirmation requests recovery verification and rejects provider failures',async()=>{
  const {client,calls}=fake();const token='a'.repeat(64);
  assert.equal(await confirmRecovery(client,token),true);
  assert.deepEqual(calls,[{method:'verify',args:{token_hash:token,type:'recovery'}}]);
  assert.equal(await confirmRecovery(fake({verifyFailed:true}).client,token),false);
});
test('password validation and authentication run before mutation',async()=>{
  const {client,calls}=fake();
  for(const [password,confirmation] of [['short','short'],['a'.repeat(129),'a'.repeat(129)],['good-password','mismatch']]) {
    assert.deepEqual(await completePasswordRecovery(client,password,confirmation),{status:'invalid'});
  }
  assert.equal(calls.length,0);
  const anonymous=fake({anonymous:true});
  assert.deepEqual(await completePasswordRecovery(anonymous.client,'good-password','good-password'),{status:'expired'});
  assert.deepEqual(anonymous.calls.map(x=>x.method),['user']);
});
test('successful password change revokes all refresh sessions and reports revocation failure',async()=>{
  const {client,calls}=fake();
  assert.deepEqual(await completePasswordRecovery(client,'good-password','good-password'),{status:'updated',userId:'fixture',revocationFailed:false});
  assert.deepEqual(calls.map(x=>x.method),['user','update','logout']);
  assert.deepEqual(calls.at(-1)?.args,{scope:'global'});
  const failed=fake({updateFailed:true});
  assert.deepEqual(await completePasswordRecovery(failed.client,'good-password','good-password'),{status:'failed'});
  assert.equal(failed.calls.some(x=>x.method==='logout'),false);
  assert.deepEqual(await completePasswordRecovery(fake({logoutFailed:true}).client,'good-password','good-password'),{status:'updated',userId:'fixture',revocationFailed:true});
});
test('recovery states have copy in every supported locale',()=>{
  for(const locale of ['pt-BR','pt-PT','en-US','es-ES'] as const){
    const copy=recoveryCopy(locale);
    for(const key of ['continueRecovery','continueDescription','invalidLink','updated'] as const)assert.ok(copy[key].length>10);
  }
});
