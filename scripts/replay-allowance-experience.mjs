import {readFile,writeFile} from 'node:fs/promises';
import {monthlyWorkload,replayAllowance} from './allowance-replay.mjs';
import {PRO_PROPOSAL,proposedProPolicy} from '../.test-build/src/lib/commercial/pro-proposal.js';
import {externalBudgetOptions} from '../.test-build/src/lib/external/cost.js';
const directory=new URL('../.test-build/phase-13-private-reports/',import.meta.url);
const samples=JSON.parse(await readFile(new URL('ALLOWANCE_REAL_AI_2026_10_16.json',directory),'utf8'));
const successful=samples.results.filter(r=>r.technicalPassed);
const requireCase=id=>{const r=successful.find(x=>x.id===id);if(!r||r.calls.some(c=>c.status!=='completed'||c.usageUnknown))throw Error('MISSING_REVIEWED_SAMPLE_'+id);return r.calls;};
const ordinary=successful.filter(r=>/^company_|^return_with_result$/.test(r.id)).map(r=>r.calls);
if(ordinary.length!==6)throw Error('Incomplete company samples');
const normal=Array.from({length:10},(_,i)=>i===9?requireCase('decision_period_confirmed'):ordinary[i%ordinary.length]);
const journal=requireCase('journal_0'),weekly=requireCase('weekly');
// New measured sample; the previous unknown remains in the historical ledger.
const researchCase=samples.results.find(r=>r.id==='research_standard_retest'&&r.technicalPassed);
if(!researchCase||researchCase.calls.some(c=>c.status!=='completed'))throw Error('Missing research sample');
const standardPrice={context_tier:'standard',input_per_million:'2',cached_per_million:'0.2',cache_write_per_million:'2.5',output_per_million:'10'};
const longPrice={context_tier:'long',input_per_million:'4',cached_per_million:'0.4',cache_write_per_million:'5',output_per_million:'15'};
const reservationOptions=externalBudgetOptions({model:'gpt-6-sol',input:'x'.repeat(8192),max_tool_calls:3},3,3500,[standardPrice,longPrice],.01).map(x=>x.reserved);
const research=multiplier=>researchCase.calls.map(c=>({...c,
 // Production STANDARD permits 3 calls: reserve long-context pricing for that
 // ceiling plus payload headroom. The real sample observed 2 calls; 1.5x is an
 // explicit projection to 3, not a measurement of a deeper search.
 ...(c.feature==='WEB_SEARCH_STANDARD'?{reservationOptions:reservationOptions.map(n=>n*multiplier)}:{}),
 reservationUsd:(c.feature==='WEB_SEARCH_STANDARD'?reservationOptions[0]:c.reservationUsd)*multiplier,
 chargedUsd:c.chargedUsd*(c.feature==='WEB_SEARCH_STANDARD'?1.5:1)*multiplier}));
const quickResearch=requireCase('research_quick');
const profiles=PRO_PROPOSAL.map(p=>({label:p.id.replace('_',' '),priceBRL:p.amount_minor/100,companies:p.company_limit,cap:p.allowance_usd,routinePerCompany:p.company_limit===1?60:40,researchPerCompany:2,policy:proposedProPolicy(p.allowance_usd)}));
const scenarios=[];
for(const p of profiles){
 for(const variant of ['routine','quick_research','intensive','long_context','research_double','research_four','concentrated_research','candidate_count']){
  const input={companies:p.companies,conversationsPerCompany:variant==='intensive'?100:variant==='candidate_count'?60:p.routinePerCompany,researchPerCompany:variant==='intensive'?8:['research_four','quick_research'].includes(variant)?4:p.researchPerCompany,researchDayOffset:variant==='concentrated_research'?0:2,
   conversationSamples:variant==='long_context'?[requireCase('long_context')]:normal,journalSample:journal,weeklySample:weekly,researchSample:variant==='quick_research'?quickResearch:research(variant==='research_double'?2:1)};
  const events=monthlyWorkload(input);
  const result=replayAllowance({capUsd:p.cap,dailyUsd:p.policy.user_day_usd,analysisLimit:null,companyLimit:p.companies,events});
  scenarios.push({plan:p.label,priceBRL:p.priceBRL,variant,researchDayOffset:input.researchDayOffset,companies:p.companies,requestedConversations:input.conversationsPerCompany*p.companies,requestedReports:4*p.companies,requestedResearch:input.researchPerCompany*p.companies,
   analysisLimit:null,result});
 }
}
const freeEvents=[1,2,3].flatMap(n=>[{day:0,company:1,kind:'conversation',eventId:'free'+n,calls:requireCase('free_'+n)},{day:0,company:1,kind:'memory',dependsOn:'free'+n,calls:journal}]);
const free=replayAllowance({capUsd:.25,dailyUsd:.25,analysisLimit:3,companyLimit:1,events:freeEvents});
const output={asOf:new Date().toISOString(),paidCalls:0,plansActivated:false,free,scenarios,
 assumptions:['30-day cycle; events distributed over days; 4 weekly reports per company. Same account budget across all companies.',
 'Measured conversations and combined memory extraction reused as cost samples, not a month of independent real calls.',
 'Report sample uses sparse fictional data; larger context may cost more. Memory writes are local normalized samples, not remote worker execution.',
 'New STANDARD sample requested one search and observed two. All calls are metered. Projection to the configured three-call setting multiplies only search cost by 1.5 and reserves long-context price with 8192 payload bytes. A smaller disclosed coverage can fit the balance; the projected cost remains conservative even when reduced. Doubled in stress case.',
 'quick_research replaces the STANDARD sample with measured QUICK research plus planning and synthesis; four per company. This does not change the application router or establish equal source depth.',
 'Routine conversation mix includes one decision simulation per ten interactions. Every successful conversational interaction schedules one memory extraction.',
 'Research days are offset by two days between companies except concentrated_research. This is a usage assumption, not automatic scheduling in the product.',
 'No cache savings assumed. Candidate paid plans use shared cycle cost, without a 200-analysis ceiling; FREE retains three analyses.',
 'Caller rate/concurrency, billing-calendar overlap and actual cross-account global contention are tested separately, not simulated as monthly experience.'],
 limitations:['A passing replay does not prove user satisfaction, retention, willingness to pay, full UI or production capacity.',
 'The proposed SQL global guard adds each active budget-mode paid account envelope to the base operational allowance. It is not deployed or activated.',
 'Failed conversations excluded from the workload library, but their evaluation costs remain in previousAttempts and the ledger. Research unknown usage is explicitly charged at the full reservation.',
 'Failed/unknown operational calls require reserve and retry headroom; provider invoice is not guaranteed by an application cap.']};
await writeFile(new URL('ALLOWANCE_ADJUSTED_REPLAY_2026_10_16.json',directory),JSON.stringify(output,null,2));
console.log(JSON.stringify({free,scenarios:scenarios.map(s=>({plan:s.plan,variant:s.variant,requested:s.requestedConversations,completed:s.result.completed,spent:s.result.spentUsd,firstBlock:s.result.firstBlock,allCompleted:s.result.allCompleted}))},null,2));
