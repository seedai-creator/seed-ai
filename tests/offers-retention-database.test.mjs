import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';

test('versioned offers and minimal access retention on migrated PostgreSQL',async t=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
   create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`);
  const folder=new URL('../supabase/migrations/',import.meta.url);
  for(const name of (await readdir(folder)).filter(n=>n.endsWith('.sql')).sort())await db.exec(await readFile(new URL(name,folder),'utf8'));
  const query=async(sql,args=[])=>(await db.query(sql,args)).rows;
  async function asRole(role,sql,args=[],user=''){
   await db.exec('begin');try{
    await db.exec('set local role '+role);await db.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);
    const rows=await query(sql,args);await db.exec('commit');return rows;
   }catch(e){await db.exec('rollback');throw e;}
  }
  const offers=await query('select * from commercial_offers order by company_limit');
  await t.test('migration prepares exact offers without opening billing or changing legacy PRO',async()=>{
   assert.deepEqual(offers.map(o=>[o.company_limit,Number(o.amount_minor),o.policy.hard_usd,o.available]),[[1,9999,4,false],[3,19999,8,false],[5,39999,16,false]]);
   assert.equal((await query("select billing_enabled from commercial_markets where code='BR'"))[0].billing_enabled,false);
   assert.equal((await query('select count(*)::int n from commercial_prices where offer_id is not null'))[0].n,0);
   assert.equal((await query("select company_limit from commercial_plans where code='PRO'"))[0].company_limit,1);
   await assert.rejects(asRole('authenticated','select * from commercial_offers'));
   await assert.rejects(asRole('authenticated',"update commercial_offers set available=true"));
   await assert.rejects(query("update commercial_offers set company_limit=5 where id='PRO_1_V1'"));
  });
  await db.exec("update commercial_markets set billing_enabled=true where code='BR';update commercial_settings set value='{"+'"enabled":true'+"}' where id='rollout'");
  for(const offer of offers)await t.test(`${offer.id}: exact access, shared budget, duplicate and cancellation`,async()=>{
   const user=randomUUID(),outsider=randomUUID(),price=randomUUID();
   await query(`insert into auth.users(id,raw_user_meta_data) values($1,'{"commercial_country":"BR"}'),($2,'{"commercial_country":"BR"}')`,[user,outsider]);
   await query("update commercial_accounts set market_code='BR' where user_id in ($1,$2)",[user,outsider]);
   await query("insert into commercial_prices(id,plan_code,market_code,currency,amount_minor,provider_price_id,status,offer_id) values($1,'PRO','BR','BRL',$2,$3,'ACTIVE',$4)",[price,offer.amount_minor,'price_'+price.replaceAll('-',''),offer.id]);
   await assert.rejects(query("update commercial_prices set amount_minor=100 where id=$1",[price]));
   await assert.rejects(query("update commercial_prices set offer_id=null where id=$1",[price]));
   await assert.rejects(asRole('service_role','select begin_checkout($1,$2,$3)',[user,'BR',price]));
   await query('update commercial_offers set available=true where id=$1',[offer.id]);
   await asRole('service_role','select begin_checkout($1,$2,$3)',[user,'BR',price]);
   const sub={user_id:user,market_code:'BR',price_id:price,provider_price_id:'price_'+price.replaceAll('-',''),
    provider_customer_id:'cus_'+user,provider_subscription_id:'sub_'+user,status:'active',currency:'BRL',amount_minor:Number(offer.amount_minor),
    current_period_start:new Date(Date.now()-3600000).toISOString(),current_period_end:new Date(Date.now()+86400000).toISOString(),cancel_at_period_end:false,canceled_at:null};
   const apply=(event,time,changes={})=>asRole('service_role','select apply_billing_event($1,$2,$3,$4::jsonb)',[event,'invoice.paid',time,JSON.stringify({...sub,...changes})]);
   await apply('evt_'+user,1);
   const plan=(await asRole('service_role','select commercial_effective_plan($1) p',[user]))[0].p;
   assert.equal(plan.company_limit,offer.company_limit);assert.equal(plan.policy.hard_usd,offer.policy.hard_usd);
   assert.equal(plan.offer_id,offer.id);
   await assert.rejects(asRole('authenticated','select commercial_effective_plan($1)',[user],outsider));
   assert.equal((await asRole('authenticated','select * from subscriptions',[],outsider)).length,0);
   for(let n=1;n<offer.company_limit;n++)await asRole('authenticated',"select create_company('FICTIONAL additional business')",[],user);
   await assert.rejects(asRole('authenticated',"select create_company('FICTIONAL excess')",[],user));
   const companies=await query('select company_id from company_members where user_id=$1',[user]);
   const request=randomUUID(),cap=offer.policy.hard_usd;
   assert.equal((await asRole('service_role','select reserve_ai_request($1,$2,$3,$4) r',[user,companies[0].company_id,request,cap]))[0].r.allowed,true);
   await asRole('service_role',"select finish_ai_request($1,'UNKNOWN',null)",[request]);
   await apply('evt_'+user,1);
   const usage=(await asRole('service_role',"select commercial_usage($1,'lifetime') r",[user]))[0].r;
   assert.equal(Number(usage.cost),cap);assert.equal(usage.policy.hard_usd,cap);
   const otherCompany=companies.at(-1).company_id;
   assert.equal((await asRole('service_role','select reserve_ai_request($1,$2,$3,0.001) r',[user,otherCompany,randomUUID()]))[0].r.allowed,false);
   // Removing an offer from sale cannot remove paid access or reset usage.
   await query('update commercial_offers set available=false where id=$1',[offer.id]);
   assert.equal((await asRole('service_role','select commercial_effective_plan($1) p',[user]))[0].p.company_limit,offer.company_limit);
   await apply('evt_cancel_'+user,3,{status:'canceled'});
   await apply('evt_late_'+user,2);
   assert.equal((await asRole('service_role','select commercial_effective_plan($1) p',[user]))[0].p.code,'FREE');
   assert.equal((await asRole('authenticated','select * from companies',[],user)).length,offer.company_limit);
   await assert.rejects(asRole('authenticated',"select create_company('No entitlement after cancellation')",[],user));
   // Remove only this local fixture's simulated spend before the next scenario.
   // The global guard correctly includes unknown spend from canceled accounts.
   await query('delete from ai_requests where user_id=$1',[user]);
  });
  await t.test('legal access storage denies reading, forgery and public purge',async()=>{
   const id=randomUUID();
   await asRole('service_role','select record_application_access($1,$2)',[id,'2001:db8::1']);
   await asRole('service_role','select record_application_access($1,$2)',[id,'192.0.2.7']);
   assert.equal((await query('select host(ip) ip from application_access_logs where id=$1',[id]))[0].ip,'2001:db8::1');
   for(const role of ['anon','authenticated','service_role'])await assert.rejects(asRole(role,'select * from application_access_logs'));
   for(const role of ['anon','authenticated']){
    await assert.rejects(asRole(role,'select record_application_access($1,$2)',[randomUUID(),'192.0.2.8']));
    await assert.rejects(asRole(role,'select prune_application_access(false,1000)'));
   }
   await assert.rejects(asRole('service_role','select record_application_access($1,$2)',[randomUUID(),'192.0.2.0/24']));
  });
  await t.test('six calendar months, dry run, legal hold and bounded deletion',async()=>{
   const fixed=randomUUID();
   await query("insert into application_access_logs(id,ip,occurred_at,expires_at) values($1,'192.0.2.1','2024-08-31T12:00:00Z',now())",[fixed]);
   assert.equal(new Date((await query('select expires_at from application_access_logs where id=$1',[fixed]))[0].expires_at).toISOString(),'2025-02-28T12:00:00.000Z');
   const held=randomUUID();
   await query("insert into application_access_logs(id,ip,occurred_at,expires_at,hold_until,hold_reference) values($1,'192.0.2.2',now()-interval '1 year',now(),now()+interval '1 day',$2)",[held,randomUUID()]);
   assert.equal((await asRole('service_role','select prune_application_access() r'))[0].r.deleted,0);
   const report=(await asRole('service_role','select prune_application_access(false,1) r'))[0].r;
   assert.equal(report.deleted,1);assert.equal(report.batch_limit,1);
   assert.equal((await query('select count(*)::int n from application_access_logs where id=$1',[held]))[0].n,1);
   await assert.rejects(asRole('service_role','select prune_application_access(false,1001)'));
   assert.equal((await asRole('service_role','select prune_application_access(false,1000) r'))[0].r.deleted,0);
  });
  await t.test('restored expired access evidence is purged again without deleting current or held records',async()=>{
   const snapshotId=randomUUID();
   const restore=()=>query("insert into application_access_logs(id,ip,occurred_at,expires_at) values($1,'192.0.2.44',now()-interval '1 year',now())",[snapshotId]);
   await restore();await asRole('service_role','select prune_application_access(false,1000)');
   await restore(); // Old snapshot resurrects exactly the fictional expired record.
   assert.equal((await asRole('service_role','select prune_application_access(false,1000) r'))[0].r.deleted,1);
   assert.equal((await query('select count(*)::int n from application_access_logs'))[0].n,2);
  });
 }finally{await db.close();}
});
