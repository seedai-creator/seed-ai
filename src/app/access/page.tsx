import Link from 'next/link';
import {redirect} from 'next/navigation';
import {createSupabaseServer} from '@/lib/supabase/server';
import {Brand} from '@/components/brand';
import {SupportContact} from '@/components/support-contact';
import {getLocale} from '@/lib/i18n/server';
import {operationCopy} from '@/lib/operations/copy';
import {operationsEnabled} from '@/lib/operations/server';
import {acceptTerms} from './actions';
import {logout} from '../auth/actions';
export const dynamic='force-dynamic';
export default async function AccessPage({searchParams}:{searchParams:Promise<{error?:string}>}){
 const client=await createSupabaseServer(),locale=await getLocale(),copy=operationCopy(locale);
 const {data,error}=await client.auth.getUser();if(error||!data.user)redirect('/login');
 if(!operationsEnabled())redirect('/companies');
 const allowed=await client.rpc('operations_user_allowed');
 const accepted=await client.rpc('operations_terms_current');
 if(allowed.data===true&&accepted.data===true)redirect('/companies');
 const documents=await client.from('legal_documents').select('id,kind,version').eq('locale',locale).eq('approved',true).order('published_at',{ascending:false}).order('id').limit(20);
 const terms=documents.data?.find(d=>d.kind==='TERMS'),privacy=documents.data?.find(d=>d.kind==='PRIVACY');
 const query=await searchParams;
 return <main className="account-shell"><Brand/><section className="account-card"><h1>{copy.beta}</h1>{allowed.data!==true?<p>{copy.betaNote}</p>:<><h2>{copy.legal}</h2>{terms&&privacy?<form action={acceptTerms} className="account-form"><input type="hidden" name="terms" value={terms.id}/><input type="hidden" name="privacy" value={privacy.id}/><p><Link href="/legal/terms" target="_blank" rel="noopener noreferrer">{copy.terms} · {terms.version}</Link></p><p><Link href="/legal/privacy" target="_blank" rel="noopener noreferrer">{copy.privacy} · {privacy.version}</Link></p><label className="commercial-check"><input type="checkbox" name="accepted" required/>{copy.agree}</label><button className="send-button">{copy.accept}</button></form>:<p>{copy.unavailable}</p>}</>}{query.error&&<p role="alert" className="error">{copy.error}</p>}<Link href="/support">{copy.support}</Link><SupportContact locale={locale}/><form action={logout}><button className="text-button">{copy.logout}</button></form></section></main>;
}
