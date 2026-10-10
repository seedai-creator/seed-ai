/** Phase10 opt-in integration test. Default is read-only. No secret values are printed.
 * Authorization 2026-10-09: synthetic company only, temporary PRO <=2h, <=US$2 additional.
 * Compile tsconfig.goals-live.json, then run node --conditions=react-server.
 */
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createClient} from '@supabase/supabase-js';
import OpenAI from 'openai';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const user='faaac0ad-bc77-4388-a3c7-9b13f1430eea',ledgerFile='.test-build/goals-test-authorization.json',allowanceFile='.test-build/goals-test-allowance.json';
const ok=r=>{if(r.error)throw Error(r.error.code||'GOAL_TEST_DATABASE_FAILED');return r.data;};
const sum=rows=>rows.reduce((v,r)=>v+Number(r.accounted_usd??r.reserved_usd),0);
mkdirSync('.test-build',{recursive:true});
const report={startedAt:new Date().toISOString(),checks:[],passed:false,syntheticOnly:true};
const save=()=>writeFileSync('.test-build/phase-10-live.json',JSON.stringify(report,null,2));
let allowance=null,company=null;
async function check(name,fn){await fn();report.checks.push(name);save();console.log(name+': OK');}
try{
 await check('remote_schema',async()=>{for(const table of ['goals','goal_events','goal_metric_links','metric_definitions','metric_observations'])ok(await db.from(table).select('*').limit(0));ok(await db.from('journal_jobs').select('goals_payload,goals_applied').limit(0));});
 if(process.argv.includes('--start-authorized')){
  assert.ok(!existsSync(ledgerFile),'Authorization ledger already exists; it cannot be reset');
  const requests=ok(await db.from('ai_requests').select('accounted_usd,reserved_usd,created_at').eq('user_id',user).limit(1001));assert.ok(requests.length<=1000,'Use paginated cost audit');
  const day=new Date().toISOString().slice(0,10),month=day.slice(0,7);
  writeFileSync(ledgerFile,JSON.stringify({started:report.startedAt,expires:new Date(Date.now()+7200000).toISOString(),base:sum(requests),dayCost:sum(requests.filter(r=>r.created_at.slice(0,10)===day)),monthCost:sum(requests.filter(r=>r.created_at.slice(0,7)===month)),maximumAdditionalUsd:2,authorization:'Explicit user reply: Autorizo nesses limites (Fase10)'},null,2));
 }
 if(process.argv.includes('--restore')){const old=JSON.parse(readFileSync(allowanceFile,'utf8'));ok(await db.from('commercial_overrides').update({revoked_at:new Date().toISOString()}).eq('id',old.id).eq('user_id',user));console.log('Temporary PRO restored');process.exit(0);}
 if(process.argv.includes('--live-authorized')){
  assert.ok(existsSync(ledgerFile),'Explicit authorization ledger required');const auth=JSON.parse(readFileSync(ledgerFile,'utf8'));assert.ok(Date.now()<Date.parse(auth.expires),'Authorization expired');
  if(existsSync(allowanceFile)){const old=JSON.parse(readFileSync(allowanceFile,'utf8'));const prior=ok(await db.from('commercial_overrides').select('revoked_at,expires_at').eq('id',old.id).maybeSingle());assert.ok(!prior||prior.revoked_at||Date.parse(prior.expires_at)<Date.now(),'Restore previous allowance');}
  const spent=sum(ok(await db.from('ai_requests').select('accounted_usd,reserved_usd').eq('user_id',user).limit(1001)));assert.ok(spent-auth.base<2,'Budget exhausted');
  const account=ok(await db.from('commercial_accounts').select('market_code').eq('user_id',user).single()),market=ok(await db.from('commercial_markets').select('status,disable_ai_requests').eq('code',account.market_code).single());assert.equal(market.disable_ai_requests,false);assert.ok(['READY','ACTIVE','PAUSED'].includes(market.status));
  const pro=ok(await db.from('commercial_plans').select('policy').eq('code','PRO').single());
  const policy={...pro.policy,window:'lifetime',target_usd:auth.base+.4,approaching_usd:auth.base+.6,soft_usd:auth.base+1,warning_usd:auth.base+1.2,heavy_usd:auth.base+1.6,hard_usd:auth.base+2,user_day_usd:auth.dayCost+2,user_month_usd:auth.monthCost+2,diagnoses:20};
  allowance=ok(await db.from('commercial_overrides').insert({user_id:user,created_by:user,kind:'CUSTOM_ALLOWANCE',settings:{plan_code:'PRO',policy,market_access:true},expires_at:auth.expires,reason:'Fase10: autorizado somente teste fictício, até2h e US$2 adicionais; restauração ao terminar.'}).select('id,expires_at').single());writeFileSync(allowanceFile,JSON.stringify(allowance,null,2));report.allowance=allowance;
  ok(await db.from('admin_audit_log').insert({actor:user,action:'PHASE_10_TEST_GRANTED',entity:allowance.id,new_state:{expires_at:auth.expires,maximum_additional_usd:2},reason:'Autorização explícita do titular no chat.'}));
  const resume=process.argv.find(x=>x.startsWith('--company='))?.slice(10);
  if(resume){assert.match(resume,/^[a-f0-9-]{36}$/);const fixture=ok(await db.from('companies').select('name').eq('id',resume).single());assert.equal(fixture.name,'TESTE FICTÍCIO — Goals & Metrics Fase10');company=resume;}
  else{company=crypto.randomUUID();ok(await db.from('companies').insert({id:company,name:'TESTE FICTÍCIO — Goals & Metrics Fase10',locale:'pt-BR',timezone:'America/Sao_Paulo'}));ok(await db.from('company_members').insert({company_id:company,user_id:user,role:'owner'}));}report.company=company;save();
  process.env.SEED_GOALS_ENABLED='true';process.env.SEED_JOURNAL_ENABLED='true';
  const require=createRequire(import.meta.url),{processJournalJob}=require('../.test-build/goals-runtime/src/lib/journal/server.js'),{goalSnapshot,goalContext}=require('../.test-build/goals-runtime/src/lib/goals/server.js');
  const {Responses}=require('openai/resources/responses/responses'),original=Responses.prototype.create;let capture=0;
  Responses.prototype.create=function(...args){const response=original.apply(this,args);void response.then(r=>writeFileSync('.test-build/phase-10-synthetic-output-'+company+'-'+(++capture)+'.json',r.output_text)).catch(()=>{});return response;};
  const cases=[
   {name:'goal_and_revenue',locale:'pt-BR',message:'O objetivo principal da minha empresa é sair de R$80 mil para R$100 mil de faturamento mensal até 2026-12-31, começando em 2026-07-01. Em julho de 2026, de 2026-07-01 a 2026-07-31, o faturamento foi R$84 mil. Em agosto de 2026, de 2026-08-01 a 2026-08-31, foi R$87 mil. Os dois meses estão completos.'},
   {name:'correction',locale:'pt-BR',message:'Correção do faturamento de agosto de 2026: de 2026-08-01 a 2026-08-31 foram R$89 mil, não R$87 mil. É o mesmo mês completo que informei antes.'},
   {name:'conversion',locale:'en-US',message:'My secondary goal is to increase monthly conversion from 10% to 15% by 2026-12-31. In the complete month 2026-09-01 to 2026-09-30 our whole company had 100 leads and 12 sales. Keep the revenue goal as the primary goal.'},
   {name:'operations',locale:'es-ES',message:'Mi meta operativa secundaria es reducir el plazo medio de entrega de 5 a 3 días hasta 2026-12-31. En septiembre completo, del 2026-09-01 al 2026-09-30, el plazo medio de entrega de toda la empresa fue de 4 días.'},
   {name:'qualitative',locale:'pt-PT',message:'Quero concluir a preparação da equipa até 2026-12-31. O critério de conclusão é terminar estas duas etapas: Documentar processo; Formar equipa. Nenhuma das etapas está concluída. Não atribuí pesos às etapas.'},
   {name:'ambiguous',locale:'pt-BR',message:'Quero melhorar minha empresa, mas ainda não defini indicador, valor de partida, alvo nem prazo. Guarde como um objetivo em rascunho; não invente esses dados.'},
   {name:'approximate',locale:'pt-PT',message:'No mês completo de setembro de 2026, de 2026-09-01 a 2026-09-30, a faturação total da empresa foi aproximadamente entre R$90 mil e R$95 mil. Não é um valor exato.'},
  ];
  const selected=process.argv.find(x=>x.startsWith('--cases='))?.slice(8).split(',');
  for(const fixture of cases.filter(c=>!selected||selected.includes(c.name))){assert.ok(Date.now()<Date.parse(auth.expires));const conversation=crypto.randomUUID(),message=crypto.randomUUID(),job=crypto.randomUUID();ok(await db.from('conversations').insert({id:conversation,company_id:company,user_id:user,title:'Teste fictício '+fixture.name}));ok(await db.from('messages').insert({id:message,conversation_id:conversation,request_id:crypto.randomUUID(),role:'user',content:fixture.message}));ok(await db.from('journal_jobs').insert({id:job,company_id:company,user_id:user,source_message_id:message,kind:'EXTRACTION',dedupe_key:'phase10:'+job,context:{at:new Date().toISOString(),timezone:'America/Sao_Paulo',locale:fixture.locale,document:false}}));await processJournalJob(company);const state=ok(await db.from('journal_jobs').select('status,error_code,goals_payload,goals_applied').eq('id',job).single());writeFileSync('.test-build/phase-10-fixture-'+fixture.name+'.json',JSON.stringify(state,null,2));assert.equal(state.status,'COMPLETED',fixture.name+': '+state.error_code);assert.equal(state.goals_applied,true);if(['qualitative','ambiguous'].includes(fixture.name)){assert.ok(state.goals_payload?.goals.length>0,'Expected extracted goal');if(fixture.name==='ambiguous')assert.ok(state.goals_payload.goals.every(g=>g.status==='DRAFT'));else assert.ok(state.goals_payload.goals.some(g=>g.spec.direction==='COMPLETE'&&g.spec.milestones.length===2&&g.spec.milestones.every(m=>m.weight===null&&!m.done)));}else{assert.ok(state.goals_payload?.observations.length>0,'Expected real extracted metric');if(fixture.name==='approximate')assert.ok(state.goals_payload.observations.some(o=>o.data.amount.value===null&&o.data.amount.min===90000&&o.data.amount.max===95000&&o.data.amount.approximate));}await check(fixture.name+'_provider_to_database',async()=>{});}
  const s=await goalSnapshot(company,user);report.goals=s.goals.map(g=>({id:g.id,title:g.spec.title,status:g.status,metric:g.spec.primary_metric}));report.metrics=s.observations.map(o=>({id:o.id,metric:o.metric,value:o.amount.value,period:o.period,quality:o.quality}));
  if(!selected){await check('corrected_revenue',async()=>{const rev=s.observations.filter(o=>o.metric==='revenue'&&o.start==='2026-08-01');assert.equal(rev.length,1);assert.equal(rev[0].amount.value,89000);});await check('derived_conversion',async()=>{assert.equal(s.observations.find(o=>o.metric==='conversion')?.amount.value,12);});}
  await check('bounded_goal_context',async()=>{const c=await goalContext(company,user,'revenue growth conversion');assert.ok(c.length>0&&c.length<=8);assert.ok(c.some(x=>x.kind==='GOAL'));});
  if(process.argv.includes('--analysis')){const {runSeedAnalysis}=require('../.test-build/goals-runtime/src/lib/openai/pipeline.js'),{meteredCompletion}=require('../.test-build/goals-runtime/src/lib/commercial/metering.js');const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,timeout:55000,maxRetries:0}),complete=await meteredCompletion(client,company,crypto.randomUUID(),user);const memory=JSON.stringify(await goalContext(company,user,'meta faturamento progresso'));const result=await runSeedAnalysis(complete,process.env.OPENAI_MODEL,[{role:'user',content:'Com base na meta de faturamento e nos resultados que registrei, como devo revisar meu próximo passo? Reconheça os dados que ainda faltam e não invente a causa.'}],memory,AbortSignal.timeout(65000),{user_language:'pt-BR',company_country:'BR',company_currency:'BRL',company_locale:'pt-BR',company_preferred_language:'pt-BR',company_timezone:'America/Sao_Paulo'});assert.ok(result.answer.length>40&&result.diagnosis);writeFileSync('.test-build/phase-10-real-analysis.json',JSON.stringify({answer:result.answer,diagnosis:result.diagnosis,validation:result.validation},null,2));report.checks.push('real_diagnosis_with_goal_context');}
  await check('anonymous_isolation',async()=>{const anon=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});const r=await anon.from('goals').select('id').eq('company_id',company);assert.ok(r.error||r.data.length===0);});
 }
 report.passed=true;
}catch(e){report.error=e instanceof Error?e.message:'GOAL_TEST_FAILED';console.error(report.error);process.exitCode=1;}
finally{
 if(allowance){try{ok(await db.from('commercial_overrides').update({revoked_at:new Date().toISOString()}).eq('id',allowance.id).eq('user_id',user));report.restored=true;ok(await db.from('admin_audit_log').insert({actor:user,action:'PHASE_10_TEST_RESTORED',entity:allowance.id,reason:'Teste encerrado; plano original restaurado.'}));}catch{report.restored=false;process.exitCode=1;}}
 if(company){const costs=ok(await db.from('ai_requests').select('accounted_usd,reserved_usd,status').eq('company_id',company));report.costUsd=sum(costs);report.unknown=costs.filter(x=>x.status==='UNKNOWN').length;report.retainedForFinancialAudit=true;if(report.costUsd>2){report.passed=false;process.exitCode=1;}}
 report.finishedAt=new Date().toISOString();save();writeFileSync('.test-build/phase-10-live-'+report.startedAt.replaceAll(':','-')+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,cost:report.costUsd,restored:report.restored}));
}
