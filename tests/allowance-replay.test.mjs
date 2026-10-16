import test from 'node:test';
import assert from 'node:assert/strict';
import {replayAllowance,monthlyWorkload} from '../scripts/allowance-replay.mjs';
const call=(feature,reservationUsd,chargedUsd)=>({feature,reservationUsd,chargedUsd});
const policy={capUsd:4,dailyUsd:2,analysisLimit:200,companyLimit:3};
const event=(day,company,calls,kind='conversation')=>({day,company,calls,kind});
test('replay preserves a shared budget, exact boundary, partial charges and daily reset',()=>{
 const r=replayAllowance({...policy,events:[event(0,1,[call('diagnosis',2,2)]),event(0,2,[call('diagnosis',.1,.01)]),event(1,3,[call('classification',.1,.01),call('diagnosis',2,1)]),event(2,2,[call('diagnosis',1.99,1.99)])]});
 assert.equal(r.spentUsd,4);assert.equal(r.analyses,2);assert.deepEqual(r.blocked.map(b=>b.reason),['DAILY_BUDGET','CYCLE_BUDGET']);
 assert.equal(r.completed.conversation,2);
});
test('background work consumes money but not the conversational count',()=>{
 const r=replayAllowance({...policy,analysisLimit:1,events:[event(0,1,[call('diagnosis',.2,.1)]),event(0,1,[call('WEEKLY_INTELLIGENCE_GENERATION',.2,.1)],'weekly'),event(1,2,[call('classification',.01,.001)])]});
 assert.equal(r.spentUsd,.2);assert.equal(r.completed.weekly,1);assert.equal(r.firstBlock.reason,'ANALYSIS_LIMIT');
});
test('unknown, impossible costs and foreign company fail closed',()=>{
 for(const calls of [[call('diagnosis',.1,null)],[call('diagnosis',NaN,.1)]])assert.throws(()=>replayAllowance({...policy,events:[event(0,1,calls)]}));
 assert.throws(()=>replayAllowance({...policy,events:[event(0,4,[call('diagnosis',.1,.01)])]}));
});

test('budget mode passes 200 cheap analyses and keeps known provider overruns charged',()=>{
 const r=replayAllowance({...policy,analysisLimit:null,events:Array.from({length:250},()=>event(0,1,[call('diagnosis',.002,.001)]))});
 assert.equal(r.completed.conversation,250);assert.equal(r.spentUsd,.25);
 const over=replayAllowance({...policy,capUsd:.15,events:[event(0,1,[call('diagnosis',.1,.2)]),event(1,1,[call('diagnosis',.01,.01)])]});
 assert.equal(over.spentUsd,.2);assert.equal(over.overruns.length,1);assert.equal(over.firstBlock.reason,'CYCLE_BUDGET');
});

test('smaller disclosed research fits the balance without discarding measured cost',()=>{
 const r=replayAllowance({...policy,capUsd:.5,analysisLimit:null,events:[event(0,1,[{...call('WEB_SEARCH_STANDARD',2,.09),reservationOptions:[2,.7,.38]}],'research')]});
 assert.equal(r.completed.research,1);assert.equal(r.spentUsd,.09);assert.equal(r.coverageReduced.length,1);
 const blocked=replayAllowance({...policy,capUsd:.3,events:[event(0,1,[{...call('WEB_SEARCH_STANDARD',2,.09),reservationOptions:[2,.7,.38]}])]});
 assert.equal(blocked.firstBlock.reason,'CYCLE_BUDGET');assert.equal(blocked.spentUsd,0);
});
test('monthly schedule includes all companies, four reports and memory for each conversation',()=>{
 const sample=[call('diagnosis',.05,.02)];
 const events=monthlyWorkload({companies:5,conversationsPerCompany:40,researchPerCompany:2,conversationSamples:[sample],journalSample:[call('BUSINESS_JOURNAL_EXTRACTION',.01,.001)],weeklySample:[call('WEEKLY_INTELLIGENCE_GENERATION',.05,.02)],researchSample:[call('WEB_SEARCH_STANDARD',.1,.07)]});
 const r=replayAllowance({capUsd:16,dailyUsd:2,analysisLimit:200,companyLimit:5,events});
 assert.deepEqual(r.completed,{conversation:200,memory:200,research:10,weekly:20});assert.equal(r.allCompleted,true);
});

test('failed parent interaction does not generate unearned memory, but partial paid calls remain charged',()=>{
 const r=replayAllowance({...policy,capUsd:.05,events:[{...event(0,1,[call('classification',.01,.005),call('diagnosis',.1,.05)]),eventId:'chat'}, {...event(0,1,[call('BUSINESS_JOURNAL_EXTRACTION',.01,.001)],'memory'),dependsOn:'chat'}]});
 assert.equal(r.spentUsd,.005);assert.equal(r.completed.memory,undefined);assert.deepEqual(r.skipped,[{kind:'memory',reason:'PARENT_NOT_COMPLETED'}]);
});
