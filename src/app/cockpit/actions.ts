'use server';
import {authorizeChat,companyContext} from '@/lib/auth/context';
import {getLocale} from '@/lib/i18n/server';
import {readCockpit,resolveCockpit,recordCockpitEvent,type CockpitEvent} from '@/lib/cockpit/server';
async function context(company:string){await authorizeChat({companyId:company});return companyContext(company);}
export async function readHome(company:string){const c=await context(company);return readCockpit(c.companyId,c.userId,await getLocale());}
export async function openHomeItem(company:string,reference:unknown){const c=await context(company);return resolveCockpit(c.companyId,c.userId,await getLocale(),reference);}
export async function dismissHomeItem(company:string,reference:unknown){const c=await context(company);await resolveCockpit(c.companyId,c.userId,await getLocale(),reference,true);}
export async function homeEvent(company:string,event:CockpitEvent){const c=await context(company);await recordCockpitEvent(c.companyId,c.userId,event);}
