import Link from 'next/link';
import {notFound} from 'next/navigation';
import {createSupabaseServer} from '@/lib/supabase/server';
import {getLocale} from '@/lib/i18n/server';
import {operationCopy} from '@/lib/operations/copy';
import {operationsEnabled} from '@/lib/operations/server';
import {Brand} from '@/components/brand';
export const dynamic='force-dynamic';
export default async function LegalPage({params}:{params:Promise<{kind:string}>}){
 const {kind}=await params;if(!['terms','privacy'].includes(kind))notFound();
 const locale=await getLocale(),copy=operationCopy(locale);
 const client=await createSupabaseServer();
 const result=operationsEnabled()?await client.from('legal_documents').select('content,version,published_at').eq('kind',kind==='terms'?'TERMS':'PRIVACY').eq('locale',locale).eq('approved',true).order('published_at',{ascending:false}).order('id').limit(1).maybeSingle():null;
 return <main className="account-shell"><Brand/><article className="account-card"><h1>{kind==='terms'?copy.terms:copy.privacy}</h1>{result?.data?<><p>{copy.version}: {result.data.version}</p><div style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{result.data.content}</div></>:<p>{copy.unavailable}</p>}<Link href="/access">{copy.back}</Link></article></main>;
}
