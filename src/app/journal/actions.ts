"use server";
import { after } from "next/server";
import { companyContext } from "@/lib/auth/context";
import { validId } from "@/lib/auth/validation";
import { journalEnabled,journalRows,queueWeekly,processJournalJob } from "@/lib/journal/server";
import {hasNumber,type Entry } from "@/lib/journal/domain";
import type { Weekly,Metric } from "@/lib/journal/weekly";
export type ReportRow={id:string;period_start:string;period_end:string;locale:string;structured_report:{goals?:{key:string;kind:string;value:string}[];external_research?:{source_id:string;value:string}[];report:Weekly;key_metrics:Metric[];coverage:{observed_dates:string[]};partial:boolean}};
export async function journalHistory(companyId:string,offset=0):Promise<Entry[]>{
 const c=await companyContext(companyId);
 if(!Number.isSafeInteger(offset)||offset<0||offset>100000)throw Error("INVALID_PAGE");
 return journalEnabled()?journalRows(c.companyId,undefined,offset,true):[];
}
export async function weeklyReports(companyId:string):Promise<ReportRow[]>{
 const c=await companyContext(companyId);
 if(!journalEnabled())return [];
 const r=await c.supabase.from("weekly_intelligence_reports").select("id,period_start,period_end,locale,structured_report").eq("company_id",c.companyId).eq("status","AVAILABLE").order("generated_at",{ascending:false}).limit(8);
 if(r.error)throw Error("WEEKLY_UNAVAILABLE");return r.data as ReportRow[];
}
export async function generateWeekly(companyId:string){
 const c=await companyContext(companyId);
 const result=await queueWeekly(c.companyId,c.userId,true);
 if(result==="QUEUED")after(async()=>{try{await processJournalJob(c.companyId);}catch{console.error("[seed:journal]",{code:"WORKER_WAKE_FAILED"});}});
 return result;
}
export async function correctJournal(companyId:string,id:string,version:number,description:string,value:number|null,remove:boolean){
 const c=await companyContext(companyId);
 if(!validId(id)||!Number.isSafeInteger(version)||version<1||typeof description!=="string"||description.length>600||(value!==null&&(!Number.isFinite(value)||value<0||value>1e15))||typeof remove!=="boolean")throw Error("INVALID_JOURNAL_CORRECTION");
 if(value!==null&&!remove&&!hasNumber(description,value))throw Error("INVALID_JOURNAL_CORRECTION");
 const result=await c.supabase.rpc("edit_journal_entry",{p_company:c.companyId,p_id:id,p_version:version,p_description:description,p_value:value,p_delete:remove});
 if(result.error)throw Error("JOURNAL_CHANGED");
}
