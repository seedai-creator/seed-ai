import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Brand } from '@/components/brand';
import { RecoveryConfirmation } from '@/components/recovery-confirmation';
import { validRecoveryToken } from '@/lib/auth/recovery';
import { getLocale } from '@/lib/i18n/server';
import { recoveryCopy } from '@/lib/operations/recovery-copy';

export const dynamic = 'force-dynamic';

export default async function RecoveryLink({ searchParams }: {
  searchParams: Promise<{ token_hash?: string | string[]; type?: string | string[] }>;
}) {
  const params = await searchParams;
  if (params.type !== 'recovery' || !validRecoveryToken(params.token_hash)) {
    redirect('/forgot-password?recovery=invalid');
  }
  const copy = recoveryCopy(await getLocale());
  // GET intentionally does not consume the single-use link. Email security
  // scanners may fetch it before its recipient opens the message.
  return <main className="account-shell"><Brand /><section className="account-card">
    <h1>{copy.title}</h1><p>{copy.continueDescription}</p>
    <RecoveryConfirmation token={params.token_hash} copy={copy} />
    <Link href="/login">{copy.back}</Link>
  </section></main>;
}
