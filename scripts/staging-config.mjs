import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';

export async function loadStagingEnvironment() {
  // Never inherit .env.local or process.env: both may contain production keys.
  return parseEnv(await readFile(new URL('../.env.staging.local',import.meta.url),'utf8'));
}

export function stagingDatabaseConfig(env,{requireKeys=true}={}) {
  const project=env.SEED_STAGING_SUPABASE_REF,production=env.SEED_PRODUCTION_SUPABASE_REF;
  if(!/^[a-z]{20}$/.test(project??'')||!/^[a-z]{20}$/.test(production??'')||project===production)throw Error('Configure referencias distintas para staging e producao.');
  let url;try{url=new URL(env.NEXT_PUBLIC_SUPABASE_URL);}catch{throw Error('URL de staging invalida.');}
  if(url.protocol!=='https:'||url.hostname!==project+'.supabase.co'||url.port||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('A URL deve corresponder exatamente ao projeto Supabase de staging.');
  const publicKey=env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,serverKey=env.SUPABASE_SECRET_KEY;
  if(requireKeys&&(!publicKey?.startsWith('sb_publishable_')||!serverKey?.startsWith('sb_secret_')))throw Error('Preencha as chaves Publishable e Secret do novo projeto em .env.staging.local.');
  return {project,url:url.origin,publicKey,serverKey};
}
