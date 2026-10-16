// Bounded real AI samples; monthly usage is replayed separately, never bought.
// Uses the existing US$2 Phase 13 ledger, no remote database mutations.
import OpenAI from 'openai';
import {parseEnv} from 'node:util';
import {readFile,writeFile,mkdir,open,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runSeedAnalysis} from '../.test-build/src/lib/openai/pipeline.js';
import {parseMessages} from '../.test-build/src/lib/chat/contracts.js';
import {market} from './allowance-fixtures.mjs';
import {firstAnalysisMessage,firstValue,freeExperienceState} from '../.test-build/src/lib/commercial/free-experience.js';
import {responseCost} from '../.test-build/src/lib/commercial/response-cost.js';

if(!process.argv.includes('--run'))throw Error('Explicit --run required');
const repeat=new Set((process.argv.find(a=>a.startsWith('--repeat='))?.slice(9)??'').split(',').filter(Boolean));
if([...repeat].some(id=>!['rich_first','sparse_first','material_last'].includes(id)))throw Error('Unsupported repeat case');
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
const output=new URL('phase-13-private-reports/FREE_EXPERIENCE_REAL_AI_2026_10_16.json',root);
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
  const max_output_tokens=Math.min(request.max_output_tokens??3800,name==='seed_route'?800:3800); // Read-only production configuration verified 2026-10-16.
  const bounded={...request,model,max_output_tokens,background:false,store:false,service_tier:'default'};
  const maxCalls=search?bounded.max_tool_calls:0;
  if(bounded.tools?.length)throw Error('TOOLS_NOT_ALLOWED');
  const inputCeiling=Buffer.byteLength(JSON.stringify(bounded),'utf8')+(search?128000*maxCalls:8192);
  if(inputCeiling>272000)throw Error('CONTEXT_LIMIT');
  const ceiling=(inputCeiling*rate.input+max_output_tokens*rate.output)/1e6+maxCalls*.01;
  if(spent()+ceiling>ledger.limitUsd)throw Error('EVALUATION_BUDGET_EXHAUSTED');
  const call={case:'free-experience:'+active.id,model,at:new Date().toISOString(),status:'RESERVED',chargedUsd:ceiling,reservationUsd:ceiling,feature:external??request.metadata?.journal_feature??(routine?'classification':'diagnosis'),requestHash:createHash('sha256').update(JSON.stringify(bounded)).digest('hex')};
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
 const policy={window:'lifetime',target_usd:.1,approaching_usd:.12,soft_usd:.15,warning_usd:.18,heavy_usd:.22,hard_usd:.25,interactions:30,diagnoses:3,max_concurrent:1,requests_per_minute:6,user_day_usd:.25,user_month_usd:.25,global_day_usd:10};
 const cases=[
  ['rich_first',firstAnalysisMessage('Quero vender mais sem aumentar anúncios.','Tenho uma oficina mecânica para motoristas da cidade.','Levamos dois dias para responder aos orçamentos e não fazemos acompanhamento. No mês passado foram 100 orçamentos e 20 vendas.'),0],
  ['sparse_first',firstAnalysisMessage('Quero vender mais.','Tenho uma padaria de bairro.','Não sei meus números e nunca registrei por que os clientes deixam de comprar.'),0],
  ['material_last',firstAnalysisMessage('Quero abrir outra loja. Você recomenda?','Tenho uma loja de roupas.','Não sei quanto sobra por mês e não sei a demanda do novo bairro. Não tenho estimativa de investimento.'),2],
 ];
 for(const [id,content,used] of cases){
  const messages=[{role:'user',content}];parseMessages({messages});
  const r=await run(id,'first_free_analysis',{messages,memory:'[]'},async()=>{
   const result=await runSeedAnalysis(complete,models.strategic,messages,'[]',AbortSignal.timeout(120000),market,null,undefined,false,undefined,freeExperienceState({cost:used*.02,diagnoses:used},policy));
   const value=firstValue(result.diagnosis);
   if(!value)throw Error('NO_VALIDATED_FIRST_VALUE');
   if(id==='material_last'&&!value.investigative)throw Error('UNSUPPORTED_MATERIAL_COMMITMENT');
   return {result,value};
  });
  if(r.conservativeCostUsd>.25)throw Error('FREE_BUDGET_OVERRUN');
 }
 report.finished=new Date().toISOString();await save();
 console.log(JSON.stringify({cases:report.results.length,technicalPassed:report.results.filter(r=>r.technicalPassed).length,totalPhase13ReservedOrCostUsd:spent(),limitUsd:2,plansActivated:false}));
 if(report.results.some(r=>!r.technicalPassed))process.exitCode=1;
}finally{await lock.close();await unlink(lockPath);}
