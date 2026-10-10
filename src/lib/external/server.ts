import {logEvent} from '../operations/logging';
import 'server-only';
import OpenAI from 'openai';
import {createHash,randomUUID} from 'node:crypto';
import {after} from 'next/server';
import {commercialContextForUser,commercialDatabase} from '../commercial/server';
import {ChatError} from '../chat/contracts';
import type {MarketContext} from '../i18n/market';
import {externalEnabled,webMode,researchTrigger,ttlMs,cacheUsable,DEPTH_LIMITS,type ResearchPlan,type ResearchReport} from './domain';
import {planningRequest,parsePlan,publicPlanningContext} from './planner';
import {collectEvidence,type WebEvidence} from './sources';
import {validatedReport,reportContext,synthesisRequest} from './report';
import {externalCompletion,prepareExternalRequest,settleExternal,type Charge} from './meter';
import {OpenAIWebSearchProvider,webRequest,type ExternalResearchProvider} from './provider';
import {externalLabels} from './labels';
type Turn={user:string;company:string;conversation:string;request:string;version:number;question:string;memory:string;market:MarketContext;attachment:boolean};
type Job={run_id:string;company_id:string;plan:ResearchPlan;internal_context:string;lease_token:string;attempts:number;evidence:WebEvidence|null;cached_report:ResearchReport|null;provider_state:{charge:Charge;id?:string;submitted:boolean}|null};
export async function externalPreference(company:string,user:string){
 const r=await commercialDatabase().from('external_preferences').select('enabled,sensitive_mode').eq('company_id',company).eq('user_id',user).maybeSingle();if(r.error)throw Error('EXTERNAL_UNAVAILABLE');return r.data??{enabled:true,sensitive_mode:false};
}
async function notice(t:Turn,answer:string){const r=await commercialDatabase().rpc('commit_seed_turn',{p_user:t.user,p_company:t.company,p_conversation:t.conversation,p_request:t.request,p_version:t.version,p_message:t.question,p_answer:answer,p_diagnosis:null,p_memories:[]});if(r.error)throw new ChatError(409,'CONVERSATION_CHANGED','A conversa mudou. Reabra a conversa antes de continuar.');return {intent:'GENERAL',answer,diagnosis:null,version:t.version+1};}
const fingerprint=(plan:ResearchPlan,memory:string)=>createHash('sha256').update(JSON.stringify({plan,memory})).digest('hex');
export async function externalTurn(t:Turn){
 const trigger=researchTrigger(t.question,t.attachment);if(!trigger)return null;
 const labels=externalLabels(t.market.user_language);
 if(!externalEnabled())return notice(t,labels.off);
 const preference=await externalPreference(t.company,t.user);if(!preference.enabled||preference.sensitive_mode)return notice(t,labels.off);
 const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,maxRetries:0,timeout:55000});
 let plan:ResearchPlan|null;
 try{const publicContext=publicPlanningContext(t.memory);const response=await externalCompletion(client,t.user,t.company,t.request,'EXTERNAL_RESEARCH_PLANNING',planningRequest('',t.question,publicContext,t.market));plan=parsePlan(JSON.parse(response.output_text),t.question,publicContext,t.market,trigger);}
 catch(e){if(e instanceof Error&&/^EXTERNAL_(PRIVATE|UNGROUNDED|INVALID)/.test(e.message))return notice(t,labels.private);if(e instanceof OpenAI.APIError)throw new ChatError(e.status===429?429:503,e.status===429?'PROVIDER_LIMIT':'PROVIDER_CONFIGURATION','A pesquisa está temporariamente indisponível. Verifique o serviço de IA e tente novamente.');throw e;}
 if(!plan)return null;if(plan.needsClarification)return notice(t,labels.clarify);
 const commercial=await commercialContextForUser({id:t.user});const cfg=await commercial.db.from('commercial_settings').select('value').eq('id','external_research').single();
 if(cfg.error)throw Error('EXTERNAL_UNAVAILABLE');const permitted=commercial.plan.code==='PRO'?cfg.data.value.pro_depths:cfg.data.value.free_depths;
 if(!permitted?.includes(plan.depth))return notice(t,labels.plan);
 const key=fingerprint(plan,t.memory),db=commercialDatabase();
 const cache=await db.from('external_research_runs').select('id,report,created_at').eq('company_id',t.company).eq('user_id',t.user).eq('cache_key',key).eq('status','COMPLETED').gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(1).maybeSingle();
 const cached=cache.data?.report&&cacheUsable(cache.data.report as ResearchReport,plan,cache.data.created_at,/atualiz|refresh|actualiz|latest|hoje|today/i.test(t.question))?cache.data.report as ResearchReport:null;
 const id=randomUUID();const queued=await db.rpc('queue_external_research',{p_user:t.user,p_company:t.company,p_run:id,p_conversation:t.conversation,p_request:t.request,p_version:t.version,p_message:t.question,p_answer:labels.queued,p_plan:plan,p_context:t.memory,p_cache_key:key});
 if(queued.error)throw new ChatError(429,'EXTERNAL_QUEUE_LIMIT','Aguarde alguns minutos antes de iniciar outra pesquisa.');
 if(cached){const copied=await db.from('external_research_jobs').update({cached_report:cached}).eq('run_id',id).eq('company_id',t.company);if(copied.error)throw Error('EXTERNAL_CACHE_FAILED');}
 after(async()=>{try{await processExternalJob(id);}catch{logEvent('external',{code:'WAKE_FAILED'},'error');}});
 return {intent:'GENERAL',answer:labels.queued,diagnosis:null,version:t.version+1,researchId:id};
}
async function saveJob(job:Job,patch:Record<string,unknown>){const r=await commercialDatabase().from('external_research_jobs').update(patch).eq('run_id',job.run_id).eq('lease_token',job.lease_token).select('run_id').single();if(r.error)throw Error('EXTERNAL_LEASE_CHANGED');}
async function event(company:string,user:string,id:string,kind:string,metadata:Record<string,unknown>={}){const r=await commercialDatabase().from('external_events').insert({company_id:company,user_id:user,run_id:id,kind,metadata});if(r.error)throw Error('EXTERNAL_EVENT_FAILED');}
export async function processExternalJob(id?:string,provider:ExternalResearchProvider=new OpenAIWebSearchProvider()){
 if(!externalEnabled())return;const db=commercialDatabase();const claim=await db.rpc('claim_external_job',{p_run:id??null});if(claim.error)throw Error('EXTERNAL_JOB_UNAVAILABLE');const job=claim.data?.[0] as Job|undefined;if(!job)return;
 const selected=await db.from('external_research_runs').select('user_id,request_id,created_at,status').eq('id',job.run_id).eq('company_id',job.company_id).single();if(selected.error)throw Error('EXTERNAL_RUN_UNAVAILABLE');const user=selected.data.user_id;
 let activeCharge:Charge|null=null;
 try{
 const member=await db.from('company_members').select('user_id').eq('company_id',job.company_id).eq('user_id',user).maybeSingle();if(member.error||!member.data)throw Error('EXTERNAL_ACCESS_DENIED');
 const pref=await externalPreference(job.company_id,user);if(!pref.enabled||pref.sensitive_mode)throw Error('EXTERNAL_DISABLED');
 if(job.cached_report){const cached=await db.rpc('finish_external_job',{p_run:job.run_id,p_lease:job.lease_token,p_report:job.cached_report,p_answer:externalLabels(job.plan.locale).cached,p_ttl:Math.max(0,Math.floor((ttlMs(job.plan.trigger)-(Date.now()-Date.parse(job.cached_report.retrievedAt)))/1000))});if(cached.error)throw Error('EXTERNAL_CACHE_FAILED');return;}
 const plan=job.plan,expired=Date.now()-Date.parse(selected.data.created_at)>DEPTH_LIMITS[plan.depth].timeout+60000;
 let evidence=job.evidence;
 if(!evidence){
 let response;
 if(job.provider_state){
  activeCharge=job.provider_state.charge;
  if(!job.provider_state.id)throw Error('EXTERNAL_UNCERTAIN_SUBMISSION');
  response=expired?await provider.cancel(job.provider_state.id):await provider.retrieve(job.provider_state.id);
 }else{
  if(expired)throw Error('EXTERNAL_TIMEOUT');
  const prepared=await prepareExternalRequest(user,job.company_id,job.run_id,('WEB_SEARCH_'+plan.depth) as 'WEB_SEARCH_QUICK',webRequest(plan,webMode()));activeCharge=prepared.charge;
  await saveJob(job,{provider_state:{charge:activeCharge,submitted:true}});
  response=await provider.start(prepared.request,AbortSignal.timeout(Math.min(100000,DEPTH_LIMITS[plan.depth].timeout)));
  await saveJob(job,{provider_state:{charge:activeCharge,submitted:true,id:response.id}});
 }
 if(response.status==='queued'||response.status==='in_progress'){await saveJob(job,{lease_token:null,lease_until:new Date(Date.now()+3000).toISOString()});return;}
 await settleExternal(activeCharge,response);activeCharge=null;
 evidence=collectEvidence(response,plan);
 if((response.status==='failed'||response.status==='cancelled')&&!evidence.citations.length)throw Error(expired?'EXTERNAL_TIMEOUT':'EXTERNAL_PROVIDER_FAILED');
 if(!evidence.calls||!evidence.citations.length)evidence.partial=true;
 await saveJob(job,{evidence,provider_state:null});
 }
 let report:ResearchReport;
 if(!evidence.citations.length||!evidence.text.trim())report=emptyReport(plan,evidence);
 else{
 const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,maxRetries:0,timeout:55000});
 const response=await externalCompletion(client,user,job.company_id,job.run_id,'EXTERNAL_SYNTHESIS',synthesisRequest('',plan,evidence,job.internal_context));
 report=validatedReport(JSON.parse(response.output_text),evidence,plan,job.internal_context);
 }
 if(webMode()==='OFFLINE_OR_CACHE_ONLY'){report.partial=true;report.limitations.push(externalLabels(plan.locale).offline);}
 await saveJob(job,{cached_report:report});
 const completed=await db.rpc('finish_external_job',{p_run:job.run_id,p_lease:job.lease_token,p_report:report,p_answer:report.partial?externalLabels(plan.locale).partial:externalLabels(plan.locale).done,p_ttl:Math.floor(ttlMs(plan.trigger)/1000)});if(completed.error)throw Error('EXTERNAL_COMMIT_FAILED');
 for(const competitor of report.competitors){const found=await db.from('external_competitors').select('id').eq('company_id',job.company_id).eq('domain',competitor.domain).maybeSingle();if(!found.data)await db.from('external_competitors').insert({company_id:job.company_id,domain:competitor.domain,name:competitor.name,last_run_id:job.run_id});}
 }catch(e){
 if(activeCharge)await settleExternal(activeCharge,null).catch(()=>{});
 const code=e instanceof ChatError?e.code:e instanceof Error&&/^[A-Z_]+$/.test(e.message)?e.message:'EXTERNAL_FAILED';
 if(job.provider_state?.id)await provider.cancel(job.provider_state.id).catch(()=>{});
 const usage=await db.from('usage_logs').select('estimated_total_cost_usd,router_decision').eq('company_id',job.company_id).eq('user_id',user).in('router_decision->>external_key',[job.run_id,selected.data.request_id]);
 const known=!usage.error&&!!usage.data?.length&&usage.data.every(r=>r.estimated_total_cost_usd!==null);
 await db.from('external_research_runs').update({status:'FAILED',error_code:code,updated_at:new Date().toISOString(),estimated_cost:known?usage.data!.reduce((sum,r)=>sum+Number(r.estimated_total_cost_usd),0):null,tool_calls:usage.data?.reduce((sum,r)=>sum+Number(r.router_decision?.tool_calls??0),0)??0,latency_ms:Date.now()-Date.parse(selected.data.created_at)}).eq('id',job.run_id).eq('status','RUNNING');
 await event(job.company_id,user,job.run_id,'external_research_failed',{code}).catch(()=>{});
 await saveJob(job,{internal_context:'',lease_token:null,lease_until:null}).catch(()=>{});
 logEvent('external',{code},'error');
 }
}
function emptyReport(plan:ResearchPlan,evidence:WebEvidence):ResearchReport{return {summary:externalLabels(plan.locale).empty,internalContext:[],claims:[],findings:[],conflicts:[],inferences:[],implications:[],nextSteps:[],limitations:[externalLabels(plan.locale).partial],competitors:[],sources:evidence.sources,citations:evidence.citations,retrievedAt:new Date().toISOString(),partial:true,query:plan.query};}
export async function externalContext(company:string,user:string,question:string,selectedId?:string){
 if(!externalEnabled())return [];const pref=await externalPreference(company,user);if(!pref.enabled||pref.sensitive_mode)return [];
 let query=commercialDatabase().from('external_research_runs').select('id,report,sanitized_query,expires_at').eq('company_id',company).in('status',['COMPLETED','PARTIAL']);
 if(selectedId)query=query.eq('id',selectedId);else query=query.gt('expires_at',new Date().toISOString());
 const r=await query.order('created_at',{ascending:false}).limit(8);if(r.error||selectedId&&!r.data?.length)throw Error('EXTERNAL_CONTEXT_UNAVAILABLE');
 const words=question.toLowerCase().match(/[\p{L}]{4,}/gu)??[];
 return r.data.filter(v=>v.report&&(selectedId||words.some(w=>v.sanitized_query.toLowerCase().includes(w)))).slice(0,2).map(v=>{const row=reportContext(v.report as ResearchReport,v.id);if(Date.parse(v.expires_at)<Date.now())row.value=JSON.stringify({...JSON.parse(row.value),notice:'EXPIRED external evidence. Historical discussion only, revalidate before any current decision.'});return row;});
}
export async function externalObservability(){const db=commercialDatabase();const [runs,events]=await Promise.all([db.from('external_research_runs').select('status,depth,source_count,tool_calls,latency_ms,estimated_cost').order('created_at',{ascending:false}).limit(500),db.from('external_events').select('kind').order('created_at',{ascending:false}).limit(500)]);if(runs.error||events.error)throw Error('EXTERNAL_UNAVAILABLE');return {runs:runs.data,events:events.data};}
