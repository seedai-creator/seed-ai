import { ChatError } from '../chat/contracts';

export async function boundedBody(request:Request, maxBytes:number, timeoutMs=10000):Promise<string> {
  if (!request.body) throw new ChatError(400,'INVALID_BODY','Envie uma solicitação válida.');
  const declared=request.headers.get('content-length');
  if(declared && (!/^\d+$/.test(declared)||Number(declared)>maxBytes)) throw new ChatError(413,'TOO_LARGE','A solicitação é muito grande.');
  const reader=request.body.getReader();
  const chunks:Uint8Array[]=[];
  let size=0;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{void reader.cancel().catch(()=>{});reject(new ChatError(408,'BODY_TIMEOUT','O envio demorou demais. Tente novamente.'));},timeoutMs);});
  try {
    await Promise.race([(async()=>{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new ChatError(413,'TOO_LARGE','A solicitação é muito grande.');}chunks.push(value);}})(),deadline]);
    const bytes=new Uint8Array(size);let offset=0;
    for(const part of chunks){bytes.set(part,offset);offset+=part.length;}
    try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new ChatError(400,'INVALID_ENCODING','Envie um texto válido.');}
  } finally {clearTimeout(timer);reader.releaseLock();}
}

export function trustedOrigin(request:Request, configuredSite?:string) {
  const origin=request.headers.get('origin');
  const fetchSite=request.headers.get('sec-fetch-site');
  if(fetchSite==='cross-site')return false;
  if(!origin)return !fetchSite||fetchSite==='same-origin'||fetchSite==='none';
  try {
    // Never trust Host or X-Forwarded-Host supplied by the caller as an allowlist.
    const expected=new URL(configuredSite||request.url).origin;
    return new URL(origin).origin===origin&&origin===expected;
  }catch{return false;}
}

export function securityHeaders(nonce:string,development:boolean,https:boolean) {
  const csp=["default-src 'self'",`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development?" 'unsafe-eval'":''}`,"style-src 'self' 'unsafe-inline'","img-src 'self' data: blob:","font-src 'self'","connect-src 'self'"+(development?' ws:':''),"object-src 'none'","base-uri 'none'","form-action 'self' https://checkout.stripe.com https://billing.stripe.com","frame-ancestors 'none'",...(https?['upgrade-insecure-requests']:[])].join('; ');
  return {
    // no-referrer makes Chromium native POST navigations send Origin: null,
    // which Server Actions must reject. strict-origin preserves origin checks
    // while withholding paths, query strings and callback codes from referrers.
    'Content-Security-Policy':csp,'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin',
    'Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=()', 'X-Frame-Options':'DENY',
    ...(https?{'Strict-Transport-Security':'max-age=31536000'}:{}),
  };
}
