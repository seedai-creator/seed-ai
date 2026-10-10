import test from 'node:test';
import assert from 'node:assert/strict';
import {safeLogFields} from '../src/lib/operations/logging';
import {boundedBody,securityHeaders,trustedOrigin} from '../src/lib/operations/http';
import {featureEnabled,externalMode} from '../src/lib/operations/flags';

test('operational logs omit raw errors, documents, credentials and arbitrary values',()=>{
  const result=safeLogFields({requestId:'11111111-1111-4111-8111-111111111111',code:'PROVIDER_TIMEOUT',durationMs:100,password:'private',message:'Revenue details',body:{secret:'private'},model:'sk-'+ 'a'.repeat(40),companyId:'malicious\nrecord',costUsd:NaN});
  assert.deepEqual(result,{requestId:'11111111-1111-4111-8111-111111111111',code:'PROVIDER_TIMEOUT',durationMs:100});
});
test('origin cannot be authorized by forging Host or X-Forwarded-Host',()=>{
  const request=new Request('https://seed.example/api/chat',{headers:{origin:'https://evil.example',host:'evil.example','x-forwarded-host':'evil.example'}});
  assert.equal(trustedOrigin(request,'https://seed.example'),false);
  assert.equal(trustedOrigin(new Request('http://internal/api/chat',{headers:{origin:'https://seed.example'}}),'https://seed.example'),true);
  assert.equal(trustedOrigin(new Request('https://seed.example',{headers:{'sec-fetch-site':'cross-site'}}),'https://seed.example'),false);
});
test('request streaming enforces real bytes and rejects malformed UTF-8',async()=>{
  await assert.rejects(boundedBody(new Request('https://seed.example',{method:'POST',body:'á'.repeat(10)}),10),{code:'TOO_LARGE'});
  await assert.rejects(boundedBody(new Request('https://seed.example',{method:'POST',body:new Uint8Array([0xff,0xff])}),100),{code:'INVALID_ENCODING'});
  assert.equal(await boundedBody(new Request('https://seed.example',{method:'POST',body:'válido'}),20),'válido');
});
test('a slow request has a finite timeout and its stream is cancelled',async()=>{
  let cancelled=false;
  const body=new ReadableStream({cancel(){cancelled=true;}});
  const request=new Request('https://seed.example',{method:'POST',body,duplex:'half'} as RequestInit);
  await assert.rejects(boundedBody(request,100,20),{code:'BODY_TIMEOUT'});
  assert.equal(cancelled,true);
});
test('production headers forbid framing and inline scripts without nonce',()=>{
  const h=securityHeaders('randomNonce',false,true);
  assert.match(h['Content-Security-Policy'],/nonce-randomNonce/);
  assert.doesNotMatch(h['Content-Security-Policy'],/script-src[^;]*unsafe-inline|unsafe-eval/);
  assert.match(h['Content-Security-Policy'],/frame-ancestors 'none'/);
  assert.equal(h['Referrer-Policy'],'strict-origin');
  assert.ok(h['Strict-Transport-Security']);
  assert.equal(securityHeaders('randomNonce',true,false)['Strict-Transport-Security'],undefined);
});
test('flags are explicit and unsupported modes fail closed',()=>{
  assert.equal(featureEnabled('cockpit',{SEED_COCKPIT_ENABLED:'yes'}),false);
  assert.equal(featureEnabled('cockpit',{SEED_COCKPIT_ENABLED:'true'}),true);
  assert.equal(externalMode({SEED_EXTERNAL_MODE:'anything'}),'DISABLED');
});
