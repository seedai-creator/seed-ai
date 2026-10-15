import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {alertConfiguration, deliverOperationalAlert} from './alerts';
import {logEvent} from './logging';

function alertDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw Error('ALERT_DATABASE_UNAVAILABLE');
  return createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false},
    global: {fetch: (url, init) => fetch(url, {...init, signal: AbortSignal.timeout(3000)})}});
}

// One bounded delivery per authenticated cron tick, independent of paid/AI jobs.
export async function processOperationalAlerts() {
  try {
    const config = alertConfiguration(process.env);
    if (!config) return;
    const db = alertDatabase();
    const queued = await db.rpc('queue_operational_alerts');
    if (queued.error) throw Error('ALERT_QUEUE_FAILED');
    const claim = await db.rpc('claim_operational_alert', {
      p_sender: config.sender, p_recipient: config.recipient, p_environment: config.environment,
    });
    if (claim.error) throw Error('ALERT_CLAIM_FAILED');
    const row = claim.data?.[0];
    if (!row) return;
    const result = await deliverOperationalAlert(row, config.key);
    const done = await db.rpc('finish_operational_alert', {
      p_id: row.id, p_lease: row.lease_token, p_provider_id: result.providerId, p_retry: result.retry, p_code: result.code,
    });
    if (done.error || done.data !== true) throw Error('ALERT_RECEIPT_FAILED');
    logEvent('operations.alert', {code: result.providerId ? 'ALERT_ACCEPTED' : result.code, attempt: row.attempts}, result.providerId ? 'info' : 'warn');
  } catch {
    // Do not recursively record an alert-delivery failure into its own alert source.
    logEvent('operations.alert', {code: 'ALERT_WORKER_FAILED'}, 'error');
  }
}

export async function recordServerFailure(feature: 'server' | 'billing' | 'auth', code: 'UNHANDLED_REQUEST' | 'WEBHOOK_PROCESSING_FAILED' | 'AUTH_PROVIDER_FAILED') {
  if (process.env.SEED_OPERATIONS_ENABLED !== 'true') return;
  try {
    const result = await alertDatabase().from('operational_events').insert({feature, code, level: 'ERROR'});
    if (result.error) throw Error('EVENT_FAILED');
  } catch { logEvent('operations.record_failed', {code: 'EVENT_FAILED', feature}, 'warn'); }
}
