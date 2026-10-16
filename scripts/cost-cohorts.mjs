// Deterministic budget scenarios, not a forecast of customer behavior or an invoice.
// Input is a reviewed configuration snapshot; this module never contacts providers.
const scale=1_000_000n;
function money(value){
 if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1_000_000||Math.abs(value*1e6-Math.round(value*1e6))>0.00001)throw Error('Invalid USD policy amount');
 return BigInt(Math.round(value*1e6));
}
const usd=value=>Number(value)/Number(scale);
const min=(...values)=>values.reduce((a,b)=>a<b?a:b);
function percentile95(values){const sorted=[...values].sort((a,b)=>a<b?-1:a>b?1:0);return sorted[Math.ceil(.95*sorted.length)-1];}

export function simulateCostCohorts(snapshot){
 if(!snapshot||!Number.isFinite(Date.parse(snapshot.captured_at))||!Array.isArray(snapshot.plans))throw Error('Configuration snapshot required');
 const result=[];
 for(const code of ['FREE','PRO']){
  const plans=snapshot.plans.filter(p=>p.code===code);
  if(plans.length!==1||plans[0].available!==true)throw Error('Available FREE and PRO policies required');
  const plan=plans[0],p=plan.policy;
  if(!p||p.window!==(code==='FREE'?'lifetime':'month'))throw Error('Review changed billing window');
  const hard=money(p.hard_usd),daily=money(p.user_day_usd),month=money(p.user_month_usd),global=money(p.global_day_usd),target=money(p.target_usd);
  if(![p.max_concurrent,p.requests_per_minute,p.diagnoses,p.interactions].every(n=>Number.isSafeInteger(n)&&n>0))throw Error('Invalid count policy');
  const cap=min(hard,month,daily*30n),globalCap=global*30n;
  for(const size of [100,1000]){
   // Hypothetical, explicit distribution; never described as observed customers.
   const mixed=Array.from({length:size},(_,i)=>cap*BigInt(i<size*.4?25:i<size*.75?50:i<size*.95?90:100)/100n);
   const scenarios=[['target',Array(size).fill(min(target,cap))],['mixed_assumption',mixed],['all_at_cap',Array(size).fill(cap)]];
   for(const [scenario,values] of scenarios){
    const total=values.reduce((a,b)=>a+b,0n);
    result.push({plan:code,users:size,scenario,days:30,window:p.window,
     demandTotalUsd:usd(total),demandAverageUsd:usd(total)/size,demandP95Usd:usd(percentile95(values)),
     sharedReservationCeilingUsd:usd(globalCap),cohortReservationCeilingUsd:usd(min(total,globalCap)),
     demandAboveSharedCeilingUsd:usd(total>globalCap?total-globalCap:0n),
     simultaneousDailyDemandUsd:usd(min(cap,daily)*BigInt(size)),globalDailyReservationCeilingUsd:usd(global),
     perUserConcurrentRequests:p.max_concurrent,perUserRequestsPerMinute:p.requests_per_minute,
     perUserAnalysisCountCeiling:Math.min(p.interactions,p.diagnoses)});
   }
  }
 }
 return {capturedAt:snapshot.captured_at,scenarios:result,
  assumptions:['New FREE accounts with no prior lifetime use; one 30-day PRO subscription period.',
   'All cohorts are independent scenarios sharing the same system budget; do not add global ceilings.',
   'Mixed demand assumes 40% of users at 25%, 35% at 50%, 20% at 90%, 5% at 100% of the effective cap.',
   'No overrides, other cohorts or pre-existing reservations; no increase to actual budgets.',
   'Demand p95 describes this hypothetical distribution, not observed customer cost.'],
  limitations:['Reservation ceilings do not guarantee provider invoice amounts: pricing, actual tokens, retries and reconciliation may differ.',
   'Analysis counts, daily limits, feature entitlements and request order may restrict usage before the money ceiling.',
   'Unused FREE allowance does not renew monthly. PRO cycles may differ from 30 days.',
   'Infrastructure, payment fees, taxes, CAC and currency conversion excluded; no measured contribution margin.',
   'Per-user limits do not prevent multi-account abuse. No capacity or performance promise.']};
}
