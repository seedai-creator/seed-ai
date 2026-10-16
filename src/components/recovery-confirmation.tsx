'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { RecoveryCopy } from '@/lib/operations/recovery-copy';

export function RecoveryConfirmation({ token, copy }: { token: string; copy: RecoveryCopy }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setFailed(false);
    try {
      const response = await fetch('/auth/recovery/confirm', {
        method: 'POST',
        headers: { accept: 'application/json' },
        body: new URLSearchParams({ token_hash: token }),
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error('RECOVERY_FAILED');
      const result: unknown = await response.json();
      const next = result && typeof result === 'object' && 'next' in result ? result.next : null;
      if (next === '/reset-password') router.replace('/reset-password');
      else if (next === '/forgot-password?recovery=invalid') router.replace('/forgot-password?recovery=invalid');
      else throw new Error('RECOVERY_FAILED');
    } catch {
      setFailed(true);
      setPending(false);
    }
  }

  return <form action="/auth/recovery/confirm" method="post" className="account-form" onSubmit={confirm} aria-busy={pending}>
    <input type="hidden" name="token_hash" value={token} />
    {failed && <p className="error" role="alert">{copy.error}</p>}
    <button type="submit" className="send-button" disabled={pending}>{pending ? copy.checking : copy.continueRecovery}</button>
  </form>;
}
