'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireAdmin} from '@/lib/commercial/server';
import {validEmail,validId} from '@/lib/auth/validation';
import {operationsEnabled} from '@/lib/operations/server';
export async function changeOperations(form:FormData){
 const actor=await requireAdmin('SUPER_ADMIN');
 if(!operationsEnabled())redirect('/admin/operations?error=1');
 const kind=String(form.get('kind')??''),key=String(form.get('key')??'').trim(),reason=String(form.get('reason')??'').trim(),version=Number(form.get('version'));
 if(form.get('confirmed')!=='on'||reason.length<5||reason.length>1000||!Number.isSafeInteger(version)||version<0)redirect('/admin/operations?error=1');
 let value:unknown;
 if(kind==='controls'&&['closed_beta','disable_ai','disable_uploads'].includes(key))value=form.get('enabled')==='on';
 else if(kind==='controls'&&['paused_features','blocked_models'].includes(key))value=String(form.get('values')??'').split(',').map(x=>x.trim()).filter(Boolean);
 else if((kind==='invitation'&&validEmail(key)&&key===key.toLowerCase())||(kind==='access'&&validId(key))){
  const rawExpires=String(form.get('expires')??''),cohort=String(form.get('cohort')??'').trim();
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(rawExpires))redirect('/admin/operations?error=1');
  const expires=rawExpires+'Z';
  if(!Number.isFinite(Date.parse(expires))||Date.parse(expires)<=Date.now()||cohort.length<1||cohort.length>80)redirect('/admin/operations?error=1');
  value={cohort,expires_at:new Date(expires).toISOString(),disabled:form.get('disabled')==='on',revoked:form.get('disabled')==='on'};
 }else redirect('/admin/operations?error=1');
 const result=await actor.db.rpc('operations_change',{p_actor:actor.user.id,p_kind:kind,p_key:key,p_value:value,p_version:version,p_reason:reason});
 if(result.error)redirect('/admin/operations?error=1');
 revalidatePath('/admin/operations');redirect('/admin/operations?updated=1');
}
export async function resolveSupport(form:FormData){
 const actor=await requireAdmin('ADMIN_OPERATOR'),id=form.get('id'),version=Number(form.get('version')),status=String(form.get('status')),reason=String(form.get('reason')??'').trim();
 if(!operationsEnabled()||!validId(id)||!Number.isSafeInteger(version)||!['IN_REVIEW','AWAITING_USER','RESOLVED','CANCELLED'].includes(status)||reason.length<5||form.get('confirmed')!=='on')redirect('/admin/operations?error=1');
 const result=await actor.db.rpc('resolve_support_request',{p_actor:actor.user.id,p_id:id,p_version:version,p_status:status,p_reason:reason});
 if(result.error)redirect('/admin/operations?error=1');
 revalidatePath('/admin/operations');redirect('/admin/operations?updated=1');
}
