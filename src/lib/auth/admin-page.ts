import 'server-only';
import {notFound,redirect} from 'next/navigation';
import {requireAdmin} from '../commercial/server';
import {ChatError} from '../chat/contracts';
import type {AdminRole} from './admin-security';
export async function adminPageAccess(minimum:AdminRole='ADMIN_VIEWER') {
 try{return await requireAdmin(minimum);}
 catch(error){
  if(error instanceof ChatError&&error.code==='ADMIN_MFA_REQUIRED')redirect('/admin/security');
  notFound();
 }
}
