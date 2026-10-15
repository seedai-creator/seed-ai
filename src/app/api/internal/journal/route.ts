import {logEvent} from '../../../../lib/operations/logging';
import {processOperationalAlerts} from '@/lib/operations/alert-worker';
import {recordSchedulerCompletion} from '@/lib/operations/health-server';
import {scheduleGrowth,processGrowthJob} from '@/lib/growth/server';
import {externalEnabled} from '@/lib/external/domain';
import {processExternalJob} from '@/lib/external/server';
import {queueExternalWatches} from '@/lib/external/watches';
import {radarEnabled} from '@/lib/radar/domain';
import {processRadarJob} from '@/lib/radar/server';
import { timingSafeEqual } from "node:crypto";
import { commercialDatabase } from "@/lib/commercial/server";
import { journalEnabled,processJournalJob,queueWeekly } from "@/lib/journal/server";
import { COMPANY_BATCH_SIZE,scheduledCompanyRange } from "@/lib/journal/schedule";
import {processBusinessModelJob} from '@/lib/business-model/server';
export const runtime="nodejs";
export const maxDuration=120;
export async function GET(request:Request){
 const expected=process.env.CRON_SECRET;
 const actual=request.headers.get("authorization")??"";
 const target="Bearer "+expected;
 if(!expected||Buffer.byteLength(actual)!==Buffer.byteLength(target)||!timingSafeEqual(Buffer.from(actual),Buffer.from(target)))return new Response(null,{status:401});
 const alerts=processOperationalAlerts();
 let completed=false;
 try{
 if(!journalEnabled()&&!radarEnabled()&&!externalEnabled()){completed=true;return Response.json({enabled:false});}
 const afterId=new URL(request.url).searchParams.get("after");
 if(afterId&&!/^[a-f0-9-]{36}$/.test(afterId))return new Response(null,{status:400});
 const db=commercialDatabase();
 let query=db.from("companies").select("id,company_members(user_id,role)").order("id");
 if(afterId)query=query.gt("id",afterId).limit(COMPANY_BATCH_SIZE);
 else{
  const total=await db.from("companies").select("id",{count:"exact",head:true});
  if(total.error||total.count===null)return new Response(null,{status:503});
  const range=scheduledCompanyRange(total.count);
  query=query.range(range.from,range.to);
 }
 const companies=await query;
 if(companies.error)return new Response(null,{status:503});
 for(const company of companies.data){
  const owner=company.company_members.find(m=>m.role==="owner");
  if(owner)try{await scheduleGrowth(company.id,owner.user_id);await queueWeekly(company.id,owner.user_id);}catch{logEvent('journal',{code:"WEEKLY_SCHEDULE_FAILED",company:company.id},'error');}
 }
 const externalWork=externalEnabled()?(async()=>{try{await queueExternalWatches();await processExternalJob();}catch{logEvent('external',{code:'SCHEDULE_FAILED'},'error');}})():Promise.resolve();
 if(journalEnabled()){await processJournalJob();await processBusinessModelJob();}
 if(radarEnabled())try{await processRadarJob();}catch{logEvent('radar',{code:'SCHEDULE_FAILED'},'error');}
 await processGrowthJob();
 await externalWork;
 completed=true;
 return Response.json({next:companies.data.length===25?companies.data.at(-1)?.id:null},{headers:{"Cache-Control":"no-store"}});
 }finally{await alerts;if(completed)await recordSchedulerCompletion();}
}
