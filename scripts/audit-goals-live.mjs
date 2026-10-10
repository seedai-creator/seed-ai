// Phase 10 audit. Never prints environment values or business message bodies.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createClient} from '@supabase/supabase-js';
process.loadEnvFile('.env.local');
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});
const user='faaac0ad-bc77-4388-a3c7-9b13f1430eea';
const ok=r=>{if(r.error)throw Error(r.error.code||'AUDIT_DATABASE_FAILED');return r.data;};
const report={at:new Date().toISOString(),checks:[]};
const fixtures=ok(await db.from('companies').select('id').eq('name','TESTE FICTÍCIO — Goals & Metrics Fase10'));
assert.ok(fixtures.length>0);
if(process.argv.includes('--verify-integrity')){
 const company='6696392e-3cb2-43c3-acfc-c464ea19599a';assert.ok(fixtures.some(c=>c.id===company));
 const existing=ok(await db.from('goals').select('spec').eq('company_id',company).eq('status','ACTIVE').limit(1).single());
 const spec={...existing.spec,title:'Teste fictício de integridade '+crypto.randomUUID().slice(0,8),primary:false,parent_id:null,plan_id:null};
 const goal=ok(await db.rpc('save_goal',{p_user:user,p_company:company,p_id:null,p_version:0,p_spec:spec,p_status:'DRAFT',p_reason:'Verificação fictícia de compatibilidade',p_source:null,p_key:crypto.randomUUID(),p_timezone:'America/Sao_Paulo',p_locale:'pt-BR'}));
 try{
  const before=ok(await db.from('business_memories').select('observed_at,version').eq('company_id',company).eq('id',goal).single());
  ok(await db.from('business_memories').update({value:'Meta fictícia corrigida na memória',version:before.version+1,observed_at:new Date(Date.now()+1000).toISOString()}).eq('company_id',company).eq('id',goal));
  const changed=ok(await db.from('goals').select('version,status,spec').eq('company_id',company).eq('id',goal).single());
  assert.equal(changed.version,2);assert.equal(changed.status,'DRAFT');assert.equal(changed.spec.title,'Meta fictícia corrigida na memória');report.checks.push('remote_memory_correction_trigger');
 }finally{
  const memory=ok(await db.from('business_memories').select('version').eq('company_id',company).eq('id',goal).single());
  ok(await db.from('business_memories').update({deleted:true,version:memory.version+1}).eq('company_id',company).eq('id',goal));
 }
 const cancelled=ok(await db.from('goals').select('status').eq('company_id',company).eq('id',goal).single());assert.equal(cancelled.status,'CANCELLED');report.checks.push('remote_memory_removal_trigger');
}
const costs=ok(await db.from('ai_requests').select('accounted_usd,reserved_usd,status').in('company_id',fixtures.map(c=>c.id)).limit(1001));assert.ok(costs.length<=1000);
report.costUsd=costs.reduce((n,c)=>n+Number(c.accounted_usd??c.reserved_usd),0);report.unknownRequests=costs.filter(c=>c.status==='UNKNOWN').length;
assert.ok(report.costUsd<2);report.checks.push('additional_cost_below_2_usd');
const overrides=ok(await db.from('commercial_overrides').select('revoked_at,expires_at').eq('user_id',user).like('reason','Fase10:%'));
report.activeTemporaryOverrides=overrides.filter(o=>!o.revoked_at&&Date.parse(o.expires_at)>Date.now()).length;assert.equal(report.activeTemporaryOverrides,0);report.checks.push('temporary_pro_restored');
const jobs=ok(await db.from('journal_jobs').select('status,error_code').in('company_id',fixtures.map(c=>c.id)).eq('kind','EXTRACTION'));
report.jobs=Object.fromEntries([...new Set(jobs.map(j=>j.status))].map(status=>[status,jobs.filter(j=>j.status===status).length]));
if(existsSync('.next/static')){
 const files=[];const walk=path=>{for(const e of readdirSync(path,{withFileTypes:true})){const p=join(path,e.name);if(e.isDirectory())walk(p);else files.push(p);}};walk('.next/static');
 const secrets=['OPENAI_API_KEY','SUPABASE_SECRET_KEY','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','CRON_SECRET'].map(k=>process.env[k]).filter(v=>v&&v.length>10);
 for(const f of files){const s=readFileSync(f,'utf8');assert.ok(!secrets.some(v=>s.includes(v)),'Server secret detected in client output');}
 report.clientAssetsChecked=files.length;report.checks.push('client_bundles_no_server_secrets');
}
writeFileSync('.test-build/phase-10-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
