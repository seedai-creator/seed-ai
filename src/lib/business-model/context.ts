import { effectiveState, type Entity, type EntityType, type Relationship, type StoredObservation } from './domain';
import {consistency,remainingShare} from './consistency';

export const DOMAINS = ['COMPANY','OFFER','CUSTOMERS','ACQUISITION','SALES','OPERATIONS','FINANCE','TEAM','GOALS'] as const;
export type Domain = typeof DOMAINS[number];
export type Coverage = 'UNKNOWN'|'LIMITED'|'PARTIAL'|'SUFFICIENT'|'STRONG';
export const DOMAIN_TYPES:Record<Domain,EntityType[]> = {
 COMPANY:['COMPANY','MARKET','LOCATION'],OFFER:['PRODUCT_SERVICE','OFFER'],CUSTOMERS:['CUSTOMER_SEGMENT'],ACQUISITION:['CHANNEL'],SALES:['SALES_PROCESS','SALES_STAGE','CUSTOMER_JOURNEY'],OPERATIONS:['OPERATION','CAPACITY','SUPPLIER'],FINANCE:['COST_STRUCTURE','REVENUE_STREAM','METRIC'],TEAM:['TEAM','TEAM_ROLE'],GOALS:['GOAL','CONSTRAINT'],
};
export function queryDomains(question:string):Domain[] {
 const q=question.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase();
 if(/contrat|vendedor|hiring|hire|seller|emplead|equipe|team|equipo/.test(q))return ['TEAM','SALES','OPERATIONS','FINANCE','GOALS'];
 if(/anunci|anunc|ads|advert|publicidad|marketing|leads/.test(q))return ['ACQUISITION','SALES','OPERATIONS','FINANCE','GOALS'];
 if(/prec|descont|price|pricing|discount|descuento|margem|margin/.test(q))return ['OFFER','CUSTOMERS','FINANCE','GOALS'];
 if(/entreg|produc|delivery|capacity|capacid|forneced|supplier/.test(q))return ['OPERATIONS','TEAM','FINANCE','GOALS'];
 return [...DOMAINS];
}
// Coverage is about this retrieved slice, never a whole-company score.
export function coverage(entities:Entity[],observations:StoredObservation[],domain:Domain,now=Date.now()):{level:Coverage;missing:string[]} {
 const nodes=entities.filter(e=>DOMAIN_TYPES[domain].includes(e.type)&&e.status==='ACTIVE');
 const obs=observations.filter(o=>nodes.some(e=>e.id===o.entity_id)&&o.is_current);
 const usable=obs.filter(o=>effectiveState(o,now)==='CONFIRMED'&&!['HYPOTHESIS','INFERENCE'].includes(o.kind));
 if(!nodes.length&&!obs.length)return {level:'UNKNOWN',missing:[domain.toLowerCase()]};
 const required:Partial<Record<Domain,string[]>>={FINANCE:['revenue','cost','margin'],TEAM:['count'],OPERATIONS:['capacity'],OFFER:['description','price'],SALES:['description','conversion'],GOALS:['goal']};
 const missing=(required[domain]??['description']).filter(k=>!usable.some(o=>o.attribute===k));
 const distinct=new Set(usable.map(o=>o.attribute));
 const level:Coverage=!usable.length||domain==='FINANCE'&&(!distinct.has('cost')||!distinct.has('margin'))?'LIMITED':missing.length?'PARTIAL':usable.some(o=>o.data.approximate||o.data.min!==null)?'PARTIAL':'SUFFICIENT';
 const historical=observations.filter(o=>!o.is_current&&nodes.some(e=>e.id===o.entity_id)&&o.state==='CONFIRMED'&&o.confidence==='HIGH'&&usable.some(c=>c.attribute===o.attribute&&c.scope_key===o.scope_key&&c.data.unit===o.data.unit&&c.data.currency===o.data.currency));
 return {level:level==='SUFFICIENT'&&new Set(historical.map(o=>o.observed_at)).size>=2?'STRONG':level,missing};
}
export function budgetContext(company:string,entities:Entity[],observations:StoredObservation[],relationships:Relationship[],question:string,limit=10000) {
 const domains=queryDomains(question),words=question.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu)??[];
 const nodes=entities.filter(e=>e.company_id===company&&e.status==='ACTIVE');
 const score=(e:Entity)=>words.filter(w=>e.name.toLowerCase().includes(w)).length*4+Number(e.type==='CONSTRAINT'||e.type==='GOAL')*3;
 const candidates=nodes.filter(e=>domains.some(d=>DOMAIN_TYPES[d].includes(e.type))).sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id));
 // Bounded dependency expansion: twelve primary entities, up to four direct/material downstream nodes.
 const primary=candidates.slice(0,12),primaryIds=new Set(primary.map(e=>e.id));
 const adjacent=new Set(relationships.filter(r=>r.company_id===company&&r.status==='ACTIVE'&&(primaryIds.has(r.source_id)||primaryIds.has(r.target_id))).flatMap(r=>[r.source_id,r.target_id]));
 const dependencies=nodes.filter(e=>!primaryIds.has(e.id)&&adjacent.has(e.id)).sort((a,b)=>Number(['CONSTRAINT','CAPACITY','OPERATION','TEAM'].includes(b.type))-Number(['CONSTRAINT','CAPACITY','OPERATION','TEAM'].includes(a.type))||score(b)-score(a)).slice(0,4);
 const ranked=[...primary,...dependencies,...candidates.filter(e=>!primaryIds.has(e.id)&&!dependencies.some(d=>d.id===e.id))].slice(0,16);
 const ids=new Set(ranked.map(e=>e.id));
 const selected=observations.filter(o=>o.company_id===company&&ids.has(o.entity_id)&&o.is_current).sort((a,b)=>Number(b.attribute==='constraint')-Number(a.attribute==='constraint')||b.observed_at.localeCompare(a.observed_at));
 const rows:{key:string;kind:string;value:string;observed_at:string;state:string;approximate:boolean;source_id:string}[]=[];
 let used=0;
 for(const o of selected){const e=nodes.find(e=>e.id===o.entity_id)!;const state=effectiveState(o);const row={key:'business_'+o.id,kind:o.kind,value:JSON.stringify({entity:e.name,attribute:o.attribute,...o.data,scope:o.scope_key,source_type:o.source_type,state}),observed_at:o.observed_at,state,approximate:o.data.approximate||o.data.min!==null,source_id:o.id};const size=JSON.stringify(row).length;if(used+size>limit)break;rows.push(row);used+=size;}
 const included=new Set(selected.filter(o=>rows.some(r=>r.source_id===o.id)).map(o=>o.entity_id));
 for(const e of ranked){if(included.has(e.id))continue;const row={key:'business_entity_'+e.id,kind:'OBSERVATION',value:e.name,observed_at:'',state:'CONFIRMED',approximate:false,source_id:e.id};const size=JSON.stringify(row).length;if(used+size>limit)break;rows.push(row);used+=size;included.add(e.id);}
 for(const r of relationships.filter(r=>r.company_id===company&&included.has(r.source_id)&&included.has(r.target_id)&&['ACTIVE','PROVISIONAL'].includes(r.status)).slice(0,12)){
 const row={key:'business_relation_'+r.id,kind:r.kind==='FACT'?'OBSERVATION':r.kind,value:JSON.stringify({from:nodes.find(n=>n.id===r.source_id)?.name,relation:r.type,to:nodes.find(n=>n.id===r.target_id)?.name,causality:'NOT_ESTABLISHED'}),observed_at:'',state:r.status==='PROVISIONAL'?'PROVISIONAL':'CONFIRMED',approximate:false,source_id:r.id};const size=JSON.stringify(row).length;if(used+size>limit)break;rows.push(row);used+=size;
 }
 const cover=Object.fromEntries(domains.map(d=>[d,coverage(ranked,observations.filter(o=>o.company_id===company),d)]));
 const calculations=consistency(selected.map(o=>({...o,state:effectiveState(o)})));
 for(const conflict of calculations.conflicts){const r=rows.find(r=>r.source_id===conflict.reported_id);if(r)r.state='CONFLICTING';}
 for(const calculation of [...calculations.derived,...remainingShare(ranked,selected)]){const row={key:'business_derived_'+rows.length,kind:'DERIVED_METRIC',value:JSON.stringify(calculation),observed_at:calculation.calculated_at,state:'CONFIRMED',approximate:calculation.approximate,source_id:calculation.inputs[0].id};const size=JSON.stringify(row).length;if(used+size>limit)break;rows.push(row);used+=size;}
 for(const o of observations.filter(o=>o.company_id===company&&included.has(o.entity_id)&&!o.is_current).slice(0,4)){const row={key:'business_history_'+o.id,kind:'OBSERVATION',value:JSON.stringify({entity:nodes.find(e=>e.id===o.entity_id)?.name,attribute:o.attribute,...o.data,historical:true}),observed_at:o.observed_at,state:'HISTORICAL',approximate:o.data.approximate,source_id:o.id};const size=JSON.stringify(row).length;if(used+size>limit)break;rows.push(row);used+=size;}
 return {rows,coveredMemoryIds:selected.filter(o=>o.memory_id&&effectiveState(o)==='CONFIRMED'&&rows.some(r=>r.source_id===o.id)).map(o=>o.memory_id!),coverage:cover,missingInformation:[...new Set(Object.values(cover).flatMap(c=>c.missing))],conflicts:calculations.conflicts,truncated:selected.length>rows.length,characters:used};
}
