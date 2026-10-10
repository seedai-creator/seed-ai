'use client';
import {useActionState} from 'react';
import {submitSupport} from '@/app/support/actions';
import {SUPPORT_CATEGORIES,type OperationCopy} from '@/lib/operations/copy';
export function SupportForm({copy}:{copy:OperationCopy}){
 const [state,action,pending]=useActionState(submitSupport,{});
 return <form action={action} className="account-form"><label>{copy.category}<select name="category" disabled={pending}>{SUPPORT_CATEGORIES.map(c=><option key={c} value={c}>{copy[c]}</option>)}</select></label><label>{copy.description}<textarea name="description" rows={5} minLength={10} maxLength={2000} required disabled={pending}/></label><p className="account-note">{copy.privacyNote}</p>{state.error&&<p role="alert" className="error">{state.error}</p>}{state.success&&<p role="status">{state.success}</p>}<button className="send-button" disabled={pending}>{copy.send}</button></form>;
}
