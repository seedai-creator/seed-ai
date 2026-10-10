import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    try {
      const client = await createSupabaseServer();
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(request.nextUrl.searchParams.get('recovery')==='1'?'/reset-password':'/companies', request.url));
    } catch { /* Never include provider errors or tokens in redirects. */ }
  }
  return NextResponse.redirect(new URL("/login?confirmation=failed", request.url));
}
