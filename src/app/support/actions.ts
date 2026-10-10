'use server';
import {revalidatePath} from 'next/cache';
import {createSupabaseServer} from '@/lib/supabase/server';
import {SUPPORT_CATEGORIES,operationCopy} from '@/lib/operations/copy';
import {getLocale} from '@/lib/i18n/server';
import {operationsEnabled} from '@/lib/operations/server';
import type {ActionState} from '@/lib/auth/validation';
export async function submitSupport(_state:ActionState,form:FormData):Promise<ActionState> {
 const copy=operationCopy(await getLocale());
 const category=String(form.get('category')??''),description=String(form.get('description')??'').trim();
 if(!operationsEnabled()||!SUPPORT_CATEGORIES.some(x=>x===category)||description.length<10||description.length>2000)return {error:copy.error};
 try{
  const client=await createSupabaseServer();const {data,error}=await client.auth.getUser();
  if(error||!data.user)return {error:copy.error};
  // Privacy/support intentionally remain available even if beta access is revoked.
  const result=await client.rpc('submit_support_request',{p_company:null,p_category:category,p_description:description});
  if(result.error)return {error:copy.error};
  revalidatePath('/support');return {success:copy.sent};
 }catch{return {error:copy.error};}
}
