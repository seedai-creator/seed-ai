'use server';
import {companyContext} from '@/lib/auth/context';
import {commercialDatabase} from '@/lib/commercial/server';
import {validId} from '@/lib/auth/validation';
import {effectiveState,validateAttributeValue,type Attribute,type Value,type Entity,type StoredObservation} from '@/lib/business-model/domain';

export async function readBusinessModel(company:string,offset=0) {
 const c=await companyContext(company),db=commercialDatabase();
 if(!Number.isSafeInteger(offset)||offset<0||offset>10000)throw Error('INVALID_PAGE');
 const nodes=await db.from('business_entities').select('id,company_id,type,name,status,reference_table,reference_id').eq('company_id',c.companyId).neq('status','MERGED').order('type').order('id').range(offset,offset+19);
 if(nodes.error)throw Error('BUSINESS_UNAVAILABLE');
 const ids=nodes.data.map(n=>n.id);
 const observations=ids.length?await db.from('business_observations').select('*').eq('company_id',c.companyId).in('entity_id',ids).eq('is_current',true).order('attribute').limit(160):{data:[],error:null};
 if(observations.error)throw Error('BUSINESS_UNAVAILABLE');
 const refs=nodes.data.filter(n=>n.reference_table==='business_memories').map(n=>n.reference_id);
 const memories=refs.length?await db.from('business_memories').select('id,value').eq('company_id',c.companyId).in('id',refs).eq('deleted',false):{data:[],error:null};
 if(memories.error)throw Error('BUSINESS_UNAVAILABLE');
 const profile=await db.from('companies').select('name').eq('id',c.companyId).single();if(profile.error)throw Error('BUSINESS_UNAVAILABLE');
 return {next:nodes.data.length===20?offset+20:null,entities:nodes.data.map(n=>({id:n.id,type:n.type as Entity['type'],name:n.type==='COMPANY'?profile.data.name:memories.data?.find(m=>m.id===n.reference_id)?.value??n.name,status:n.status,reference:!!n.reference_id,
 observations:(observations.data as StoredObservation[]).filter(o=>o.entity_id===n.id).map(o=>({id:o.id,attribute:o.attribute,data:o.data,state:effectiveState(o),version:o.version,observed_at:o.observed_at,editable:true,source:o.source_type==='MANUAL_EDIT'?'manual':'conversation'}))}))};
}
export async function correctBusinessObservation(company:string,id:string,version:number,data:Value) {
 const c=await companyContext(company);if(!validId(id)||!Number.isSafeInteger(version)||version<1)throw Error('INVALID_OBSERVATION');
 const db=commercialDatabase();
 const row=await db.from('business_observations').select('attribute').eq('company_id',c.companyId).eq('id',id).single();
 if(row.error||!row.data)throw Error('BUSINESS_UNAVAILABLE');
 validateAttributeValue(row.data.attribute as Attribute,data);
 if(row.data.attribute==='status'&&!['ACTIVE','INACTIVE','DISCONTINUED','PLANNED'].includes(data.text??''))throw Error('BUSINESS_STATUS_INVALID');
 const r=await db.rpc('edit_business_observation',{p_user:c.userId,p_company:c.companyId,p_id:id,p_version:version,p_data:data});if(r.error)throw Error('BUSINESS_CHANGED');
}
export async function businessHistory(company:string,entity:string,offset=0){
 const c=await companyContext(company);if(!validId(entity)||!Number.isSafeInteger(offset)||offset<0||offset>10000)throw Error('INVALID_HISTORY');
 const result=await commercialDatabase().from('business_observations').select('attribute,data,observed_at,source_type,state,operation,is_current').eq('company_id',c.companyId).eq('entity_id',entity).order('created_at',{ascending:false}).range(offset,offset+19);
 if(result.error)throw Error('BUSINESS_UNAVAILABLE');return result.data;
}
