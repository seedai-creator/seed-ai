import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeModelBatch,EMPTY_VALUE,type Extraction} from '../src/lib/business-model/domain';
const text='Caixa Aurora custa R$ 199. A cozinha produz aproximadamente 80 caixas por dia.';
const product={key:'p',type:'PRODUCT_SERVICE' as const,name:'Caixa Aurora',scope:'CURRENT_COMPANY' as const,existing_id:null,version:null,reference_id:null,evidence:'Caixa Aurora custa R$ 199.'};
const capacity={...product,key:'c',type:'CAPACITY' as const,name:'Capacidade da cozinha',evidence:'A cozinha produz aproximadamente 80 caixas por dia.'};
const price={entity:'p',attribute:'price' as const,data:{...EMPTY_VALUE,value:199,unit:'money',currency:'BRL'},kind:'FACT' as const,confidence:'HIGH' as const,evidence:product.evidence,operation:'NEW' as const,observed_on:null,structural:true,memory_id:null};
const valid:Extraction={entities:[product,capacity],observations:[price,{...price,entity:'c',attribute:'capacity',data:{...EMPTY_VALUE,value:80,unit:'caixas por dia'},evidence:capacity.evidence}],relationships:[]};
test('business model partial batch preserves supported records and quarantines invalid relationship without repairing it',()=>{
 const data=structuredClone(valid);data.relationships.push({source:'p',target:'c',type:'HAS',kind:'FACT',confidence:'HIGH',status:'ACTIVE',evidence:capacity.evidence});
 const result=normalizeModelBatch(data,text,[]);
 assert.equal(result.model.observations.length,2);assert.equal(result.model.observations[1].data.approximate,true);assert.equal(result.model.relationships.length,0);
 assert.deepEqual(result.rejected,[{section:'relationships',index:0,code:'BUSINESS_RELATION_INVALID'}]);
 assert.equal(data.observations[1].data.approximate,false);
});
test('business model partial batch never accepts unsupported numbers or copied reference-backed observations',()=>{
 const data=structuredClone(valid);data.observations.push({...price,data:{...price.data,value:249}});
 data.entities.push({...product,key:'co',type:'COMPANY',name:'Empresa',reference_id:'company'});data.observations.push({...price,entity:'co'});
 const result=normalizeModelBatch(data,text,[],[{id:'company',type:'COMPANY'}]);
 assert.equal(result.model.observations.length,2);assert.equal(result.rejected.length,2);
 assert.deepEqual(result.rejected.map(r=>r.code),['BUSINESS_NUMBER_UNSUPPORTED','BUSINESS_REFERENCE_READ_ONLY']);
});
test('business model partial batch fails closed on foreign identity, schema or evidence',()=>{
 assert.throws(()=>normalizeModelBatch({...valid,entities:[{...product,existing_id:'foreign',version:1}]},text,[]),/BUSINESS_ENTITY_CHANGED/);
 assert.throws(()=>normalizeModelBatch({...valid,entities:[{...product,evidence:'Invented quote'}]},text,[]),/BUSINESS_SOURCE_INVALID/);
 assert.throws(()=>normalizeModelBatch({entities:[],observations:'bad'},text,[]),/BUSINESS_EXTRACTION_INVALID/);
});
test('business model binds omitted version from exact server identity but never repairs stale or foreign identity',()=>{
 const known={id:'known',company_id:'tenant',type:'PRODUCT_SERVICE' as const,name:product.name,canonical_name:'caixa aurora',version:3,reference_id:null,reference_table:null,status:'ACTIVE' as const};
 const data=structuredClone(valid);data.entities[0].existing_id='known';
 const result=normalizeModelBatch(data,text,[known]);assert.equal(result.model.entities[0].version,3);assert.equal(data.entities[0].version,null);
 data.entities[0].version=2;assert.throws(()=>normalizeModelBatch(data,text,[known]),/BUSINESS_ENTITY_CHANGED/);
 data.entities[0].existing_id='foreign';data.entities[0].version=null;assert.throws(()=>normalizeModelBatch(data,text,[known]),/BUSINESS_ENTITY_CHANGED/);
});
