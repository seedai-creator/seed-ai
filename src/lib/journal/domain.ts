import { validateSchema } from "../reliability/contracts";

export const ENTRY_TYPES = ["FACT","METRIC","PROBLEM","OPPORTUNITY","DECISION","HYPOTHESIS","EXPERIMENT","RESULT","LEARNING"] as const;
export type EntryType = typeof ENTRY_TYPES[number];
export const obj = (properties: Record<string, object>) => ({type:"object",additionalProperties:false,required:Object.keys(properties),properties});
export const str = {type:"string",minLength:1,maxLength:600};
export const nullable = (schema:object) => ({anyOf:[schema,{type:"null"}]});
export const list = (items:object,maxItems=8) => ({type:"array",items,maxItems});
const enumeration = (values:readonly string[]) => ({type:"string",enum:values});
export const EXTRACTION_SCHEMA = obj({entries:list(obj({
  entry_type:enumeration(ENTRY_TYPES), description:str, evidence:str,
  scope:enumeration(["CURRENT_COMPANY","OTHER","SIMULATION","AMBIGUOUS"]),
  epistemic:enumeration(["REPORTED","POSSIBLE"]), confidence:enumeration(["LOW","MEDIUM","HIGH"]),
  operation:enumeration(["NEW","ENRICH","CORRECT"]), target_id:nullable(str), target_version:nullable({type:"number"}),
  period:enumeration(["TODAY","YESTERDAY","THIS_WEEK","LAST_WEEK","THIS_MONTH","LAST_MONTH","EXPLICIT","UNKNOWN"]),
  start:nullable(str), end:nullable(str), metric_type:nullable(enumeration(["leads","sales","marketing_spend","revenue","cost","refunds","repeat_sales"])),
  value:nullable({type:"number"}), unit:nullable(enumeration(["count","money"])), currency_code:nullable(str),
  channel:nullable(str), product:nullable(str), location:nullable(str),
  entity_refs:list(obj({type:enumeration(["STRATEGY","ACTION","DECISION","EXPERIMENT","DIAGNOSIS"]),id:str}),3),
  related_ids:list(str,4), hypothesis:nullable(str), action:nullable(str), indicator:nullable(str),
  baseline:nullable(str), target:nullable(str), review_date:nullable(str),
}),12)});
export type EntityRef={type:"STRATEGY"|"ACTION"|"DECISION"|"EXPERIMENT"|"DIAGNOSIS";id:string};
export type Candidate = {
 entity_refs:EntityRef[];
 entry_type:EntryType;description:string;evidence:string;scope:"CURRENT_COMPANY"|"OTHER"|"SIMULATION"|"AMBIGUOUS";
 epistemic:"REPORTED"|"POSSIBLE";confidence:"LOW"|"MEDIUM"|"HIGH";operation:"NEW"|"ENRICH"|"CORRECT";target_id:string|null;target_version:number|null;
 period:"TODAY"|"YESTERDAY"|"THIS_WEEK"|"LAST_WEEK"|"THIS_MONTH"|"LAST_MONTH"|"EXPLICIT"|"UNKNOWN";
 start:string|null;end:string|null;metric_type:string|null;value:number|null;unit:string|null;currency_code:string|null;
 channel:string|null;product:string|null;location:string|null;related_ids:string[];hypothesis:string|null;action:string|null;indicator:string|null;baseline:string|null;target:string|null;review_date:string|null;
};
export type Entry = {
 metric_data?: import('../goals/domain').ObservationData|null;
 id:string;company_id:string;user_id:string;source_message_id:string|null;entry_type:EntryType;description:string;evidence:string;
 event_date:string|null;period_start:string|null;period_end:string|null;metric_type:string|null;value:number|null;unit:string|null;currency_code:string|null;
 channel:string|null;product:string|null;location:string|null;confidence:"LOW"|"MEDIUM"|"HIGH";status:string;version:number;manual:boolean;created_at:string;
 metadata: {entity_refs?:EntityRef[];related_ids?:string[];hypothesis?:string|null;action?:string|null;indicator?:string|null;baseline?:string|null;target?:string|null;review_date?:string|null};
};
export function validDate(s:string):boolean {return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;}
export function localDay(at:Date,timezone:string|null):string|null {
 if(!timezone)return null;
 try { const p=new Intl.DateTimeFormat("en-CA",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(at);return ["year","month","day"].map(k=>p.find(v=>v.type===k)!.value).join("-"); } catch {return null;}
}
export function shiftDay(day:string,days:number):string {const d=new Date(day+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function periodBounds(period:Candidate["period"],day:string|null,start:string|null=null,end:string|null=null):[string|null,string|null] {
 if(period==="EXPLICIT") {if(!start||!end||!validDate(start)||!validDate(end)||start>end)throw Error("INVALID_EVENT_PERIOD");return [start,end];}
 if(!day||period==="UNKNOWN")return [null,null];
 if(period==="TODAY")return [day,day];
 if(period==="YESTERDAY"){const d=shiftDay(day,-1);return [d,d];}
 const d=new Date(day+"T12:00:00Z");
 if(period==="THIS_WEEK"||period==="LAST_WEEK"){const monday=shiftDay(day,-((d.getUTCDay()+6)%7)-(period==="LAST_WEEK"?7:0));return [monday,period==="THIS_WEEK"?day:shiftDay(monday,6)];}
 const first=day.slice(0,8)+"01";
 if(period==="THIS_MONTH")return [first,day];
 const last=shiftDay(first,-1);return [last.slice(0,8)+"01",last];
}
// Literal numeric evidence only: ambiguous separators or written numbers stay unquantified.
export function hasNumber(quote:string,value:number):boolean {
 return (quote.match(/\d+(?:[.,]\d+)*/g)??[]).some(s=>{
  const normalized=s.includes(",")&&s.includes(".")?(s.lastIndexOf(",")>s.lastIndexOf(".")?s.replaceAll(".","").replace(",","."):s.replaceAll(",","")):s.replace(",",".");
  return Number(normalized)===value;
 });
}
export function normalizeExtraction(raw:unknown,message:string,at:Date,timezone:string|null,recent:Entry[],entities:EntityRef[]=[]) {
 if(!validateSchema(raw,EXTRACTION_SCHEMA))throw Error("INVALID_JOURNAL_OUTPUT");
 const entries=(raw as {entries:Candidate[]}).entries;
 return entries.filter(c=>c.scope==="CURRENT_COMPANY"&&message.includes(c.evidence)).map(c=>{
  if(c.epistemic==="POSSIBLE"&&!["HYPOTHESIS","OPPORTUNITY"].includes(c.entry_type)) c={...c,entry_type:"HYPOTHESIS",value:null,metric_type:null,unit:null,currency_code:null};
  const old=c.target_id?recent.find(e=>e.id===c.target_id):null;
  if(c.operation!=="NEW"&&(!old||old.version!==c.target_version||old.entry_type!==c.entry_type))throw Error("INVALID_JOURNAL_TARGET");
  if(c.operation==="NEW"&&c.target_id)throw Error("INVALID_JOURNAL_TARGET");
  if(c.operation==="ENRICH"&&old&&c.value!==old.value)throw Error("ENRICH_CHANGED_VALUE");
  if(c.value!==null&&(!(c.operation==="ENRICH"&&old?.value===c.value)&&!hasNumber(c.evidence,c.value)||c.value<0||c.value>1e15||c.entry_type!=="METRIC"))throw Error("UNSUPPORTED_JOURNAL_NUMBER");
  if(c.entry_type==="METRIC"&&(!c.metric_type||c.value===null||!c.unit))throw Error("INCOMPLETE_JOURNAL_METRIC");
  if(c.unit==="count"&&(c.currency_code!==null||!Number.isSafeInteger(c.value)))throw Error("INVALID_COUNT");
  if(c.currency_code!==null&&!/^[A-Z]{3}$/.test(c.currency_code))throw Error("INVALID_CURRENCY");
  if(c.currency_code&&!((c.operation!=="NEW"&&old?.currency_code===c.currency_code)||c.evidence.includes(c.currency_code)||(c.currency_code==="BRL"&&c.evidence.includes("R$"))||(c.currency_code==="EUR"&&c.evidence.includes("€"))||(c.currency_code==="GBP"&&c.evidence.includes("£"))))c={...c,currency_code:null};
  if(c.entry_type==="METRIC"&&(["leads","sales","repeat_sales"].includes(c.metric_type!)?c.unit!=="count":c.unit!=="money"))throw Error("INVALID_METRIC_UNIT");
  if(c.review_date!==null&&!validDate(c.review_date))throw Error("INVALID_REVIEW_DATE");
  const dates=c.operation==="ENRICH"&&old?[old.period_start,old.period_end]:periodBounds(c.period,localDay(at,timezone),c.start,c.end);
  return {...c,period_start:dates[0]??old?.period_start??null,period_end:dates[1]??old?.period_end??null,
   entity_refs:c.entity_refs.filter(ref=>entities.some(e=>e.type===ref.type&&e.id===ref.id)),
   related_ids:c.related_ids.filter(id=>recent.some(e=>e.id===id)).slice(0,4)};
 });
}
export function selectJournalContext(entries:Entry[],company:string,query:string,now:Date,limit=6) {
 const words=query.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)??[];
 return entries.filter(e=>e.company_id===company&&e.status==="ACTIVE"&&new Date(e.created_at).getTime()>now.getTime()-90*86400000)
  .map(e=>({e,score:words.filter(w=>(e.description+" "+e.channel+" "+e.product+" "+e.metric_type).toLowerCase().includes(w)).length}))
  .filter(x=>x.score>0).sort((a,b)=>b.score-a.score||b.e.created_at.localeCompare(a.e.created_at)).slice(0,Math.min(limit,6)).map(({e})=>({
   key:"journal_"+e.id,kind:["PROBLEM","OPPORTUNITY","EXPERIMENT"].includes(e.entry_type)?"OBSERVATION":e.entry_type,
   value:e.description+(e.value!==null?` [${e.metric_type}: ${e.value} ${e.currency_code??e.unit}]`:"")+` [${e.period_start??"?"} / ${e.period_end??"?"}]`,
   observed_at:e.event_date??e.created_at,source_id:e.id,version:e.version,
  }));
}
