'use server';
import {authorizeChat,companyContext} from '@/lib/auth/context';
import {commercialContext,commercialDatabase} from '@/lib/commercial/server';
import {validId} from '@/lib/auth/validation';
import {buildSimulation,type Simulation} from '@/lib/simulation/domain';
import {quantity,type Quantity} from '@/lib/simulation/calculation';
import {revalidatePath} from 'next/cache';
import {assessAssumptions,type ObservedResult} from '@/lib/simulation/outcomes';
import {getLocale} from '@/lib/i18n/server';
export type SavedSimulation={id:string;company_id:string;version:number;status:string;snapshot:Simulation;decision_id:string|null;plan_id:string|null;experiment_id:string|null;selected_scenario:string|null;recommendation_summary:string};
export async function readSimulations(companyId:string,conversationId:string):Promise<SavedSimulation[]> {
 const c=await companyContext(companyId);if(process.env.SEED_SIMULATOR_ENABLED!=='true')return [];
 if(!validId(conversationId))throw Error('SIMULATION_UNAVAILABLE');
 const r=await commercialDatabase().from('decision_simulations').select('id,company_id,version,status,snapshot,decision_id,plan_id,experiment_id,selected_scenario,recommendation_summary').eq('company_id',c.companyId).eq('user_id',c.userId).eq('conversation_id',conversationId).order('created_at',{ascending:false}).limit(5);
 if(r.error)throw Error('SIMULATION_UNAVAILABLE');return r.data as SavedSimulation[];
}
async function owner(companyId:string,id:string){
 await authorizeChat({companyId});const c=await companyContext(companyId);
 if(process.env.SEED_SIMULATOR_ENABLED!=='true'||!validId(id))throw Error('SIMULATION_UNAVAILABLE');
 const db=commercialDatabase();const r=await db.from('decision_simulations').select('*').eq('id',id).eq('company_id',c.companyId).eq('user_id',c.userId).single();
 if(r.error||!r.data)throw Error('SIMULATION_UNAVAILABLE');return {c,db,row:r.data as SavedSimulation};
}
export async function recalculateSimulation(companyId:string,id:string,version:number,changes:{id:string;min:number;max:number}[]) {
 const {c,db,row}=await owner(companyId,id);
 if(!Number.isSafeInteger(version)||row.version!==version||!Array.isArray(changes)||!changes.length||changes.length>12||new Set(changes.map(v=>v.id)).size!==changes.length)throw Error('SIMULATION_CHANGED');
 const extraction=structuredClone(row.snapshot.extraction);
 for(const change of changes){
  const input=extraction.inputs.find(i=>i.id===change.id);if(!input||input.kind==='FACT')throw Error('SIMULATION_BASELINE_IMMUTABLE');
  input.value=quantity({...input.value,min:change.min,max:change.max} as Quantity);
  input.kind='USER_ASSUMPTION';input.source='USER_MESSAGE';input.reference='scenario_editor';input.quote=JSON.stringify({min:change.min,max:change.max});
 }
 const simulation=buildSimulation(row.snapshot.intent,extraction);
 // Editing assumptions invalidates the old strategic recommendation. Recalculation itself is free of AI calls.
 simulation.readiness='NOT_READY';simulation.status='WAITING_FOR_INFORMATION';simulation.limitations.push('STRATEGIC_REVIEW_REQUIRED_AFTER_EDIT');
 const saved=await db.rpc('revise_decision_simulation',{p_user:c.userId,p_company:c.companyId,p_id:id,p_version:version,p_snapshot:simulation});
 if(saved.error)throw Error('SIMULATION_CHANGED');revalidatePath('/');return Number(saved.data);
}
export async function acceptScenario(companyId:string,id:string,version:number,scenario:string){
 const {c,db,row}=await owner(companyId,id);const commercial=await commercialContext();
 if(!commercial.flags.decisions)throw Error('SIMULATION_PLAN_REQUIRED');
 if(!Number.isSafeInteger(version)||!row.snapshot.scenarios.some(s=>s.id===scenario))throw Error('SIMULATION_CHANGED');
 const r=await db.rpc('accept_decision_scenario',{p_user:c.userId,p_company:c.companyId,p_id:id,p_version:version,p_scenario:scenario});
 if(r.error)throw Error('SIMULATION_CHANGED');revalidatePath('/');return String(r.data);
}
export async function readSimulationResults(companyId:string,id:string):Promise<ObservedResult[]>{
 const {c,db,row}=await owner(companyId,id);
 const filters=[row.decision_id?'decision_id.eq.'+row.decision_id:null,row.plan_id?'plan_id.eq.'+row.plan_id:null,row.experiment_id?'experiment_id.eq.'+row.experiment_id:null].filter(Boolean);
 if(!filters.length)return [];
 const results=await db.from('execution_results').select('id,description,metric_type,observed_value,unit,currency_code,period_start,period_end,created_at').eq('company_id',c.companyId).or(filters.join(',')).order('created_at',{ascending:false}).limit(10);
 if(results.error)throw Error('SIMULATION_UNAVAILABLE');return results.data as ObservedResult[];
}
export async function compareSimulationResult(companyId:string,id:string,inputId:string,resultId:string,confirmComparable:boolean){
 const {c,db,row}=await owner(companyId,id);
 if(!confirmComparable||!validId(resultId)||row.status!=='ACCEPTED')throw Error('SIMULATION_COMPARABILITY_REQUIRED');
 const chosen=row.snapshot.scenarios.find(s=>s.id===row.selected_scenario);
 const input=row.snapshot.extraction.inputs.find(i=>i.id===inputId&&i.kind!=='FACT'&&chosen?.assumption_ids.includes(i.id));if(!input)throw Error('SIMULATION_ASSUMPTION_INVALID');
 const results=await readSimulationResults(companyId,id),result=results.find(r=>r.id===resultId);if(!result)throw Error('SIMULATION_RESULT_UNAVAILABLE');
 const decision=await db.from('decisions').select('decision_date').eq('id',row.decision_id).eq('company_id',c.companyId).single();if(decision.error)throw Error('SIMULATION_UNAVAILABLE');
 // User explicitly confirms the same metric/unit/scope; dates and currency still require software compatibility.
 const assessment=assessAssumptions({...row.snapshot,extraction:{...row.snapshot.extraction,inputs:[input]}},[{...result,metric_type:input.id,unit:input.value.unit}],input.value.scope,decision.data.decision_date)[0];
 if(!assessment)throw Error('SIMULATION_RESULT_UNAVAILABLE');
 const locale=await getLocale();
 const messages={
  'pt-BR':{SUPPORTED:'A observação é compatível com a premissa. Isso não comprova causalidade.',NOT_SUPPORTED:'A observação ficou fora do intervalo da premissa. Revise a estratégia; isso não comprova causalidade.',UNKNOWN:'Não foi possível estabelecer uma comparação segura entre a premissa e o resultado.'},
  'pt-PT':{SUPPORTED:'A observação é compatível com a premissa. Isto não comprova causalidade.',NOT_SUPPORTED:'A observação ficou fora do intervalo da premissa. Reveja a estratégia; isto não comprova causalidade.',UNKNOWN:'Não foi possível estabelecer uma comparação segura entre a premissa e o resultado.'},
  'en-US':{SUPPORTED:'The observation is compatible with the assumption. This does not establish causality.',NOT_SUPPORTED:'The observation fell outside the assumed range. Review the strategy; this does not establish causality.',UNKNOWN:'A reliable comparison between the assumption and the result could not be established.'},
  'es-ES':{SUPPORTED:'La observación es compatible con la premisa. Esto no demuestra causalidad.',NOT_SUPPORTED:'La observación quedó fuera del intervalo supuesto. Revisa la estrategia; esto no demuestra causalidad.',UNKNOWN:'No se pudo establecer una comparación fiable entre la premisa y el resultado.'},
 };
 const summary=input.label+': '+messages[locale][assessment.status];
 const saved=await db.rpc('record_simulation_assessment',{p_user:c.userId,p_company:c.companyId,p_id:id,p_result:resultId,p_assessment:assessment,p_summary:summary});
 if(saved.error)throw Error('SIMULATION_SAVE_FAILED');revalidatePath('/');return summary;
}
