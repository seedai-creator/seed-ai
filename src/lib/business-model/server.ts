import 'server-only';
import {commercialDatabase} from '../commercial/server';
import {canonicalName,normalizeModelBatch,EMPTY_VALUE,type Entity,type EntityType,type Extraction,type StoredObservation,type Relationship,type Attribute} from './domain';
import {budgetContext,DOMAIN_TYPES,queryDomains} from './context';

async function member(company:string,user:string){const db=commercialDatabase();const r=await db.from('company_members').select('user_id').eq('company_id',company).eq('user_id',user).maybeSingle();if(r.error||!r.data)throw Error('BUSINESS_ACCESS_DENIED');return db;}
export async function builderContext(company:string,user:string) {
 const db=await member(company,user);
 const [entities,memories,journal]=await Promise.all([
 db.from('business_entities').select('id,company_id,type,name,canonical_name,version,reference_id,reference_table,status').eq('company_id',company).eq('status','ACTIVE').order('updated_at',{ascending:false}).limit(24),
 db.from('business_memories').select('id,kind,key,value').eq('company_id',company).eq('deleted',false).order('updated_at',{ascending:false}).limit(40),
 db.from('business_journal_entries').select('id,metric_type,value,description').eq('company_id',company).eq('entry_type','METRIC').eq('status','ACTIVE').order('created_at',{ascending:false}).limit(12)]);
 if(entities.error||memories.error||journal.error)throw Error('BUSINESS_CONTEXT_UNAVAILABLE');
 const references:{id:string;type:EntityType|'MEMORY';value:string}[]=[{id:company,type:'COMPANY',value:'Current company'}];
 for(const m of memories.data)references.push({id:m.id,type:['GOAL','METRIC','CONSTRAINT'].includes(m.kind)?m.kind as EntityType:'MEMORY',value:m.key+': '+m.value});
 for(const m of journal.data)references.push({id:m.id,type:'METRIC',value:m.description});
 return {companyId:company,entities:entities.data as Entity[],references};
}
export function builderPayload(extraction:Extraction,document=false){return {...extraction,source_type:document?'DOCUMENT':'CHAT',entities:extraction.entities.map(e=>({...e,canonical_name:e.reference_id?'ref:'+e.reference_id:canonicalName(e.type,e.name)}))};}
export async function processBusinessModelJob(company?:string){
 const db=commercialDatabase();let q=db.from('journal_jobs').select('id,company_id,user_id,source_message_id,context,model_candidate,model_attempts').eq('status','COMPLETED').not('model_error','is',null).lt('model_attempts',4).order('created_at').limit(1);if(company)q=q.eq('company_id',company);
 const retry=await q;if(retry.error)throw Error('BUSINESS_WORKER_FAILED');
 for(const j of retry.data){try{
 const ctx=await builderContext(j.company_id,j.user_id);const source=await db.from('messages').select('content').eq('id',j.source_message_id).single();if(source.error)throw Error('BUSINESS_SOURCE_UNAVAILABLE');
 const validated=normalizeModelBatch(j.model_candidate,source.data.content,ctx.entities,ctx.references,new Date(j.context.at));
 const payload=builderPayload(validated.model,j.context.document===true);
 const partial=validated.rejected.length>0;
 const saved=await db.from('journal_jobs').update({model_payload:payload,model_candidate:partial?j.model_candidate:null,model_error:partial?'BUSINESS_PARTIAL_REVIEW_REQUIRED':null,model_attempts:partial?4:j.model_attempts+1}).eq('id',j.id).eq('model_attempts',j.model_attempts);
 if(saved.error)throw Error('BUSINESS_WORKER_SAVE_FAILED');
 }catch{await db.from('journal_jobs').update({model_attempts:j.model_attempts+1}).eq('id',j.id).eq('model_attempts',j.model_attempts);}}
 const r=await db.rpc('process_business_model_job',{p_company:company??null});if(r.error)throw Error('BUSINESS_WORKER_FAILED');if(r.data==='RETRY')console.error('[seed:business-model]',{code:'BUILD_RETRY'});return r.data;
}

// Read-only, bounded queries: opening a page never calls a provider.
export async function resolveBusinessContext(company:string,user:string,question:string) {
 const db=await member(company,user),types=[...new Set(queryDomains(question).flatMap(d=>DOMAIN_TYPES[d]))];
 const terms=(question.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)??[]).slice(0,8);
 const [result,direct,goals]=await Promise.all([
 db.from('business_entities').select('*').eq('company_id',company).in('type',types).eq('status','ACTIVE').order('updated_at',{ascending:false}).order('id').limit(32),
 terms.length?db.from('business_entities').select('*').eq('company_id',company).eq('status','ACTIVE').or(terms.map(t=>'name.ilike.%'+t+'%').join(',')).limit(12):Promise.resolve({data:[],error:null}),
 db.from('business_entities').select('*').eq('company_id',company).eq('status','ACTIVE').in('type',['GOAL','CONSTRAINT']).order('updated_at',{ascending:false}).limit(8)]);
 if(result.error||direct.error||goals.error)throw Error('BUSINESS_CONTEXT_UNAVAILABLE');
 const entities=[...new Map([...direct.data,...goals.data,...result.data].map(e=>[e.id,e])).values()] as Entity[],ids=entities.map(e=>e.id);
 if(!ids.length)return budgetContext(company,[],[],[],question);
 const [observations,relations,history]=await Promise.all([
 db.from('business_observations').select('*').eq('company_id',company).in('entity_id',ids).eq('is_current',true).order('observed_at',{ascending:false}).limit(80),
 db.from('business_relationships').select('*').eq('company_id',company).or('source_id.in.('+ids.join(',')+'),target_id.in.('+ids.join(',')+')').is('valid_until',null).in('status',['ACTIVE','PROVISIONAL']).limit(40),
 db.from('business_observations').select('*').eq('company_id',company).in('entity_id',ids.slice(0,12)).eq('is_current',false).order('observed_at',{ascending:false}).limit(6)]);
 if(observations.error||relations.error||history.error)throw Error('BUSINESS_CONTEXT_UNAVAILABLE');
 const obs=[...observations.data,...history.data] as StoredObservation[];
 // Fetch at most eight missing endpoints in two bulk queries, never one query per relation.
 const missingIds=[...new Set(relations.data.flatMap(r=>[r.source_id,r.target_id]))].filter(id=>!ids.includes(id)).slice(0,8);
 if(missingIds.length){
  const linked=await db.from('business_entities').select('*').eq('company_id',company).eq('status','ACTIVE').in('id',missingIds).limit(8);
  if(linked.error)throw Error('BUSINESS_CONTEXT_UNAVAILABLE');
  entities.push(...linked.data as Entity[]);
  if(linked.data.length){const values=await db.from('business_observations').select('*').eq('company_id',company).in('entity_id',linked.data.map(e=>e.id)).eq('is_current',true).order('observed_at',{ascending:false}).limit(24);if(values.error)throw Error('BUSINESS_CONTEXT_UNAVAILABLE');obs.push(...values.data as StoredObservation[]);}
 }
 if(entities.some(e=>e.type==='COMPANY')){const profile=await db.from('companies').select('name').eq('id',company).single();if(profile.error)throw Error('BUSINESS_CONTEXT_UNAVAILABLE');for(const e of entities)if(e.type==='COMPANY')e.name=profile.data.name;}
 // Resolve external identities from their canonical source; no copied goals/metrics.
 const mids=entities.filter(e=>e.reference_table==='business_memories').map(e=>e.reference_id!);
 if(mids.length){const mem=await db.from('business_memories').select('id,key,value,kind,observed_at,version').eq('company_id',company).in('id',mids).eq('deleted',false);if(mem.error)throw Error('BUSINESS_CONTEXT_UNAVAILABLE');for(const m of mem.data){const e=entities.find(e=>e.reference_id===m.id)!;e.name=m.value.slice(0,120);}}
 const jids=entities.filter(e=>e.reference_table==='business_journal_entries').map(e=>e.reference_id!);
 if(jids.length){const entries=await db.from('business_journal_entries').select('*').eq('company_id',company).eq('status','ACTIVE').in('id',jids);if(entries.error)throw Error('BUSINESS_CONTEXT_UNAVAILABLE');for(const m of entries.data){const e=entities.find(e=>e.reference_id===m.id)!;if(m.metric_data)continue;obs.push({id:m.id,entity_id:e.id,company_id:company,attribute:m.metric_type as Attribute,data:{...EMPTY_VALUE,value:Number(m.value),unit:m.unit,currency:m.currency_code,period_start:m.period_start,period_end:m.period_end},kind:'METRIC',state:'CONFIRMED',confidence:m.confidence,observed_at:m.created_at,source_type:'CHAT',source_message_id:m.source_message_id,memory_id:null,version:m.version,is_current:true,scope_key:JSON.stringify([company,m.channel,m.product,m.location])});}}
 return budgetContext(company,entities,obs,relations.data as Relationship[],question);
}
