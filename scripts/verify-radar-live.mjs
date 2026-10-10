/** Phase 9.7 remote verification. No AI, Stripe, messages or paid-plan changes.
 * Default is read-only. --allow-test-writes creates two synthetic Auth users,
 * exercises their own isolated companies and removes them in finally.
 * First run: npx tsc -p tsconfig.test.json
 */
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
const publicKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if(!url||!secret||!publicKey)throw Error('RADAR_TEST_CONFIGURATION_REQUIRED');
const client=key=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const db=client(secret),fixtures=[],checks=[];
const fixtureOwner=process.argv.find(a=>a.startsWith('--fixture-owner='))?.split('=')[1];
if(fixtureOwner&&!/^[a-f0-9-]{36}$/.test(fixtureOwner))throw Error('RADAR_TEST_OWNER_INVALID');
const require=createRequire(import.meta.url);
const ok=r=>{if(r.error)throw Error(r.error.code||r.error.message||'RADAR_TEST_DATABASE_ERROR');return r.data;};
async function check(name,fn){await fn();checks.push({name,passed:true});console.log(name+': OK');}
const report={at:new Date().toISOString(),mode:process.argv.includes('--allow-test-writes')?(fixtureOwner?'isolated-company-existing-owner':'isolated-live-fixtures'):'read-only',aiCalls:0,aiCostUsd:0,checks,cleanup:[]};
try{
 await check('schema_available',async()=>{for(const table of ['radar_company_state','radar_signals','radar_insights','radar_preferences','radar_deliveries','radar_watches','radar_events']){const r=await db.from(table).select('company_id').limit(0);assert.equal(r.status,200,table+': migration not available');ok(r);}const r=await db.rpc('claim_radar_job',{p_company:crypto.randomUUID()});assert.equal(r.status,200);assert.deepEqual(ok(r),[]);});
 if(process.argv.includes('--allow-test-writes')){
  const {normalizeSnapshot}=require('../.test-build/src/lib/radar/normalize.js');
  const {evaluate}=require('../.test-build/src/lib/radar/rules.js');
  const {relevance,cluster}=require('../.test-build/src/lib/radar/relevance.js');
  const {localDay,shiftDay}=require('../.test-build/src/lib/journal/domain.js');
  if(fixtureOwner){
   ok(await db.from('profiles').select('id').eq('id',fixtureOwner).single());
   const tag=crypto.randomUUID(),fixture={user:fixtureOwner,company:crypto.randomUUID(),name:'TESTE FICTÍCIO RADAR 9.7 '+tag,session:null,existingUser:true};fixtures.push(fixture);
   ok(await db.from('companies').insert({id:fixture.company,name:fixture.name,timezone:'America/Sao_Paulo'}));ok(await db.from('company_members').insert({company_id:fixture.company,user_id:fixture.user,role:'owner'}));
  }else{
  const market=ok(await db.from('commercial_markets').select('status,signup_enabled,disable_new_signups').eq('code','BR').single());assert.ok(market.status==='ACTIVE'&&market.signup_enabled&&!market.disable_new_signups,'RADAR_TEST_SIGNUP_DISABLED');
  for(let i=0;i<2;i++){
   const tag=crypto.randomUUID(),email='seed-radar-'+tag+'@example.invalid',password=crypto.randomUUID()+'aA1!';
   const created=ok(await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:'TESTE FICTÍCIO RADAR 9.7',commercial_country:'BR'}}));
   const fixture={user:created.user.id,company:null,name:'TESTE FICTÍCIO RADAR 9.7 '+tag,session:client(publicKey)};fixtures.push(fixture);
   const membership=ok(await db.from('company_members').select('company_id').eq('user_id',fixture.user).single());fixture.company=membership.company_id;
   ok(await db.from('companies').update({name:fixture.name,timezone:'America/Sao_Paulo'}).eq('id',fixture.company));
   ok(await fixture.session.auth.signInWithPassword({email,password}));
  }
  }
  const f=fixtures[0],other=fixtures[1],day=localDay(new Date(),'America/Sao_Paulo'),monday=shiftDay(day,-((new Date(day+'T12:00:00Z').getUTCDay()+6)%7));
  const journal=[];
  for(let i=0;i<3;i++)for(const [metric,value] of [['leads',500],['sales',[60,50,40][i]]])journal.push({company_id:f.company,user_id:f.user,entry_type:'METRIC',description:'TESTE FICTÍCIO RADAR 9.7',evidence:'TESTE FICTÍCIO RADAR 9.7',event_date:shiftDay(monday,(i-3)*7),period_start:shiftDay(monday,(i-3)*7),period_end:shiftDay(monday,(i-3)*7+6),metric_type:metric,value,unit:'count',confidence:'HIGH',identity_key:crypto.randomUUID(),source_type:'MANUAL',manual:true,metadata:{period:'EXPLICIT'}});
  ok(await db.from('business_journal_entries').insert(journal));
  const claim=async()=>{ok(await db.from('radar_company_state').update({next_scan_at:new Date(0).toISOString()}).eq('company_id',f.company));return ok(await db.rpc('claim_radar_job',{p_company:f.company}))[0];};
  const evaluateCompany=async()=>evaluate(normalizeSnapshot({company:f.company,timezone:'America/Sao_Paulo',journal:ok(await db.from('business_journal_entries').select('*').eq('company_id',f.company).eq('status','ACTIVE')),entities:[],observations:[],relations:[],plans:[],actions:[],decisions:[],experiments:[],results:[],events:[],simulations:[],watches:[],limited:false}));
  const apply=async(job,result)=>ok(await db.rpc('apply_radar_job',{p_company:f.company,p_lease:job.lease_token,p_generation:job.generation,p_signals:result.signals.map(signal=>({signal,gate:relevance(signal)})),p_insights:cluster(result.signals.filter(s=>relevance(s).surface)).map(g=>({key:g.key,fingerprints:g.signals.map(s=>s.fingerprint),attention:relevance(g.primary).attention,payload:{signals:g.signals},materialChange:false})),p_recoveries:result.recoveries,p_complete:true,p_latency:1}));
  let insight,result;
  await check('canonical_metrics_to_persisted_insight',async()=>{result=await evaluateCompany();assert.ok(result.signals.some(s=>s.metric==='conversion'&&s.current.min===8));await apply(await claim(),result);insight=ok(await db.from('radar_insights').select('id,version,status').eq('company_id',f.company).single());assert.equal(insight.status,'READY');});
  await check('idempotent_reprocessing',async()=>{await apply(await claim(),result);const next=ok(await db.from('radar_insights').select('version').eq('id',insight.id).single());assert.equal(next.version,insight.version);});
  if(!fixtureOwner)await check('authenticated_tenant_isolation',async()=>{assert.equal(ok(await other.session.from('radar_insights').select('id').eq('company_id',f.company)).length,0);assert.equal(ok(await f.session.from('radar_insights').select('id').eq('company_id',f.company)).length,1);assert.ok((await other.session.rpc('claim_radar_job',{p_company:f.company})).error);assert.ok((await other.session.from('radar_preferences').insert({company_id:f.company,user_id:other.user})).error);});
  if(fixtureOwner)await check('nonmember_rpc_and_anonymous_access',async()=>{const denied=await db.rpc('radar_feedback',{p_user:crypto.randomUUID(),p_company:f.company,p_insight:insight.id,p_action:'DISMISSED',p_feedback:null});assert.ok(denied.error);const anon=client(publicKey);const r=await anon.from('radar_insights').select('id').eq('company_id',f.company);assert.ok(r.error||r.data.length===0);});
  const surface=async()=>ok(await db.rpc('radar_surface',{p_user:f.user,p_company:f.company,p_id:insight.id,p_version:insight.version,p_daily:2,p_cooldown:72}));
  await check('preference_and_dismiss',async()=>{ok(await db.from('radar_preferences').upsert({company_id:f.company,user_id:f.user,proactive_insights_enabled:false}));assert.equal(await surface(),false);ok(await db.from('radar_preferences').update({proactive_insights_enabled:true}).eq('company_id',f.company).eq('user_id',f.user));assert.equal(await surface(),true);ok(await db.rpc('radar_feedback',{p_user:f.user,p_company:f.company,p_insight:insight.id,p_action:'DISMISSED',p_feedback:'NOT_RELEVANT'}));assert.equal(await surface(),false);});
  await check('correction_invalidates_stale_worker',async()=>{const job=await claim();const source=ok(await db.from('business_journal_entries').select('id,version').eq('company_id',f.company).eq('metric_type','sales').order('period_end',{ascending:false}).limit(1).single());ok(await db.from('business_journal_entries').update({value:35,version:source.version+1}).eq('company_id',f.company).eq('id',source.id));assert.equal(ok(await db.from('radar_insights').select('status').eq('id',insight.id).single()).status,'SUPERSEDED');await assert.rejects(apply(job,result));ok(await db.from('radar_company_state').update({lease_until:new Date(0).toISOString()}).eq('company_id',f.company));await apply(await claim(),await evaluateCompany());});
  await check('deleted_sources_erase_derived_payloads',async()=>{ok(await db.from('business_journal_entries').update({status:'DELETED',value:null,evidence:'',description:''}).eq('company_id',f.company));assert.equal(ok(await db.from('radar_signals').select('id').eq('company_id',f.company)).length,0);assert.equal(ok(await db.from('radar_insights').select('id').eq('company_id',f.company)).length,0);});
 }
 report.passed=true;
}catch(error){report.passed=false;report.error=error instanceof Error?error.message:'RADAR_TEST_FAILED';process.exitCode=1;console.error(report.error);}
finally{
 for(const f of fixtures.reverse()){
  try{
   if(!f.company){const memberships=ok(await db.from('company_members').select('company_id').eq('user_id',f.user));f.company=memberships[0]?.company_id??null;}
   if(f.company){const membership=ok(await db.from('company_members').select('user_id').eq('company_id',f.company));assert.ok(membership.length<=1&&(!membership.length||membership[0].user_id===f.user));const company=ok(await db.from('companies').select('name').eq('id',f.company).maybeSingle());assert.ok(!company||company.name===f.name||!f.existingUser&&company.name==='Minha empresa');ok(await db.from('companies').delete().eq('id',f.company));}
   if(!f.existingUser)ok(await db.auth.admin.deleteUser(f.user));report.cleanup.push({user:f.user,company:f.company,removed:true,userRemoved:!f.existingUser});
  }catch{report.cleanup.push({user:f.user,company:f.company,removed:false});report.passed=false;process.exitCode=1;}
 }
 mkdirSync('.test-build',{recursive:true});writeFileSync('.test-build/phase-9-7-live.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:checks.length,cleanupComplete:report.cleanup.every(c=>c.removed),aiCalls:0}));
}
