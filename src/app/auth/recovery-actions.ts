'use server';
import {redirect} from 'next/navigation';
import {cookies} from 'next/headers';
import {createSupabaseServer} from '@/lib/supabase/server';
import {validEmail,validPassword,type ActionState} from '@/lib/auth/validation';
import {getLocale} from '@/lib/i18n/server';
import {recoveryCopy} from '@/lib/operations/recovery-copy';
import {ACTIVE_COMPANY_COOKIE} from '@/lib/auth/context';
import {logEvent} from '@/lib/operations/logging';
export async function requestRecovery(_state:ActionState,form:FormData):Promise<ActionState>{
 const copy=recoveryCopy(await getLocale()),email=String(form.get('email')??'').trim();
 if(!validEmail(email))return {error:copy.error};
 try{
  const client=await createSupabaseServer(),site=process.env.NEXT_PUBLIC_SITE_URL;
  if(!site)return {error:copy.error};
  const result=await client.auth.resetPasswordForEmail(email,{redirectTo:new URL('/auth/callback?recovery=1',site).href});
  if(result.error)logEvent('auth.recovery',{code:'RECOVERY_SEND_FAILED'},'warn');
  // Identical answer whether the account exists or the provider refuses delivery.
  return {success:copy.sent};
 }catch{return {success:copy.sent};}
}
export async function updatePassword(_state:ActionState,form:FormData):Promise<ActionState>{
 const copy=recoveryCopy(await getLocale()),password=form.get('password');
 if(!validPassword(password)||password!==form.get('confirmation'))return {error:copy.error};
 try{
  const client=await createSupabaseServer(),{data,error}=await client.auth.getUser();
  if(error||!data.user)return {error:copy.expired};
  const result=await client.auth.updateUser({password:password as string});
  if(result.error)return {error:copy.error};
  const logout=await client.auth.signOut({scope:'global'});
  if(logout.error)logEvent('auth.recovery',{code:'SESSION_REVOCATION_FAILED',userId:data.user.id},'error');
  (await cookies()).delete(ACTIVE_COMPANY_COOKIE);
 }catch{return {error:copy.error};}
 redirect('/login');
}
