import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedRelation,canonicalName,normalizeModel,validateValue,EMPTY_VALUE,effectiveState,deriveRatio,numericConflict,type Entity,type Extraction,type StoredObservation} from '../src/lib/business-model/domain';
import {coverage,budgetContext,queryDomains} from '../src/lib/business-model/context';
import {remainingShare} from '../src/lib/business-model/consistency';
import {extractionRequest} from '../src/lib/journal/requests';
import {emptyReliability,metric} from './reliability-fixtures';
import {validateProvenance,calculateDerived,renderCalculations} from '../src/lib/reliability/validate';
const now=new Date('2026-10-06T12:00:00Z');
const extraction:Extraction={entities:[{key:'t',type:'TEAM',name:'Equipe comercial',scope:'CURRENT_COMPANY',existing_id:null,version:null,reference_id:null,evidence:'Tenho quatro vendedores.'}],observations:[{entity:'t',attribute:'count',data:{...EMPTY_VALUE,value:4,unit:'people'},kind:'FACT',confidence:'HIGH',evidence:'Tenho quatro vendedores.',operation:'NEW',observed_on:null,structural:true,memory_id:null}],relationships:[]};
const node:Entity={id:'a',company_id:'c',type:'TEAM',name:'Equipe comercial',canonical_name:'equipe comercial',version:1,reference_id:null,reference_table:null,status:'ACTIVE'};
const observation:StoredObservation={id:'o',company_id:'c',entity_id:'a',attribute:'count',data:{...EMPTY_VALUE,value:4},kind:'FACT',state:'CONFIRMED',confidence:'HIGH',observed_at:now.toISOString(),source_type:'CHAT',source_message_id:null,memory_id:null,version:1,is_current:true,scope_key:'a'};
test('business model: deterministic aliases preserve genuinely distinct channels',()=>{
 for(const n of ['Meta Ads','Facebook Ads','Anúncios da Meta'])assert.equal(canonicalName('CHANNEL',n),'meta ads');
 assert.notEqual(canonicalName('CHANNEL','Instagram Orgânico'),canonicalName('CHANNEL','Meta Ads'));
 assert.notEqual(canonicalName('CHANNEL','Meta'),canonicalName('CHANNEL','Meta Ads'));
 assert.equal(canonicalName('CHANNEL','WhatsApp Business'),canonicalName('CHANNEL','Whats'));
});
test('business model: semantic relationship matrix and invalid targets',()=>{
 for(const [a,r,b] of [['COMPANY','SELLS','PRODUCT_SERVICE'],['PRODUCT_SERVICE','TARGETS','CUSTOMER_SEGMENT'],['CHANNEL','PARTICIPATES_IN','SALES_PROCESS'],['TEAM','OPERATES','SALES_PROCESS'],['PRODUCT_SERVICE','GENERATES','REVENUE_STREAM'],['CONSTRAINT','LIMITS','OPERATION'],['GOAL','DEPENDS_ON','METRIC']] as const)assert.ok(allowedRelation(a,r,b));
 assert.equal(allowedRelation('PRODUCT_SERVICE','OPERATES','MARKET'),false);
});
test('business model: strict output, literal source, identity and foreign references',()=>{
 assert.equal(normalizeModel(extraction,'Tenho quatro vendedores.',[],[],now).observations[0].data.value,4);
 assert.throws(()=>normalizeModel(extraction,'Outra mensagem',[],[],now));
 assert.throws(()=>normalizeModel({...extraction,entities:[{...extraction.entities[0],existing_id:'other',version:1}]},'Tenho quatro vendedores.',[],[],now));
 assert.throws(()=>normalizeModel({...extraction,extra:true},'Tenho quatro vendedores.',[],[],now));
});
test('business model: episodic event is not a structural count; hypothesis is never high confidence',()=>{
 const payload={...extraction,observations:[{...extraction.observations[0],structural:false}]};assert.equal(normalizeModel(payload,'Tenho quatro vendedores.',[],[],now).observations.length,0);
 const h={...extraction,observations:[{...extraction.observations[0],kind:'HYPOTHESIS'}]};assert.equal(normalizeModel(h,'Tenho quatro vendedores.',[],[],now).observations[0].confidence,'LOW');
});
test('business model: unknown, approximation, explicit magnitude and ranges',()=>{
 const p=structuredClone(extraction);p.observations[0].attribute='revenue';p.observations[0].data={...EMPTY_VALUE,value:100000,unit:'money',currency:'BRL',approximate:true};p.observations[0].evidence='Faturamos uns R$100 mil.';
 const msg='Tenho quatro vendedores. Faturamos uns R$100 mil.';assert.equal(normalizeModel(p,msg,[],[],now).observations[0].data.approximate,true);
 assert.throws(()=>validateValue({...EMPTY_VALUE,min:80000,max:100000,value:90000}));
 assert.deepEqual(validateValue({...EMPTY_VALUE,min:80000,max:100000}),{...EMPTY_VALUE,min:80000,max:100000});
 assert.throws(()=>validateValue({...EMPTY_VALUE}));assert.doesNotThrow(()=>validateValue({...EMPTY_VALUE,value:0}));
 assert.throws(()=>validateValue({...EMPTY_VALUE,value:100,unit:'money'}));
 assert.throws(()=>validateValue({...EMPTY_VALUE,value:1,period_start:'2026-02-30',period_end:'2026-03-01'}));
});
test('business model: staleness is category-specific; stable descriptions remain known',()=>{
 const old={...observation,observed_at:'2024-01-01'};assert.equal(effectiveState(old,now.getTime()),'STALE');assert.equal(effectiveState({...old,attribute:'description'},now.getTime()),'CONFIRMED');
});
test('business model: coverage is deterministic and absence remains unknown',()=>{
 assert.equal(coverage([],[],'OPERATIONS').level,'UNKNOWN');
 const e={...node,type:'REVENUE_STREAM' as const};assert.equal(coverage([e],[{...observation,attribute:'revenue'}],'FINANCE',now.getTime()).level,'LIMITED');
 assert.equal(coverage([node],[observation],'TEAM',now.getTime()).level,'SUFFICIENT');
 assert.equal(coverage([node],[{...observation,state:'CONFLICTING'}],'TEAM',now.getTime()).level,'LIMITED');
});
test('business model: derived conversion detects conflict without rewriting reported data',()=>{
 const a={...observation,attribute:'sales' as const,data:{...EMPTY_VALUE,value:20,unit:'count',period_start:'2026-09-01',period_end:'2026-09-30'}};
 const b={...a,id:'b',attribute:'leads' as const,data:{...a.data,value:100}};
 const derived=deriveRatio(a,b,'conversion')!;assert.equal(derived.value,20);assert.equal(derived.source_type,'SYSTEM_DERIVED');
 const report={...a,attribute:'conversion' as const,data:{...a.data,value:35}};assert.ok(numericConflict(report,derived));assert.equal(report.data.value,35);
 assert.equal(deriveRatio(a,{...b,scope_key:'another-unit'},'conversion'),null);
 assert.equal(deriveRatio(a,{...b,company_id:'other'},'conversion'),null);
 assert.equal(deriveRatio(a,{...b,data:{...b.data,value:0}},'conversion'),null);
 assert.equal(deriveRatio(a,{...b,data:{...b.data,period_end:'2026-10-01'}},'conversion'),null);
});
test('business model: 240 records stay bounded, scoped, and relevant to the question',()=>{
 const nodes=Array.from({length:240},(_,i)=>({...node,id:String(i),type:i<30?'CAPACITY' as const:'SUPPLIER' as const}));
 const obs=nodes.map((n,i)=>({...observation,id:'obs'+i,entity_id:n.id,data:{...EMPTY_VALUE,text:'x'.repeat(450)}}));
 const r=budgetContext('c',nodes,obs,[],'Quero aumentar meus anúncios',3000);assert.ok(r.characters<=3000);assert.ok(r.rows.length<20);
 assert.equal(budgetContext('foreign',nodes,obs,[],'anúncios').rows.length,0);
 assert.ok(queryDomains('Should I hire another seller?').includes('TEAM'));
});
test('business model: nine business types require no universal digital sales funnel',()=>{
 for(const name of ['Padaria','Restaurante','Clínica','Consultoria','Agência','Loja','Indústria','E-commerce','B2B']){
 const p={entities:[{...extraction.entities[0],type:'OPERATION',name,evidence:name}],observations:[],relationships:[]};assert.equal(normalizeModel(p,name,[],[],now).entities[0].name,name);
 }
});
test('business model: bakery remaining share is software derived and approximate, never reported',()=>{
 const nodes=['Salão','Balcão','Encomendas'].map((name,i)=>({...node,id:String(i),name,type:'REVENUE_STREAM' as const}));
 const rows=nodes.map((n,i)=>({...observation,id:'share'+i,entity_id:n.id,attribute:'share' as const,source_message_id:'same-message',data:{...EMPTY_VALUE,value:[40,35,null][i],text:i===2?'restante':null,unit:'percent',approximate:true}}));
 const result=remainingShare(nodes,rows);assert.equal(result[0].value,25);assert.equal(result[0].source_type,'SYSTEM_DERIVED');assert.equal(result[0].approximate,true);assert.equal(result[0].inputs.length,3);assert.equal(rows[2].data.value,null);
 assert.equal(remainingShare(nodes,rows.map((r,i)=>({...r,source_message_id:String(i)}))).length,0);
});
test('business model: grouped extraction adds one strict schema, not extra provider calls',()=>{
 const r=extractionRequest('configured-model','Hello',[],{business_context:{entities:[],references:[]}});assert.equal(r.metadata?.business_model_feature,'BUSINESS_MODEL_EXTRACTION');assert.ok(r.instructions?.includes('SAME call'));assert.equal(r.text?.format?.type,'json_schema');
});
test('business model: wrong-company and simulation claims cannot create structural facts',()=>{
 for(const scope of ['OTHER','SIMULATION','AMBIGUOUS']){const p=structuredClone(extraction);p.entities[0].scope=scope as typeof p.entities[0]['scope'];const r=normalizeModel(p,'Tenho quatro vendedores.',[],[],now);assert.deepEqual(r,{entities:[],observations:[],relationships:[]});}
});
test('business model: server derivation can be cited only with its exact computed value and kind',()=>{
 const row={key:'business_derived_1',kind:'DERIVED_METRIC',value:JSON.stringify({value:20,source_type:'SYSTEM_DERIVED'})};
 const e={...metric('conversion',20),kind:'DERIVED_METRIC' as const,source:'MEMORY' as const,reference:row.key,quote:row.value};
 assert.doesNotThrow(()=>validateProvenance({...emptyReliability(),evidence:[e]},[],JSON.stringify([row])));
 assert.throws(()=>validateProvenance({...emptyReliability(),evidence:[{...e,numeric_value:35}]},[],JSON.stringify([row])));
 assert.throws(()=>validateProvenance({...emptyReliability(),evidence:[{...e,kind:'METRIC'}]},[],JSON.stringify([row])));
});
test('business model: calculations preserve approximation and cannot turn ranges into point facts',()=>{
 const a=metric('sales',20,{source:'MEMORY',reference:'business_sales'}),b=metric('leads',100);
 const r={...emptyReliability(),evidence:[a,b],calculations:[{id:'conversion',operation:'RATIO_PERCENT' as const,left:a.id,right:b.id}]};
 assert.equal(renderCalculations('{{calc:conversion}}',calculateDerived(r,JSON.stringify([{key:'business_sales',kind:'METRIC',value:'20',approximate:true}])),'en-US'),'≈ 20%');
});
