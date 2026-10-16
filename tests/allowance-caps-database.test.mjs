import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {proposedProPolicy} from '../.test-build/src/lib/commercial/pro-proposal.js';

test('candidate allowances: real SQL enforces shared 4/8/16 budgets without activating any remote plan',async t=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
   create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`);
  const folder=new URL('../supabase/migrations/',import.meta.url);
  for(const n of (await readdir(folder)).filter(n=>n.endsWith('.sql')).sort())await db.exec(await readFile(new URL(n,folder),'utf8'));
  const uid=crypto.randomUUID(),other=crypto.randomUUID();
  await db.query('insert into auth.users(id) values($1),($2)',[uid,other]);
  const company=(await db.query('select company_id from company_members where user_id=$1',[uid])).rows[0].company_id;
  await db.query("insert into commercial_accounts(user_id,market_code) values($1,'BR') on conflict(user_id) do update set market_code='BR'",[uid]);
  await db.query("insert into subscriptions(user_id,plan_code,market_code,provider,status,currency,amount_minor,current_period_start,current_period_end) values($1,'PRO','BR','stripe','active','BRL',9999,now()-interval '20 days',now()+interval '10 days')",[uid]);
  await db.exec("update commercial_markets set status='ACTIVE',disable_ai_requests=false where code='BR';update commercial_settings set value=jsonb_set(value,'{enabled}','true') where id='rollout'");
  await t.test('price edits preserve long-context rates; tool-limit drift queues an operational alert',async()=>{
   await db.exec('begin');try{
    await db.query("insert into admin_roles(user_id,role) values($1,'SUPER_ADMIN')",[uid]);
    await db.query("select change_commercial_catalog($1,'AI_PRICE_CHANGED',$2::jsonb,'Fixture pricing revision')",[uid,JSON.stringify({model:'gpt-6-sol',input_per_million:'2',cached_per_million:'0.2',output_per_million:'10',cache_write_per_million:'2.5',source:'Fixture revision'})]);
    const rates=(await db.query("select context_tier,cache_write_per_million from ai_model_pricing where model='gpt-6-sol' and effective_to is null order by context_tier")).rows;
    assert.deepEqual(rates.map(r=>[r.context_tier,Number(r.cache_write_per_million)]),[['long',5],['standard',2.5]]);
    await db.query("insert into operational_events(request_id,feature,code,level) values($1,'WEB_SEARCH_STANDARD','AI_TOOL_LIMIT_EXCEEDED','WARN')",[crypto.randomUUID()]);
    assert.equal((await db.query('select queue_operational_alerts() n')).rows[0].n,1);
    const alert=(await db.query('select metrics from operational_alerts')).rows[0];assert.equal(alert.metrics.tool_limit_exceeded_15m,1);
   }finally{await db.exec('rollback');}
  });
  const reserve=async(co,cost,feature='diagnosis',id=crypto.randomUUID())=>(await db.query('select reserve_ai_request($1,$2,$3,$4,$5,$6) r',[uid,co,id,cost,feature,id])).rows[0].r;
  for(const [cap,limit] of [[4,1],[8,3],[16,5]])await t.test(`US$${cap} across ${limit} companies`,async()=>{
   await db.exec('begin');
   try{
    await db.query("update commercial_plans set company_limit=$1,policy=$2::jsonb where code='PRO'",[limit,JSON.stringify(proposedProPolicy(cap))]);
    const companies=[company];
    assert.equal(Number((await db.query('select commercial_global_day_budget() n')).rows[0].n),10+cap);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
    for(let i=1;i<limit;i++){
     await db.exec('set role authenticated');
     const row=(await db.query("select create_company($1) co",['Fictional allowance company '+i])).rows[0];
     await db.exec('reset role');companies.push(row.co);
    }
    await db.exec('savepoint extra_company;set role authenticated');
    await assert.rejects(db.query("select create_company('Over allowance')"));
    await db.exec('rollback to extra_company;reset role');
    // More than 200 cheap analyses and old-cycle spend must not consume a new cycle.
    await db.query("update subscriptions set current_period_start=now()-interval '2 days' where user_id=$1",[uid]);
    await db.query("insert into ai_requests(id,user_id,company_id,plan_code,market_code,status,reserved_usd,accounted_usd,feature,created_at) values(gen_random_uuid(),$1,$2,'PRO','BR','COMPLETED',$3,$3,'diagnosis',now()-interval '3 days')",[uid,company,cap]);
    await db.query("insert into ai_requests(id,user_id,company_id,plan_code,market_code,status,reserved_usd,accounted_usd,feature,created_at) select gen_random_uuid(),$1,$2,'PRO','BR','COMPLETED',.000001,.000001,'diagnosis',now()-interval '1 day' from generate_series(1,201)",[uid,company]);
    const cheap=crypto.randomUUID();assert.equal((await reserve(company,.001,'diagnosis',cheap)).allowed,true);
    await db.query("select finish_ai_request($1,'COMPLETED',.001)",[cheap]);
    assert.equal((await reserve(company,cap)).reason,'REQUEST_BUDGET');
    assert.equal((await db.query("select count(*)::int n from commercial_events where user_id=$1 and event='pro_protection_reached'",[uid])).rows[0].n,0);
    await db.query('delete from ai_requests where user_id=$1',[uid]);
    // A different account has an independent allowance but contributes once to
    // the global operational envelope, including when it owns multiple companies.
    await db.query("insert into commercial_accounts(user_id,market_code) values($1,'BR') on conflict(user_id) do update set market_code='BR'",[other]);
    await db.query("insert into subscriptions(user_id,plan_code,market_code,provider,status,currency,amount_minor,current_period_start,current_period_end) values($1,'PRO','BR','stripe','active','BRL',9999,now()-interval '1 day',now()+interval '29 days')",[other]);
    assert.equal(Number((await db.query('select commercial_global_day_budget() n')).rows[0].n),10+cap*2);
    const otherCo=(await db.query('select company_id from company_members where user_id=$1',[other])).rows[0].company_id;
    const independent=(await db.query('select reserve_ai_request($1,$2,$3,.01) r',[other,otherCo,crypto.randomUUID()])).rows[0].r;
    assert.equal(independent.allowed,true);
    assert.equal((await db.query("select commercial_usage($1,'month') r",[uid])).rows[0].r.cost,0);
    // Full allowance in one day, including search, uses only the shared cycle cap.
    const ext=crypto.randomUUID();
    const allowed=(await db.query("select reserve_external_ai($1,$2,$3,$4,'WEB_SEARCH_STANDARD',$5) r",[uid,company,ext,cap-.05,ext])).rows[0].r;
    assert.equal(allowed.allowed,true);await db.query("select finish_ai_request($1,'COMPLETED',$2)",[ext,cap-.05]);
    await db.query('delete from ai_requests where user_id=$1',[uid]);
    // A controlled historical balance tests the boundary, not worker throughput.
    await db.query("insert into ai_requests(id,user_id,company_id,plan_code,market_code,status,reserved_usd,accounted_usd,feature,created_at) values($1,$2,$3,'PRO','BR','COMPLETED',$4,$4,'diagnosis',now()-interval '1 day')",[crypto.randomUUID(),uid,company,cap-.05]);
    const id=crypto.randomUUID();
    assert.equal((await reserve(companies.at(-1),.05,'WEEKLY_INTELLIGENCE_GENERATION',id)).allowed,true);
    await db.query("select finish_ai_request($1,'UNKNOWN',null)",[id]);
    assert.equal((await reserve(company,.000001)).reason,'HARD_LIMIT');
    const snap=(await db.query("select commercial_usage($1,'month') r",[uid])).rows[0].r;
    assert.equal(snap.cost,cap);assert.equal(snap.diagnoses,1);assert.equal(snap.automatic_reports,1);
    await db.exec('savepoint cross_tenant');
    await assert.rejects(db.query('select reserve_ai_request($1,$2,$3,.01)',[other,company,crypto.randomUUID()]));
    await db.exec('rollback to cross_tenant');
    await db.exec('savepoint unauthorized_budget;set role authenticated');
    await assert.rejects(db.query('select commercial_global_day_budget()'));
    await db.exec('rollback to unauthorized_budget;reset role');
    // Calendar turn alone must not renew an active provider subscription cycle.
    assert.equal(snap.window,'subscription');
    await db.query("update subscriptions set current_period_start=now()+interval '1 millisecond',current_period_end=now()+interval '30 days' where user_id=$1",[uid]);
    await db.exec('savepoint invalid_cycle');await assert.rejects(db.query("select commercial_usage($1,'month')",[uid]));await db.exec('rollback to invalid_cycle');
   }finally{await db.exec('rollback');}
  });
 }finally{await db.close();}
});
