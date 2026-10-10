import {randomBytes} from 'node:crypto';
import {stagingDatabaseConfig} from './staging-config.mjs';
import {validateEnvironment} from './environment.mjs';

const operatingSystemKeys=['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','ComSpec','COMSPEC','PATHEXT','TEMP','TMP','TMPDIR','USERPROFILE','HOME','APPDATA','LOCALAPPDATA','NUMBER_OF_PROCESSORS'];

export function stagingRuntimeEnvironment(staging,ambientKeys=[],parent=process.env) {
  stagingDatabaseConfig(staging);
  // Blank every ambient app key before Next loads its normal .env files. Only
  // the explicit staging file may supply application configuration.
  const env=Object.fromEntries([...ambientKeys,...Object.keys(parent)].filter(key=>!operatingSystemKeys.includes(key)).map(key=>[key,'']));
  for(const key of operatingSystemKeys)if(parent[key])env[key]=parent[key];
  Object.assign(env,staging);
  env.SEED_ENV='development';
  env.SEED_STAGING_CORE_ONLY='true';
  env.SEED_OPERATIONS_ENABLED='true';
  env.SEED_BUILD_TARGET='staging';
  env.NEXT_TELEMETRY_DISABLED='1';
  env.NEXT_PUBLIC_SITE_URL='http://127.0.0.1:3002';
  env.CRON_SECRET=randomBytes(32).toString('hex');
  env.SEED_EXTERNAL_MODE='DISABLED';
  // Core staging is deliberately incapable of paid calls or scheduled work.
  for(const key of Object.keys(env))if(/^(OPENAI_|STRIPE_)/.test(key))env[key]='';
  for(const key of ['OPENAI_API_KEY','OPENAI_MODEL','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET'])env[key]='';
  env.SEED_JOURNAL_ENABLED='false';
  env.VERCEL_ENV='';
  env.NODE_ENV='';
  // Never forward Node preload options or dotenv's internal loaded-state marker.
  delete env.NODE_OPTIONS;
  delete env.__NEXT_PROCESSED_ENV;
  validateEnvironment(env);
  return env;
}
