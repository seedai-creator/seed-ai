import {redirect} from 'next/navigation';
import {getLocale} from '@/lib/i18n/server';
import {recoveryCopy} from '@/lib/operations/recovery-copy';
import {RecoveryForm} from '@/components/recovery-form';
import {Brand} from '@/components/brand';
import {createSupabaseServer} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
export default async function ResetPassword(){const client=await createSupabaseServer();const {data,error}=await client.auth.getUser();if(error||!data.user)redirect('/forgot-password?recovery=invalid');const copy=recoveryCopy(await getLocale());return <main className="account-shell"><Brand/><section className="account-card"><h1>{copy.password}</h1><RecoveryForm copy={copy} reset/></section></main>;}
