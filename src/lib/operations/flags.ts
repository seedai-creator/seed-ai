export const FLAG_ENV = {
  cockpit:'SEED_COCKPIT_ENABLED',growth:'SEED_GROWTH_MAP_ENABLED',goals:'SEED_GOALS_ENABLED',
  radar:'SEED_RADAR_ENABLED',simulation:'SEED_SIMULATOR_ENABLED',journal:'SEED_JOURNAL_ENABLED',
} as const;
export type FeatureFlag = keyof typeof FLAG_ENV;
// Deployment flags are server-owned. Commercial entitlements and immediate market
// switches remain enforced in the database and can only further restrict access.
export function featureEnabled(flag:FeatureFlag, env:Record<string,string|undefined>=process.env) {
  return env[FLAG_ENV[flag]] === 'true';
}
export function externalMode(env:Record<string,string|undefined>=process.env):'LIVE_WEB_ENABLED'|'OFFLINE_OR_CACHE_ONLY'|'DISABLED' {
  return env.SEED_EXTERNAL_MODE==='LIVE_WEB_ENABLED'||env.SEED_EXTERNAL_MODE==='OFFLINE_OR_CACHE_ONLY'?env.SEED_EXTERNAL_MODE:'DISABLED';
}
