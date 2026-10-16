import type { SupabaseClient } from '@supabase/supabase-js';
import { validPassword } from './validation';

export function validRecoveryToken(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{20,256}$/.test(value);
}

// The application chooses the verification flow, never a caller-supplied type.
// Supabase uses a shared verifier for recovery and email magic-link tokens;
// possession is authenticated by the provider, not inferred from URL metadata.
export async function confirmRecovery(client: SupabaseClient, token: unknown) {
  if (!validRecoveryToken(token)) return false;
  const { data, error } = await client.auth.verifyOtp({ token_hash: token, type: 'recovery' });
  return !error && Boolean(data.user && data.session);
}

export type PasswordRecoveryResult =
  | { status: 'invalid' | 'expired' | 'failed' }
  | { status: 'updated'; userId: string; revocationFailed: boolean };

export async function completePasswordRecovery(
  client: SupabaseClient,
  password: unknown,
  confirmation: unknown,
): Promise<PasswordRecoveryResult> {
  if (!validPassword(password) || password !== confirmation) return { status: 'invalid' };
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return { status: 'expired' };
  const updated = await client.auth.updateUser({ password });
  if (updated.error) return { status: 'failed' };
  const logout = await client.auth.signOut({ scope: 'global' });
  return { status: 'updated', userId: data.user.id, revocationFailed: Boolean(logout.error) };
}
