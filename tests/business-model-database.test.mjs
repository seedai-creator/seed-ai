import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
test('business model database: history, corrections, idempotency, rollback and RLS',async t=>{
 const db=new PGlite(),user=crypto.randomUUID(),other=crypto.randomUUID(),conversation=crypto.randomUUID();let company,team;
 const value=n=>({text:null,value:n,min:null,max:null,unit:'people',currency:null,approximate:false,period_start:null,period_end:null});
 const payload=(n,operation='NEW',day=null,kind='FACT')=>({entities:[{key:'t',scope:'CURRENT_COMPANY',type:'TEAM',name:'Equipe comercial',canonical_name:'equipe comercial',reference_id:null,existing_id:null,version:null,evidence:'Equipe comercial '+n}],observations:[{entity:'t',attribute:'count',data:value(n),kind,confidence:kind==='FACT'?'HIGH':'LOW',evidence:'Equipe comercial '+n,operation,observed_on:day,structural:true,memory_id:null}],relationships:[]});
 async function job(p,who=user,co=company){const message=crypto.randomUUID();await db.query("insert into messages(id,conversation_id,request_id,role,content) values($1,$2,$3,'user',$4)",[message,conversation,crypto.randomUUID(),p.entities.map(e=>e.evidence).concat(p.relationships.map(r=>r.evidence)).join('\n')]);return (await db.query('insert into business_model_jobs(company_id,user_id,source_message_id,payload) values($1,$2,$3,$4) returning id',[co,who,message,p])).rows[0].id;}
 async function asUser(sql,args=[],who=user){await db.exec('begin');try{await db.exec('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[who]);const r=await db.query(sql,args);await db.exec('commit');return r.rows;}catch(e){await db.exec('rollback');throw e;}}
 try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`);
 const folder=new URL('../supabase/migrations/',import.meta.url);for(const f of (await readdir(folder)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(f,folder),'utf8'));
 await db.query('insert into auth.users(id) values($1),($2)',[user,other]);company=(await db.query('select company_id from company_members where user_id=$1',[user])).rows[0].company_id;
 await db.query("insert into conversations(id,company_id,user_id,title) values($1,$2,$3,'Fixture 9.5')",[conversation,company,user]);
 await t.test('entity is created once; replay changes nothing',async()=>{
 const id=await job(payload(4,'NEW','2026-01-01'));await db.query('select apply_business_model($1)',[id]);await db.query('select apply_business_model($1)',[id]);
 assert.equal((await db.query('select count(*) from business_entities')).rows[0].count,1);assert.equal((await db.query('select count(*) from business_observations')).rows[0].count,1);team=(await db.query('select id from business_entities')).rows[0].id;
 });
 await t.test('4 to 5 to 7 preserves temporal history and only one current state',async()=>{
 for(const [n,d] of [[5,'2026-04-01'],[7,'2026-09-01']])await db.query('select apply_business_model($1)',[await job(payload(n,'CHANGE',d))]);
 const rows=(await db.query('select * from business_observations order by observed_at')).rows;assert.deepEqual(rows.map(r=>r.data.value),[4,5,7]);assert.equal(rows.filter(r=>r.is_current).length,1);assert.equal(rows.at(-1).data.value,7);
 });
 await t.test('correction differs from real-world change and keeps audit trail',async()=>{
 await db.query('select apply_business_model($1)',[await job(payload(6,'CORRECTION','2026-09-02'))]);
 const r=(await db.query('select * from business_observations where is_current')).rows[0];assert.equal(r.data.value,6);assert.equal(r.operation,'CORRECTION');assert.ok(r.supersedes);
 });
 await t.test('uncertain inference and older sources cannot replace confirmed current facts',async()=>{
 await db.query('select apply_business_model($1)',[await job(payload(9,'CHANGE','2026-01-02'))]);
 await db.query('select apply_business_model($1)',[await job(payload(12,'CHANGE','2026-09-03','INFERENCE'))]);
 assert.equal((await db.query('select data from business_observations where is_current')).rows[0].data.value,6);
 assert.equal((await db.query("select state from business_observations where kind='INFERENCE'")).rows[0].state,'PROVISIONAL');
 });
 await t.test('conflicting new assertion is recorded without silently overwriting',async()=>{
 await db.query('select apply_business_model($1)',[await job(payload(10,'NEW','2026-09-04'))]);
 const r=(await db.query('select * from business_observations where is_current')).rows[0];assert.equal(r.data.value,6);assert.equal(r.state,'CONFLICTING');
 });
 await t.test('manual correction resolves current state, version protects against stale tabs',async()=>{
 const r=(await db.query('select * from business_observations where is_current')).rows[0];
 await db.query('select edit_business_observation($1,$2,$3,$4,$5)',[user,company,r.id,r.version,value(5)]);
 await assert.rejects(db.query('select edit_business_observation($1,$2,$3,$4,$5)',[user,company,r.id,r.version,value(8)]));
 const current=(await db.query('select * from business_observations where is_current')).rows[0];assert.equal(current.source_type,'MANUAL_EDIT');assert.equal(current.state,'CONFIRMED');assert.equal(current.data.value,5);
 });
 await t.test('RLS hides all graph/history data; client writes and worker RPCs denied',async()=>{
 for(const table of ['business_entities','business_observations','business_relationships','business_model_events'])assert.equal((await asUser('select * from '+table,[],other)).length,0);
 assert.ok((await asUser('select * from business_observations')).length>0);
 await assert.rejects(asUser("update business_entities set name='bad'"));await assert.rejects(asUser('select process_business_model_job(null)'));
 const r=(await db.query('select * from business_observations where is_current')).rows[0];await assert.rejects(db.query('select edit_business_observation($1,$2,$3,$4,$5)',[other,company,r.id,r.version,value(8)]));
 await assert.rejects(db.query('select apply_business_model($1)',[await job(payload(12),other)]));
 });
 await t.test('invalid relation rolls back new entities and observations atomically',async()=>{
 const p=payload(11);p.entities.push({...p.entities[0],key:'p',type:'PRODUCT_SERVICE',name:'Produto',canonical_name:'produto',evidence:'Produto'});p.relationships=[{source:'t',target:'p',type:'OPERATES',kind:'FACT',status:'ACTIVE',confidence:'HIGH',evidence:'Produto'}];
 await assert.rejects(db.query('select apply_business_model($1)',[await job(p)]));assert.equal((await db.query("select count(*) from business_entities where type='PRODUCT_SERVICE'")).rows[0].count,0);
 });
 await t.test('referenced company and goals are not copied; foreign references rejected',async()=>{
 const p={entities:[{key:'c',scope:'CURRENT_COMPANY',type:'COMPANY',name:'Empresa',canonical_name:'ref:'+company,reference_id:company,existing_id:null,version:null,evidence:'Empresa'}],observations:[],relationships:[]};await db.query('select apply_business_model($1)',[await job(p)]);
 const e=(await db.query("select * from business_entities where type='COMPANY'")).rows[0];assert.equal(e.reference_table,'companies');assert.equal(e.reference_id,company);
 const otherCompany=(await db.query('select company_id from company_members where user_id=$1',[other])).rows[0].company_id;p.entities[0].reference_id=otherCompany;await assert.rejects(db.query('select apply_business_model($1)',[await job(p)]));
 });
 await t.test('cross-tenant relationships fail composite foreign keys',async()=>{
 const otherCompany=(await db.query('select company_id from company_members where user_id=$1',[other])).rows[0].company_id;
 const foreign=(await db.query("insert into business_entities(company_id,type,name,canonical_name) values($1,'CHANNEL','Google','google') returning id",[otherCompany])).rows[0].id;
 await assert.rejects(db.query("insert into business_relationships(company_id,source_id,target_id,type,kind,status,confidence,evidence) values($1,$2,$3,'USES','FACT','ACTIVE','HIGH','Test')",[company,team,foreign]));
 });
 await t.test('product price evolves, old documents stay historical, discontinuation closes relationships',async()=>{
 const p={entities:[{key:'p',scope:'CURRENT_COMPANY',type:'PRODUCT_SERVICE',name:'Produto A',canonical_name:'produto a',reference_id:null,existing_id:null,version:null,evidence:'Produto A custa BRL 199.'},{key:'c',scope:'CURRENT_COMPANY',type:'COMPANY',name:'Empresa',canonical_name:'ref:'+company,reference_id:company,existing_id:null,version:null,evidence:'Empresa'}],observations:[{entity:'p',attribute:'price',data:{...value(199),unit:'money',currency:'BRL'},kind:'METRIC',confidence:'HIGH',evidence:'Produto A custa BRL 199.',operation:'NEW',observed_on:'2026-01-01',structural:true,memory_id:null}],relationships:[{source:'c',target:'p',type:'SELLS',kind:'FACT',status:'ACTIVE',confidence:'HIGH',evidence:'Produto A custa BRL 199.'}]};
 await db.query('select apply_business_model($1)',[await job(p)]);
 const id=(await db.query("select id from business_entities where company_id=$1 and type='PRODUCT_SERVICE'",[company])).rows[0].id;
 p.observations[0].data.value=249;p.observations[0].operation='CHANGE';p.observations[0].observed_on='2026-09-01';p.observations[0].evidence='Produto A custa BRL 249.';p.entities[0].evidence=p.observations[0].evidence;p.relationships=[];
 await db.query('select apply_business_model($1)',[await job(p)]);
 const oldDoc=structuredClone(p);oldDoc.source_type='DOCUMENT';oldDoc.observations[0].data.value=100;oldDoc.observations[0].observed_on='2025-01-01';await db.query('select apply_business_model($1)',[await job(oldDoc)]);
 assert.equal((await db.query('select data from business_observations where entity_id=$1 and is_current',[id])).rows[0].data.value,249);
 assert.equal((await db.query("select state from business_observations where entity_id=$1 and source_type='DOCUMENT'",[id])).rows[0].state,'PROVISIONAL');
 p.observations[0]={...p.observations[0],attribute:'status',data:{...value(null),text:'DISCONTINUED',unit:null},observed_on:'2026-10-01'};
 await db.query('select apply_business_model($1)',[await job(p)]);
 assert.equal((await db.query('select status from business_entities where id=$1',[id])).rows[0].status,'DISCONTINUED');
 assert.equal((await db.query('select status from business_relationships where target_id=$1',[id])).rows[0].status,'HISTORICAL');assert.equal((await db.query('select count(*) from business_observations where entity_id=$1',[id])).rows[0].count,4);
 });
 await t.test('safe merge preserves original IDs and history and rejects another company',async()=>{
 const a=(await db.query("insert into business_entities(company_id,type,name,canonical_name) values($1,'CHANNEL','Whats','whats') returning id",[company])).rows[0].id;
 const b=(await db.query("insert into business_entities(company_id,type,name,canonical_name) values($1,'CHANNEL','WhatsApp','whatsapp') returning id",[company])).rows[0].id;
 await db.query("insert into business_relationships(company_id,source_id,target_id,type,kind,status,confidence,evidence) values($1,$2,$3,'USES','FACT','ACTIVE','HIGH','Equipe usa Whats')",[company,team,a]);
 await assert.rejects(db.query('select merge_business_entities($1,$2,$3,$4)',[other,company,a,b]));await db.query('select merge_business_entities($1,$2,$3,$4)',[user,company,a,b]);
 assert.equal((await db.query('select merged_into from business_entities where id=$1',[a])).rows[0].merged_into,b);
 assert.equal((await db.query('select status from business_relationships where target_id=$1',[a])).rows[0].status,'HISTORICAL');assert.equal((await db.query('select status from business_relationships where target_id=$1',[b])).rows[0].status,'ACTIVE');
 });
 } finally {await db.close();}
});
