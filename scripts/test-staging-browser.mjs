// Separate, disposable browser and fictional staging accounts. Never uses the
// user's browser profile, sends emails, calls paid providers or touches production.
import {createClient} from '@supabase/supabase-js';
import {randomUUID,randomBytes,createHmac} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {loadStagingEnvironment,stagingDatabaseConfig} from './staging-config.mjs';

process.env.PLAYWRIGHT_BROWSERS_PATH=fileURLToPath(new URL('../.test-build/playwright-browsers',import.meta.url));
const {chromium,expect:baseExpect}=await import('@playwright/test');
// Local development compiles routes on first use. This timeout is not an SLA.
const expect=baseExpect.configure({timeout:60000});
const base='http://127.0.0.1:3002';
const uploadsOnly=process.argv.includes('--uploads-only');
const reportFile=uploadsOnly?'staging-uploads-report.json':'staging-browser-report.json';
const manifest=new URL('../.test-build/staging-browser-state.json',import.meta.url);
const report={startedAt:new Date().toISOString(),checks:[],passed:false,cleanup:false};
let admin,browser,state,activePage,phase='configuration';
const requireTrue=(v,label)=>{if(!v)throw Error(label);};
const data=(r,label)=>{requireTrue(!r.error,label);return r.data;};
const passed=label=>{report.checks.push(label);console.log(JSON.stringify({passed:label}));};
const client=(url,key)=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,redirect:'error',signal:AbortSignal.timeout(20000)})}});
const save=()=>writeFile(manifest,JSON.stringify(state,null,2));
function totp(secret){
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';
 for(const c of secret.toUpperCase().replace(/=+$/,'')){requireTrue(alphabet.includes(c),'totp_encoding');bits+=alphabet.indexOf(c).toString(2).padStart(5,'0');}
 const key=Buffer.from(bits.match(/.{8}/g).map(b=>parseInt(b,2))),counter=Buffer.alloc(8);
 counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
 const mac=createHmac('sha1',key).update(counter).digest(),offset=mac.at(-1)&15;
 return String((mac.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
}
async function login(page,user){
 await page.goto(base+'/login',{waitUntil:'domcontentloaded'});
 await page.locator('input[name=email]').fill(user.email);
 await page.locator('input[name=password]').fill(user.password);
 await page.locator('form button[type=submit], form button.send-button').click();
 await page.waitForURL(url=>['/access','/companies'].includes(url.pathname));
}
async function clean(){
 if(browser)await browser.close();
 if(!state)return;
 const found=data(await admin.auth.admin.listUsers({perPage:1000}),'cleanup_lookup').users.filter(u=>state.emails.includes(u.email));
 const ids=found.map(u=>u.id);
 if(ids.length){
  const memberships=data(await admin.from('company_members').select('company_id').in('user_id',ids),'cleanup_memberships');
  const companies=[...new Set(memberships.map(r=>r.company_id))];
  if(companies.length){
   const all=data(await admin.from('company_members').select('user_id').in('company_id',companies),'cleanup_shared_check');
   requireTrue(all.every(r=>ids.includes(r.user_id)),'cleanup_shared_company_refused');
   data(await admin.from('companies').delete().in('id',companies),'cleanup_companies');
  }
  data(await admin.from('legal_acceptances').delete().in('user_id',ids),'cleanup_acceptances');
  data(await admin.from('legal_documents').delete().eq('version','FIXTURE-'+state.run),'cleanup_documents');
  data(await admin.from('admin_audit_log').delete().in('actor',ids),'cleanup_audit');
  data(await admin.from('commercial_events').delete().in('user_id',ids),'cleanup_events');
  data(await admin.from('operational_events').delete().in('user_id',ids),'cleanup_operations');
  for(const user of found)data(await admin.auth.admin.deleteUser(user.id),'cleanup_users');
 }
 data(await admin.from('beta_invitations').delete().in('email',state.emails),'cleanup_invitations');
 requireTrue(data(await admin.auth.admin.listUsers({perPage:1000}),'cleanup_verify').users.every(u=>!state.emails.includes(u.email)),'cleanup_remaining_user');
 const controls=data(await admin.from('operations_controls').select('*').eq('id',true).single(),'cleanup_controls');
 requireTrue(JSON.stringify(controls)===JSON.stringify(state.controls),'controls_changed');
 state.status='cleaned';await save();report.cleanup=true;
}
try{
 requireTrue(process.argv.includes('--run'),'explicit_run_required');
 const config=stagingDatabaseConfig(await loadStagingEnvironment());
 await mkdir(new URL('../.test-build/',import.meta.url),{recursive:true});
 try{requireTrue(JSON.parse(await readFile(manifest,'utf8')).status==='cleaned','previous_cleanup_required');}catch(e){if(e.code!=='ENOENT')throw e;}
 admin=client(config.url,config.serverKey);
 const controls=data(await admin.from('operations_controls').select('*').eq('id',true).single(),'controls');
 requireTrue(controls.closed_beta&&controls.disable_ai&&controls.disable_uploads,'staging_not_paused');
 // Only an empty staging database or the exact, verified restore-drill
 // identities may coexist with temporary legal fixtures. Never admit arbitrary
 // accounts merely because their address looks fictional.
 const existingUsers=data(await admin.auth.admin.listUsers({perPage:1000}),'staging_identities').users;
 if(existingUsers.length){
  const retained=JSON.parse(await readFile(new URL('../.test-build/backup-drill/manifest.json',import.meta.url),'utf8'));
  requireTrue(retained.project===config.project&&retained.restoreVerified===true&&existingUsers.length<1000,'unknown_retained_accounts');
  requireTrue(existingUsers.every(user=>retained.users.some(expected=>expected.id===user.id&&expected.email===user.email)),'staging_has_existing_users');
  requireTrue(retained.users.every(user=>user.email===`seed-restore-${retained.run}-${user.email.endsWith('-a@example.invalid')?'a':'b'}@example.invalid`),'retained_fixture_identity_invalid');
 }
 const run=randomUUID();state={run,status:'running',project:config.project,controls,emails:['a','b','admin'].map(s=>`seed-browser-${run}-${s}@example.invalid`)};await save();
 data(await admin.from('beta_invitations').insert(state.emails.map(email=>({email,cohort:'FIXTURE-'+run,expires_at:new Date(Date.now()+3600000).toISOString()}))),'invitations');
 const users=[];
 for(const email of state.emails){
  const password=randomBytes(32).toString('base64url');
  const user=data(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:'FIXTURE QA',commercial_country:'BR'}}),'signup').user;
  const company=data(await admin.from('company_members').select('company_id').eq('user_id',user.id).single(),'company').company_id;
  data(await admin.from('companies').update({name:'FIXTURE '+users.length}).eq('id',company),'fixture_name');
  users.push({id:user.id,email,password,company});
 }
 const [a,b,operator]=users;
 if(!uploadsOnly)data(await admin.from('admin_roles').insert({user_id:operator.id,role:'SUPER_ADMIN'}),'fixture_admin');
 const legal=[];
 for(const locale of ['pt-BR','pt-PT','en-US','es-ES'])for(const kind of ['TERMS','PRIVACY'])legal.push({kind,locale,version:'FIXTURE-'+run,content:'FICTITIOUS TEST DOCUMENT. NOT VALID FOR REAL USERS. DOCUMENTO FICTICIO, SEM VALIDADE PARA USO REAL. '.repeat(3),approved:true,approved_by:operator.id});
 data(await admin.from('legal_documents').insert(legal),'fixture_legal');
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 const page=await context.newPage();activePage=page;page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(90000);
 phase='login_consent';await login(page,a);
 await expect(page).toHaveURL(/\/access$/);await page.locator('input[name=accepted]').check();
 await page.locator('form button.send-button').click();await page.waitForURL('**/companies');
 await page.locator('.company-card form button.send-button').first().click();await page.waitForURL(base+'/');
 await expect(page.locator('#challenge')).toBeVisible();
 passed('browser_login_consent_and_company_selection');
 if(uploadsOnly){
  phase='attachment_ui';
  const input=page.locator('input[type=file]');
  for(const name of ['fixture.txt','fixture.csv','fixture.md']){
   await input.setInputFiles({name,mimeType:'text/plain',buffer:Buffer.from('FICTITIOUS DATA: 18 leads')});
   await expect(page.locator('.core-file')).toContainText(name);
   await page.locator('.core-file button').click();await expect(page.locator('.core-file')).toHaveCount(0);
  }
  for(const [name,content] of [['fixture.pdf','%PDF-1.4'],['fixture.exe','MZ'],['oversize.txt','x'.repeat(20481)],['long.txt','x'.repeat(2001)],['binary.txt','a\0b']]){
   await input.setInputFiles({name,mimeType:'application/octet-stream',buffer:Buffer.from(content)});
   await expect(page.locator('.core-error')).toBeVisible();await expect(page.locator('.core-file')).toHaveCount(0);
  }
  passed('browser_accepts_bounded_text_rejects_binary_unsupported_and_oversized_files');
  phase='attachment_server';
  const body={companyId:a.company,conversationId:randomUUID(),requestId:randomUUID(),version:0,hasAttachment:true,messages:[{role:'user',content:'FICTITIOUS FILE QA'}]};
  const post=value=>context.request.post(base+'/api/chat',{data:value,headers:{origin:base,'content-type':'application/json'},timeout:60000});
  const paused=await post(body);
  requireTrue(paused.status()===503&&(await paused.json()).code==='UPLOADS_PAUSED','upload_pause_not_enforced');
  const cross=await post({...body,companyId:b.company});requireTrue(cross.status()===403,'upload_tenant_mismatch');
  const invalid=await post({...body,messages:[{role:'user',content:'x'.repeat(4001)}]});requireTrue(invalid.status()===400,'message_limit_ignored');
  const binary=await context.request.post(base+'/api/chat',{data:Buffer.from([0xff]),headers:{origin:base,'content-type':'application/json'}});requireTrue(binary.status()===400,'invalid_utf8_accepted');
  const multipart=await context.request.post(base+'/api/chat',{data:'FICTITIOUS',headers:{origin:base,'content-type':'multipart/form-data'}});requireTrue(multipart.status()===415,'binary_transport_accepted');
  const samples=[];
  for(let round=0;round<4;round++)await Promise.all(Array.from({length:4},async()=>{
   const started=performance.now();const response=await context.request.post(base+'/api/chat',{data:'x'.repeat(160001),headers:{origin:base,'content-type':'application/json'},timeout:30000});
   requireTrue(response.status()===413,'oversized_http_body_accepted');samples.push(Math.round(performance.now()-started));await response.dispose();
  }));
  requireTrue(data(await admin.from('conversations').select('id').eq('user_id',a.id),'attachment_no_conversation').length===0,'rejected_upload_persisted');
  requireTrue(data(await admin.from('usage_logs').select('id').eq('user_id',a.id),'attachment_no_usage').length===0,'rejected_upload_charged');
  report.uploads={requests:16,concurrency:4,samples,paidCalls:0,limits:{httpBytes:160000,fileBytes:20480,fileCharacters:2000,messageCharacters:4000},limitations:['Limited local HTTP rejection test, not a production capacity or SLA estimate.','Text-only attachments; PDF, Office, images, audio and antivirus scanning are unsupported.','Uploads stay paused in staging; no document was sent to AI.']};
  passed('server_pause_tenant_encoding_transport_and_bounded_body_load_no_cost_or_persistence');
 }else{
 phase='core_views';
 for(const view of ['company','memory','diagnosis','plan','settings']){
  await page.goto(base+'/?view='+view,{waitUntil:'domcontentloaded'});
  // This heading appears only after the authenticated workspace data loads.
  await expect(page.locator('.core-panel h1')).toBeVisible();
  await expect(page.locator('.core-error')).toHaveCount(0);
  requireTrue(!(await page.locator('body').innerText()).includes('Application error'),'page_error');
 }
 await page.screenshot({path:fileURLToPath(new URL('../.test-build/staging-settings.png',import.meta.url)),fullPage:true,caret:'initial'});
 passed('company_memory_diagnosis_plan_settings_pages');
 phase='support_page';await page.goto(base+'/support');
 await page.locator('select[name=category]').selectOption('PRIVACY');
 await page.locator('textarea[name=description]').fill('FICTITIOUS BROWSER PRIVACY REQUEST');
 const supportForm=page.locator('form').filter({has:page.locator('select[name=category]')});
 phase='support_submit';await supportForm.locator('button.send-button').click();
 // Scope to the form: Next's development overlay also exposes an alert region.
 await expect(supportForm.getByRole('status')).toBeVisible();
 phase='export_form';
 await page.locator('select[name=company]').selectOption(a.company);
 await page.locator('input[name=password]').fill(a.password);
 phase='export_download';const download=page.waitForEvent('download');await page.locator('form[action="/api/privacy/export"] button').click();
 const file=await download,stream=await file.createReadStream();let exported='';for await(const chunk of stream)exported+=chunk.toString();
 const payload=JSON.parse(exported);requireTrue(payload.account.id===a.id&&payload.business_data.company.id===a.company,'export_wrong_owner');
 requireTrue(!exported.includes(b.email)&&!exported.includes(config.serverKey),'export_private_leak');
 passed('support_and_authenticated_private_download');
 phase='cross_tenant_export';
 const cross=await context.request.post(base+'/api/privacy/export',{form:{company:b.company,password:a.password},headers:{origin:base}});
 requireTrue(cross.status()===403,'cross_tenant_export');
 passed('browser_cross_tenant_export_denied');
 if(process.argv.includes('--load-smoke')){
  phase='bounded_authenticated_load';const latencies=[],started=performance.now();
  // At most twelve read-only requests, three concurrent, to this local server.
  // No AI, uploads, payments or writes; this is not a production capacity test.
  for(let round=0;round<4;round++)await Promise.all(Array.from({length:3},async()=>{
   const before=performance.now();const response=await context.request.get(base+'/?view=settings',{timeout:60000});
   requireTrue(response.status()===200,'load_read_failed');await response.dispose();latencies.push(Math.round(performance.now()-before));
  }));
  latencies.sort((a,b)=>a-b);
  report.loadSmoke={requests:12,concurrency:3,elapsedMs:Math.round(performance.now()-started),p50Ms:latencies[5],p95Ms:latencies[11],maxMs:latencies[11],paidCalls:0,scope:'Local compiled app, one fictional staging account. No capacity/SLA claim.'};
  passed('bounded_authenticated_read_load');
 }
 phase='admin_second_factor';
 const auth=client(config.url,config.publicKey);data(await auth.auth.signInWithPassword({email:operator.email,password:operator.password}),'admin_login');
 const factor=data(await auth.auth.mfa.enroll({factorType:'totp',issuer:'SEED QA',friendlyName:'FICTITIOUS QA'}),'mfa_enroll');
 data(await auth.auth.mfa.challengeAndVerify({factorId:factor.id,code:totp(factor.totp.secret)}),'mfa_enrollment_verify');
 const adminContext=await browser.newContext(),adminPage=await adminContext.newPage();adminPage.setDefaultTimeout(60000);adminPage.setDefaultNavigationTimeout(90000);
 await login(adminPage,operator);await adminPage.goto(base+'/admin');await expect(adminPage).toHaveURL(/\/admin\/security$/);
 // TOTP verification cannot reuse the enrollment code in the same 30s window.
 await new Promise(resolve=>setTimeout(resolve,31000-Date.now()%30000));
 await adminPage.locator('input[name=code]').fill(totp(factor.totp.secret));
 await adminPage.locator('form button').click();await adminPage.waitForURL('**/admin');
 await expect(adminPage.getByRole('heading',{name:'Operação da SEED',exact:true})).toBeVisible();
 await adminPage.goto(base+'/admin/operations');await expect(adminPage.getByRole('heading',{name:'Operação do beta',exact:true})).toBeVisible();
 passed('admin_password_only_blocked_and_real_totp_accepted');
 phase='locales';
 for(const locale of ['pt-BR','pt-PT','en-US','es-ES']){
  const isolated=await browser.newContext();await isolated.addCookies([{name:'seed-locale',value:locale,url:base}]);const p=await isolated.newPage();
  await p.goto(base+'/login');await expect(p.locator('html')).toHaveAttribute('lang',locale);await expect(p.locator('input[name=email]')).toBeVisible();await isolated.close();
 }
 passed('four_locales_login');
 phase='revocation';data(await admin.from('beta_access').update({disabled:true}).eq('user_id',a.id),'revoke_fixture');
 await page.goto(base+'/');await expect(page).toHaveURL(/\/access$/);await page.goto(base+'/support');await expect(page.locator('textarea[name=description]')).toBeVisible();
 passed('revocation_blocks_workspace_keeps_privacy_support');
 }
 report.passed=true;
}catch(error){
 report.failedPhase=phase;report.failureKind=error?.name==='TimeoutError'?'TIMEOUT':'ASSERTION_OR_PROVIDER';process.exitCode=1;
 if(phase==='support_submit'&&activePage){
  // This page contains only fictional fixtures; password has not been filled.
  report.supportUi={statusCount:await activePage.getByRole('status').count(),alertCount:await activePage.getByRole('alert').count()};
  await activePage.screenshot({path:fileURLToPath(new URL('../.test-build/staging-support-failure.png',import.meta.url)),fullPage:true});
 }
 console.error(JSON.stringify({failedPhase:phase,failureKind:report.failureKind,supportUi:report.supportUi,note:'Raw browser/provider errors omitted to protect session data.'}));
}
finally{
 try{await clean();}catch{report.cleanup=false;report.passed=false;process.exitCode=1;if(state){state.status='cleanup_required';await save();}console.error('Fixture cleanup needs review.');}
 report.finishedAt=new Date().toISOString();await mkdir(new URL('../.test-build/',import.meta.url),{recursive:true});await writeFile(new URL('../.test-build/'+reportFile,import.meta.url),JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,cleanup:report.cleanup,report:'.test-build/'+reportFile}));
}
