import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "./lib/supabase/config";

function protectRecovery(request: NextRequest, response: NextResponse) {
  if (request.nextUrl.pathname.startsWith('/auth/') || ['/forgot-password','/reset-password'].includes(request.nextUrl.pathname)) {
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('Referrer-Policy', 'strict-origin');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
  }
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  protectRecovery(request, response);
  const config = supabaseConfig();
  if (!config) return response;
  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        for (const { name, value } of values) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of values) response.cookies.set(name, value, options);
        response.headers.set("Cache-Control", "private, no-store");
        protectRecovery(request, response);
      },
    },
  });
  try { await supabase.auth.getClaims(); }
  catch { /* Access is checked again by each protected page, action and API. */ }
  return response;
}
export const config = {
  matcher: ["/", "/login", "/companies", "/auth/:path*", "/forgot-password", "/reset-password", "/api/chat"],
};
