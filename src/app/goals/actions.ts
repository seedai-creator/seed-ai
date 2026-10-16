'use server';
import {companyContext} from '@/lib/auth/context';
import {goalsEnabled,goalSnapshot,saveGoal,recordMetric,goalHistory,metricSeries} from '@/lib/goals/server';
import type {Goal} from '@/lib/goals/domain';
async function access(company:string){if(!goalsEnabled())throw Error('GOALS_DISABLED');return companyContext(company);}
export async function readGoals(company:string){const c=await access(company);return goalSnapshot(c.companyId,c.userId);}
export async function writeGoal(company:string,id:string|null,version:number,spec:unknown,status:Goal['status'],reason:string,key:string){const c=await access(company);return saveGoal(c.companyId,c.userId,id,version,spec,status,reason,key);}
export async function writeMetric(company:string,id:string|null,version:number,data:unknown,reason:string,key:string){const c=await access(company);return recordMetric(c.companyId,c.userId,id,version,data,reason,key);}
export async function readGoalHistory(company:string,id:string){const c=await access(company);return goalHistory(c.companyId,c.userId,id);}
export async function readMetricSeries(company:string,metric:string,offset:number){const c=await access(company);return metricSeries(c.companyId,c.userId,metric,offset);}
