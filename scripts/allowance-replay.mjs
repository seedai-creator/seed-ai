// Offline workload replay, not a forecast. Preserve every billed sub-call,
// reservation, incomplete interaction and day; company switches never reset usage.
const SCALE=1e12;
const amount=n=>{if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>1000)throw Error('INVALID_COST');return BigInt(Math.round(n*SCALE));};
const usd=n=>Number(n)/SCALE;
export function replayAllowance({capUsd,dailyUsd,analysisLimit,companyLimit,events}){
 const cap=amount(capUsd),dayCap=amount(dailyUsd);
 if(!cap||!dayCap||!(analysisLimit===null||Number.isSafeInteger(analysisLimit)&&analysisLimit>0)||!Number.isSafeInteger(companyLimit)||companyLimit<1||!Array.isArray(events))throw Error('INVALID_POLICY');
 let spent=0n,analyses=0,previousDay=-1;
 const days=new Map(),done={},attempted={},blocked=[],completedIds=new Set(),skipped=[],overruns=[],coverageReduced=[];
 for(const event of events){
  if(!Number.isSafeInteger(event.day)||event.day<0||event.day>29||event.day<previousDay||!Number.isSafeInteger(event.company)||event.company<1||event.company>companyLimit||!Array.isArray(event.calls)||!event.calls.length||typeof event.kind!=='string')throw Error('INVALID_WORKLOAD');
  previousDay=event.day;
  if(event.dependsOn&&!completedIds.has(event.dependsOn)){skipped.push({kind:event.kind,reason:'PARENT_NOT_COMPLETED'});continue;}
  attempted[event.kind]=(attempted[event.kind]??0)+1;
  let completed=true;
  for(const call of event.calls){
   const reservations=(call.reservationOptions??[call.reservationUsd]).map(amount),cost=amount(call.chargedUsd);
   if(!reservations.length||reservations.some((v,i)=>v===0n||i>0&&v>reservations[i-1]))throw Error('INVALID_RESERVATION_OPTIONS');
   const daily=days.get(event.day)??0n;
   const reserve=reservations.find(r=>spent+r<=cap&&daily+r<=dayCap)??reservations.at(-1);
   if(!reserve||typeof call.feature!=='string')throw Error('INVALID_CALL');
   const reason=analysisLimit!==null&&['classification','diagnosis'].includes(call.feature)&&analyses>=analysisLimit?'ANALYSIS_LIMIT':spent+reserve>cap?'CYCLE_BUDGET':daily+reserve>dayCap?'DAILY_BUDGET':null;
   if(reason){blocked.push({day:event.day+1,company:event.company,kind:event.kind,reason,spentUsd:usd(spent),neededReservationUsd:usd(reserve)});completed=false;break;}
   if(reserve!==reservations[0])coverageReduced.push({day:event.day+1,company:event.company,kind:event.kind,reservedUsd:usd(reserve)});
   if(cost>reserve)overruns.push({kind:event.kind,reservedUsd:usd(reserve),accountedUsd:usd(cost)});
   spent+=cost;days.set(event.day,daily+cost);if(call.feature==='diagnosis')analyses++;
  }
  if(completed){done[event.kind]=(done[event.kind]??0)+1;if(event.eventId)completedIds.add(event.eventId);}
 }
 return {spentUsd:usd(spent),capUsd,analyses,attempted,completed:done,blocked,skipped,overruns,coverageReduced,firstBlock:blocked[0]??null,allCompleted:blocked.length===0};
}

export function monthlyWorkload({companies,conversationsPerCompany,researchPerCompany,conversationSamples,journalSample,weeklySample,researchSample,researchDayOffset=0}){
 if(![companies,conversationsPerCompany,researchPerCompany].every(n=>Number.isSafeInteger(n)&&n>=0)||!companies||!conversationSamples.length)throw Error('INVALID_WORKLOAD');
 if(!Number.isSafeInteger(researchDayOffset)||researchDayOffset<0||researchDayOffset>29)throw Error('INVALID_WORKLOAD');
 const events=[];
 for(let company=1;company<=companies;company++){
  for(let i=0;i<conversationsPerCompany;i++){
   const day=Math.floor(i*30/conversationsPerCompany);
   const eventId=company+':'+i;
   events.push({day,company,kind:'conversation',eventId,calls:conversationSamples[(i+company-1)%conversationSamples.length]});
   events.push({day,company,kind:'memory',dependsOn:eventId,calls:journalSample});
  }
  for(const day of [6,13,20,27])events.push({day,company,kind:'weekly',calls:weeklySample});
  for(let i=0;i<researchPerCompany;i++)events.push({day:(Math.floor((i+.5)*30/researchPerCompany)+(company-1)*researchDayOffset)%30,company,kind:'research',calls:researchSample});
 }
 return events.sort((a,b)=>a.day-b.day||a.company-b.company);
}
