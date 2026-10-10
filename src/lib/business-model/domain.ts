import { validateSchema } from '../reliability/contracts';
import { literalNumber } from '../reliability/validate';
import { obj, list, nullable, validDate } from '../journal/domain';

export const SCHEMA_VERSION = '9.5.1';
export const ENTITY_TYPES = ['COMPANY','PRODUCT_SERVICE','OFFER','CUSTOMER_SEGMENT','CHANNEL','SALES_PROCESS','SALES_STAGE','TEAM','TEAM_ROLE','OPERATION','CAPACITY','COST_STRUCTURE','REVENUE_STREAM','LOCATION','SUPPLIER','GOAL','CONSTRAINT','METRIC','MARKET','CUSTOMER_JOURNEY'] as const;
export type EntityType = typeof ENTITY_TYPES[number];
export const RELATIONS = ['SELLS','TARGETS','PROMOTES','GENERATES','USES','OPERATES','CONSUMES','DELIVERS','DEPENDS_ON','LIMITS','SERVES','PARTICIPATES_IN','NEXT','HAS','MEASURES'] as const;
export type RelationType = typeof RELATIONS[number];
export const ATTRIBUTES = ['description','price','margin','count','capacity','cost','revenue','sales','leads','conversion','ticket','frequency','retention','response_time','share','goal','constraint','role','status','primary','industry','business_type','cash','capital','owner_dependence'] as const;
export type Attribute = typeof ATTRIBUTES[number];
export type Knowledge = 'FACT'|'METRIC'|'OBSERVATION'|'HYPOTHESIS'|'INFERENCE'|'DERIVED_METRIC';
export type State = 'CONFIRMED'|'PROVISIONAL'|'CONFLICTING'|'STALE'|'UNKNOWN';
const en = (values:readonly string[]) => ({type:'string',enum:values});
const text = {type:'string',minLength:1,maxLength:500};
const short = {type:'string',minLength:1,maxLength:120};
const num = nullable({type:'number',minimum:0,maximum:1e15});
export const VALUE_SCHEMA = obj({text:nullable(text),value:num,min:num,max:num,unit:nullable(short),currency:nullable({type:'string',pattern:'^[A-Z]{3}$'}),approximate:{type:'boolean'},period_start:nullable(short),period_end:nullable(short)});
export type Value = {text:string|null;value:number|null;min:number|null;max:number|null;unit:string|null;currency:string|null;approximate:boolean;period_start:string|null;period_end:string|null};
export const EMPTY_VALUE:Value = {text:null,value:null,min:null,max:null,unit:null,currency:null,approximate:false,period_start:null,period_end:null};
export const MODEL_SCHEMA = obj({entities:list(obj({key:short,type:en(ENTITY_TYPES),name:short,scope:en(['CURRENT_COMPANY','OTHER','SIMULATION','AMBIGUOUS']),existing_id:nullable(short),version:nullable({type:'integer',minimum:1}),reference_id:nullable(short),evidence:text}),12),
 observations:list(obj({entity:short,attribute:en(ATTRIBUTES),data:VALUE_SCHEMA,kind:en(['FACT','METRIC','OBSERVATION','HYPOTHESIS','INFERENCE']),confidence:en(['LOW','MEDIUM','HIGH']),evidence:text,operation:en(['NEW','CHANGE','CORRECTION']),observed_on:nullable(short),structural:{type:'boolean'},memory_id:nullable(short)}),20),
 relationships:list(obj({source:short,target:short,type:en(RELATIONS),kind:en(['FACT','OBSERVATION','HYPOTHESIS','INFERENCE']),confidence:en(['LOW','MEDIUM','HIGH']),evidence:text,status:en(['ACTIVE','INACTIVE','PROVISIONAL'])}),16)});
export type ExtractEntity = {key:string;type:EntityType;name:string;scope:'CURRENT_COMPANY'|'OTHER'|'SIMULATION'|'AMBIGUOUS';existing_id:string|null;version:number|null;reference_id:string|null;evidence:string};
export type Observation = {entity:string;attribute:Attribute;data:Value;kind:Exclude<Knowledge,'DERIVED_METRIC'>;confidence:'LOW'|'MEDIUM'|'HIGH';evidence:string;operation:'NEW'|'CHANGE'|'CORRECTION';observed_on:string|null;structural:boolean;memory_id:string|null};
export type ExtractRelation = {source:string;target:string;type:RelationType;kind:'FACT'|'OBSERVATION'|'HYPOTHESIS'|'INFERENCE';confidence:'LOW'|'MEDIUM'|'HIGH';evidence:string;status:'ACTIVE'|'INACTIVE'|'PROVISIONAL'};
export type Extraction = {entities:ExtractEntity[];observations:Observation[];relationships:ExtractRelation[]};
export type Entity = {id:string;company_id:string;type:EntityType;name:string;canonical_name:string;version:number;reference_id:string|null;reference_table:string|null;status:string};
export type StoredObservation = {id:string;company_id:string;entity_id:string;attribute:Attribute;data:Value;kind:Knowledge;state:State;confidence:'LOW'|'MEDIUM'|'HIGH';observed_at:string;source_type:string;source_message_id:string|null;memory_id:string|null;version:number;is_current:boolean;scope_key:string};
export type Relationship = {id:string;company_id:string;source_id:string;target_id:string;type:RelationType;kind:Knowledge;status:string;confidence:string};

export function canonicalName(type:EntityType,name:string) {
 const s=name.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 // Only unambiguous ad-product aliases. Bare Meta, Instagram and organic are distinct.
 if(type==='CHANNEL'&&['meta ads','facebook ads','anuncios da meta','anuncios de meta'].includes(s))return 'meta ads';
 if(type==='CHANNEL'&&['whats','whatsapp','whatsapp business'].includes(s))return 'whatsapp';
 return s;
}
export function allowedRelation(a:EntityType,r:RelationType,b:EntityType):boolean {
 const pairs:Partial<Record<RelationType,readonly string[]>>={
 SELLS:['COMPANY:PRODUCT_SERVICE'],TARGETS:['PRODUCT_SERVICE:CUSTOMER_SEGMENT','OFFER:CUSTOMER_SEGMENT'],PROMOTES:['OFFER:PRODUCT_SERVICE'],
 GENERATES:['CHANNEL:SALES_PROCESS','CHANNEL:SALES_STAGE','PRODUCT_SERVICE:REVENUE_STREAM'],
 USES:['CUSTOMER_SEGMENT:CHANNEL','SALES_PROCESS:CHANNEL','TEAM:CHANNEL','OPERATION:SUPPLIER'],
 OPERATES:['TEAM:SALES_PROCESS','TEAM:OPERATION','TEAM_ROLE:SALES_PROCESS','TEAM_ROLE:OPERATION'],CONSUMES:['PRODUCT_SERVICE:CAPACITY','OPERATION:CAPACITY'],
 DELIVERS:['OPERATION:PRODUCT_SERVICE'],LIMITS:['CONSTRAINT:GOAL','CONSTRAINT:OPERATION','CONSTRAINT:CAPACITY','CONSTRAINT:SALES_PROCESS','CONSTRAINT:TEAM'],
 SERVES:['LOCATION:CUSTOMER_SEGMENT'],PARTICIPATES_IN:['CHANNEL:SALES_PROCESS','SALES_STAGE:SALES_PROCESS','SALES_STAGE:CUSTOMER_JOURNEY'],
 };
 if(pairs[r])return pairs[r]!.includes(a+':'+b);
 if(r==='HAS')return a==='COMPANY'&&b!=='COMPANY'||a==='SALES_PROCESS'&&b==='SALES_STAGE'||a==='TEAM'&&b==='TEAM_ROLE';
 if(r==='MEASURES')return a==='METRIC'&&b!=='METRIC';
 if(r==='DEPENDS_ON')return ['GOAL','METRIC','OPERATION','SALES_PROCESS','CAPACITY','REVENUE_STREAM'].includes(a)&&['METRIC','CHANNEL','TEAM','CAPACITY','OPERATION','SUPPLIER','PRODUCT_SERVICE','OFFER','SALES_PROCESS','COST_STRUCTURE','CONSTRAINT'].includes(b);
 if(r==='NEXT')return [a,b].every(t=>['CHANNEL','SALES_STAGE','OPERATION','TEAM','TEAM_ROLE'].includes(t));
 return false;
}
export function validateValue(v:Value) {
 if(!validateSchema(v,VALUE_SCHEMA))throw Error('BUSINESS_VALUE_INVALID');
 if((v.min===null)!==(v.max===null)||v.min!==null&&(v.min>v.max!||v.value!==null))throw Error('BUSINESS_RANGE_INVALID');
 if(v.value===null&&v.min===null&&!v.text)throw Error('BUSINESS_VALUE_EMPTY');
 if(v.currency&&v.unit!=='money')throw Error('BUSINESS_CURRENCY_INVALID');
 if(v.currency&&!Intl.supportedValuesOf('currency').includes(v.currency))throw Error('BUSINESS_CURRENCY_INVALID');
 if(v.unit==='money'&&!v.currency)throw Error('BUSINESS_CURRENCY_REQUIRED');
 if((v.period_start===null)!==(v.period_end===null)||v.period_start&&(!validDate(v.period_start)||!validDate(v.period_end!)||v.period_start>v.period_end!))throw Error('BUSINESS_PERIOD_INVALID');
 return v;
}
export function validateAttributeValue(attribute:Attribute,v:Value){
 validateValue(v);
 const numbers=['price','margin','count','capacity','cost','revenue','sales','leads','conversion','ticket','frequency','retention','response_time','share','cash','capital'];
 if(numbers.includes(attribute)&&v.value===null&&v.min===null&&!(attribute==='share'&&/\b(restante|resto|remaining|remainder)\b/i.test(v.text??'')))throw Error('BUSINESS_NUMERIC_VALUE_REQUIRED');
 if(['price','cost','revenue','ticket','cash','capital'].includes(attribute)&&v.unit!=='money')throw Error('BUSINESS_MONEY_REQUIRED');
 if(['margin','conversion','retention','share'].includes(attribute)&&(v.unit!=='percent'||[v.value,v.min,v.max].some(n=>n!==null&&n>100)))throw Error('BUSINESS_PERCENT_INVALID');
 if(['count','sales','leads'].includes(attribute)&&[v.value,v.min,v.max].some(n=>n!==null&&!Number.isSafeInteger(n)))throw Error('BUSINESS_COUNT_INVALID');
 if(attribute==='status'&&!['ACTIVE','INACTIVE','DISCONTINUED','PLANNED'].includes(v.text??''))throw Error('BUSINESS_STATUS_INVALID');
 return v;
}
export function supportedNumber(quote:string,value:number) {
 if(literalNumber(quote,value))return true;
 // Explicit magnitude is retained; ambiguous thousands separators are not guessed.
 for(const m of quote.matchAll(/(\d+(?:[.,]\d{1,2})?)\s*(mil\b|thousand\b|k\b|milh[oõ]es\b|million\b|millones\b)/gi))if(Number(m[1].replace(',','.'))*(/^(mil$|thousand$|k$)/i.test(m[2])?1000:1e6)===value)return true;
 const words:Record<string,number>={um:1,uma:1,one:1,uno:1,dois:2,duas:2,two:2,dos:2,tres:3,three:3,quatro:4,four:4,cuatro:4,cinco:5,five:5,seis:6,six:6,sete:7,seven:7,siete:7,oito:8,eight:8,ocho:8,nove:9,nine:9,nueve:9,dez:10,ten:10,diez:10};
 return canonicalName('COMPANY',quote).split(' ').some(w=>words[w]===value);
}
export function normalizeModel(raw:unknown,message:string,known:Entity[],references:{id:string;type:EntityType|'MEMORY'}[]=[],at=new Date()):Extraction {
 if(!validateSchema(raw,MODEL_SCHEMA))throw Error('BUSINESS_EXTRACTION_INVALID');
 const all=raw as Extraction, data={...all,entities:all.entities.filter(e=>e.scope==='CURRENT_COMPANY')}, keys=new Map<string,ExtractEntity>();
 const quote=(q:string)=>{if(!message.includes(q))throw Error('BUSINESS_SOURCE_INVALID');};
 for(const e of data.entities){quote(e.evidence);if(keys.has(e.key)||!canonicalName(e.type,e.name))throw Error('BUSINESS_IDENTITY_INVALID');keys.set(e.key,e);
  if(e.existing_id){const found=known.find(n=>n.id===e.existing_id&&n.type===e.type&&n.version===e.version);if(!found)throw Error('BUSINESS_ENTITY_CHANGED');}
  else if(e.version!==null)throw Error('BUSINESS_ENTITY_CHANGED');
  if(['COMPANY','GOAL','METRIC'].includes(e.type)&&!e.reference_id)throw Error('BUSINESS_REFERENCE_REQUIRED');
  if(e.reference_id&&!references.some(r=>r.id===e.reference_id&&r.type===e.type))throw Error('BUSINESS_REFERENCE_INVALID');
 }
 const observations=data.observations.filter(o=>o.structural&&keys.has(o.entity)).map(o=>{
  quote(o.evidence);const entity=keys.get(o.entity);if(!entity)throw Error('BUSINESS_ENTITY_MISSING');
  if(entity.reference_id)throw Error('BUSINESS_REFERENCE_READ_ONLY');
  validateAttributeValue(o.attribute,o.data);
  if(/\b(uns|umas|cerca|aproximad\w*|mais ou menos|around|about|roughly|approximately|em media|en promedio)\b/i.test(o.evidence.normalize('NFKD').replace(/\p{M}/gu,'')))o.data.approximate=true;
  for(const n of [o.data.value,o.data.min,o.data.max])if(n!==null&&!supportedNumber(o.evidence,n))throw Error('BUSINESS_NUMBER_UNSUPPORTED');
  if(o.observed_on&&(!validDate(o.observed_on)||o.observed_on>at.toISOString().slice(0,10)||!message.includes(o.observed_on)))throw Error('BUSINESS_DATE_INVALID');
  if(o.memory_id&&!references.some(r=>r.id===o.memory_id))throw Error('BUSINESS_REFERENCE_INVALID');
  if(o.attribute==='status'&&!['ACTIVE','INACTIVE','DISCONTINUED','PLANNED'].includes(o.data.text??''))throw Error('BUSINESS_STATUS_INVALID');
  if(o.data.currency&&!o.evidence.includes(o.data.currency)&&!(o.data.currency==='BRL'&&o.evidence.includes('R$'))&&!(o.data.currency==='EUR'&&o.evidence.includes('€'))&&!(o.data.currency==='USD'&&/US\$|USD/.test(o.evidence)))throw Error('BUSINESS_CURRENCY_UNSUPPORTED');
  return {...o,confidence:['HYPOTHESIS','INFERENCE'].includes(o.kind)?'LOW' as const:o.confidence};
 });
 const relationships=data.relationships.filter(r=>keys.has(r.source)&&keys.has(r.target));
 for(const r of relationships){quote(r.evidence);const a=keys.get(r.source),b=keys.get(r.target);if(!a||!b||r.source===r.target||!allowedRelation(a.type,r.type,b.type))throw Error('BUSINESS_RELATION_INVALID');if(['HYPOTHESIS','INFERENCE'].includes(r.kind)){r.status='PROVISIONAL';r.confidence='LOW';}}
 return {entities:data.entities,observations,relationships};
}

// Keep independently valid records without repairing or guessing rejected facts.
// Identity/schema failures still reject the whole batch; rejected records remain in the worker's candidate audit.
export function normalizeModelBatch(raw:unknown,message:string,known:Entity[],references:{id:string;type:EntityType|'MEMORY'}[]=[],at=new Date()) {
 if(!validateSchema(raw,MODEL_SCHEMA))throw Error('BUSINESS_EXTRACTION_INVALID');
 const input=structuredClone(raw as Extraction);
 // Versions are server-owned metadata. Bind an omitted version only to an exact
 // identity in the bounded tenant snapshot; never fix a supplied stale version.
 for(const entity of input.entities){
  if(entity.existing_id&&entity.version===null){
   const existing=known.find(n=>n.id===entity.existing_id&&n.type===entity.type);
   if(existing)entity.version=existing.version;
  }
 }
 const model=normalizeModel({...input,observations:[],relationships:[]},message,known,references,at);
 const rejected:{section:'observations'|'relationships';index:number;code:string}[]=[];
 for(const section of ['observations','relationships'] as const){
  input[section].forEach((record,index)=>{
   try{
    const fragment=normalizeModel({entities:input.entities,observations:[],relationships:[],[section]:[record]},message,known,references,at);
    model.observations.push(...fragment.observations);model.relationships.push(...fragment.relationships);
   }catch(error){rejected.push({section,index,code:error instanceof Error&&/^BUSINESS_[A-Z_]+$/.test(error.message)?error.message:'BUSINESS_VALIDATION_FAILED'});}
  });
 }
 return {model,rejected};
}

export function effectiveState(o:StoredObservation,now=Date.now()):State {
 if(o.state!=='CONFIRMED')return o.state;
 const days:Partial<Record<Attribute,number>>={price:90,cost:90,margin:90,cash:30,capacity:180,count:180,revenue:90,sales:90,leads:90,conversion:90};
 return days[o.attribute]&&now-Date.parse(o.observed_at)>days[o.attribute]!*86400000?'STALE':o.state;
}
// Compatibility includes the company, business scope, full period and currency. No cross-unit arithmetic.
export function deriveRatio(a:StoredObservation,b:StoredObservation,formula:'conversion'|'ticket'|'utilization') {
 if(a.company_id!==b.company_id||a.scope_key!==b.scope_key||!a.data.period_start||a.data.period_start!==b.data.period_start||a.data.period_end!==b.data.period_end||a.state!=='CONFIRMED'||b.state!=='CONFIRMED'||a.data.value===null||b.data.value===null||b.data.value===0||a.data.currency!==b.data.currency&&formula!=='ticket')return null;
 if(formula==='ticket'&&(a.data.unit!=='money'||!a.data.currency||b.data.unit!=='count')||formula==='conversion'&&(a.data.unit!=='count'||b.data.unit!=='count')||formula==='utilization'&&a.data.unit!==b.data.unit)return null;
 if(formula==='conversion'&&(a.attribute!=='sales'||b.attribute!=='leads')||formula==='ticket'&&(a.attribute!=='revenue'||b.attribute!=='sales')||formula==='utilization'&&b.attribute!=='capacity')return null;
 const multiplier=formula==='ticket'?1:100;
 return {kind:'DERIVED_METRIC' as const,source_type:'SYSTEM_DERIVED',formula:formula+':1',inputs:[{id:a.id,version:a.version},{id:b.id,version:b.version}],value:Number((a.data.value/b.data.value*multiplier).toPrecision(12)),approximate:a.data.approximate||b.data.approximate,scope:a.scope_key,period_start:a.data.period_start,period_end:a.data.period_end,currency:formula==='ticket'?a.data.currency:null,calculated_at:new Date().toISOString()};
}
export function numericConflict(reported:StoredObservation,derived:NonNullable<ReturnType<typeof deriveRatio>>) {
 return reported.scope_key===derived.scope&&reported.data.period_start===derived.period_start&&reported.data.period_end===derived.period_end&&reported.data.value!==null&&!reported.data.approximate&&!derived.approximate&&Math.abs(reported.data.value-derived.value)>0.01;
}
