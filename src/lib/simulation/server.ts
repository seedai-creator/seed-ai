import {featureEnabled} from '../operations/flags';
import 'server-only';
import {commercialDatabase} from '../commercial/server';
import type {Simulation} from './domain';
import {createHash} from 'node:crypto';
import {CALCULATION_VERSION} from './calculation';
import type {SimulationLifecycle} from './domain';
export async function simulationLifecycle(user:string,company:string,conversation:string,request:string,version:number,question:string,context:string):Promise<SimulationLifecycle|undefined>{
 if(!featureEnabled('simulation'))return;
 const db=commercialDatabase(),fingerprint=createHash('sha256').update(CALCULATION_VERSION+context).digest('hex');
 const cached=await db.from('decision_simulations').select('snapshot').eq('company_id',company).eq('user_id',user).eq('conversation_id',conversation).eq('status','DRAFT').eq('context_fingerprint',fingerprint).order('created_at',{ascending:false}).limit(1).maybeSingle();
 if(cached.error)throw Error('SIMULATION_UNAVAILABLE');
 return {prepared:cached.data?.snapshot as Simulation|undefined,calculated:async(snapshot)=>{
  const r=await db.rpc('stage_decision_simulation',{p_user:user,p_company:company,p_conversation:conversation,p_request:request,p_version:version,p_question:question,p_fingerprint:fingerprint,p_snapshot:snapshot});
  if(r.error)throw Error('SIMULATION_SAVE_FAILED');
 }};
}
export async function simulationMemory(company:string,user:string,conversation:string,question=''){
 if(!featureEnabled('simulation'))return [];
 const db=commercialDatabase();
 const member=await db.from('company_members').select('user_id').eq('company_id',company).eq('user_id',user).maybeSingle();
 if(member.error||!member.data)throw Error('SIMULATION_ACCESS_DENIED');
 const r=await db.from('decision_simulations').select('id,version,snapshot,decision_id,selected_scenario').eq('company_id',company).eq('user_id',user).eq('conversation_id',conversation).neq('status','DRAFT').order('created_at',{ascending:false}).limit(2);
 if(r.error)throw Error('SIMULATION_CONTEXT_UNAVAILABLE');
 const assessments=await db.from('execution_events').select('id,after_state').eq('company_id',company).eq('operation','assumption_assessed').order('created_at',{ascending:false}).limit(8);
 if(assessments.error)throw Error('SIMULATION_CONTEXT_UNAVAILABLE');
 const terms=question.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu)??[];
 const learned=assessments.data.filter(a=>terms.some(t=>String(a.after_state?.summary??'').toLocaleLowerCase().includes(t))).slice(0,3).map(a=>({key:'simulation_learning_'+a.id,kind:'LEARNING',value:JSON.stringify(a.after_state)}));
 return [...learned,...r.data.map(row=>{
  const s=row.snapshot as Simulation;
  return {key:'simulation_'+row.id,kind:'ASSUMPTION',value:JSON.stringify({id:row.id,version:row.version,intent:s.intent,inputs:s.extraction.inputs,selected_scenario:row.selected_scenario,decision_id:row.decision_id,notice:'Scenario snapshot, not current business facts. USER_ASSUMPTION values are explicit user scenario choices. Never promote to baseline facts.'})};
 }).filter(row=>row.value.length<=18000)];
}
