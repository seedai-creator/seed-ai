import Link from 'next/link';
import {redirect} from 'next/navigation';
import {createSupabaseServer} from '@/lib/supabase/server';
import {Brand} from '@/components/brand';
import {SupportForm} from '@/components/support-form';
import {getLocale} from '@/lib/i18n/server';
import {operationCopy} from '@/lib/operations/copy';
import {operationsEnabled} from '@/lib/operations/server';
export const dynamic='force-dynamic';
export default async function SupportPage(){
 const locale=await getLocale(),copy=operationCopy(locale);
 const client=await createSupabaseServer();const {data,error}=await client.auth.getUser();
 if(error||!data.user)redirect('/login');
 const active=operationsEnabled();
 const result=active?await client.from('support_requests').select('id,category,status,created_at').eq('user_id',data.user.id).order('created_at',{ascending:false}).limit(30):null;
 return <main className="account-shell"><Brand/><section className="account-card"><Link href="/">{copy.back}</Link><h1>{copy.support}</h1><p>{copy.intro}</p>{active?<><SupportForm copy={copy}/><h2>{copy.requests}</h2>{result?.error?<p role="alert">{copy.error}</p>:!result?.data?.length?<p>{copy.empty}</p>:<ul>{result.data.map(r=><li key={r.id}>{copy[r.category as keyof typeof copy]??r.category} · {copy[r.status as keyof typeof copy]??r.status} · <time dateTime={r.created_at}>{new Intl.DateTimeFormat(locale,{dateStyle:'short'}).format(new Date(r.created_at))}</time></li>)}</ul>}</>:<p>{copy.unavailable}</p>}</section></main>;
}
