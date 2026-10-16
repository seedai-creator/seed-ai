// Component integration in an isolated local browser. Actions and provider
// responses are explicit fixtures; SQL persistence and real AI run separately.
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {usefulDiagnosis} from '../.test-build/tests/free-experience-fixtures.js';
const require=createRequire(import.meta.url),root=fileURLToPath(new URL('../',import.meta.url));
const folder=path.join(root,'.test-build/free-browser');await mkdir(folder,{recursive:true});
process.env.PLAYWRIGHT_BROWSERS_PATH=path.join(root,'.test-build/playwright-browsers');
const {chromium,expect}=await import('@playwright/test');
const diagnosis=usefulDiagnosis();
await writeFile(path.join(folder,'loader.cjs'),`const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=function(source){return ts.transpileModule(source,{fileName:this.resourcePath,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;};`);
await writeFile(path.join(folder,'mocks.tsx'),`
import React from 'react';
export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}
export async function workspaceData(){const f=window.fixture;return {conversations:f.conversations,memories:[],freeExperience:f.free,usageAvailable:window.fixture.usageAvailable!==false};}
export async function readConversation(){return {messages:window.fixture.messages,version:window.fixture.version};}
export async function editMemory(){} export async function logout(){} export async function homeEvent(){}
export function Brand(){return <span>SeedAI</span>} export function LanguageSwitcher(){return null}
export const Cockpit=()=>null,GrowthMapPanel=()=>null,GoalPanel=()=>null,ExternalResearchPanel=()=>null,ExternalPreference=()=>null,RadarInsight=()=>null,RadarPreference=()=>null,BusinessModelPanel=()=>null,SimulationPanel=()=>null,ExecutionPanel=()=>null,JournalHistory=()=>null,WeeklyInsight=()=>null;
`);
await writeFile(path.join(folder,'entry.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {SeedWorkspace} from ${JSON.stringify(path.join(root,'src/components/seed-workspace'))};
import {I18nProvider} from ${JSON.stringify(path.join(root,'src/lib/i18n/provider'))};
const mode=new URLSearchParams(location.search).get('mode')||'useful';
const saved=localStorage.getItem('free-fixture-'+mode);
window.fixture=saved?JSON.parse(saved):{free:mode==='paid'?null:{used:mode==='quota'?3:0,limit:3,remaining:mode==='quota'?0:3,limited:mode==='quota'},messages:[],conversations:[],version:0,usageAvailable:mode!=='usageUnavailable'};window.requests=[];
window.fetch=async(url,options)=>{
 if(url!='/api/chat')throw Error('Non-fixture request refused');
 const input=JSON.parse(options.body);window.requests.push(input);
 if(mode==='saveFailure')return Response.json({error:'Não foi possível salvar a conversa. Reabra a conversa antes de tentar novamente.',code:'CONVERSATION_SAVE_FAILED'},{status:503});
 if(mode==='failure')return Response.json({error:'Não foi possível concluir a análise agora. Tente novamente.',code:'PROVIDER_UNAVAILABLE'},{status:502});
 const d=mode==='withheld'?null:${JSON.stringify(diagnosis)};
 const answer=d?'Revise os orçamentos pendentes e registre os motivos de desistência.':'Ainda preciso conhecer seu problema empresarial.';
 const f=window.fixture;f.version=input.version+1;f.messages=[...input.messages,{role:'assistant',content:answer,diagnosis:d}];f.conversations=[{id:input.conversationId,title:'Oficina fictícia',version:f.version}];
 if(f.free){f.free.used++;f.free.remaining=3-f.free.used;f.free.limited=!f.free.remaining;}
 localStorage.setItem('free-fixture-'+mode,JSON.stringify(f));
 return Response.json({answer,diagnosis:d,version:f.version});
};
createRoot(document.getElementById('app')).render(<I18nProvider locale="pt-BR"><SeedWorkspace company={{id:'11111111-1111-4111-8111-111111111111',name:'Oficina fictícia'}} userId="22222222-2222-4222-8222-222222222222"/></I18nProvider>);
`);
const mock=path.join(folder,'mocks.tsx');
const alias={'next/link$':mock,'@/app/workspace/actions$':mock,'@/app/auth/actions$':mock,'@/app/cockpit/actions$':mock};
for(const name of ['brand','language-switcher','cockpit','growth-map','goal-panel','external-research','radar-insight','business-model-panel','simulation-panel','execution-panel','journal-insights'])alias['./'+name+'$']=mock;
alias['@']=path.join(root,'src');
const {webpack}=require('next/dist/compiled/webpack/webpack');
const compiler=webpack({
 mode:'development',devtool:false,entry:path.join(folder,'entry.tsx'),
 output:{path:folder,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.js','.json'],alias},
 module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:[{loader:path.join(folder,'loader.cjs')}]}]},
});
await new Promise((resolve,reject)=>compiler.run((error,stats)=>error?reject(error):stats.hasErrors()?reject(Error(stats.toString({all:false,errors:true}))):resolve()));
await new Promise((resolve,reject)=>compiler.close(error=>error?reject(error):resolve()));
const html='<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>FREE fixture</title><link rel="stylesheet" href="/style.css"><div id="app"></div><script src="/bundle.js"></script></html>';
const cssDir=path.join(root,'.next/static/chunks');
const cssFiles=await readdir(cssDir).catch(()=>[]);
const styles=await Promise.all(cssFiles.filter(n=>n.endsWith('.css')).map(n=>readFile(path.join(cssDir,n),'utf8')));
const css=styles.find(s=>s.includes('.free-value'))??(await readFile(path.join(root,'src/app/globals.css'),'utf8')).replace('@import "tailwindcss";','');
const bundle=await readFile(path.join(folder,'bundle.js'));
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/bundle.js'?'text/javascript':req.url==='/style.css'?'text/css':'text/html');res.end(req.url==='/bundle.js'?bundle:req.url==='/style.css'?css:html);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});const checks=[];
try{
 const context=await browser.newContext();await context.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function start(mode){await page.goto(base+'/?mode='+mode);await page.evaluate(()=>sessionStorage.clear());await page.reload();await expect(page.locator('#challenge')).toBeVisible();}
 async function guide(){await page.locator('#challenge').fill('Quero vender mais');await page.getByRole('button',{name:'Vamos começar',exact:true}).click();await expect(page.locator('#free-business')).toBeFocused();assert.equal(await page.evaluate(()=>window.requests.length),0);await page.locator('#free-business').fill('Oficina mecânica para motoristas');await page.locator('#free-observation').fill('Não fazemos acompanhamento.');}
 await start('useful');await guide();checks.push('clarification does not send an AI request');
 assert.equal(await page.getByRole('link',{name:'Conhecer o PRO',exact:true}).count(),0);
 await page.getByRole('button',{name:'Gerar minha primeira análise'}).click();
 await expect(page.getByRole('heading',{name:'Uma direção para começar'})).toBeVisible();
 await expect(page.getByRole('link',{name:'Conhecer o PRO',exact:true})).toBeVisible();
 const sent=await page.evaluate(()=>window.requests);assert.equal(sent.length,1);assert.equal(sent[0].messages.length,1);assert.match(sent[0].messages[0].content,/Oficina mecânica/);assert.match(sent[0].messages[0].content,/Não fazemos acompanhamento/);
 const action=await page.getByText(diagnosis.reliability.recommendation.action,{exact:true}).boundingBox(),invite=await page.getByRole('link',{name:'Conhecer o PRO',exact:true}).boundingBox();assert.ok(action.y<invite.y);checks.push('one complete message; useful result precedes invite');
 await page.reload();await expect(page.getByRole('heading',{name:'Uma direção para começar'})).toBeVisible();checks.push('saved conversation restores first-value card');
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(folder,'mobile.png'),fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);checks.push('390px mobile without horizontal overflow');
 await page.setViewportSize({width:1280,height:900});await page.getByRole('button',{name:'＋ Nova conversa',exact:true}).first().click();await page.locator('#challenge').fill('Como acompanhar o resultado?');await page.getByRole('button',{name:'Vamos começar',exact:true}).click();await expect(page.getByRole('heading',{name:'Uma direção para começar'})).toBeVisible();assert.equal(await page.locator('#free-business').count(),0);assert.equal(await page.evaluate(()=>window.fixture.free.used),2);checks.push('returning FREE conversation does not repeat onboarding or reset allowance');
 await start('withheld');await guide();await page.getByRole('button',{name:'Gerar minha primeira análise'}).click();await expect(page.getByText('Ainda preciso conhecer seu problema empresarial.',{exact:true})).toBeVisible();assert.equal(await page.getByRole('link',{name:'Conhecer o PRO',exact:true}).count(),0);checks.push('questions-only answer has no upgrade invitation');
 await start('quota');await expect(page.locator('#challenge')).toBeDisabled();await expect(page.getByRole('link',{name:'Falar com o suporte'})).toBeVisible();assert.equal(await page.getByRole('link',{name:'Conhecer o PRO',exact:true}).count(),0);checks.push('quota without validated value is transparent, not a sales success');
 await start('failure');await guide();await page.getByRole('button',{name:'Gerar minha primeira análise'}).click();await expect(page.getByRole('alert')).toBeVisible();assert.equal(await page.getByRole('link',{name:'Conhecer o PRO',exact:true}).count(),0);await page.getByRole('button',{name:'Vamos começar',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();assert.equal(await page.locator('#free-business').count(),0);checks.push('provider failure keeps full context for retry; no invite');
 await start('saveFailure');await guide();await page.getByRole('button',{name:'Gerar minha primeira análise'}).click();await expect(page.getByRole('alert')).toBeVisible();assert.equal(await page.getByRole('link',{name:'Conhecer o PRO',exact:true}).count(),0);checks.push('failed persistence never shows saved analysis or invite');
 await start('usageUnavailable');await expect(page.locator('#challenge')).toBeDisabled();await expect(page.getByText(/Não foi possível consultar sua cota agora/)).toBeVisible();await page.setViewportSize({width:1280,height:900});await page.getByRole('button',{name:'Conversas',exact:true}).first().click();checks.push('usage outage disables new AI without preventing navigation');
 await start('paid');await page.locator('#challenge').fill('Quero vender mais');await page.getByRole('button',{name:'Vamos começar',exact:true}).click();await expect(page.getByText('Revise os orçamentos pendentes e registre os motivos de desistência.',{exact:true})).toBeVisible();assert.equal(await page.locator('#free-business').count(),0);checks.push('paid conversation does not receive free onboarding');
 assert.deepEqual(errors,[]);await writeFile(path.join(folder,'report.json'),JSON.stringify({fixture:true,checks,passed:true},null,2));console.log(JSON.stringify({passed:true,checks}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
