// A monitor outside Vercel/Supabase can detect when those services cannot send
// their own alert. No database/admin/provider credentials belong in this job.
export async function checkOperationalHealth(env,transport=fetch) {
  const token=env.SEED_HEALTH_TOKEN;
  let url;try{url=new URL(env.SEED_HEALTH_URL);}catch{throw Error('HEALTH_MONITOR_CONFIGURATION');}
  const allowed=url.origin==='https://appseedai.com'||url.origin==='http://127.0.0.1:3002';
  if(!allowed||url.pathname!=='/api/internal/health'||url.search||url.hash||url.username||url.password
    ||!token||!/^[A-Za-z0-9_-]{32,256}$/.test(token))throw Error('HEALTH_MONITOR_CONFIGURATION');
  try {
    const response=await transport(url,{headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(8000)});
    if(response.status!==200){await response.body?.cancel();return {healthy:false,code:'HTTP_FAILURE'};}
    const body=await response.json();
    const expected=['DATABASE','SCHEDULER','ALERT_DELIVERY'];
    const healthy=body?.status==='ok'&&Array.isArray(body.checks)&&body.checks.length===expected.length
      &&expected.every(code=>body.checks.filter(c=>c?.code===code&&c.healthy===true).length===1);
    return {healthy,code:healthy?'HEALTHY':'INVALID_HEALTH_RESPONSE'};
  }catch{return {healthy:false,code:'UNREACHABLE'};}
}
