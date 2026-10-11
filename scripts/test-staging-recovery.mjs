// Explicit, bounded integration test. Only disposable staging fixtures; no
// emails, browser automation, OpenAI calls, production changes or secret output.
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { loadStagingEnvironment, stagingDatabaseConfig } from './staging-config.mjs';
import { completePasswordRecovery } from '../.test-build/src/lib/auth/recovery.js';

const base = 'http://127.0.0.1:3002';
const builtServer = process.argv.includes('--production-build');
const manifest = new URL('../.test-build/staging-recovery-state.json', import.meta.url);
const report = { startedAt: new Date().toISOString(), checks: [], passed: false, cleanup: false, emailsSent: 0 };
let phase = 'configuration', admin, state, server;
class RecoveryCheckFailure extends Error {}
const requireTrue = (value, label) => { if (!value) throw new RecoveryCheckFailure(label); };
const data = (result, label) => { requireTrue(!result.error, label); return result.data; };
const passed = label => { report.checks.push(label); console.log(JSON.stringify({ passed: label })); };
const client = (url, key) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: {
  fetch: (input, init) => fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(20000) }),
} });
const save = () => writeFile(manifest, JSON.stringify(state, null, 2));
const http = (path, options = {}) => fetch(base + path, { ...options, redirect: 'manual', signal: AbortSignal.timeout(90000) });
const postToken = (token, extraHeaders = {}) => http('/auth/recovery/confirm', { method: 'POST',
  headers: { origin: base, 'content-type': 'application/x-www-form-urlencoded', ...extraHeaders },
  body: new URLSearchParams({ token_hash: token }),
});

async function clean() {
  if (server) { server.kill('SIGTERM'); await new Promise(resolve => { if (server.exitCode !== null) resolve(); else { server.once('exit', resolve); setTimeout(resolve, 5000).unref(); } }); }
  if (!state || !admin) return;
  const users = data(await admin.auth.admin.listUsers({ perPage: 1000 }), 'cleanup_lookup').users.filter(u => u.email === state.email);
  for (const user of users) {
    const memberships = data(await admin.from('company_members').select('company_id').eq('user_id', user.id), 'cleanup_memberships');
    for (const { company_id } of memberships) {
      const members = data(await admin.from('company_members').select('user_id').eq('company_id', company_id), 'cleanup_shared_check');
      requireTrue(members.every(m => m.user_id === user.id), 'cleanup_shared_company_refused');
      data(await admin.from('companies').delete().eq('id', company_id), 'cleanup_company');
    }
    data(await admin.from('commercial_events').delete().eq('user_id', user.id), 'cleanup_commercial');
    data(await admin.from('operational_events').delete().eq('user_id', user.id), 'cleanup_events');
    data(await admin.auth.admin.deleteUser(user.id), 'cleanup_user');
  }
  data(await admin.from('beta_invitations').delete().eq('email', state.email), 'cleanup_invitation');
  requireTrue(data(await admin.auth.admin.listUsers({ perPage: 1000 }), 'cleanup_verified').users.every(u => u.email !== state.email), 'cleanup_remaining');
  const controls = data(await admin.from('operations_controls').select('*').eq('id', true).single(), 'cleanup_controls');
  requireTrue(JSON.stringify(controls) === JSON.stringify(state.controls), 'controls_changed');
  state.status = 'cleaned'; await save(); report.cleanup = true;
}

try {
  requireTrue(process.argv.includes('--run'), 'explicit_run_required');
  const config = stagingDatabaseConfig(await loadStagingEnvironment());
  await mkdir(new URL('../.test-build/', import.meta.url), { recursive: true });
  try { requireTrue(JSON.parse(await readFile(manifest, 'utf8')).status === 'cleaned', 'previous_cleanup_required'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  admin = client(config.url, config.serverKey);
  const controls = data(await admin.from('operations_controls').select('*').eq('id', true).single(), 'controls');
  requireTrue(controls.closed_beta && controls.disable_ai && controls.disable_uploads, 'staging_not_paused');
  let portUsed = false;
  try { await fetch(base, { signal: AbortSignal.timeout(1000) }); portUsed = true; } catch { /* expected: test owns its server */ }
  requireTrue(!portUsed, 'port_in_use');
  server = spawn(process.execPath, ['scripts/run-staging.mjs', builtServer ? 'start' : 'dev'], { stdio: ['ignore', 'pipe', 'pipe'] });
  // Next development request logs can contain query tokens. Drain without
  // storing or printing them; only explicit check labels enter the report.
  server.stdout.on('data', () => {}); server.stderr.on('data', () => {});
  server.on('error', () => {});
  const started = Date.now(); let ready = false;
  while (Date.now() - started < 90000) {
    try { ready = (await http('/forgot-password')).status === 200; } catch { /* startup */ }
    if (ready) break;
    requireTrue(server.exitCode === null, 'server_exited');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  requireTrue(ready, 'server_unavailable');
  const run = randomUUID(); state = { project: config.project, run, email: `seed-recovery-${run}@example.invalid`, status: 'running', controls }; await save();
  data(await admin.from('beta_invitations').insert({ email: state.email, cohort: 'FIXTURE-' + run, expires_at: new Date(Date.now() + 3600000).toISOString() }), 'invitation');
  const password = randomBytes(32).toString('base64url'), replacement = randomBytes(32).toString('base64url');
  phase = 'fixture';
  const user = data(await admin.auth.admin.createUser({ email: state.email, password, email_confirm: true, user_metadata: { display_name: 'FIXTURE RECOVERY', commercial_country: 'BR' } }), 'fixture_user').user;
  const oldSession = client(config.url, config.publicKey);
  const oldLogin = data(await oldSession.auth.signInWithPassword({ email: state.email, password }), 'old_login');
  const oldRefreshToken = oldLogin.session.refresh_token;

  phase = 'confirmation';
  const link = data(await admin.auth.admin.generateLink({ type: 'recovery', email: state.email }), 'generate_link');
  const token = link.properties.hashed_token;
  const landing = '/auth/recovery?type=recovery&token_hash=' + encodeURIComponent(token);
  for (let i = 0; i < 2; i++) {
    const response = await http(landing); requireTrue(response.status === 200, 'landing');
    report.landingCacheControl = response.headers.get('cache-control');
    // Next dev overrides this with no-cache; the built server must use no-store.
    requireTrue(builtServer ? report.landingCacheControl?.includes('no-store') : /no-(cache|store)/.test(report.landingCacheControl ?? ''), 'private_cache');
    await response.text();
  }
  requireTrue((await postToken(token, { origin: 'https://untrusted.example' })).status === 403, 'csrf_origin');
  requireTrue((await http('/auth/recovery/confirm', { method: 'POST', body: new URLSearchParams({ token_hash: token }) })).status === 403, 'csrf_missing_origin');
  requireTrue((await http('/reset-password')).headers.get('location')?.endsWith('/forgot-password?recovery=invalid'), 'anonymous_reset');
  const confirmed = await postToken(token);
  requireTrue(confirmed.status === 303 && confirmed.headers.get('location')?.endsWith('/reset-password'), 'valid_confirmation');
  const jar = new Map();
  for (const value of confirmed.headers.getSetCookie()) { const pair = value.split(';')[0], index = pair.indexOf('='); jar.set(pair.slice(0, index), pair.slice(index + 1)); }
  requireTrue(jar.size > 0, 'session_cookie');
  const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  const reset = await http('/reset-password', { headers: { cookie } }); requireTrue(reset.status === 200, 'authenticated_reset'); await reset.text();
  passed('link_confirmation_creates_session_after_post_only_and_rejects_cross_origin');
  const replay = await postToken(token);
  requireTrue(replay.headers.get('location')?.endsWith('/forgot-password?recovery=invalid'), 'replay_rejected');
  const invalid = await postToken('0'.repeat(64));
  requireTrue(invalid.headers.get('location')?.endsWith('/forgot-password?recovery=invalid'), 'invalid_rejected');
  passed('single_use_and_invalid_token_rejected_without_redirect_leak');
  const enhanced = await postToken('0'.repeat(64), { accept: 'application/json' });
  requireTrue(enhanced.status === 200 && enhanced.headers.get('cache-control')?.includes('no-store'), 'enhanced_invalid_status');
  requireTrue((await enhanced.json()).next === '/forgot-password?recovery=invalid', 'enhanced_invalid_destination');
  const unsupported = await http('/auth/recovery?type=magiclink&token_hash=' + encodeURIComponent(token));
  requireTrue(unsupported.headers.get('location')?.endsWith('/forgot-password?recovery=invalid'), 'unsupported_link_type');
  passed('unsupported_link_type_is_not_routed_to_password_form');

  const secondLink = data(await admin.auth.admin.generateLink({ type: 'recovery', email: state.email }), 'enhanced_link');
  const enhancedValid = await postToken(secondLink.properties.hashed_token, { accept: 'application/json' });
  requireTrue(enhancedValid.status === 200 && (await enhancedValid.json()).next === '/reset-password', 'enhanced_confirmation');
  for (const value of enhancedValid.headers.getSetCookie()) { const pair = value.split(';')[0], index = pair.indexOf('='); jar.set(pair.slice(0,index),pair.slice(index+1)); }
  passed('enhanced_confirmation_uses_bounded_local_destination_and_sets_session');

  phase = 'password_change';
  const recovered = createServerClient(config.url, config.publicKey, { cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: values => { for (const { name, value } of values) { if (value) jar.set(name, value); else jar.delete(name); } },
  } });
  const result = await completePasswordRecovery(recovered, replacement, replacement);
  requireTrue(result.status === 'updated' && result.userId === user.id && !result.revocationFailed, 'password_update');
  requireTrue(Boolean((await client(config.url, config.publicKey).auth.signInWithPassword({ email: state.email, password })).error), 'old_password_rejected');
  const newLogin = client(config.url, config.publicKey);
  requireTrue(data(await newLogin.auth.signInWithPassword({ email: state.email, password: replacement }), 'new_password').user.id === user.id, 'new_identity');
  requireTrue(Boolean((await client(config.url, config.publicKey).auth.refreshSession({ refresh_token: oldRefreshToken })).error), 'old_refresh_revoked');
  await newLogin.auth.signOut({ scope: 'global' });
  passed('password_changed_old_password_rejected_new_password_accepted_refresh_sessions_revoked');
  phase = 'locales';
  for (const locale of ['pt-BR', 'pt-PT', 'en-US', 'es-ES']) { const page = await http('/forgot-password?recovery=invalid', { headers: { cookie: 'seed-locale=' + locale } }); const html = await page.text(); requireTrue(page.status === 200 && html.includes(`lang="${locale}"`) && html.includes('role="alert"'), 'localized_failure'); }
  passed('expired_or_invalid_link_has_recovery_path_in_four_locales');
  report.passed = true;
} catch (error) {
  report.failedPhase = phase; process.exitCode = 1;
  report.failedCheck = error instanceof RecoveryCheckFailure ? error.message : 'provider_or_runtime';
  console.error(JSON.stringify({ failedPhase: phase, failedCheck: report.failedCheck, note: 'Provider payloads, credentials and tokens omitted.' }));
} finally {
  try { await clean(); } catch { report.cleanup = false; report.passed = false; process.exitCode = 1; if (state) { state.status = 'cleanup_required'; await save(); } }
  report.finishedAt = new Date().toISOString();
  await writeFile(new URL('../.test-build/staging-recovery-report.json', import.meta.url), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, cleanup: report.cleanup, checks: report.checks.length, emailsSent: 0 }));
}
