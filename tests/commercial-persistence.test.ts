import test from 'node:test';
import assert from 'node:assert/strict';
import {persistUsage} from '../src/lib/commercial/persistence';
test('usage retries transport bookkeeping once, without retrying a paid provider',async()=>{
 let calls=0;
 const result=await persistUsage(async()=>({error:++calls===1?{message:'fetch failed'}:null}));
 assert.equal(calls,2);assert.equal(result.error,null);
});
test('usage never retries a constraint failure and bounds persistent transport failure',async()=>{
 let calls=0;
 await persistUsage(async()=>{calls++;return {error:{code:'23514',message:'constraint'}};});assert.equal(calls,1);
 calls=0;
 const result=await persistUsage(async()=>{calls++;return {error:{code:'PGRST000',message:'connection'}};});
 assert.equal(calls,2);assert.equal(result.error?.code,'PGRST000');
});
