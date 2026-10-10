import Link from 'next/link';
import {getLocale} from '@/lib/i18n/server';
import {recoveryCopy} from '@/lib/operations/recovery-copy';
import {RecoveryForm} from '@/components/recovery-form';
import {Brand} from '@/components/brand';
export const dynamic='force-dynamic';
export default async function ForgotPassword(){const copy=recoveryCopy(await getLocale());return <main className="account-shell"><Brand/><section className="account-card"><h1>{copy.title}</h1><RecoveryForm copy={copy}/><Link href="/login">{copy.back}</Link></section></main>;}
