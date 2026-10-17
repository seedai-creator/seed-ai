import test from 'node:test';
import assert from 'node:assert/strict';
import {accessEvidence} from '../src/lib/operations/access-retention';
test('access evidence trusts the edge only and excludes all unnecessary data',()=>{
 const headers=new Headers({'x-vercel-forwarded-for':'192.0.2.1','x-forwarded-for':'198.51.100.7',cookie:'private','authorization':'Bearer private'});
 assert.deepEqual(accessEvidence(headers,'/api/chat',{enabled:'true',vercel:'1'}),{ip:'192.0.2.1'});
 assert.throws(()=>accessEvidence(headers,'/',{enabled:'true'}));
 assert.equal(accessEvidence(headers,'/',{enabled:'false'}),null);
 for(const path of ['/seedai','/seedai/pt-BR','/api/internal/health','/api/billing/webhook','/_next/static/chunk.js'])assert.equal(accessEvidence(headers,path,{enabled:'true'}),null);
 for(const value of ['192.0.2.1, 198.51.100.7','192.0.2.0/24','not-an-ip',''])assert.throws(()=>accessEvidence(new Headers({'x-vercel-forwarded-for':value}),'/',{enabled:'true',vercel:'1'}));
 assert.throws(()=>accessEvidence(new Headers({'x-forwarded-for':'198.51.100.7'}),'/',{enabled:'true',vercel:'1'}));
});
