import fs from 'node:fs/promises';
import OpenAI from 'openai';
import {extractionRequest,weeklyRequest} from '../.test-build/src/lib/journal/requests.js';
import {normalizeExtraction} from '../.test-build/src/lib/journal/domain.js';
import {validateWeekly,weeklyMetrics} from '../.test-build/src/lib/journal/weekly.js';
process.loadEnvFile('.env.local');
const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,timeout:60000,maxRetries:0});
const cases=[
 ['2026-09-21','Hoje tivemos 20 interessados, 3 vendas e gastamos R$300 em mídia.'],
 ['2026-09-22','Hoje tivemos 25 interessados e 3 vendas. Clientes mencionaram preço alto.'],
 ['2026-09-23','Decidi testar parcelamento em 6x sem juros durante 7 dias, começando hoje. Quero medir se mais interessados compram.'],
 ['2026-09-24','Hoje tivemos 30 interessados e 6 vendas. O parcelamento está ativo; esse foi o resultado observado durante o teste.'],
 ['2026-09-25','Hoje tivemos 28 interessados e 6 vendas.']
];
const resume=process.argv.includes("--resume-result");
const previous=resume?JSON.parse(await fs.readFile(".test-build/journal-live/result.json","utf8")):null;
const rows=previous?previous.rows.filter(r=>!r.created_at.startsWith("2026-09-24")):[],usage=[];
await fs.mkdir('.test-build/journal-live',{recursive:true});
async function call(request,feature){const start=Date.now();const response=await client.responses.create(request);if(response.status!=='completed')throw Error('INCOMPLETE_'+feature);usage.push({feature,model:response.model,tokens:response.usage,latency_ms:Date.now()-start});const raw=JSON.parse(response.output_text);await fs.writeFile(".test-build/journal-live/raw-"+feature+"-"+usage.length+".json",JSON.stringify(raw,null,2));return raw;}
for(const [date,message] of (resume?cases.filter(c=>c[0]==="2026-09-24"):cases)){const at=new Date(date+'T15:00:00Z');const request=extractionRequest(process.env.OPENAI_ECONOMY_MODEL??process.env.OPENAI_MODEL,message,rows.filter(r=>r.created_at.slice(0,10)<date),{locale:'pt-BR',timezone:'America/Sao_Paulo',referenceDay:date});const raw=await call(request,'BUSINESS_JOURNAL_EXTRACTION');
 await fs.writeFile('.test-build/journal-live/'+date+'.json',JSON.stringify(raw,null,2));
 const normalized=normalizeExtraction(raw,message,at,'America/Sao_Paulo',rows);
 for(const c of normalized){const row={...c,id:crypto.randomUUID(),company_id:'synthetic-fixture-only',user_id:'fixture',source_message_id:crypto.randomUUID(),event_date:c.period_start,status:'ACTIVE',version:1,manual:false,created_at:at.toISOString(),metadata:{related_ids:c.related_ids,hypothesis:c.hypothesis,action:c.action,indicator:c.indicator,baseline:c.baseline,target:c.target,review_date:c.review_date}};if(c.operation==='NEW')rows.push(row);else {const index=rows.findIndex(r=>r.id===c.target_id);rows[index]={...row,id:c.target_id,version:rows[index].version+1};}}
 console.log(JSON.stringify({date,events:normalized.map(e=>({kind:e.entry_type,metric:e.metric_type,value:e.value}))}));}
const window={start:'2026-09-21',end:'2026-09-27'};
await fs.writeFile(".test-build/journal-live/rows.json",JSON.stringify(rows,null,2));
const weekly=validateWeekly(await call(weeklyRequest(process.env.OPENAI_STRATEGIC_MODEL??process.env.OPENAI_MODEL,rows,window,{locale:'pt-BR',timezone:'America/Sao_Paulo'}),'WEEKLY_INTELLIGENCE_GENERATION'),rows);
const metrics=weeklyMetrics(rows,window);await fs.writeFile('.test-build/journal-live/result.json',JSON.stringify({fixture:true,rows,metrics,weekly,usage},null,2));
if(metrics.find(m=>m.metric==='leads')?.value!==103||metrics.find(m=>m.metric==='sales')?.value!==18)throw Error('LIVE_METRICS_MISMATCH');
for(const type of ['DECISION','EXPERIMENT','RESULT'])if(!rows.some(r=>r.entry_type===type))throw Error('MISSING_'+type);
console.log(JSON.stringify({status:'PASS',metrics,weekly,usage},null,2));
