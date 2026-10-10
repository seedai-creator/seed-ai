export function environmentIssues(env) {
  const issues=[];
  const environment=env.SEED_ENV;
  if(!['development','staging','production'].includes(environment))issues.push('SEED_ENV must be development, staging or production');
  const coreOnly=env.SEED_STAGING_CORE_ONLY==='true';
  if(env.SEED_STAGING_CORE_ONLY&&!['true','false'].includes(env.SEED_STAGING_CORE_ONLY))issues.push('SEED_STAGING_CORE_ONLY must be true or false');
  if(coreOnly&&environment==='production')issues.push('Staging core mode is forbidden in production');
  if(coreOnly&&Object.entries(env).some(([key,value])=>/^(OPENAI_|STRIPE_)/.test(key)&&value?.trim()))issues.push('Staging core mode must not receive AI or billing configuration');
  if(coreOnly&&env.SEED_OPERATIONS_ENABLED!=='true')issues.push('Staging core mode requires operations controls');
  const required=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY','NEXT_PUBLIC_SITE_URL','CRON_SECRET',...(!coreOnly?['OPENAI_API_KEY','OPENAI_MODEL','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET']:[])];
  for(const key of required)if(!env[key]?.trim())issues.push(key+' is required');
  const urls={};
  for(const key of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SITE_URL']){
    try {const url=new URL(env[key]);urls[key]=url;if(url.username||url.password||url.search||url.hash)issues.push(key+' must not contain credentials, query or fragment');if(url.protocol!=='https:'&&!(environment==='development'&&url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))issues.push(key+' requires HTTPS (except local development)');}catch{issues.push(key+' must be an absolute URL');}
  }
  if(environment!=='production'){
    if(!env.SEED_PRODUCTION_SUPABASE_REF)issues.push('SEED_PRODUCTION_SUPABASE_REF is required to enforce isolation');
    if(urls.NEXT_PUBLIC_SUPABASE_URL?.hostname===env.SEED_PRODUCTION_SUPABASE_REF+'.supabase.co')issues.push('Non-production cannot use the production database');
  }
  if(env.VERCEL_ENV==='production'&&environment!=='production')issues.push('Vercel Production requires SEED_ENV=production');
  if(env.VERCEL_ENV==='preview'&&environment!=='staging')issues.push('Vercel Preview requires SEED_ENV=staging');
  if(env.STRIPE_SECRET_KEY&&!/^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY))issues.push('Stripe must remain in test mode');
  if(env.STRIPE_WEBHOOK_SECRET&&!env.STRIPE_WEBHOOK_SECRET.startsWith('whsec_'))issues.push('STRIPE_WEBHOOK_SECRET has an invalid format');
  if(env.CRON_SECRET&&env.CRON_SECRET.length<32)issues.push('CRON_SECRET must contain at least 32 characters');
  if(env.SUPABASE_SECRET_KEY&&env.SUPABASE_SECRET_KEY===env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)issues.push('Public and server Supabase keys must differ');
  for(const key of Object.keys(env))if(key.startsWith('NEXT_PUBLIC_')&&/(SECRET|PASSWORD|PRIVATE|OPENAI.*KEY|SERVICE_ROLE)/.test(key))issues.push(key+' must not be public');
  for(const key of ['SEED_OPERATIONS_ENABLED','SEED_COCKPIT_ENABLED','SEED_GROWTH_MAP_ENABLED','SEED_GOALS_ENABLED','SEED_RADAR_ENABLED','SEED_SIMULATOR_ENABLED','SEED_JOURNAL_ENABLED'])if(env[key]&&!['true','false'].includes(env[key]))issues.push(key+' must be true or false');
  if(env.SEED_EXTERNAL_MODE&&!['DISABLED','OFFLINE_OR_CACHE_ONLY','LIVE_WEB_ENABLED'].includes(env.SEED_EXTERNAL_MODE))issues.push('Invalid SEED_EXTERNAL_MODE');
  return issues;
}
export function validateEnvironment(env) {
  const issues=environmentIssues(env);
  if(issues.length)throw new Error('SEED environment configuration failed:\n'+issues.map(x=>'- '+x).join('\n'));
}
