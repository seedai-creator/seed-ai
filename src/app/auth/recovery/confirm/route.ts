import { NextResponse, type NextRequest } from 'next/server';
import { confirmRecovery } from '@/lib/auth/recovery';
import { boundedBody, trustedOrigin } from '@/lib/operations/http';
import { createSupabaseServer } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  const next = (path: '/reset-password' | '/forgot-password?recovery=invalid') =>
    request.headers.get('accept') === 'application/json'
      ? NextResponse.json({ next: path }, { headers: { 'Cache-Control': 'private, no-store' } })
      : NextResponse.redirect(new URL(path, request.url), 303);
  const fail = () => next('/forgot-password?recovery=invalid');
  if (!site || !request.headers.get('origin') || !trustedOrigin(request, site)) {
    return new NextResponse(null, { status: 403 });
  }
  try {
    if (request.headers.get('content-type')?.split(';')[0] !== 'application/x-www-form-urlencoded') return fail();
    const form = new URLSearchParams(await boundedBody(request, 1024));
    if (form.getAll('token_hash').length !== 1) return fail();
    const client = await createSupabaseServer();
    if (await confirmRecovery(client, form.get('token_hash'))) {
      return next('/reset-password');
    }
  } catch { /* Never include a recovery token or provider response in logs. */ }
  return fail();
}
