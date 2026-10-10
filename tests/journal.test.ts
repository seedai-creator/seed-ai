import test from "node:test";
import assert from "node:assert/strict";
import {localDay,periodBounds,normalizeExtraction,selectJournalContext,ENTRY_TYPES} from "../src/lib/journal/domain";
import {weeklyMetrics,compareWeeks,eligibility,validateWeekly,type Weekly} from "../src/lib/journal/weekly";
import {extractionRequest,weeklyRequest} from "../src/lib/journal/requests";
import {candidate,row} from "./journal-fixtures";
const now=new Date("2026-10-01T01:00:00Z");
test("journal: relative dates use company timezone, month/week boundaries and unknown stay unknown",()=>{
 assert.equal(localDay(now,"America/Sao_Paulo"),"2026-09-30");assert.equal(localDay(now,"Europe/Lisbon"),"2026-10-01");assert.equal(localDay(now,null),null);
 assert.deepEqual(periodBounds("TODAY","2026-09-30"),["2026-09-30","2026-09-30"]);
 assert.deepEqual(periodBounds("YESTERDAY","2026-10-01"),["2026-09-30","2026-09-30"]);
 assert.deepEqual(periodBounds("THIS_WEEK","2026-10-01"),["2026-09-28","2026-10-01"]);
 assert.deepEqual(periodBounds("LAST_WEEK","2026-10-01"),["2026-09-21","2026-09-27"]);
 assert.deepEqual(periodBounds("THIS_MONTH","2026-10-01"),["2026-10-01","2026-10-01"]);
 assert.deepEqual(periodBounds("LAST_MONTH","2026-01-03"),["2025-12-01","2025-12-31"]);
 assert.deepEqual(periodBounds("TODAY",null),[null,null]);assert.throws(()=>periodBounds("EXPLICIT",null,"2026-02-30","2026-03-01"));
});
test("journal: every category, exact source, foreign/simulated statements and hypotheses",()=>{
 for(const type of ENTRY_TYPES){const c={...candidate,entry_type:type,...(type!=="METRIC"?{metric_type:null,value:null,unit:null}:{})};assert.equal(normalizeExtraction({entries:[c]},c.evidence,now,"UTC",[])[0].entry_type,type);}
 assert.equal(normalizeExtraction({entries:[{...candidate,scope:"SIMULATION"}]},candidate.evidence,now,"UTC",[]).length,0);
 assert.equal(normalizeExtraction({entries:[candidate]},"Texto diferente",now,"UTC",[]).length,0);
 assert.equal(normalizeExtraction({entries:[{...candidate,epistemic:"POSSIBLE"}]},candidate.evidence,now,"UTC",[])[0].entry_type,"HYPOTHESIS");
 assert.throws(()=>normalizeExtraction({entries:[{...candidate,value:21}]},candidate.evidence,now,"UTC",[]));
});
test("journal: explicit enrichment/correction target versions and money",()=>{
 const old=row("known","2026-09-30");
 const enrich={...candidate,operation:"ENRICH",target_id:"known",target_version:1,channel:"Meta"};
 assert.equal(normalizeExtraction({entries:[enrich]},candidate.evidence,now,"UTC",[old])[0].channel,"Meta");
 assert.throws(()=>normalizeExtraction({entries:[{...enrich,target_id:"foreign"}]},candidate.evidence,now,"UTC",[old]));
 assert.throws(()=>normalizeExtraction({entries:[{...enrich,value:21,evidence:"21"}]},"21",now,"UTC",[old]));
 const correction={...enrich,operation:"CORRECT",value:21,evidence:"21"};assert.equal(normalizeExtraction({entries:[correction]},"21",now,"UTC",[old])[0].value,21);
 const money={...candidate,metric_type:"marketing_spend",value:350,unit:"money",currency_code:"BRL",evidence:"R$350"};assert.equal(normalizeExtraction({entries:[money]},"R$350",now,"UTC",[])[0].currency_code,"BRL");
});
test("journal: sparse week conversion, mixed scope/currency, overlapping periods and zero",()=>{
 const window={start:"2026-09-28",end:"2026-10-04"};
 const days=["2026-09-28","2026-09-29","2026-10-01","2026-10-02"];
 const entries=days.flatMap((d,i)=>[row("l"+i,d,"leads",[20,25,30,28][i]),row("s"+i,d,"sales",[3,3,6,6][i])]);
 const metrics=weeklyMetrics(entries,window);assert.equal(metrics.find(m=>m.metric==="leads")?.value,103);assert.equal(metrics.find(m=>m.metric==="sales")?.value,18);assert.ok(Math.abs(metrics.find(m=>m.metric==="conversion")!.value-17.475728)<0.00001);
 assert.equal(eligibility(entries,window).coverage.complete_coverage,false);
 assert.equal(weeklyMetrics([row("l",days[0]),{...row("s",days[0],"sales",2),channel:"Meta"}],window).some(m=>m.metric==="conversion"),false);
 assert.equal(weeklyMetrics([row("l",days[0],"leads",0),row("s",days[0],"sales",0)],window).some(m=>m.metric==="conversion"),false);
 assert.equal(weeklyMetrics([row("a",days[0]),{...row("b",days[0]),period_end:days[3]}],window).length,0);
 const cash=(currency:string|null)=>({...row(currency??"unknown",days[0],"revenue",300),unit:"money",currency_code:currency});assert.equal(weeklyMetrics([cash("BRL"),cash("EUR"),cash(null)],window).length,2);
});
test("journal: comparable coverage and percentage points differ from percent change",()=>{
 const current={start:"2026-09-28",end:"2026-10-04"},prior={start:"2026-09-21",end:"2026-09-27"};
 const m=weeklyMetrics([row("a",current.start),row("b",current.start,"sales",2)],current),p=weeklyMetrics([row("c",prior.start),row("d",prior.start,"sales",1)],prior);
 const delta=compareWeeks(m,p,current,prior);assert.equal(delta.find(x=>x.metric==="sales")?.value,100);assert.equal(delta.find(x=>x.metric==="conversion")?.unit,"percentage_points");
 assert.deepEqual(compareWeeks(m,p,{...current,end:"2026-09-30"},prior),[]);
});
test("journal: relevant bounded context never mixes company, deleted or ancient events",()=>{
 const e=row("a","2026-09-30");const context=selectJournalContext([e,{...e,id:"b",company_id:"other"},{...e,id:"c",status:"DELETED"}],"a","interessados",now);assert.equal(context.length,1);
 assert.equal(selectJournalContext([e],"a","fornecedor",now).length,0);
});
test("weekly: provenance, preliminary learning and confidence cap",()=>{
 const c={text:"Com base no que compartilhou",evidence_ids:["a"]};const w:Weekly={summary:c,changes:[],important_events:[],actions:[],decisions:[],experiments:[],results:[],diagnosis:null,alerts:[],learnings:[{...c,strength:"SUPPORTED"}],hypotheses:[],next_priority:c,recommended_actions:[],primary_indicator:null,next_review:null,confidence:"HIGH",missing_data:[]};
 const result=validateWeekly(w,[row("a","2026-09-30")]);assert.equal(result.confidence,"MEDIUM");assert.equal(result.learnings[0].strength,"PRELIMINARY");assert.throws(()=>validateWeekly(w,[]));assert.throws(()=>validateWeekly(w,[{...row("a","2026-09-30"),entry_type:"HYPOTHESIS"}]));
});
test("journal: one combined economy extraction and strategic weekly request preserve safeguards",()=>{
 const extraction=extractionRequest("configured-model","test",[],{locale:"pt-PT"});assert.equal(extraction.metadata?.journal_feature,"BUSINESS_JOURNAL_EXTRACTION");assert.equal(extraction.store,false);
 const weekly=weeklyRequest("configured-model",[],{start:"2026-09-28",end:"2026-10-04"},{locale:"en-US"});assert.equal(weekly.metadata?.materiality,"HIGH");assert.match(weekly.instructions!,/causality/);assert.match(weekly.instructions!,/Missing events/);
});
