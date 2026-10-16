"use server";
import {authorizeChat,companyContext} from '@/lib/auth/context';
import {validId} from '@/lib/auth/validation';
import {executionSnapshot} from '@/lib/execution/server';
import {commercialDatabase} from '@/lib/commercial/server';
import {revalidatePath} from 'next/cache';
export async function readExecution(companyId:string){const c=await companyContext(companyId);return executionSnapshot(c.companyId,c.userId);}
export async function acceptRecommendation(companyId:string,id:string,version:number,simulationId?:string){
 await authorizeChat({companyId});const c=await companyContext(companyId);
 if(!validId(id)||!Number.isSafeInteger(version)||version<1)throw Error('INVALID_RECOMMENDATION');
 if(simulationId&&(!validId(simulationId)||process.env.SEED_SIMULATOR_ENABLED!=='true'))throw Error('INVALID_SIMULATION');
 const params={p_user:c.userId,p_company:c.companyId,p_id:id,p_version:version};
 const r=simulationId?await commercialDatabase().rpc('accept_simulation_plan',{...params,p_simulation:simulationId}):await commercialDatabase().rpc('accept_execution_recommendation',params);
 if(r.error)throw Error('EXECUTION_CHANGED');revalidatePath('/');return String(r.data);
}
