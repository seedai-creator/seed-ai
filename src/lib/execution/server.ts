import 'server-only';
import {commercialDatabase,commercialContextForUser} from '../commercial/server';
import {type ExecutionRow,type ExecutionSnapshot,relevantExecution} from './domain';
export async function executionSnapshot(company:string,user:string):Promise<ExecutionSnapshot>{
 const db=commercialDatabase();
 const member=await db.from('company_members').select('user_id').eq('company_id',company).eq('user_id',user).maybeSingle();if(member.error||!member.data)throw Error('EXECUTION_ACCESS_DENIED');
 const commercial=await commercialContextForUser({id:user});
 const count=await db.from('strategies').select('id',{count:'exact',head:true}).eq('created_by',user);
 if(count.error)throw Error('EXECUTION_UNAVAILABLE');
 const allowed_operations=['ACTION','RESULT','REVIEW'];
 if(commercial.flags.strategies&& (commercial.plan.strategy_limit===null||(count.count??0)<commercial.plan.strategy_limit))allowed_operations.push('ACCEPT');
 if(commercial.flags.decisions)allowed_operations.push('DECISION','DECISION_STATUS');
 if(commercial.flags.experiments)allowed_operations.push('EXPERIMENT','EXPERIMENT_STATUS');
 const tables=['recommendations','strategies','actions','decisions','experiments','execution_results','execution_learnings','weekly_intelligence_reports'] as const;
 const rows=await Promise.all(tables.map(table=>{
  let q=db.from(table).select('*').eq('company_id',company);
  if(table==='recommendations')q=q.in('status',['PROPOSED','ACCEPTED','IN_EXECUTION']);
  // Include recent closed plans for continuity; prioritization selects only active work.
  if(table==='weekly_intelligence_reports')q=q.eq('status','AVAILABLE');
  return q.order(table==='weekly_intelligence_reports'?'generated_at':'created_at',{ascending:false}).limit(table==='actions'?60:table==='weekly_intelligence_reports'?1:20);
 }));
 if(rows.some(r=>r.error))throw Error('EXECUTION_UNAVAILABLE');
 const [recommendations,plans,actions,decisions,experiments,results,learnings,weekly]=rows.map(r=>r.data!);
 let simulations:ExecutionRow[]=[];
 if(process.env.SEED_SIMULATOR_ENABLED==='true'){
  const rows=await db.from('decision_simulations').select('id,company_id,version,status,decision_id,plan_id,experiment_id,selected_scenario,question,conversation_id').eq('company_id',company).eq('user_id',user).eq('status','ACCEPTED').order('created_at',{ascending:false}).limit(5);
  if(rows.error)throw Error('SIMULATION_UNAVAILABLE');simulations=rows.data;
 }
 return {allowed_operations,simulations,recommendations,plans,actions,decisions,experiments,results,learnings,weekly} as unknown as ExecutionSnapshot;
}
export function executionMemory(snapshot:ExecutionSnapshot,message:string){
 const s=relevantExecution(snapshot,message);
 const entries: {key:string;kind:string;value:string;observed_at:string}[]=[];
 for(const [key,rows] of Object.entries(s)){
  if(!Array.isArray(rows))continue;
  for(const row of rows as ExecutionRow[]){
   const {id,version,status,description,decision,statement,evidence_level,observed_value,baseline_value,metric_type,unit,currency_code,period_start,period_end,summary}=row;
   const value=JSON.stringify({id,version,status,description,decision,statement,evidence_level,observed_value,baseline_value,metric_type,unit,currency_code,period_start,period_end,summary});
   if(!['results','decisions','learnings','weekly'].includes(key))continue;
   entries.push({key:'execution_'+key+'_'+row.id,kind:key==='results'?'RESULT':key==='decisions'?'DECISION':key==='learnings'?'LEARNING':key==='weekly'?'INFERENCE':'ACTION',value,observed_at:String(row.created_at??row.generated_at??'')});
  }
 }
 return entries;
}
