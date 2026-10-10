/** Phase 9.8. Default: read-only schema check. Paid calls require --live-authorized.
 * Run with --conditions=react-server after compiling tsconfig.external-live.json.
 * Credentials remain in .env.local. Only synthetic data leaves this test.
 */
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createClient} from '@supabase/supabase-js';
import OpenAI from 'openai';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const user='faaac0ad-bc77-4388-a3c7-9b13f1430eea';
const file='.test-build/phase-9-8-live.json',allowanceFile='.test-build/external-live-allowance.json';
const ok=r=>{if(r.error)throw Error(r.error.code||'EXTERNAL_TEST_DATABASE_ERROR');return r.data;};
const checks=[],report={startedAt:new Date().toISOString(),checks,passed:false,syntheticOnly:true,maximumAdditionalUsd:2,toolCallCeiling:process.env.SEED_EXTERNAL_MAX_TOOL_CALLS??'default'};
mkdirSync('.test-build',{recursive:true});
const save=()=>writeFileSync(file,JSON.stringify(report,null,2));
async function check(name,fn){await fn();checks.push({name,passed:true});save();console.log(name+': OK');}
async function schema(){
 for(const table of ['external_preferences','external_research_runs','external_sources','external_claims','external_claim_sources','external_research_jobs','external_competitors','external_watchlist','external_events'])ok(await db.from(table).select('*').limit(0));
 assert.ok(ok(await db.from('commercial_settings').select('value').eq('id','external_research').single()).value.enabled);
}
if(process.argv.includes('--restore')){
 const a=JSON.parse(readFileSync(allowanceFile,'utf8'));
 ok(await db.from('commercial_overrides').update({revoked_at:new Date().toISOString()}).eq('id',a.id).eq('user_id',user));
 console.log('Temporary allowance revoked.');process.exit(0);
}
let allowance=null,company=null;
try{
 await check('remote_migration_available',schema);
 if(process.argv.includes('--live-authorized')){
  const require=createRequire(import.meta.url);
  const {Responses}=require('openai/resources/responses/responses');
  const {processExternalJob,externalContext}=require('../.test-build/external-runtime/src/lib/external/server.js');
  const {planningRequest,parsePlan,publicPlanningContext}=require('../.test-build/external-runtime/src/lib/external/planner.js');
  const {externalCompletion}=require('../.test-build/external-runtime/src/lib/external/meter.js');
  const {OpenAIWebSearchProvider}=require('../.test-build/external-runtime/src/lib/external/provider.js');
  process.env.SEED_EXTERNAL_MODE='LIVE_WEB_ENABLED';
  const account=ok(await db.from('commercial_accounts').select('market_code').eq('user_id',user).single());
  const marketPolicy=ok(await db.from('commercial_markets').select('status,disable_ai_requests').eq('code',account.market_code).single());
  assert.equal(marketPolicy.disable_ai_requests,false,'Market AI must already be enabled');
  assert.ok(['READY','ACTIVE','PAUSED'].includes(marketPolicy.status));
  if(existsSync(allowanceFile)){
   const old=JSON.parse(readFileSync(allowanceFile,'utf8'));
   const row=ok(await db.from('commercial_overrides').select('revoked_at,expires_at').eq('id',old.id).maybeSingle());
   assert.ok(!row||row.revoked_at||Date.parse(row.expires_at)<=Date.now(),'Restore prior allowance first');
  }
  const before=ok(await db.from('ai_requests').select('accounted_usd,reserved_usd,created_at').eq('user_id',user));
  const sum=rows=>rows.reduce((s,r)=>s+Number(r.accounted_usd??r.reserved_usd),0);
  const base=sum(before);
  const authorizationFile='.test-build/external-test-authorization.json';
  assert.ok(existsSync(authorizationFile),'Original authorization ledger required; this script cannot create or reset a budget');
  const authorization=JSON.parse(readFileSync(authorizationFile,'utf8'));
  assert.ok(Date.now()<Date.parse(authorization.expires),'Test authorization expired');
  assert.ok(base-authorization.base<2,'Original total test budget exhausted');
  assert.ok([authorization.base,authorization.dayCost,authorization.monthCost].every(v=>Number.isFinite(v)&&v>=0),'Invalid original authorization ledger');
  const pro=ok(await db.from('commercial_plans').select('policy').eq('code','PRO').single());
  const policy={...pro.policy,window:'lifetime',target_usd:authorization.base+.6,approaching_usd:authorization.base+.8,soft_usd:authorization.base+1.2,warning_usd:authorization.base+1.4,heavy_usd:authorization.base+1.6,hard_usd:authorization.base+2,user_day_usd:authorization.dayCost+2,user_month_usd:authorization.monthCost+2,diagnoses:25};
  const expires=authorization.expires;
  allowance=ok(await db.from('commercial_overrides').insert({user_id:user,created_by:user,kind:'CUSTOM_ALLOWANCE',settings:{plan_code:'PRO',policy,market_access:true},expires_at:expires,reason:'Fase 9.8: autorização explícita no chat; somente empresa fictícia, até 2 horas e US$2 adicionais.'}).select('id,expires_at').single());
  writeFileSync(allowanceFile,JSON.stringify({...allowance,beforeCost:base,startedAt:report.startedAt},null,2));
  report.allowance=allowance;
  ok(await db.from('admin_audit_log').insert({actor:user,action:'PHASE_9_8_TEST_GRANTED',entity:allowance.id,new_state:{expires_at:expires,maximum_additional_usd:2},reason:'Autorização explícita do titular; revogação ao terminar.'}));
  company=crypto.randomUUID();report.company=company;
  ok(await db.from('companies').insert({id:company,name:'TESTE FICTÍCIO — External Intelligence 9.8',locale:'pt-PT',timezone:'Europe/Lisbon'}));
  ok(await db.from('company_members').insert({company_id:company,user_id:user,role:'owner'}));
  save();
  const market={user_language:'pt-BR',company_preferred_language:null,company_country:'PT',company_currency:'EUR',company_locale:'pt-PT',company_timezone:'Europe/Lisbon'};
  const memory=JSON.stringify([{key:'segment',value:'pizzaria'},{key:'city',value:'Leiria'},{key:'goal',value:'Comparar o escopo da oferta antes de decidir. DADO FICTÍCIO.'}]);
  const questions={quick:'Faça uma verificação pontual e rápida: pesquise no site https://www.ine.pt qual é a função do Instituto Nacional de Estatística em Portugal. Só preciso dessa informação pública com fonte.',standard:'Pesquise os concorrentes de pizzaria em Leiria, Portugal, e compare o tipo de oferta pública. Não presuma participação de mercado nem demanda.',deep:'Faça pesquisa pública geral e detalhada de fontes oficiais sobre licenciamento de pizzaria em Portugal, em âmbito nacional, sem avaliar um estabelecimento particular. Não ofereça garantia jurídica.'};
  const selected=(process.argv.find(x=>x.startsWith('--cases='))?.slice(8)||'quick,standard').split(',');
  report.runs=[];
  const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,maxRetries:0,timeout:55000});
  // Synthetic fixtures only: preserve structured output locally for validation diagnostics.
  const originalCreate=Responses.prototype.create;
  Responses.prototype.create=function(...args){const response=originalCreate.apply(this,args);if(args[0]?.text?.format?.name==='external_report')void response.then(r=>writeFileSync('.test-build/external-synthesis-'+company+'.json',r.output_text)).catch(()=>{});return response;};
  const baseProvider=new OpenAIWebSearchProvider(client);
  const provider={start:(r,s)=>baseProvider.start(r,s),retrieve:id=>baseProvider.retrieve(id),cancel:id=>baseProvider.cancel(id)};
  for(const name of selected){
   assert.ok(questions[name],'Unknown fixture');assert.ok(Date.now()<Date.parse(expires));
   const request=crypto.randomUUID(),conversation=crypto.randomUUID(),id=crypto.randomUUID();
   const result=await externalCompletion(client,user,company,request,'EXTERNAL_RESEARCH_PLANNING',planningRequest('',questions[name],publicPlanningContext(memory),market));
   writeFileSync('.test-build/external-plan-'+company+'-'+name+'.json',result.output_text);
   const plan=parsePlan(JSON.parse(result.output_text),questions[name],publicPlanningContext(memory),market,name==='deep'?'REGULATORY_CHECK':name==='standard'?'COMPETITOR_ANALYSIS':'USER_REQUESTED');
   assert.ok(plan&&!plan.needsClarification,'Planner must return a grounded public query');
   assert.ok(!plan.query.includes('FICTÍCIO')&&!plan.query.includes('Comparar o escopo'));
   ok(await db.rpc('queue_external_research',{p_user:user,p_company:company,p_run:id,p_conversation:conversation,p_request:request,p_version:0,p_message:questions[name],p_answer:'Pesquisa de teste em andamento.',p_plan:plan,p_context:memory,p_cache_key:crypto.randomUUID()}));
   const run={name,id,request,depth:plan.depth};report.runs.push(run);save();
   const end=Math.min(Date.now()+540000,Date.parse(expires));
   let status;
   do{
    await processExternalJob(id,provider);
    status=ok(await db.from('external_research_runs').select('status,error_code,source_count,tool_calls,estimated_cost,report').eq('id',id).single());
    if(['QUEUED','RUNNING'].includes(status.status))await new Promise(resolve=>setTimeout(resolve,4000));else break;
   }while(Date.now()<end);
   Object.assign(run,{status:status.status,error:status.error_code,sources:status.source_count,toolCalls:status.tool_calls,cost:status.estimated_cost,claims:status.report?.claims?.length??0});save();
   assert.ok(['COMPLETED','PARTIAL'].includes(status.status),`${name}: ${status.error_code||status.status}`);
   assert.ok(run.sources>0&&run.toolCalls>0&&run.claims>0,'Real cited research required');
   assert.ok(status.report.claims.every(c=>c.sourceIds.length&&c.sourceIds.every(id=>status.report.sources.some(s=>s.id===id))));
   const context=await externalContext(company,user,questions[name],id);assert.equal(context[0].kind,'EXTERNAL_DATA');
   checks.push({name:'real_'+name+'_provider_to_persisted_citations',passed:true});save();console.log(JSON.stringify(run));
  }
  await check('anonymous_research_isolation',async()=>{const anon=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});const r=await anon.from('external_research_runs').select('id').eq('company_id',company);assert.ok(r.error||r.data.length===0);});
 }
 report.passed=true;
}catch(e){report.error=e instanceof Error?e.message:'EXTERNAL_TEST_FAILED';process.exitCode=1;console.error(report.error);}
finally{
 if(allowance){
  try{ok(await db.from('commercial_overrides').update({revoked_at:new Date().toISOString()}).eq('id',allowance.id).eq('user_id',user));report.allowanceRestored=true;ok(await db.from('admin_audit_log').insert({actor:user,action:'PHASE_9_8_TEST_RESTORED',entity:allowance.id,reason:'Teste encerrado; histórico financeiro preservado.'}));}catch{report.allowanceRestored=false;report.passed=false;process.exitCode=1;}
 }
 if(company){
  try{
   const costs=ok(await db.from('ai_requests').select('accounted_usd,reserved_usd,status').eq('company_id',company));
   report.accountedOrReservedUsd=costs.reduce((s,r)=>s+Number(r.accounted_usd??r.reserved_usd),0);
   report.unknownCostRequests=costs.filter(r=>r.status==='UNKNOWN').length;
   assert.ok(report.accountedOrReservedUsd<=2,'Authorized budget exceeded');
   // Preserve the explicitly labeled fixture because immutable financial records reference it.
   ok(await db.from('external_research_jobs').update({internal_context:'',cached_report:null}).eq('company_id',company));
   ok(await db.from('external_watchlist').update({enabled:false}).eq('company_id',company));
   report.fixtureRetainedForFinancialAudit=true;
  }catch{report.passed=false;process.exitCode=1;report.cleanupNeedsReview=true;}
 }
 report.finishedAt=new Date().toISOString();save();writeFileSync('.test-build/phase-9-8-live-'+report.startedAt.replaceAll(':','-')+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:checks.length,cost:report.accountedOrReservedUsd,restored:report.allowanceRestored}));
}
