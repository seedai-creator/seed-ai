/** Phase 12, synthetic retained company only. GET/SELECT only, no provider calls or overrides.
 * Compile npm test first; node --conditions=react-server scripts/verify-cockpit-readonly.mjs
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
process.loadEnvFile('.env.local');
const allowedOrigin=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin,nativeFetch=globalThis.fetch;
let reads=0,blocked=0;
globalThis.fetch=async(input,init)=>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url),method=(init?.method??(input instanceof Request?input.method:'GET')).toUpperCase();
 if(url.origin!==allowedOrigin||!['GET','HEAD'].includes(method)){blocked++;throw Error('READ_ONLY_NETWORK_GUARD');}reads++;return nativeFetch(input,init);
};
const require=createRequire(import.meta.url),{loadCockpit,cockpitContext}=require('../.test-build/src/lib/cockpit/server.js'),{viewModel}=require('../.test-build/src/lib/cockpit/aggregate.js');
const company='ad09591a-7a71-42c8-a5d2-125310b585b1',user='faaac0ad-bc77-4388-a3c7-9b13f1430eea';
const report={at:new Date().toISOString(),syntheticOnly:true,readOnly:true,providerCalls:0,changesToPlans:0,checks:[],durationsMs:[],reads:0,passed:false};
try{
 for(const locale of ['pt-BR','pt-PT','en-US','es-ES']){
  const start=performance.now(),state=await loadCockpit(company,user,locale),view=viewModel(state.input,state.candidates);report.durationsMs.push(Math.round(performance.now()-start));assert.equal(view.partial,false,'PARTIAL_'+locale);assert.ok(view.items.length<=3);assert.equal(view.companyId,company);report.checks.push('real_read_'+locale);
  if(locale==='pt-BR'&&view.items[0]){await cockpitContext(company,user,locale,view.items[0].ref);report.checks.push('context_revalidated');}
 }
 await assert.rejects(loadCockpit(company,crypto.randomUUID(),'pt-BR'),/ACCESS_DENIED/);report.checks.push('unknown_member_denied');assert.equal(blocked,0);report.reads=reads;report.passed=true;
}finally{mkdirSync('.test-build',{recursive:true});writeFileSync('.test-build/phase-12-readonly.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
