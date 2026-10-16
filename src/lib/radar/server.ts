import {radarGrowthSnapshot} from '../growth/server';
import {annotateGrowthSignals} from '../growth/radar';
import 'server-only';
import {commercialDatabase} from '../commercial/server';
import {validId} from '../auth/validation';
import {localDay} from '../journal/domain';
import {externalRadarSignals} from '../external/watches';
import {goalRadarSignals} from '../goals/radar';
import {RADAR_CONFIG as C,radarEnabled,type Signal,type Watch} from './domain';
import {normalizeSnapshot,radarWindow,type RawSnapshot,type Row} from './normalize';
import {evaluate} from './rules';
import {relevance,cluster,materiallyChanged} from './relevance';
import {conversationSignals,weeklySignals} from './context';
import {narrative} from './narrative';
import type {Locale} from '../i18n/config';
export type Insight={id:string;company_id:string;version:number;status:string;attention:string;payload:{signals:Signal[]};material_change:boolean};
async function authorized(company:string,user:string){if(!validId(company)||!validId(user))throw Error('RADAR_ACCESS_DENIED');const db=commercialDatabase(),r=await db.from('company_members').select('user_id').eq('company_id',company).eq('user_id',user).maybeSingle();if(r.error||!r.data)throw Error('RADAR_ACCESS_DENIED');return db;}
export async function loadRadarSnapshot(company:string,at=new Date()){
 const db=commercialDatabase(),c=await db.from('companies').select('timezone').eq('id',company).single();if(c.error)throw Error('RADAR_COMPANY_UNAVAILABLE');const day=localDay(at,c.data.timezone);if(!day)throw Error('RADAR_TIMEZONE_REQUIRED');const since=radarWindow(day);
 const specs=[['business_journal_entries',C.maxRows,'created_at'],['business_entities',300,'updated_at'],['business_observations',C.maxRows,'observed_at'],['business_relationships',500,'created_at'],['strategies',100,'created_at'],['actions',400,'created_at'],['decisions',100,'created_at'],['experiments',100,'created_at'],['execution_results',300,'created_at'],['execution_events',300,'created_at'],['decision_simulations',100,'created_at'],['radar_watches',50,'updated_at']] as const;
 const batches=await Promise.all(specs.map(async([table,limit,order])=>{let q=db.from(table).select('*',{count:'exact'}).eq('company_id',company).order(order,{ascending:false}).order('id').limit(limit+1);if(table==='business_journal_entries')q=q.or(`period_end.gte.${since},event_date.gte.${since}`).eq('status','ACTIVE');if(table==='execution_events')q=q.eq('operation','assumption_assessed');const r=await q;if(r.error)throw Error('RADAR_SOURCE_UNAVAILABLE');return {rows:r.data.slice(0,limit),limited:r.data.length>limit||(r.count!==null&&r.count>r.data.length)};}));
 const [journal,entities,observations,relations,plans,actions,decisions,experiments,results,events,simulations,watchRows]=batches.map(b=>b.rows);
 let watches:Watch[]=[];if(watchRows.length){const m=await db.from('business_memories').select('id,version,deleted').eq('company_id',company).in('id',watchRows.map(w=>w.memory_id));if(m.error)throw Error('RADAR_SOURCE_UNAVAILABLE');watches=watchRows.filter(w=>m.data.some(v=>v.id===w.memory_id&&v.version===w.memory_version&&!v.deleted)).map(w=>({...w.config,id:w.id,source:{table:'business_memories',id:w.memory_id,version:w.memory_version},kind:w.kind})) as Watch[];}
 // Resolve exact names to the same entity identity used by Journal adapters.
 for(const w of watches){const name=w.scope.product??w.scope.channel??w.scope.location;const type=w.scope.product?'PRODUCT_SERVICE':w.scope.channel?'CHANNEL':'LOCATION';const candidates=entities.filter(e=>e.type===type&&e.name===name&&e.status==='ACTIVE');if(name&&candidates.length===1)w.scope.entity=candidates[0].id;}
 return normalizeSnapshot({company,timezone:c.data.timezone,journal,entities,observations,relations,plans,actions,decisions,experiments,results,events,simulations,watches,limited:batches.some(b=>b.limited)} as RawSnapshot,at);
}
export async function processRadarJob(company?:string){
 if(!radarEnabled())return {enabled:false};const db=commercialDatabase();const started=Date.now();const claim=await db.rpc('claim_radar_job',{p_company:company??null});if(claim.error)throw Error('RADAR_CLAIM_FAILED');const job=claim.data?.[0];if(!job)return {idle:true};
 try{
  const snapshot=await loadRadarSnapshot(job.company_id);const result=evaluate(snapshot);result.signals.push(...await externalRadarSignals(job.company_id),...await goalRadarSignals(job.company_id));
  result.signals=annotateGrowthSignals(result.signals,await radarGrowthSnapshot(job.company_id).catch(()=>null));
  const old=await db.from('radar_insights').select('id,fingerprint,payload').eq('company_id',job.company_id).limit(C.maxSignals);if(old.error)throw Error('RADAR_HISTORY_UNAVAILABLE');
  const gated=result.signals.map(signal=>({signal,gate:relevance(signal)}));
  const insights=cluster(gated.filter(s=>s.gate.surface).map(s=>s.signal)).map(group=>{const prior=old.data.find(i=>i.fingerprint===group.key);return {key:group.key,fingerprints:group.signals.map(s=>s.fingerprint),attention:relevance(group.primary).attention,payload:{signals:group.signals},materialChange:!!prior&&group.signals.some(s=>{const before=(prior.payload.signals as Signal[]).find(o=>o.fingerprint===s.fingerprint);return before?materiallyChanged(before,s):s.strategic;})};});
  const saved=await db.rpc('apply_radar_job',{p_company:job.company_id,p_lease:job.lease_token,p_generation:job.generation,p_signals:gated,p_insights:insights,p_recoveries:result.recoveries,p_complete:result.complete,p_latency:Date.now()-started});if(saved.error)throw Error(saved.error.message.includes('LEASE_CHANGED')?'RADAR_LEASE_CHANGED':'RADAR_SAVE_FAILED');
  return {signals:gated.length,insights:insights.length,complete:result.complete};
 }catch(error){
  const code=error instanceof Error&&/^RADAR_[A-Z_]+$/.test(error.message)?error.message:'RADAR_PROCESSING_FAILED';
  await db.from('radar_company_state').update({lease_token:null,lease_until:null,last_error:code,next_scan_at:new Date(Date.now()+(job.attempts>=C.maxAttempts?C.scanHours*3600000:30000*2**job.attempts)).toISOString()}).eq('company_id',job.company_id).eq('lease_token',job.lease_token);
  await db.from('radar_events').insert({company_id:job.company_id,kind:'SCAN_FAILED',details:{code,latency_ms:Date.now()-started}});
  console.error('[seed:radar]',{code});return {error:code};
 }
}
export async function radarPreferences(company:string,user:string){const db=await authorized(company,user);const r=await db.from('radar_preferences').select('proactive_insights_enabled,mute_until').eq('company_id',company).eq('user_id',user).maybeSingle();if(r.error)throw Error('RADAR_UNAVAILABLE');return r.data??{proactive_insights_enabled:true,mute_until:null};}
export async function radarHome(company:string,user:string,locale:Locale){
 if(!radarEnabled())return null;const db=await authorized(company,user);const pref=await radarPreferences(company,user);if(!pref.proactive_insights_enabled||pref.mute_until&&Date.parse(pref.mute_until)>Date.now())return null;
 const rows=await db.from('radar_insights').select('*').eq('company_id',company).eq('status','READY').order('attention',{ascending:false}).order('updated_at',{ascending:false}).limit(8);if(rows.error)throw Error('RADAR_UNAVAILABLE');
 for(const row of rows.data as Insight[]){const shown=await db.rpc('radar_surface',{p_user:user,p_company:company,p_id:row.id,p_version:row.version,p_daily:C.dailyBudget,p_cooldown:C.cooldownHours});if(shown.error)throw Error('RADAR_UNAVAILABLE');if(shown.data)return {id:row.id,version:row.version,...narrative(row.payload.signals,locale)};}
 return null;
}
export async function radarContext(company:string,user:string,question:string,id?:string){
 if(!radarEnabled())return [];const db=await authorized(company,user),pref=await radarPreferences(company,user);if(!pref.proactive_insights_enabled||pref.mute_until&&Date.parse(pref.mute_until)>Date.now())return [];
 if(id&&!validId(id))throw Error('RADAR_UNAVAILABLE');let query=db.from('radar_insights').select('*').eq('company_id',company).eq('status','READY');if(id)query=query.eq('id',id);const r=await query.order('updated_at',{ascending:false}).limit(12);if(r.error)throw Error('RADAR_UNAVAILABLE');
 const dismiss=await db.from('radar_deliveries').select('insight_id,status').eq('company_id',company).eq('user_id',user).in('status',['DISMISSED','RESOLVED']);if(dismiss.error)throw Error('RADAR_UNAVAILABLE');
 const rows=(r.data as Insight[]).map(row=>({id:row.id,signals:row.payload.signals,dismissed:dismiss.data.some(d=>d.insight_id===row.id)}));
 if(!id&&!dismiss.data.length){const observed=await db.from('radar_signals').select('id,payload').eq('company_id',company).eq('status','OBSERVING').in('suppression_reason',['NOT_ACTIONABLE','ISOLATED_CHANGE']).order('last_observed_at',{ascending:false}).limit(8);if(!observed.error)rows.push(...observed.data.map(row=>({id:row.id,signals:[row.payload as Signal],dismissed:false})));}
 return conversationSignals(rows,question,id);
}
export async function radarWeekly(company:string,user:string,sourceIds:string[]){
 if(!radarEnabled())return [];const db=await authorized(company,user);const r=await db.from('radar_signals').select('payload').eq('company_id',company).in('status',['READY_TO_SURFACE','OBSERVING']).order('last_observed_at',{ascending:false}).limit(12);if(r.error)throw Error('RADAR_UNAVAILABLE');
 const pref=await radarPreferences(company,user);if(!pref.proactive_insights_enabled||pref.mute_until&&Date.parse(pref.mute_until)>Date.now())return [];
 return weeklySignals((r.data as {payload:Signal}[]).map(r=>r.payload),sourceIds);
}
export async function radarObservability(){const db=commercialDatabase();const r=await db.from('radar_events').select('kind,details,created_at').order('created_at',{ascending:false}).limit(100);if(r.error)throw Error('RADAR_UNAVAILABLE');return r.data;}
export type RadarRow=Row;
