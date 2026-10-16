import test from 'node:test';
import assert from 'node:assert/strict';
import Module,{createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url),original=Module._load;
const company='20000000-0000-4000-8000-000000000001',foreign='20000000-0000-4000-8000-000000000002',user='20000000-0000-4000-8000-000000000003',outsider='20000000-0000-4000-8000-000000000004',plan='20000000-0000-4000-8000-000000000005',action='20000000-0000-4000-8000-000000000006',at=new Date().toISOString();
let queries=[],rpc=[],failed=new Set(),tables={},preference=true;
function reset(){queries=[];rpc=[];failed=new Set();preference=true;tables={company_members:[{user_id:user,company_id:company}],strategies:[{id:plan,company_id:company,version:1,status:'ACTIVE',name:'Fictício',objective:'Revisar propostas',current_focus:'Organizar propostas',updated_at:at,review_date:'2099-01-01'}],actions:[{id:action,company_id:company,strategy_id:plan,version:1,status:'TODO',title:'Confirmar retorno',position:1,depends_on:[],updated_at:at}],commercial_accounts:[{user_id:user,market_code:'BR'}],commercial_events:[],radar_company_state:[{company_id:company,generation:1,processed_generation:1,last_success_at:at}]};}
class Query{
 constructor(table){this.table=table;this.filters=[];this.orders=[];this.count=null;this.singleRow=false;this.insert=null;}
 select(){return this;}eq(k,v){this.filters.push([k,'eq',v]);return this;}is(k,v){this.filters.push([k,'is',v]);return this;}in(k,v){this.filters.push([k,'in',v]);return this;}not(k,op,v){this.filters.push([k,'not',v]);return this;}gt(k,v){this.filters.push([k,'gt',v]);return this;}lte(k,v){this.filters.push([k,'lte',v]);return this;}
 order(k,options={}){this.orders.push([k,options.ascending!==false]);return this;}limit(n){this.count=n;return this;}maybeSingle(){this.singleRow=true;return this;}single(){this.singleRow=true;return this;}upsert(value){this.insert=value;return this;}
 then(resolve,reject){return Promise.resolve().then(()=>{
  queries.push({table:this.table,filters:this.filters,limit:this.count,write:!!this.insert});
  if(failed.has(this.table))return {data:null,error:{code:'SYNTHETIC_FAILURE'}};
  if(this.insert){tables[this.table]??=[];if(!tables[this.table].some(r=>r.dedupe_key===this.insert.dedupe_key))tables[this.table].push(this.insert);return {data:null,error:null};}
  let data=(tables[this.table]??[]).filter(r=>this.filters.every(([k,op,v])=>op==='eq'?r[k]===v:op==='is'?(r[k]??null)===v:op==='in'?v.includes(r[k]):op==='not'?r[k]!=null:op==='gt'?r[k]>v:r[k]<=v));
  for(const [key,asc] of [...this.orders].reverse())data=[...data].sort((a,b)=>String(a[key]).localeCompare(String(b[key]))*(asc?1:-1));
  if(this.count!==null)data=data.slice(0,this.count);return {data:this.singleRow?data[0]??null:data,error:null};
 }).then(resolve,reject);}
}
const database={from:table=>new Query(table),rpc:async(name,args)=>{rpc.push({name,args});return {data:true,error:null};}};
Module._load=function(spec,parent,...rest){
 if(spec==='server-only')return {};
 if(parent?.filename.replaceAll('\\','/').endsWith('/cockpit/server.js')){
  if(spec==='../commercial/server')return {commercialDatabase:()=>database};
  if(spec==='../goals/server')return {goalsEnabled:()=>false};
  if(spec==='../growth/server')return {radarGrowthSnapshot:async()=>null,growthContext:async()=>[]};
  if(spec==='../radar/server')return {radarPreferences:async()=>({proactive_insights_enabled:preference,mute_until:null}),radarContext:async()=>[{key:'radar',kind:'INFERENCE'}]};
  if(spec==='../external/server')return {externalPreference:async()=>({enabled:true,sensitive_mode:false})};
 }
 return original.call(this,spec,parent,...rest);
};
process.env.SEED_COCKPIT_ENABLED='true';process.env.SEED_RADAR_ENABLED='true';
const api=require('../.test-build/src/lib/cockpit/server.js');Module._load=original;

test('Cockpit server authorization, boundaries, versions and zero provider calls',async t=>{
 await t.test('nonmember cannot read data, resolve or emit events, even with a known source ID',async()=>{reset();await assert.rejects(api.readCockpit(company,outsider,'pt-BR'),/ACCESS_DENIED/);assert.deepEqual(queries.map(q=>q.table),['company_members']);await assert.rejects(api.recordCockpitEvent(foreign,user,'home_viewed'),/ACCESS_DENIED/);await assert.rejects(api.resolveCockpit(foreign,user,'pt-BR',{type:'PLAN',id:plan,version:'1'}),/ACCESS_DENIED/);});
 await t.test('every company source is filtered, conversations additionally private; reads are bounded',async()=>{reset();tables.conversations=[{id:action,company_id:foreign,user_id:user,title:'FOREIGN',version:1,updated_at:at},{id:user,company_id:company,user_id:outsider,title:'PRIVATE OTHER USER',version:1,updated_at:at}];const view=await api.readCockpit(company,user,'pt-BR');assert.equal(view.partial,false);assert.equal(view.items.length,1);assert.ok(!JSON.stringify(view).includes('FOREIGN'));for(const q of queries.filter(q=>q.table!=='company_members')){assert.ok(q.filters.some(([k,op,v])=>k==='company_id'&&op==='eq'&&v===company));assert.ok(q.limit!==null||q.table==='radar_company_state');}assert.equal(rpc.length,0);});
 await t.test('one source failure retains plan and composer; no failure text/data is exposed',async()=>{reset();failed.add('weekly_intelligence_reports');const view=await api.readCockpit(company,user,'pt-BR');assert.equal(view.partial,true);assert.equal(view.canConverse,true);assert.ok(view.items.some(x=>x.ref.type==='PLAN'));assert.ok(!JSON.stringify(view).includes('SYNTHETIC_FAILURE'));});
 await t.test('CTA prepares current source context, no AI or mutation of the plan',async()=>{reset();const view=await api.readCockpit(company,user,'pt-BR'),before=JSON.stringify(tables.strategies);const open=await api.resolveCockpit(company,user,'pt-BR',view.items[0].ref);assert.equal(open.destination,'chat');assert.equal(open.planId,plan);assert.ok(open.prompt.length<120);const context=await api.cockpitContext(company,user,'pt-BR',open.reference);assert.equal(context.planId,plan);assert.match(context.rows[0].value,/Confirmar retorno/);assert.equal(JSON.stringify(tables.strategies),before);assert.ok(queries.filter(q=>q.write).every(q=>q.table==='commercial_events'));assert.equal(rpc.length,0);});
 await t.test('editing an action invalidates its old card and its unsent contextual draft',async()=>{reset();const old=(await api.readCockpit(company,user,'pt-BR')).items[0].ref;tables.actions[0].version=2;tables.actions[0].title='Versão corrigida';await assert.rejects(api.resolveCockpit(company,user,'pt-BR',old),/CONTEXT_CHANGED/);await assert.rejects(api.cockpitContext(company,user,'pt-BR',old),/CONTEXT_CHANGED/);assert.equal(tables.commercial_events.length,0);});
 await t.test('completed/deleted plan cannot be resumed by replaying its reference',async()=>{reset();const old=(await api.readCockpit(company,user,'pt-BR')).items[0].ref;tables.strategies[0].status='COMPLETED';await assert.rejects(api.cockpitContext(company,user,'pt-BR',old),/CONTEXT_CHANGED/);});
 await t.test('weekly acknowledgement is private and survives refresh; weekly content remains canonical',async()=>{reset();tables.strategies=[];tables.weekly_intelligence_reports=[{id:plan,company_id:company,status:'AVAILABLE',locale:'pt-BR',generated_at:at,period_start:at.slice(0,10),period_end:at.slice(0,10),confidence:'MEDIUM',source_ids:[action],structured_report:{report:{summary:{text:'Análise fictícia para rever'}}}}];const view=await api.readCockpit(company,user,'pt-BR');assert.equal(view.items[0].ref.type,'WEEKLY');await api.resolveCockpit(company,user,'pt-BR',view.items[0].ref);assert.equal((await api.readCockpit(company,user,'pt-BR')).items.length,0);assert.equal(tables.weekly_intelligence_reports[0].status,'AVAILABLE');assert.equal((await api.cockpitContext(company,user,'pt-BR',view.items[0].ref)).rows.length,1);});
 await t.test('101+ actions do not pretend to be complete; size of reads stays fixed',async()=>{reset();tables.actions=Array.from({length:10000},(_,i)=>({...tables.actions[0],id:String(i),position:i}));const view=await api.readCockpit(company,user,'pt-BR');assert.equal(view.partial,true);assert.equal(view.items[0].destination,'plan');assert.match(view.items[0].progressLabel,/parcial/);assert.equal(queries.filter(q=>q.table==='actions').length,1);assert.equal(queries.find(q=>q.table==='actions').limit,101);});
 await t.test('analytics allowlist, opaque keys and hourly dedup prevent arbitrary payloads',async()=>{reset();await api.recordCockpitEvent(company,user,'home_viewed');await api.recordCockpitEvent(company,user,'home_viewed');assert.equal(tables.commercial_events.length,1);assert.ok(tables.commercial_events[0].dedupe_key.startsWith('cockpit:event:'));await assert.rejects(api.recordCockpitEvent(company,user,'secret user text'),/INVALID/);});
 await t.test('feature disabled fails closed; FREE rendering is not a new paywall',async()=>{reset();assert.equal((await api.readCockpit(company,user,'pt-BR')).items.length,1);process.env.SEED_COCKPIT_ENABLED='false';await assert.rejects(api.readCockpit(company,user,'pt-BR'),/ACCESS_DENIED/);process.env.SEED_COCKPIT_ENABLED='true';});
});

test('UI/action/orchestrator wiring keeps expensive work after explicit send and source validation',()=>{
 const ui=readFileSync(new URL('../src/components/seed-workspace.tsx',import.meta.url),'utf8'),actions=readFileSync(new URL('../src/app/cockpit/actions.ts',import.meta.url),'utf8'),orchestrator=readFileSync(new URL('../src/lib/seed/orchestrator.ts',import.meta.url),'utf8');
 assert.ok(actions.includes('authorizeChat({companyId:company})'));assert.ok(orchestrator.indexOf('selectedHome=await cockpitContext')<orchestrator.indexOf('await externalTurn'));
 assert.ok(ui.indexOf('className="composer core-composer"')<ui.indexOf('<Cockpit companyId'));
 assert.ok(ui.includes('cockpitReference:cockpitRef'));assert.ok(ui.includes('setDraft(current=>current.trim()?current:action.prompt)'));
 const handler=ui.slice(ui.indexOf('async function fromCockpit'),ui.indexOf('function trackComposer'));assert.doesNotMatch(handler,/fetch\(|submit\(|requestSubmit/);
 const view=readFileSync(new URL('../src/components/cockpit-view.tsx',import.meta.url),'utf8');assert.match(view,/aria-labelledby/);assert.match(view,/slice\(0,3\)/);
});
