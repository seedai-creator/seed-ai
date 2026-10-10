'use client';
import {useActionState,useState,useTransition} from 'react';
import Image from 'next/image';
import {enrollAdminMfa,verifyAdminMfa,type MfaState} from '@/app/admin/security/actions';
export function AdminMfaForm({factors}:{factors:{id:string;name:string}[]}){
 const [enrollment,setEnrollment]=useState<MfaState>({}),[enrolling,start]=useTransition();
 const [state,action,pending]=useActionState(verifyAdminMfa,{});
 const begin=()=>start(async()=>setEnrollment(await enrollAdminMfa()));
 return <>
  {!factors.length&&!enrollment.factorId&&<button className="primary-button" disabled={enrolling} onClick={begin}>{enrolling?'Preparando…':'Configurar autenticador'}</button>}
  {enrollment.qr&&<><p>Leia este QR no seu aplicativo autenticador. Não compartilhe esta imagem.</p><Image unoptimized src={enrollment.qr} alt="QR para cadastrar o autenticador da sua conta" width={240} height={240}/></>}
  {(enrollment.factorId||factors.length>0)&&<form action={action} className="account-form">
   {enrollment.factorId?<input type="hidden" name="factorId" value={enrollment.factorId}/>:<label>Autenticador<select name="factorId">{factors.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>}
   <label>Código de seis dígitos<input name="code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} required disabled={pending}/></label>
   <button className="primary-button" disabled={pending}>{pending?'Confirmando…':'Confirmar e acessar'}</button>
  </form>}
  {(state.error||enrollment.error)&&<p role="alert">{state.error||enrollment.error}</p>}
 </>;
}
