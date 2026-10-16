import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateCostCohorts} from '../scripts/cost-cohorts.mjs';
const policy=(window,hard)=>({window,hard_usd:hard,user_day_usd:2,user_month_usd:hard,global_day_usd:10,target_usd:.1,max_concurrent:1,requests_per_minute:6,diagnoses:3,interactions:30});
const fixture=()=>({captured_at:'2026-10-15T00:00:00Z',plans:[{code:'FREE',available:true,policy:policy('lifetime',.25)},{code:'PRO',available:true,policy:policy('month',8)}]});
test('cohort budgets distinguish lifetime allowance and shared global ceilings',()=>{
 const result=simulateCostCohorts(fixture());assert.equal(result.scenarios.length,12);
 const free=result.scenarios.find(r=>r.plan==='FREE'&&r.users===1000&&r.scenario==='all_at_cap');
 assert.equal(free.window,'lifetime');assert.equal(free.demandTotalUsd,250);
 const pro=result.scenarios.find(r=>r.plan==='PRO'&&r.users===1000&&r.scenario==='all_at_cap');
 assert.equal(pro.demandTotalUsd,8000);assert.equal(pro.cohortReservationCeilingUsd,300);assert.equal(pro.demandAboveSharedCeilingUsd,7700);
 assert.equal(pro.perUserAnalysisCountCeiling,3);
});
test('mixed p95 uses the explicit hypothetical distribution; daily and monthly caps constrain demand',()=>{
 const f=fixture();const p=f.plans[1].policy;p.user_day_usd=.1;p.user_month_usd=6;
 const mixed=simulateCostCohorts(f).scenarios.find(r=>r.plan==='PRO'&&r.users===100&&r.scenario==='mixed_assumption');
 assert.equal(mixed.demandP95Usd,2.7);assert.equal(mixed.demandTotalUsd,151.5);assert.equal(mixed.demandAverageUsd,1.515);
 const daily=simulateCostCohorts(f).scenarios.find(r=>r.plan==='PRO'&&r.scenario==='all_at_cap');
 assert.equal(daily.demandP95Usd,3);
});
test('missing or invalid policies fail instead of inventing usage or costs',()=>{
 for(const update of [f=>f.plans.pop(),f=>f.plans[0].policy.hard_usd=-1,f=>f.plans[0].policy.user_day_usd=NaN,f=>f.plans[0].policy.window='month',f=>f.plans[1].policy.requests_per_minute=0]){
  const f=fixture();update(f);assert.throws(()=>simulateCostCohorts(f));
 }
});
