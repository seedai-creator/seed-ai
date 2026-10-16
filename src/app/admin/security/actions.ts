'use server';
import {redirect} from 'next/navigation';
import {adminIdentity} from '@/lib/commercial/server';
import {validId} from '@/lib/auth/validation';
import {adminMfaSatisfied} from '@/lib/auth/admin-security';
export type MfaState={error?:string;factorId?:string;qr?:string};
const failure='Não foi possível confirmar. Confira o código atual do autenticador e tente novamente.';
export async function enrollAdminMfa():Promise<MfaState>{
 try{
  const {supabase}=await adminIdentity();
  const factors=await supabase.auth.mfa.listFactors();
  if(factors.error)return {error:failure};
  if(factors.data.totp.length){
   const claims=await supabase.auth.getClaims();
   if(claims.error||!adminMfaSatisfied(claims.data?.claims))return {error:failure};
  }
  // Remove only abandoned enrollments owned by this same authenticated user.
  for(const factor of factors.data.all.filter(f=>f.status==='unverified'&&f.factor_type==='totp')){
   const removed=await supabase.auth.mfa.unenroll({factorId:factor.id});
   if(removed.error)return {error:failure};
  }
  const result=await supabase.auth.mfa.enroll({factorType:'totp',issuer:'SeedAI',friendlyName:'SeedAI Admin '+new Date().toISOString()});
  if(result.error)return {error:failure};
  return {factorId:result.data.id,qr:result.data.totp.qr_code};
 }catch{return {error:failure};}
}
export async function verifyAdminMfa(_state:MfaState,form:FormData):Promise<MfaState>{
 const factorId=form.get('factorId'),code=String(form.get('code')??'').trim();
 if(!validId(factorId)||!/^\d{6}$/.test(code))return {error:failure};
 try{
  const {supabase}=await adminIdentity();
  const factors=await supabase.auth.mfa.listFactors();
  if(factors.error||!factors.data.all.some(f=>f.id===factorId&&f.factor_type==='totp'))return {error:failure};
  const result=await supabase.auth.mfa.challengeAndVerify({factorId,code});
  if(result.error)return {error:failure};
  const claims=await supabase.auth.getClaims();
  if(claims.error||!adminMfaSatisfied(claims.data?.claims))return {error:failure};
 }catch{return {error:failure};}
 redirect('/admin');
}
