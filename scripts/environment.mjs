export function environmentIssues(env) {
  const issues=[];
  const environment=env.SEED_ENV;
  if(!['development','staging','production'].includes(environment))issues.push('SEED_ENV must be development, staging or production');
  const coreOnly=env.SEED_STAGING_CORE_ONLY==='true';
  const billingOnly=env.SEED_STAGING_BILLING_ONLY==='true';
  const hostedBilling=env.SEED_STAGING_HOSTED_BILLING==='true';
  const anyBillingTest=billingOnly||hostedBilling;
  if(env.SEED_STAGING_HOSTED_BILLING&&!['true','false'].includes(env.SEED_STAGING_HOSTED_BILLING))issues.push('SEED_STAGING_HOSTED_BILLING must be true or false');
  if(hostedBilling&&(environment!=='staging'||env.VERCEL_ENV!=='preview'))issues.push('Hosted billing test mode requires Vercel Preview and staging');
  if(env.SEED_STAGING_BILLING_ONLY&&!['true','false'].includes(env.SEED_STAGING_BILLING_ONLY))issues.push('SEED_STAGING_BILLING_ONLY must be true or false');
  if(billingOnly&&(environment!=='development'||env.VERCEL_ENV))issues.push('Billing test mode is restricted to local development');
  if([billingOnly,hostedBilling,coreOnly].filter(Boolean).length>1)issues.push('Staging modes are mutually exclusive');
  if(anyBillingTest&&Object.entries(env).some(([key,value])=>/^(OPENAI_|RESEND_)/.test(key)&&value?.trim()))issues.push('Billing test mode must not receive AI or email configuration');
  if(anyBillingTest&&(env.SEED_OPERATIONS_ENABLED!=='true'||env.SEED_ALERTS_ENABLED==='true'||env.SEED_JOURNAL_ENABLED!=='false'||env.SEED_EXTERNAL_MODE!=='DISABLED'))issues.push('Billing test mode requires paused external work and operations controls');
  if(env.SEED_STAGING_CORE_ONLY&&!['true','false'].includes(env.SEED_STAGING_CORE_ONLY))issues.push('SEED_STAGING_CORE_ONLY must be true or false');
  if(coreOnly&&environment==='production')issues.push('Staging core mode is forbidden in production');
  if(coreOnly&&Object.entries(env).some(([key,value])=>/^(OPENAI_|STRIPE_)/.test(key)&&value?.trim()))issues.push('Staging core mode must not receive AI or billing configuration');
  if(coreOnly&&(env.RESEND_API_KEY?.trim()||env.SEED_ALERTS_ENABLED==='true'))issues.push('Staging core mode must not send operational email');
  if(coreOnly&&env.SEED_OPERATIONS_ENABLED!=='true')issues.push('Staging core mode requires operations controls');
  const required=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY','NEXT_PUBLIC_SITE_URL','CRON_SECRET',...(!coreOnly&&!anyBillingTest?['OPENAI_API_KEY','OPENAI_MODEL']:[]),...(!coreOnly?['STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET']:[])];
  for(const key of required)if(!env[key]?.trim())issues.push(key+' is required');
  const urls={};
  for(const key of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SITE_URL']){
    try {const url=new URL(env[key]);urls[key]=url;if(url.username||url.password||url.search||url.hash)issues.push(key+' must not contain credentials, query or fragment');if(url.protocol!=='https:'&&!(environment==='development'&&url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))issues.push(key+' requires HTTPS (except local development)');}catch{issues.push(key+' must be an absolute URL');}
  }
  if(environment!=='production'){
    if(!env.SEED_PRODUCTION_SUPABASE_REF)issues.push('SEED_PRODUCTION_SUPABASE_REF is required to enforce isolation');
    if(urls.NEXT_PUBLIC_SUPABASE_URL?.hostname===env.SEED_PRODUCTION_SUPABASE_REF+'.supabase.co')issues.push('Non-production cannot use the production database');
  }
  if(hostedBilling){
    const db=urls.NEXT_PUBLIC_SUPABASE_URL,site=urls.NEXT_PUBLIC_SITE_URL;
    if(!/^[a-z]{20}$/.test(env.SEED_STAGING_SUPABASE_REF??'')||db?.origin!=='https://'+env.SEED_STAGING_SUPABASE_REF+'.supabase.co'||db?.pathname!=='/')issues.push('Hosted billing requires the exact isolated staging database');
    if(!site?.hostname.endsWith('.vercel.app')||site?.protocol!=='https:'||site.port||site.pathname!=='/')issues.push('Hosted billing requires a dedicated Vercel staging origin');
  }
  if(env.VERCEL_ENV==='production'&&environment!=='production')issues.push('Vercel Production requires SEED_ENV=production');
  if(billingOnly&&(!urls.NEXT_PUBLIC_SITE_URL||urls.NEXT_PUBLIC_SITE_URL.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(urls.NEXT_PUBLIC_SITE_URL.hostname)))issues.push('Billing test mode requires a loopback site');
  if(env.VERCEL_ENV==='preview'&&environment!=='staging')issues.push('Vercel Preview requires SEED_ENV=staging');
  if(env.STRIPE_SECRET_KEY&&!/^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY))issues.push('Stripe must remain in test mode');
  if(env.STRIPE_WEBHOOK_SECRET&&!env.STRIPE_WEBHOOK_SECRET.startsWith('whsec_'))issues.push('STRIPE_WEBHOOK_SECRET has an invalid format');
  if(env.CRON_SECRET&&env.CRON_SECRET.length<32)issues.push('CRON_SECRET must contain at least 32 characters');
  if(env.SEED_HEALTH_TOKEN){
    if(!/^[A-Za-z0-9_-]{32,256}$/.test(env.SEED_HEALTH_TOKEN))issues.push('SEED_HEALTH_TOKEN must contain 32 to 256 URL-safe characters');
    if(['CRON_SECRET','SUPABASE_SECRET_KEY','OPENAI_API_KEY','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','RESEND_API_KEY'].some(key=>env[key]===env.SEED_HEALTH_TOKEN))issues.push('SEED_HEALTH_TOKEN must not reuse a privileged credential');
  }
  if(env.SUPABASE_SECRET_KEY&&env.SUPABASE_SECRET_KEY===env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)issues.push('Public and server Supabase keys must differ');
  for(const key of Object.keys(env))if(key.startsWith('NEXT_PUBLIC_')&&/(SECRET|PASSWORD|PRIVATE|OPENAI.*KEY|RESEND.*KEY|SERVICE_ROLE|HEALTH.*TOKEN)/.test(key))issues.push(key+' must not be public');
  for(const key of ['SEED_OPERATIONS_ENABLED','SEED_ALERTS_ENABLED','SEED_COCKPIT_ENABLED','SEED_GROWTH_MAP_ENABLED','SEED_GOALS_ENABLED','SEED_RADAR_ENABLED','SEED_SIMULATOR_ENABLED','SEED_JOURNAL_ENABLED'])if(env[key]&&!['true','false'].includes(env[key]))issues.push(key+' must be true or false');
  if(env.SEED_ALERTS_ENABLED==='true'){
    if(env.SEED_OPERATIONS_ENABLED!=='true')issues.push('Alerts require operations controls');
    if(!/^re_[A-Za-z0-9_-]{16,}$/.test(env.RESEND_API_KEY??''))issues.push('RESEND_API_KEY is required for alerts');
    for(const key of ['SEED_ALERT_FROM','SEED_ALERT_TO'])if(!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(env[key]??'')||(env[key]?.length??0)>254)issues.push(key+' must be one valid email address');
  }
  if(env.SEED_EXTERNAL_MODE&&!['DISABLED','OFFLINE_OR_CACHE_ONLY','LIVE_WEB_ENABLED'].includes(env.SEED_EXTERNAL_MODE))issues.push('Invalid SEED_EXTERNAL_MODE');
  return issues;
}
export function validateEnvironment(env) {
  const issues=environmentIssues(env);
  if(issues.length)throw new Error('SEED environment configuration failed:\n'+issues.map(x=>'- '+x).join('\n'));
}
