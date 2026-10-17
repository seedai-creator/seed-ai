import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "./lib/supabase/config";
import {securityHeaders} from './lib/operations/http';
import {recordApplicationAccess} from './lib/operations/access-retention-server';

export async function proxy(request: NextRequest) {
  const nonce=Buffer.from(crypto.randomUUID()).toString('base64');
  const headers=securityHeaders(nonce,process.env.NODE_ENV==='development',request.nextUrl.protocol==='https:');
  const next=()=>{
    const incoming=new Headers(request.headers);
    incoming.set('x-nonce',nonce);
    incoming.set('Content-Security-Policy',headers['Content-Security-Policy']);
    const result=NextResponse.next({request:{headers:incoming}});
    result.headers.set('Cache-Control','private, no-store');
    for(const [key,value] of Object.entries(headers))result.headers.set(key,value);
    return result;
  };
  let response = next();
  try { await recordApplicationAccess(request.headers,request.nextUrl.pathname); }
  catch {
    // Fail closed for app access when evidence storage is enabled but unavailable.
    // Do not serialize the request, IP, provider error or authentication material.
    return new NextResponse('Serviço temporariamente indisponível.',{status:503,headers:{...headers,'Cache-Control':'no-store'}});
  }
  if(request.nextUrl.pathname.startsWith('/api/internal/')||request.nextUrl.pathname.startsWith('/api/billing/'))return response;
  const config = supabaseConfig();
  if (!config) return response;
  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        for (const { name, value } of values) request.cookies.set(name, value);
        response = next();
        for (const { name, value, options } of values) response.cookies.set(name, value, options);
        response.headers.set("Cache-Control", "private, no-store");
      },
    },
  });
  try { await supabase.auth.getClaims(); }
  catch { /* Access is checked again by each protected page, action and API. */ }
  return response;
}
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2)$).*)'],
};
