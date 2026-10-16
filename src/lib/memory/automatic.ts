export const MEMORY_KINDS = ["FACT", "METRIC", "GOAL", "BUSINESS_PREFERENCE", "CONSTRAINT", "DECISION", "HYPOTHESIS", "RESULT", "LEARNING"] as const;
export type MemoryKind = typeof MEMORY_KINDS[number];
export type MemoryItem = { id:string; company_id:string; key:string; kind:MemoryKind; value:string; evidence:string; observed_at:string; updated_at:string; created_at:string; version:number; manual:boolean; deleted:boolean };
export type MemoryCandidate = { key:string; kind:MemoryKind; value:string; evidence:string; certainty:"EXPLICIT"|"AMBIGUOUS"; scope:"CURRENT_COMPANY"|"OTHER"|"SIMULATION"; observed_at:string|null; replaces_current:boolean };
export const AUTOMATIC_MEMORY_SCHEMA = {type:"array",maxItems:8,items:{type:"object",additionalProperties:false,required:["key","kind","value","evidence","certainty","scope","observed_at","replaces_current"],properties:{key:{type:"string"},kind:{type:"string",enum:MEMORY_KINDS},value:{type:"string"},evidence:{type:"string"},certainty:{type:"string",enum:["EXPLICIT","AMBIGUOUS"]},scope:{type:"string",enum:["CURRENT_COMPANY","OTHER","SIMULATION"]},observed_at:{anyOf:[{type:"string"},{type:"null"}]},replaces_current:{type:"boolean"}}}};
export function parseMemoryCandidates(raw:unknown):MemoryCandidate[]{
 if(raw===undefined)return [];
 if(!Array.isArray(raw)||raw.length>8)throw Error("Invalid memory");
 return raw.map(v=>{
  if(!v||typeof v!=="object"||!MEMORY_KINDS.includes(v.kind)||typeof v.key!=="string"||!/^[a-z][a-z0-9_]{1,79}$/.test(v.key)||typeof v.value!=="string"||!v.value.trim()||v.value.length>500||typeof v.evidence!=="string"||!v.evidence.trim()||v.evidence.length>500||!["EXPLICIT","AMBIGUOUS"].includes(v.certainty)||!["CURRENT_COMPANY","OTHER","SIMULATION"].includes(v.scope)||typeof v.replaces_current!=="boolean"||(v.observed_at!==null&&(typeof v.observed_at!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v.observed_at)||(!Number.isFinite(Date.parse(v.observed_at))||new Date(v.observed_at).toISOString().slice(0,10)!==v.observed_at))))throw Error("Invalid memory");
  return v as MemoryCandidate;
 });
}
export function eligibleMemories(items:MemoryCandidate[],message:string){
 return items.filter((v,i)=>v.scope==="CURRENT_COMPANY"&&v.certainty==="EXPLICIT"&&message.includes(v.evidence)&&items.findIndex(x=>x.key===v.key)===i);
}
// Bounded relevance selection, never another tenant, deleted entries or historical versions.
export function relevantMemory(items:MemoryItem[],company:string,query:string,limit=8){
 const words=new Set(query.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu)??[]);
 return items.filter(x=>x.company_id===company&&!x.deleted).map(x=>({x,score:(["GOAL","CONSTRAINT"].includes(x.kind)?3:0)+(x.manual?1:0)+[...words].filter(w=>(x.key+" "+x.value).toLocaleLowerCase().includes(w)).length*4})).sort((a,b)=>b.score-a.score||b.x.observed_at.localeCompare(a.x.observed_at)).slice(0,Math.min(limit,8)).map(({x})=>({key:x.key,kind:x.kind,value:x.value,observed_at:x.observed_at,manual:x.manual,source_id:x.id,version:x.version}));
}
