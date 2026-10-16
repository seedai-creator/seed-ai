// Bounded real AI samples; monthly usage is replayed separately, never bought.
// Uses the existing US$2 Phase 13 ledger, no remote database mutations.
import OpenAI from 'openai';
import {parseEnv} from 'node:util';
import {readFile,writeFile,mkdir,open,unlink} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {runSeedAnalysis} from '../.test-build/src/lib/openai/pipeline.js';
import {parseMessages} from '../.test-build/src/lib/chat/contracts.js';
import {extractionRequest,weeklyRequest} from '../.test-build/src/lib/journal/requests.js';
import {normalizeExtraction} from '../.test-build/src/lib/journal/domain.js';
import {validateWeekly,weeklyMetrics} from '../.test-build/src/lib/journal/weekly.js';
import {planningRequest,parsePlan,publicPlanningContext} from '../.test-build/src/lib/external/planner.js';
import {webRequest} from '../.test-build/src/lib/external/request.js';
import {collectEvidence} from '../.test-build/src/lib/external/sources.js';
import {synthesisRequest,validatedReport} from '../.test-build/src/lib/external/report.js';
import {companies,memoryFor,freeMessages,longHistory,market} from './allowance-fixtures.mjs';
import {responseCost} from '../.test-build/src/lib/commercial/response-cost.js';

if(!process.argv.includes('--run'))throw Error('Explicit --run required');
const repeat=new Set((process.argv.find(a=>a.startsWith('--repeat='))?.slice(9)??'').split(',').filter(Boolean));
const adjustments=process.argv.includes('--adjustments');
if([...repeat].some(id=>!['decision_simulation','journal_0','journal_1','weekly'].includes(id)))throw Error('Unsupported repeat case');
const env=parseEnv(await readFile(new URL('../.env.local',import.meta.url),'utf8'));
const models={economy:env.OPENAI_ECONOMY_MODEL,strategic:env.OPENAI_STRATEGIC_MODEL};
if(models.economy!=='gpt-6-luna'||models.strategic!=='gpt-6-sol'||!env.OPENAI_API_KEY)throw Error('Review configured model and pricing before evaluation');
// Official Standard short-context prices reviewed 2026-10-16. All input is
// conservatively charged at cache-write price; no cache savings assumed.
const rates={'gpt-6-luna':{input:.125,output:.5},'gpt-6-sol':{input:2.5,output:10}};
process.env.OPENAI_REASONING_EFFORT=env.OPENAI_REASONING_EFFORT==='low'?'low':'';
process.env.SEED_SIMULATOR_ENABLED='false';
const root=new URL('../.test-build/',import.meta.url);
await mkdir(root,{recursive:true});
const ledgerPath=new URL('phase13-ai-budget.json',root),lockPath=new URL('phase13-ai-budget.lock',root);
const output=new URL('phase-13-private-reports/ALLOWANCE_REAL_AI_2026_10_16.json',root);
const lock=await open(lockPath,'wx');
try{
 const ledger=JSON.parse(await readFile(ledgerPath,'utf8'));
 if(ledger.limitUsd!==2||!Array.isArray(ledger.calls)||ledger.calls.some(c=>!Number.isFinite(c.chargedUsd)||c.chargedUsd<0))throw Error('Invalid budget ledger');
 const spent=()=>ledger.calls.reduce((s,c)=>s+c.chargedUsd,0);
 const report=await readFile(output,'utf8').then(JSON.parse,e=>{if(e.code!=='ENOENT')throw e;return {fixture:true,started:new Date().toISOString(),costBasis:'Conservative cache-write input price; no assumed cache savings; provider invoice not reconciled',results:[]};});
 const save=()=>writeFile(output,JSON.stringify({...report,totalPhase13ReservedOrCostUsd:spent()},null,2));
 const client=new OpenAI({apiKey:env.OPENAI_API_KEY,baseURL:'https://api.openai.com/v1',maxRetries:0,timeout:60000});
 let active;
 async function complete(request,signal){
  const name=request.text?.format?.name;
  const external=request.metadata?.external_feature,search=['WEB_SEARCH_STANDARD','WEB_SEARCH_QUICK'].includes(external);
  const routine=external==='WEB_SEARCH_QUICK'||external==='EXTERNAL_RESEARCH_PLANNING'||name==='seed_route'||request.metadata?.journal_feature==='BUSINESS_JOURNAL_EXTRACTION'||request.metadata?.simulation_feature==='DECISION_SCENARIO_EXTRACTION';
  const model=routine?models.economy:models.strategic,rate=rates[model];
  const max_output_tokens=external?(request.max_output_tokens??1600):name==='seed_route'?800:3800; // Read-only production configuration verified 2026-10-16.
  const bounded={...request,model,max_output_tokens,background:false,store:false,service_tier:'default'};
  const maxCalls=search?bounded.max_tool_calls:0;
  if(bounded.tools?.length&&(!process.argv.includes('--with-research')&&!process.argv.includes('--with-quick-research')||!['research_standard','research_standard_retest','research_quick'].includes(active.id)||!search||bounded.tools.length!==1||bounded.tools[0].type!=='web_search'||!Number.isSafeInteger(maxCalls)||maxCalls<1||maxCalls>2))throw Error('TOOLS_NOT_AUTHORIZED_BY_THIS_RUNNER');
  const inputCeiling=Buffer.byteLength(JSON.stringify(bounded),'utf8')+(search?128000*maxCalls:8192);
  if(inputCeiling>272000)throw Error('CONTEXT_LIMIT');
  const ceiling=(inputCeiling*rate.input+max_output_tokens*rate.output)/1e6+maxCalls*.01;
  if(spent()+ceiling>ledger.limitUsd)throw Error('EVALUATION_BUDGET_EXHAUSTED');
  const call={case:'allowance:'+active.id,model,at:new Date().toISOString(),status:'RESERVED',chargedUsd:ceiling,reservationUsd:ceiling,feature:external??request.metadata?.journal_feature??(routine?'classification':'diagnosis'),requestHash:createHash('sha256').update(JSON.stringify(bounded)).digest('hex')};
  ledger.calls.push(call);active.calls.push(call);await writeFile(ledgerPath,JSON.stringify(ledger,null,2));await save();
  const start=Date.now();
  const response=await client.responses.create(bounded,{signal});
  const u=response.usage;
  call.latencyMs=Date.now()-start;
  const toolCalls=response.output.filter(x=>x.type==='web_search_call').length;
  const pricing={id:'official-2026-10-16',provider:'openai',model,currency:'USD',processing_tier:'default',context_tier:'standard',effective_from:'2026-10-16T00:00:00Z',effective_to:null,input_per_million:model===models.economy?'0.1':'2',cached_per_million:model===models.economy?'0.01':'0.2',cache_write_per_million:String(rate.input),output_per_million:String(rate.output)};
  const metered=responseCost(response,pricing,call.at,.01);
  call.providerResponseId=response.id;call.measuredCost=metered.cost;
  call.providerModel=response.model;call.providerUsage=u??null;call.providerToolCalls=toolCalls;
  call.requestedToolCalls=maxCalls;call.toolLimitExceeded=toolCalls>maxCalls;
  if(metered.cost.status==='ESTIMATED'){
   // The ledger remains conservative and comparable with prior samples; exact
   // application metering is stored separately. Never erase a known overrun.
   call.chargedUsd=Math.max(Number(metered.cost.total_usd),(u.input_tokens*rate.input+u.output_tokens*rate.output)/1e6+toolCalls*.01);
   call.reservationOverrun=call.chargedUsd>ceiling;
   call.toolCalls=toolCalls;
   call.usage={input:u.input_tokens,output:u.output_tokens,cached:u.input_tokens_details?.cached_tokens??null,cacheWrites:u.input_tokens_details?.cache_write_tokens??null};
  }else {call.usageUnknown=true;call.unknownReason=metered.cost.reason;}
  call.status=response.status;
  // Fixture responses stay in the ignored report, never logs or provider data.
  active.providerOutputs??=[];active.providerOutputs.push({format:name,text:response.output_text});
  await writeFile(ledgerPath,JSON.stringify(ledger,null,2));await save();
  return response;
 }
 async function run(id,kind,input,fn){
  const prior=report.results.find(r=>r.id===id);
  if(prior){
   if(!repeat.has(id)&&(prior.technicalPassed||!process.argv.includes('--retry-failed')))return prior;
   report.previousAttempts??=[];report.previousAttempts.push(prior);
   report.results=report.results.filter(r=>r!==prior);
  }
  active={id,kind,input,calls:[],technicalPassed:false,qualityReview:'PENDING'};report.results.push(active);await save();
  try{active.response=await fn();active.technicalPassed=true;}
  catch(e){active.errorCode=typeof e.code==='string'&&/^[A-Z_]+$/.test(e.code)?e.code:typeof e.message==='string'&&/^[A-Z_]+$/.test(e.message)?e.message:'EVALUATION_FAILED';}
  active.conservativeCostUsd=active.calls.reduce((s,c)=>s+c.chargedUsd,0);
  active.latencyMs=active.calls.reduce((s,c)=>s+(c.latencyMs??0),0);await save();
  console.log(JSON.stringify({case:id,passed:active.technicalPassed,costUsd:active.conservativeCostUsd,latencyMs:active.latencyMs}));return active;
 }
 async function chat(id,messages,memory='[]'){
  parseMessages({messages});
  return run(id,'conversation',{messages,memory},()=>runSeedAnalysis(complete,models.strategic,messages,memory,AbortSignal.timeout(120000),market));
 }
 const history=[];
 for(let i=0;i<freeMessages.length;i++){
  history.push({role:'user',content:freeMessages[i]});
  const r=await chat('free_'+(i+1),[...history]);
  if(!r.technicalPassed)break;
  history.push({role:'assistant',content:r.response.answer});
 }
 for(const [index,c] of companies.entries())await chat('company_'+(index+1),[{role:'user',content:`Estamos trabalhando na ${c.name}. Considerando somente os dados desta empresa na memória, qual prioridade você recomenda para os próximos sete dias? Diga como acompanhar o resultado e quais dados faltam.`}],memoryFor(c));
 await chat('return_with_result',[{role:'user',content:'Na Oficina Cedro fizemos o acompanhamento dos orçamentos por sete dias. Foram 30 orçamentos e 8 vendas nesse período. Antes tínhamos 100 orçamentos e 20 vendas no mês inteiro. Posso dizer que o acompanhamento causou melhora? O que revisar agora?'}],memoryFor(companies[0]));
 await chat('long_context',longHistory(),memoryFor(companies[0]));
 process.env.SEED_SIMULATOR_ENABLED='true';
 await chat('decision_simulation',[{role:'user',content:'Na Oficina Cedro quero comparar o preço de um serviço de R$100 com R$110. O custo variável é R$60 por serviço, vendemos 100 serviços por mês e temos capacidade de 120. Os custos fixos não mudarão nesse intervalo. Simule manter o volume ou perder 10% das vendas com o reajuste. Trate os volumes futuros como hipóteses.'}],memoryFor(companies[0]));
 if(adjustments)await chat('decision_period_confirmed',[{role:'user',content:'Na Oficina Cedro quero comparar o preço de um serviço de R$100 com R$110. O custo variável é R$60 por serviço. Vendemos 100 serviços por mês. Temos capacidade de 120 serviços por mês. Os custos fixos não mudarão nesse intervalo. Simule manter o volume ou perder 10% das vendas com o reajuste. Trate os volumes futuros como hipóteses.'}],memoryFor(companies[0]));
 process.env.SEED_SIMULATOR_ENABLED='false';
 let entries=[];
 for(const [index,message] of ['Hoje tivemos 20 pedidos de orçamento e 4 vendas na Oficina Cedro. Decidi testar o acompanhamento dos orçamentos durante sete dias a partir de hoje.','Hoje tivemos 25 pedidos de orçamento e 6 vendas na Oficina Cedro. O acompanhamento continua, mas ainda não sei o que causou a diferença.'].entries()){
  const day=`2026-10-${12+index}`;
  const r=await run('journal_'+index,'journal',{message,day},async()=>{
   const request=extractionRequest(models.economy,message,entries,{company_name:companies[0].name,locale:'pt-BR',timezone:'America/Sao_Paulo',referenceDay:day,business_context:{entities:[],observations:[],relationships:[]},radar_memories:[],goals_context:{goals:[],metrics:[]}});
   const res=await complete(request,AbortSignal.timeout(60000));if(res.status!=='completed')throw Error('INCOMPLETE_RESPONSE');
   const raw=JSON.parse(res.output_text),normalized=normalizeExtraction({entries:raw.entries},message,new Date(day+'T15:00:00Z'),'America/Sao_Paulo',entries);
   return {raw,normalized,rows:normalized.map(c=>({...c,id:c.target_id??randomUUID(),company_id:'fictional-cedro',user_id:'fixture',source_message_id:randomUUID(),event_date:c.period_start,status:'ACTIVE',version:(c.target_version??0)+1,manual:false,created_at:day+'T15:00:00Z',metadata:{related_ids:c.related_ids,hypothesis:c.hypothesis,action:c.action,indicator:c.indicator,baseline:c.baseline,target:c.target,review_date:c.review_date}}))};
  });
  if(r.technicalPassed)for(const row of r.response.rows){const index=entries.findIndex(e=>e.id===row.id);if(index<0)entries.push(row);else entries[index]=row;}
 }
 if(entries.length)await run('weekly','weekly',{entries},async()=>{
  const window={start:'2026-10-12',end:'2026-10-18'};
  const response=await complete(weeklyRequest(models.strategic,entries,window,{locale:'pt-BR',timezone:'America/Sao_Paulo'}),AbortSignal.timeout(60000));
  if(response.status!=='completed')throw Error('INCOMPLETE_RESPONSE');
  return {weekly:validateWeekly(JSON.parse(response.output_text),entries),metrics:weeklyMetrics(entries,window)};
 });
 for(const [flag,id,depth,maxCalls] of [['--with-research',adjustments?'research_standard_retest':'research_standard','STANDARD',adjustments?1:2],['--with-quick-research','research_quick','QUICK',1]])if(process.argv.includes(flag))await run(id,'research',{fictional:true,toolCallCeiling:maxCalls},async()=>{
  const question='Pesquise nos sites oficiais https://sebrae.com.br e https://www.gov.br recomendações públicas para reduzir desperdício de alimentos em padarias no Brasil. Compare duas ações práticas, cite as fontes e não presuma demanda, custos ou lucro da minha empresa.';
  const memory=memoryFor(companies[1]),publicContext=publicPlanningContext(memory);
  const planned=await complete(planningRequest(models.economy,question,publicContext,market),AbortSignal.timeout(60000));
  if(planned.status!=='completed')throw Error('INCOMPLETE_RESPONSE');
  const plan=parsePlan(JSON.parse(planned.output_text),question,publicContext,market,'USER_REQUESTED');
  if(!plan||plan.needsClarification)throw Error('RESEARCH_NEEDS_CLARIFICATION');
  // Explicitly bounded STANDARD sample; no changes to the application's limits.
  const boundedPlan={...plan,depth,allowedDomains:['sebrae.com.br','gov.br']};
  const request=webRequest(boundedPlan,'LIVE_WEB_ENABLED');
  const searched=await complete({...request,max_tool_calls:maxCalls,metadata:{external_feature:'WEB_SEARCH_'+depth}},AbortSignal.timeout(60000));
  if(searched.status!=='completed')throw Error('INCOMPLETE_RESPONSE');
  const evidence=collectEvidence(searched,boundedPlan);
  if(!evidence.calls||!evidence.citations.length)throw Error('RESEARCH_WITHOUT_CITATIONS');
  const synthesized=await complete(synthesisRequest(models.strategic,boundedPlan,evidence,memory),AbortSignal.timeout(60000));
  if(synthesized.status!=='completed')throw Error('INCOMPLETE_RESPONSE');
  const result=validatedReport(JSON.parse(synthesized.output_text),evidence,boundedPlan,memory);
  if(!result.claims.length)throw Error('RESEARCH_WITHOUT_SUPPORTED_CLAIMS');
  return {plan:boundedPlan,report:result};
 });
 report.finished=new Date().toISOString();await save();
 console.log(JSON.stringify({cases:report.results.length,technicalPassed:report.results.filter(r=>r.technicalPassed).length,totalPhase13ReservedOrCostUsd:spent(),limitUsd:2,plansActivated:false}));
 if(report.results.some(r=>!r.technicalPassed))process.exitCode=1;
}finally{await lock.close();await unlink(lockPath);}
