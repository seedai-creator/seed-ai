'use server';
import {redirect} from 'next/navigation';
import {createSupabaseServer} from '@/lib/supabase/server';
import {getLocale} from '@/lib/i18n/server';
import {validId} from '@/lib/auth/validation';
import {operationsEnabled} from '@/lib/operations/server';
export async function acceptTerms(form:FormData){
 if(!operationsEnabled()||form.get('accepted')!=='on')redirect('/access?error=1');
 const terms=form.get('terms'),privacy=form.get('privacy');
 if(!validId(terms)||!validId(privacy))redirect('/access?error=1');
 const client=await createSupabaseServer();const {data,error}=await client.auth.getUser();
 if(error||!data.user)redirect('/login');
 const result=await client.rpc('accept_legal_documents',{p_terms:String(terms),p_privacy:String(privacy),p_locale:await getLocale()});
 if(result.error)redirect('/access?error=1');
 redirect('/companies');
}
