import { isIP } from 'node:net';

// Only Vercel's trusted edge value is accepted. No cookies, URLs, user agent,
// user ID or query strings enter this evidence store. Never trust this locally.
export function accessEvidence(headers: Headers, pathname: string, env: {enabled?:string;vercel?:string}) {
  if(env.enabled!=='true' || pathname==='/seedai' || pathname.startsWith('/seedai/')
    || pathname.startsWith('/_next/') || pathname.startsWith('/api/internal/')
    || pathname.startsWith('/api/billing/')) return null;
  if(env.vercel!=='1') throw new Error('ACCESS_TRUSTED_EDGE_REQUIRED');
  const ip=headers.get('x-vercel-forwarded-for');
  if(!ip || !isIP(ip)) throw new Error('ACCESS_IP_UNAVAILABLE');
  return {ip};
}
