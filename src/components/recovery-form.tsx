'use client';
import {useActionState} from 'react';
import {requestRecovery,updatePassword} from '@/app/auth/recovery-actions';
import type {RecoveryCopy} from '@/lib/operations/recovery-copy';
export function RecoveryForm({copy,reset=false}:{copy:RecoveryCopy;reset?:boolean}){
 const [state,action,pending]=useActionState(reset?updatePassword:requestRecovery,{});
 return <form action={action} className="account-form">{reset?<><label>{copy.password}<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required disabled={pending}/></label><label>{copy.confirm}<input name="confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={128} required disabled={pending}/></label></>:<label>{copy.email}<input name="email" type="email" autoComplete="email" maxLength={254} required disabled={pending}/></label>}{state.error&&<p className="error" role="alert">{state.error}</p>}{state.success&&<p role="status">{state.success}</p>}<button className="send-button" disabled={pending}>{reset?copy.save:copy.send}</button></form>;
}
