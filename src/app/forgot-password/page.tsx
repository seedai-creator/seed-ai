import Link from 'next/link';
import {getLocale} from '@/lib/i18n/server';
import {recoveryCopy} from '@/lib/operations/recovery-copy';
import {RecoveryForm} from '@/components/recovery-form';
import {Brand} from '@/components/brand';
export const dynamic='force-dynamic';
export default async function ForgotPassword({searchParams}:{searchParams:Promise<{recovery?:string}>}){const copy=recoveryCopy(await getLocale());const params=await searchParams;return <main className="account-shell"><Brand/><section className="account-card"><h1>{copy.title}</h1>{params.recovery==='invalid'&&<p className="error" role="alert">{copy.invalidLink}</p>}<RecoveryForm copy={copy}/><Link href="/login">{copy.back}</Link></section></main>;}
