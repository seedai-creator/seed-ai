import { validateSchema } from "../reliability/contracts";
import { obj,str,nullable,list,shiftDay,type Entry } from "./domain";

export const GENERATION_VERSION="9.3.1";
export type Window={start:string;end:string};
export type Metric={key:string;metric:string;value:number;unit:string;currency:string|null;scope:string;source_ids:string[];days:string[]};
const scopeOf=(e:Entry)=>e.metric_data?JSON.stringify([e.company_id,e.metric_data.scope.type==='COMPANY'?null:e.metric_data.scope.type,e.metric_data.scope.id]):JSON.stringify([e.company_id,e.channel,e.product,e.location]);
const round=(v:number)=>Number(v.toPrecision(12));
export function weeklyMetrics(entries:Entry[],window:Window):Metric[] {
 const groups=new Map<string,Entry[]>();
 for(const e of entries.filter(e=>e.status==="ACTIVE"&&e.entry_type==="METRIC"&&e.value!==null&&e.period_start&&e.period_end&&e.period_start>=window.start&&e.period_end<=window.end)){
  // Unknown monetary currency cannot be safely aggregated.
  if(e.unit==="money"&&!e.currency_code)continue;
  if(e.metric_data&&(!e.metric_data.complete||e.metric_data.quality!=='VALID'||e.metric_data.source==='EXTERNAL'||e.metric_data.amount.approximate||e.metric_data.amount.min!==null||!['revenue','sales','leads','marketing_spend','ad_spend','cost','refunds','repeat_sales'].includes(e.metric_type??'')))continue;
  const key=JSON.stringify([e.metric_type,e.unit,e.currency_code,scopeOf(e)]);
  groups.set(key,[...(groups.get(key)??[]),e]);
 }
 const metrics:Metric[]=[];
 for(const rows of groups.values()){
  rows.sort((a,b)=>a.period_start!.localeCompare(b.period_start!));
  if(rows.some((e,i)=>i>0&&e.period_start!<=rows[i-1].period_end!))continue; // Never sum weekly totals and daily observations.
  const e=rows[0];
  metrics.push({key:"m"+metrics.length,metric:e.metric_type!,value:round(rows.reduce((s,x)=>s+Number(x.value),0)),unit:e.unit!,currency:e.currency_code,scope:scopeOf(e),source_ids:rows.map(x=>x.id),days:rows.flatMap(x=>[x.period_start+"/"+x.period_end])});
 }
 for(const leads of metrics.filter(m=>m.metric==="leads"&&m.unit==="count"&&m.value>0)){
  const sales=metrics.find(m=>m.metric==="sales"&&m.unit==="count"&&m.scope===leads.scope&&JSON.stringify(m.days)===JSON.stringify(leads.days));
  if(sales&&sales.value<=leads.value)metrics.push({key:"m"+metrics.length,metric:"conversion",value:round(sales.value/leads.value*100),unit:"percent",currency:null,scope:leads.scope,source_ids:[...sales.source_ids,...leads.source_ids],days:leads.days});
 }
 return metrics;
}
export function compareWeeks(current:Metric[],previous:Metric[],window:Window,prior:Window){
 if(shiftDay(prior.start,7)!==window.start||shiftDay(prior.end,7)!==window.end)return [];
 return current.flatMap(c=>{
  const p=previous.find(p=>p.metric===c.metric&&p.scope===c.scope&&p.currency===c.currency&&p.unit===c.unit&&JSON.stringify(p.days.map(d=>d.split("/").map(x=>shiftDay(x,7)).join("/")))===JSON.stringify(c.days));
  if(!p)return [];
  return [{metric:c.metric,scope:c.scope,unit:c.unit==="percent"?"percentage_points":"percent_change",value:c.unit==="percent"?round(c.value-p.value):p.value===0?null:round((c.value-p.value)/p.value*100),source_ids:[...c.source_ids,...p.source_ids]}];
 });
}
export function eligibility(entries:Entry[],window:Window,minEntries=3,minDays=2){
 const selected=entries.filter(e=>e.status==="ACTIVE"&&e.period_start&&e.period_end&&e.period_start>=window.start&&e.period_end<=window.end);
 const days=new Set(selected.map(e=>e.event_date).filter(Boolean));
 return {eligible:selected.length>=minEntries&&days.size>=minDays,entries:selected,coverage:{shared_events:selected.length,observed_dates:[...days].sort(),complete_coverage:false}};
}
const claim=obj({text:str,evidence_ids:list(str,6)});
export const WEEKLY_SCHEMA=obj({
 summary:claim,changes:list(claim,3),important_events:list(claim,3),actions:list(claim,3),decisions:list(claim,3),experiments:list(claim,3),results:list(claim,3),
 diagnosis:nullable(claim),alerts:list(claim,2),learnings:list(obj({text:str,evidence_ids:list(str,6),strength:{type:"string",enum:["PRELIMINARY","SUPPORTED","INCONCLUSIVE"]}}),2),
 hypotheses:list(claim,2),next_priority:nullable(claim),recommended_actions:list(claim,2),primary_indicator:nullable(str),next_review:nullable(str),
 confidence:{type:"string",enum:["LOW","MEDIUM","HIGH"]},missing_data:list(str,3),
});
type Claim={text:string;evidence_ids:string[]};
export type Weekly={summary:Claim;changes:Claim[];important_events:Claim[];actions:Claim[];decisions:Claim[];experiments:Claim[];results:Claim[];diagnosis:Claim|null;alerts:Claim[];learnings:(Claim&{strength:"PRELIMINARY"|"SUPPORTED"|"INCONCLUSIVE"})[];hypotheses:Claim[];next_priority:Claim|null;recommended_actions:Claim[];primary_indicator:string|null;next_review:string|null;confidence:"LOW"|"MEDIUM"|"HIGH";missing_data:string[]};
// Reuse the strict schema validator from 9.2.1, then validate provenance and cap conclusions.
export function validateWeekly(raw:unknown,entries:Entry[]):Weekly {
 if(!validateSchema(raw,WEEKLY_SCHEMA))throw Error("INVALID_WEEKLY_OUTPUT");
 const w=raw as Weekly;
 const claims=[w.summary,w.diagnosis,w.next_priority,...w.changes,...w.important_events,...w.actions,...w.decisions,...w.experiments,...w.results,...w.alerts,...w.learnings,...w.hypotheses,...w.recommended_actions].filter((c):c is Claim=>!!c);
 for(const c of claims)if(!c.evidence_ids.length||c.evidence_ids.some(id=>!entries.some(e=>e.id===id&&e.status==="ACTIVE")))throw Error("INVALID_WEEKLY_PROVENANCE");
 // Findings cannot be justified solely with an unproven hypothesis.
 for(const c of [w.summary,w.diagnosis,...w.results,...w.learnings].filter((c):c is Claim=>!!c)){
  if(c.evidence_ids.every(id=>entries.find(e=>e.id===id)?.entry_type==="HYPOTHESIS"))throw Error("WEEKLY_HYPOTHESIS_AS_FACT");
 }
 for(const l of w.learnings){
  const evidence=entries.filter(e=>l.evidence_ids.includes(e.id));
  if(l.strength==="SUPPORTED"&&(new Set(evidence.map(e=>e.event_date)).size<3||!evidence.some(e=>e.entry_type==="RESULT")))l.strength="PRELIMINARY";
 }
 // Observational, sparse chat data never warrants high causal confidence or a firm commitment.
 if(w.confidence==="HIGH")w.confidence="MEDIUM";
 return w;
}
