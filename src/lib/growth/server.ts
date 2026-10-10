import {logEvent} from '../operations/logging';
import 'server-only';
import {createHash} from 'node:crypto';
import {commercialDatabase,commercialContextForUser} from '../commercial/server';
import {validId} from '../auth/validation';
import {goalSnapshot} from '../goals/server';
import {businessDay,COMPANY_SCOPE,SCOPES,type Scope} from '../goals/domain';
import type {Entity,StoredObservation,Relationship} from '../business-model/domain';
import {evaluateGrowth} from './engine';
import {growthEnabled,DIMENSIONS,RULE_SET_VERSION,type GrowthInput,type Snapshot,type Dimension} from './domain';
import {mapContext} from './context';
import {externalContext} from '../external/server';

export type MapFilter={goalId:string|null;scope:Scope};
export const DEFAULT_FILTER:MapFilter={goalId:null,scope:COMPANY_SCOPE};
export function validateFilter(f:MapFilter){if(!f||f.goalId!==null&&!validId(f.goalId)||!f.scope||!SCOPES.includes(f.scope.type)||f.scope.type==='COMPANY'&&f.scope.id!==null||f.scope.type!=='COMPANY'&&!validId(f.scope.id))throw Error('GROWTH_FILTER_INVALID');return f;}
async function access(company:string,user:string){
 if(!growthEnabled())throw Error('GROWTH_DISABLED');if(!validId(company)||!validId(user))throw Error('GROWTH_ACCESS_DENIED');
 const db=commercialDatabase(),m=await db.from('company_members').select('user_id').eq('company_id',company).eq('user_id',user).maybeSingle();if(m.error||!m.data)throw Error('GROWTH_ACCESS_DENIED');return db;
}
async function permitted(user:string){return (await commercialContextForUser({id:user})).flags.growth_map===true;}
const contextKey=(f:MapFilter)=>(f.goalId??'auto')+':'+f.scope.type+':'+(f.scope.id??'company');
export async function requestMap(company:string,user:string,filter:MapFilter=DEFAULT_FILTER,manual=true){
 const db=await access(company,user);validateFilter(filter);if(!await permitted(user))throw Error('GROWTH_PLAN_REQUIRED');
 const r=await db.rpc('request_growth_map',{p_company:company,p_user:user,p_goal:filter.goalId,p_scope:filter.scope.type,p_scope_id:filter.scope.id,p_manual:manual});if(r.error)throw Error(r.error.message.includes('COOLDOWN')?'GROWTH_REFRESH_COOLDOWN':'GROWTH_REQUEST_FAILED');return String(r.data);
}
export async function loadGrowthInput(company:string,user:string,filter:MapFilter=DEFAULT_FILTER,now=new Date()):Promise<GrowthInput>{
 const db=await access(company,user);validateFilter(filter);const base=await goalSnapshot(company,user,now);if(!base.timezone)throw Error('GROWTH_TIMEZONE_REQUIRED');
 const [entities,structural,relations,memories]=await Promise.all([
 db.from('business_entities').select('*').eq('company_id',company).eq('status','ACTIVE').order('id').limit(201),
 db.from('business_observations').select('*').eq('company_id',company).eq('is_current',true).order('observed_at',{ascending:false}).order('id').limit(201),
 db.from('business_relationships').select('*').eq('company_id',company).eq('status','ACTIVE').order('id').limit(201),
 db.from('business_memories').select('id,key,kind,value,version').eq('company_id',company).eq('deleted',false).in('kind',['CONSTRAINT','FACT']).order('updated_at',{ascending:false}).limit(101)]);
 if([entities,structural,relations,memories].some(r=>r.error))throw Error('GROWTH_SOURCE_UNAVAILABLE');
 const constraints=memories.data!.filter(m=>m.kind==='CONSTRAINT'),currency=memories.data!.find(m=>m.key==='currency')?.value??null;
 const parentIds=[...new Set(structural.data!.flatMap(o=>o.memory_id?[String(o.memory_id)]:[]))];
 const parents=parentIds.length?await db.from('business_memories').select('id,version').eq('company_id',company).in('id',parentIds):null;if(parents?.error)throw Error('GROWTH_SOURCE_UNAVAILABLE');
 // References to parent identities allow privacy deletion to remove their derived snapshots.
 const context:GrowthInput['context']=[...entities.data!.map(e=>({table:'business_entities',id:e.id,version:e.version,kind:'OBSERVATION' as const})),...(parents?.data??[]).map(m=>({table:'business_memories',id:m.id,version:m.version,kind:'OBSERVATION' as const}))];
 return {company,day:businessDay(base.timezone,now),timezone:base.timezone,scope:filter.scope,goalId:filter.goalId,goals:base.goals,observations:base.observations,entities:entities.data!.slice(0,200) as Entity[],structural:structural.data!.slice(0,200) as StoredObservation[],relations:relations.data!.slice(0,200) as Relationship[],constraints:constraints.slice(0,8),context,external:[],limited:base.limited||entities.data!.length>200||structural.data!.length>200||relations.data!.length>200||memories.data!.length>100,currency:currency&&/^[A-Z]{3}$/.test(currency)?currency:null};
}
// No provider calls here. One bounded leased job; the existing protected worker drains retries.
export async function processGrowthJob(company?:string){
 if(!growthEnabled())return {enabled:false};const db=commercialDatabase(),started=Date.now(),claim=await db.rpc('claim_growth_map',{p_company:company??null});if(claim.error)throw Error('GROWTH_CLAIM_FAILED');const job=claim.data?.[0];if(!job)return {idle:true};
 try{
  await access(job.company_id,job.requested_by);if(!await permitted(job.requested_by))throw Error('GROWTH_PLAN_REQUIRED');
  const input=await loadGrowthInput(job.company_id,job.requested_by,{goalId:job.goal_id,scope:{type:job.scope_type,id:job.scope_id}});
  const map=evaluateGrowth(input),hash=createHash('sha256').update(JSON.stringify(map)).digest('hex');
  const saved=await db.rpc('finish_growth_map',{p_request:job.id,p_lease:job.lease_token,p_generation:job.generation,p_hash:hash,p_payload:map,p_latency:Date.now()-started});if(saved.error)throw Error('GROWTH_SAVE_FAILED');return {snapshot:saved.data,changedDuringCalculation:saved.data===null};
 }catch(e){
  const code=e instanceof Error&&/^GROWTH_[A-Z_]+$/.test(e.message)?e.message:'GROWTH_PROCESSING_FAILED';
  await db.from('growth_map_requests').update({status:job.attempts>=4||code==='GROWTH_PLAN_REQUIRED'||code==='GROWTH_ACCESS_DENIED'?'FAILED':'QUEUED',lease_token:null,lease_until:null,last_error:code,next_at:new Date(Date.now()+30000*2**job.attempts).toISOString()}).eq('id',job.id).eq('lease_token',job.lease_token);
  await db.from('growth_map_events').insert({company_id:job.company_id,kind:'FAILED',details:{code,latency_ms:Date.now()-started,ai_calls:0}});logEvent('growth',{code},'error');return {error:code};
 }
}
export async function scheduleGrowth(company:string,user:string){
 if(!growthEnabled())return;const db=await access(company,user);
 const rows=await db.from('growth_map_requests').select('id,goal_id,scope_type,scope_id,status,next_at').eq('company_id',company).limit(30);if(rows.error)throw Error('GROWTH_READ_FAILED');
 if(rows.data.length&&!rows.data.some(r=>['COMPLETED','FAILED'].includes(r.status)&&Date.parse(r.next_at)<=Date.now()))return;
 if(!await permitted(user))return;
 if(!rows.data.length)await requestMap(company,user,DEFAULT_FILTER,false);
 else for(const r of rows.data.filter(r=>['COMPLETED','FAILED'].includes(r.status)&&Date.parse(r.next_at)<=Date.now()).slice(0,3))await requestMap(company,user,{goalId:r.goal_id,scope:{type:r.scope_type,id:r.scope_id}},false);
}
export async function readMap(company:string,user:string,filter:MapFilter=DEFAULT_FILTER){
 const db=await access(company,user);validateFilter(filter);
 const [req,goals,entities,companyRow,canRefresh]=await Promise.all([
 db.from('growth_map_requests').select('id,status,last_error,generation,processed_generation').eq('company_id',company).eq('context_key',contextKey(filter)).maybeSingle(),
 db.from('goals').select('id,spec,status').eq('company_id',company).eq('status','ACTIVE').order('updated_at',{ascending:false}).limit(40),
 db.from('business_entities').select('id,type,name').eq('company_id',company).eq('status','ACTIVE').in('type',['LOCATION','PRODUCT_SERVICE','CHANNEL','TEAM','SALES_PROCESS','OPERATION','CUSTOMER_SEGMENT']).order('name').limit(60),
 db.from('companies').select('timezone').eq('id',company).single(),permitted(user)]);
 if(req.error||goals.error||entities.error||companyRow.error)throw Error('GROWTH_READ_FAILED');
 const r=req.data?await db.from('growth_map_snapshots').select('*').eq('company_id',company).eq('request_id',req.data.id).order('created_at',{ascending:false}).order('id').limit(1).maybeSingle():null;if(r?.error)throw Error('GROWTH_READ_FAILED');
 const snapshot=r?.data as Snapshot|null,stale=!!snapshot&&(snapshot.status==='SUPERSEDED'||snapshot.payload.ruleSetVersion!==RULE_SET_VERSION||!companyRow.data.timezone||snapshot.payload.generatedDay!==businessDay(companyRow.data.timezone)||req.data?.generation!==req.data?.processed_generation);
 // External references stay in their source ledger and are checked on read, including privacy preferences and expiry.
 const externalRows=await externalContext(company,user,goals.data.map(g=>g.spec.title).join(' ')+' growth crescimento mercado market marketing').catch(()=>[]);
 const references=externalRows.flatMap(r=>{const data=JSON.parse(r.value) as {sources:{url:string;at:string}[]};return data.sources.filter(s=>/^https?:\/\//i.test(s.url)).slice(0,3).map(s=>({id:r.source_id,title:new URL(s.url).hostname,url:s.url,retrievedAt:s.at}));}).slice(0,3);
 return {snapshot,stale,references,pending:!!req.data&&['QUEUED','RUNNING'].includes(req.data.status),failed:req.data?.status==='FAILED',canRefresh,goals:goals.data.map(g=>({id:g.id,title:String(g.spec.title),scope:g.spec.scope as Scope})),scopes:entities.data.map(e=>({id:e.id,type:(e.type==='PRODUCT_SERVICE'?'PRODUCT':e.type) as Scope['type'],name:e.name}))};
}
export async function mapHistory(company:string,user:string,filter:MapFilter=DEFAULT_FILTER,offset=0,from:string|null=null,to:string|null=null){
 const db=await access(company,user);validateFilter(filter);if(!Number.isSafeInteger(offset)||offset<0||offset>10000||[from,to].some(d=>d!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(d))||from&&to&&from>to)throw Error('GROWTH_FILTER_INVALID');
 let q=db.from('growth_map_snapshots').select('*').eq('company_id',company).eq('scope_type',filter.scope.type);q=filter.scope.id?q.eq('scope_id',filter.scope.id):q.is('scope_id',null);if(filter.goalId)q=q.eq('goal_id',filter.goalId);if(from)q=q.gte('created_at',from+'T00:00:00Z');if(to)q=q.lte('created_at',to+'T23:59:59.999Z');
 const r=await q.order('created_at',{ascending:false}).order('id').range(offset,offset+19);if(r.error)throw Error('GROWTH_READ_FAILED');return r.data as Snapshot[];
}
export async function dimensionDetails(company:string,user:string,id:string,dimension:Dimension){const db=await access(company,user);if(!validId(id)||!DIMENSIONS.includes(dimension))throw Error('GROWTH_FILTER_INVALID');const r=await db.from('growth_map_snapshots').select('payload,status,created_at').eq('company_id',company).eq('id',id).single();if(r.error)throw Error('GROWTH_READ_FAILED');return {assessment:(r.data.payload as Snapshot['payload']).dimensions.find(d=>d.dimension===dimension)!,status:r.data.status,createdAt:r.data.created_at};}
export async function growthContext(company:string,user:string,question:string,id?:string,dimension?:Dimension){
 if(!growthEnabled())return [];if(!id&&!/crescer|crescimento|gargalo|vender|growth|bottleneck|crecimiento|grow|weekly|margem|margin|convers/i.test(question))return [];
 const db=await access(company,user);if(id&&!validId(id)||dimension&&!DIMENSIONS.includes(dimension))throw Error('GROWTH_FILTER_INVALID');
 const r=id?await db.from('growth_map_snapshots').select('*').eq('company_id',company).eq('id',id).single():null;if(r?.error)throw Error('GROWTH_CONTEXT_CHANGED');
 const snapshot=id?r!.data as Snapshot:await radarGrowthSnapshot(company);
 const [request,companyRow]=id&&snapshot?await Promise.all([db.from('growth_map_requests').select('generation,processed_generation').eq('company_id',company).eq('id',snapshot.request_id).single(),db.from('companies').select('timezone').eq('id',company).single()]):[null,null];
 const changed=!snapshot||snapshot.status==='SUPERSEDED'||snapshot.payload.ruleSetVersion!==RULE_SET_VERSION||id&&(request?.error||companyRow?.error||!companyRow?.data?.timezone||snapshot.payload.generatedDay!==businessDay(companyRow.data.timezone)||request?.data?.generation!==request?.data?.processed_generation);
 if(changed){if(id)throw Error('GROWTH_CONTEXT_CHANGED');return [];}
 return mapContext(snapshot,dimension);
}
export async function radarGrowthSnapshot(company:string){
 if(!growthEnabled())return null;const db=commercialDatabase(),r=await db.from('growth_map_requests').select('id,generation,processed_generation').eq('company_id',company).eq('context_key',contextKey(DEFAULT_FILTER)).maybeSingle();if(r.error||!r.data||r.data.generation!==r.data.processed_generation)return null;
 const [s,c]=await Promise.all([db.from('growth_map_snapshots').select('*').eq('company_id',company).eq('request_id',r.data.id).in('status',['READY','LIMITED']).order('created_at',{ascending:false}).limit(1).maybeSingle(),db.from('companies').select('timezone').eq('id',company).single()]);if(s.error||c.error||!s.data||!c.data.timezone||s.data.payload.generatedDay!==businessDay(c.data.timezone))return null;return s.data as Snapshot;
}
