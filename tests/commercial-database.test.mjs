import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('commercial migrations: deny client writes, budgets, idempotency and billing isolation',async t=>{
 const db=new PGlite(); const uid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
   create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`);
  const folder=new URL('../supabase/migrations/',import.meta.url);
  for(const name of (await readdir(folder)).filter(n=>n.endsWith('.sql')).sort())await db.exec(await readFile(new URL(name,folder),'utf8'));
  await db.query('insert into auth.users(id) values($1),($2)',[uid,other]);
  await db.query("insert into commercial_accounts(user_id,market_code) values($1,'BR'),($2,'BR') on conflict(user_id) do update set market_code='BR'",[uid,other]);
  const company=(await db.query('select company_id from company_members where user_id=$1',[uid])).rows[0].company_id;
  async function role(sql,args=[],as='authenticated',user=uid){await db.exec('begin');try{await db.exec('set local role '+as);await db.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);const result=await db.query(sql,args);await db.exec('commit');return result.rows;}catch(e){await db.exec('rollback');throw e;}}
  await t.test('ordinary account cannot promote itself or forge subscriptions/usage',async()=>{
   await assert.rejects(role("insert into admin_roles(user_id,role) values($1,'SUPER_ADMIN')",[uid]));
   await assert.rejects(role("update commercial_plans set company_limit=100"));
   assert.equal((await role('select * from commercial_accounts')).length,1);
   assert.equal((await role('select * from usage_logs')).length,0);
   await assert.rejects(role('select public.reserve_ai_request($1,$2,$3,0.1)',[uid,company,crypto.randomUUID()]));
  });
  await t.test('reserved and unknown costs consume budget; repeats cannot charge twice',async()=>{
   const id=crypto.randomUUID();const reserve='select public.reserve_ai_request($1,$2,$3,$4) as result';
   assert.equal((await role(reserve,[uid,company,id,.1],'service_role'))[0].result.allowed,true);
   await assert.rejects(role(reserve,[uid,company,id,.1],'service_role'));
   assert.equal((await role(reserve,[uid,company,crypto.randomUUID(),.1],'service_role'))[0].result.reason,'RATE_LIMIT');
   await role("select public.finish_ai_request($1,'UNKNOWN',null)",[id],'service_role');
   assert.equal((await role(reserve,[uid,company,crypto.randomUUID(),.16],'service_role'))[0].result.reason,'REQUEST_BUDGET');
   await assert.rejects(role(reserve,[other,company,crypto.randomUUID(),.01],'service_role'));
  });
  await t.test('checkout requires active billing; simultaneous repeats reuse attempt',async()=>{
   const price=(await db.query("select id from commercial_prices where market_code='BR'")).rows[0].id;
   await assert.rejects(role('select public.begin_checkout($1,$2,$3)',[uid,'BR',price],'service_role'));
   await db.exec("update commercial_markets set billing_enabled=true where code='BR'");
   const a=await role('select public.begin_checkout($1,$2,$3) as result',[uid,'BR',price],'service_role');
   const b=await role('select public.begin_checkout($1,$2,$3) as result',[uid,'BR',price],'service_role');assert.equal(a[0].result.id,b[0].result.id);
   await assert.rejects(role('select public.begin_checkout($1,$2,$3)',[uid,'PT',price],'service_role'));
  });
  await t.test('verified billing persistence is idempotent, ordered and preserves companies',async()=>{
   await db.exec("update commercial_prices set provider_price_id='price_fixture' where market_code='BR'");
   const price=(await db.query("select id from commercial_prices where market_code='BR'")).rows[0].id;
   const sub={user_id:uid,market_code:'BR',price_id:price,provider_price_id:'price_fixture',provider_customer_id:'cus_fixture',provider_subscription_id:'sub_fixture',status:'active',currency:'BRL',amount_minor:9999,current_period_start:'2026-09-01',current_period_end:'2099-01-01',cancel_at_period_end:false,canceled_at:null};
   const apply='select public.apply_billing_event($1,$2,$3,$4::jsonb)';
   await assert.rejects(role(apply,['evt_1','invoice.paid',100,JSON.stringify(sub)]));
   await role(apply,['evt_1','invoice.paid',100,JSON.stringify(sub)],'service_role');
   await role(apply,['evt_1','invoice.paid',100,JSON.stringify(sub)],'service_role');
   assert.equal((await db.query("select count(*)::int n from subscriptions")).rows[0].n,1);
   await role(apply,['evt_2','invoice.payment_failed',200,JSON.stringify({...sub,status:'past_due'})],'service_role');
   await role(apply,['evt_old','invoice.paid',50,JSON.stringify(sub)],'service_role');
   assert.equal((await db.query('select status from subscriptions')).rows[0].status,'past_due');
   assert.equal((await role('select * from subscriptions',[],'authenticated',other)).length,0);
   await role(apply,['evt_3','customer.subscription.deleted',300,JSON.stringify({...sub,status:'canceled',canceled_at:'2026-09-28'})],'service_role');
   assert.equal((await db.query('select count(*)::int n from companies where id=$1',[company])).rows[0].n,1);
   await assert.rejects(role(apply,['evt_attack','invoice.paid',400,JSON.stringify({...sub,user_id:other})],'service_role'));
  });
  await t.test('administrator configuration is audited and ordinary users cannot override',async()=>{
   await db.query("insert into admin_roles values($1,'SUPER_ADMIN',now())",[uid]);
   const rpc='select public.change_commercial_catalog($1,$2,$3::jsonb,$4)';
   const ai={model:'fixture-model',input_per_million:'2',cached_per_million:'0.5',output_per_million:'10',source:'FIXTURE: not real provider prices'};
   await assert.rejects(role(rpc,[other,'AI_PRICE_CHANGED',JSON.stringify(ai),'Test unauthorized'],'service_role'));
   await role(rpc,[uid,'AI_PRICE_CHANGED',JSON.stringify(ai),'Test first version'],'service_role');
   await role(rpc,[uid,'AI_PRICE_CHANGED',JSON.stringify({...ai,input_per_million:'3'}),'Test second version'],'service_role');
   const rows=(await db.query("select * from ai_model_pricing where model='fixture-model' and context_tier='standard'")).rows;assert.equal(rows.length,2);assert.equal(rows.filter(r=>r.effective_to===null).length,1);
   assert.equal((await db.query("select count(*)::int n from admin_audit_log where action='AI_PRICE_CHANGED'")).rows[0].n,2);
   const pt=(await db.query("select * from commercial_markets where code='PT'")).rows[0];
   await assert.rejects(role('select public.update_commercial_config($1,$2,$3,$4,$5::jsonb,$6)',[uid,'market','PT',pt.version,JSON.stringify({...pt,status:'ACTIVE'}),'Test launch blocked'],'service_role'));
  });
  await t.test('completed or explicitly expired checkout can be replaced without duplicating an open attempt',async()=>{
   const price=(await db.query("select id from commercial_prices where market_code='BR'")).rows[0].id;
   const first=(await role('select public.begin_checkout($1,$2,$3) as r',[uid,'BR',price],'service_role'))[0].r;
   await role('select public.update_checkout_attempt($1,$2,$3,true)',[uid,first.id,'cs_test_closedfixture'],'service_role');
   const second=(await role('select public.begin_checkout($1,$2,$3) as r',[uid,'BR',price],'service_role'))[0].r;
   assert.notEqual(second.id,first.id);
   assert.equal((await role('select public.begin_checkout($1,$2,$3) as r',[uid,'BR',price],'service_role'))[0].r.id,second.id);
   await assert.rejects(role('select public.update_checkout_attempt($1,$2,$3,true)',[other,second.id,'cs_test_attack'],'service_role'));
  });
  await t.test('unknown costs make totals unknown and reconciliation is audited and restricted',async()=>{
   const id=(await db.query("select id from ai_requests where status='UNKNOWN' limit 1")).rows[0].id;
   await db.query("insert into usage_logs(request_id,user_id,company_id,plan_code,market_code,feature,provider,model,cost_status,status) values($1,$2,$3,'FREE','BR','diagnosis','openai','fixture','UNKNOWN','error')",[id,uid,company]);
   const report=(await role('select public.commercial_overview($1) as r',[uid],'service_role'))[0].r;assert.equal(report.ai_cost_month_usd,null);
   await assert.rejects(role('select public.reconcile_ai_cost($1,$2,0.01,$3)',[other,id,'FIXTURE provider evidence'],'service_role'));
   await role('select public.reconcile_ai_cost($1,$2,0.01,$3)',[uid,id,'FIXTURE provider evidence'],'service_role');
   assert.equal(Number((await db.query('select accounted_usd from ai_requests where id=$1',[id])).rows[0].accounted_usd),.01);
   assert.equal((await db.query("select count(*)::int n from admin_audit_log where action='AI_COST_RECONCILED'")).rows[0].n,1);
  });
  for(const [market,currency] of [['PT','EUR'],['ES','EUR'],['US','USD']])await t.test('SIMULATION ONLY: '+market+' readiness, activation, FREE, PRO, pause and preservation',async()=>{
   await db.exec('begin');try{
    const categories=['configuration','localization','product','pricing','billing','legal_tax','privacy','ai_cost_protection','analytics','testing','emergency_controls'];
    const readiness=Object.fromEntries(categories.map(k=>[k,{pass:true,evidence:'SIMULATED fixture only; no legal or launch approval'}]));
    let marketRow=(await db.query('select * from commercial_markets where code=$1',[market])).rows[0];
    const update=async value=>{await db.query('select update_commercial_config($1,$2,$3,$4,$5::jsonb,$6)',[uid,'market',market,marketRow.version,JSON.stringify(value),'SIMULATION ONLY']);marketRow=(await db.query('select * from commercial_markets where code=$1',[market])).rows[0];};
    await update({...marketRow,status:'READY',readiness,signup_enabled:true,pro_enabled:true,billing_enabled:true});
    // Missing provider mapping prevents launch; savepoint keeps the simulation transaction usable.
    await db.exec('savepoint missing_billing');await assert.rejects(update({...marketRow,status:'ACTIVE'}));await db.exec('rollback to savepoint missing_billing');
    await db.query("update commercial_prices set provider_price_id=$1 where market_code=$2",['price_sim_'+market,market]);
    await db.exec("update commercial_settings set value='{\"enabled\":true}' where id in ('rollout','international_launch')");
    await update({...marketRow,status:'ACTIVE'});
    const user=crypto.randomUUID();await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2::jsonb)',[user,JSON.stringify({commercial_country:market})]);
    const co=(await db.query('select company_id from company_members where user_id=$1',[user])).rows[0].company_id;
    const request=crypto.randomUUID();assert.equal((await db.query('select reserve_ai_request($1,$2,$3,.001) r',[user,co,request])).rows[0].r.allowed,true);
    await db.query("select finish_ai_request($1,'COMPLETED',.0005)",[request]);
    await db.query('update commercial_accounts set activated_at=now() where user_id=$1',[user]);
    const price=(await db.query('select id from commercial_prices where market_code=$1',[market])).rows[0].id;
    await db.query('select begin_checkout($1,$2,$3)',[user,market,price]);
    const sub={user_id:user,market_code:market,price_id:price,provider_price_id:'price_sim_'+market,provider_customer_id:'cus_sim_'+market,provider_subscription_id:'sub_sim_'+market,status:'active',currency,amount_minor:1999,current_period_start:'2026-09-01',current_period_end:'2099-01-01',cancel_at_period_end:false,canceled_at:null};
    await db.query('select apply_billing_event($1,$2,500,$3::jsonb)',['evt_sim_'+market,'invoice.paid',JSON.stringify(sub)]);
    assert.equal((await db.query('select commercial_user_plan($1) p',[user])).rows[0].p,'PRO');
    await update({...marketRow,status:'PAUSED',disable_new_signups:true,disable_new_subscriptions:true});
    assert.equal((await db.query('select count(*)::int n from companies where id=$1',[co])).rows[0].n,1);
    assert.equal((await db.query("select status from commercial_markets where code='BR'")).rows[0].status,'ACTIVE');
    assert.ok((await db.query("select count(*)::int n from admin_audit_log where action='MARKET_ACTIVE' and market_code=$1",[market])).rows[0].n>0);
   }finally{await db.exec('rollback');}
  });
  await t.test('rollout enforces existing company limit without deleting previous data',async()=>{
   await db.exec("update commercial_settings set value='{"+'"enabled":true,"environment":"test"'+"}' where id='rollout'");
   await assert.rejects(role("select create_company('Another company')"));
   assert.equal((await role('select * from companies')).length,1);
   await assert.rejects(db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2::jsonb)',[crypto.randomUUID(),JSON.stringify({commercial_country:'PT'})]));
   const br=crypto.randomUUID();await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2::jsonb)',[br,JSON.stringify({commercial_country:'BR'})]);
   assert.equal((await db.query('select market_code from commercial_accounts where user_id=$1',[br])).rows[0].market_code,'BR');
  });
 }finally{await db.close();}
});
