'use server';
import {after} from 'next/server';
import {companyContext} from '@/lib/auth/context';
import {readMap,requestMap,processGrowthJob,mapHistory,dimensionDetails,type MapFilter,DEFAULT_FILTER} from '@/lib/growth/server';
import type {Dimension} from '@/lib/growth/domain';
export async function readGrowth(company:string,filter:MapFilter=DEFAULT_FILTER){const c=await companyContext(company);return readMap(c.companyId,c.userId,filter);}
export async function refreshGrowth(company:string,filter:MapFilter=DEFAULT_FILTER){const c=await companyContext(company);await requestMap(c.companyId,c.userId,filter);after(async()=>{await processGrowthJob(c.companyId);});return {queued:true};}
export async function readGrowthHistory(company:string,filter:MapFilter,offset:number,from:string|null=null,to:string|null=null){const c=await companyContext(company);return mapHistory(c.companyId,c.userId,filter,offset,from,to);}
export async function readGrowthDimension(company:string,snapshot:string,dimension:Dimension){const c=await companyContext(company);return dimensionDetails(c.companyId,c.userId,snapshot,dimension);}
