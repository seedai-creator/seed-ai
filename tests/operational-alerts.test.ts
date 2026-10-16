import test from 'node:test';
import assert from 'node:assert/strict';
import {alertConfiguration, deliverOperationalAlert, renderOperationalAlert} from '../src/lib/operations/alerts';

const fixture = () => ({id: '11111111-1111-4111-8111-111111111111', severity: 'P1',
  sender: 'alerts@example.invalid', recipient: 'owner@example.invalid', environment: 'staging', created_at: '2026-10-14T12:00:00Z',
  metrics: {errors_15m: 5, ai_failures_2m: 5, webhook_failures_15m: 0, auth_failures_15m: 0,
    journal_overdue: 0, cost_unknown_today: 0, accounted_or_reserved_usd_today: 0.02, budget_reference_usd: 10}});
test('alerts are off by default and core staging cannot send even with an accidentally supplied key', () => {
  assert.equal(alertConfiguration({}), null);
  const env = {SEED_OPERATIONS_ENABLED: 'true', SEED_ALERTS_ENABLED: 'true', RESEND_API_KEY: 're_' + 'x'.repeat(20),
    SEED_ALERT_FROM: 'alerts@example.invalid', SEED_ALERT_TO: 'owner@example.invalid', SEED_ENV: 'staging'};
  assert.equal(alertConfiguration(env)?.environment, 'staging');
  assert.throws(() => alertConfiguration({...env, SEED_STAGING_CORE_ONLY: 'true'}));
  assert.throws(() => alertConfiguration({...env, RESEND_API_KEY: ''}));
  assert.throws(() => alertConfiguration({...env, SEED_ALERT_TO: 'one@example.invalid,two@example.invalid'}));
  assert.throws(() => alertConfiguration({...env, SEED_ALERT_FROM: 'a@example.invalid\nBcc: leak@example.invalid'}));
});
test('only finite aggregate metrics reach the message, never arbitrary input or company information', () => {
  const raw = {...fixture(), secret: 'CANARY_SECRET', company: 'CANARY_COMPANY', metrics: {...fixture().metrics, text: 'CANARY_REVENUE'}};
  const email = renderOperationalAlert(raw);
  assert.doesNotMatch(JSON.stringify(email), /CANARY/);
  assert.match(email.text, /não uma fatura/);
  assert.throws(() => renderOperationalAlert({...raw, metrics: {...raw.metrics, errors_15m: Infinity}}));
  assert.throws(() => renderOperationalAlert({...raw, metrics: {...raw.metrics, errors_15m: '5'}}));
  assert.throws(() => renderOperationalAlert({...raw, recipient: 'one@example.invalid\r\nBcc: another@example.invalid'}));
});
test('a retry uses the same body and provider idempotency key, and acceptance is not delivery proof', async () => {
  const requests: RequestInit[] = [];
  const transport: typeof fetch = async (url, init) => {
    assert.equal(url, 'https://api.resend.com/emails'); requests.push(init!);
    assert.equal(init?.redirect, 'error'); assert.ok(init?.signal);
    return Response.json({id: '22222222-2222-4222-8222-222222222222'});
  };
  const first = await deliverOperationalAlert(fixture(), 'test-placeholder', transport);
  await deliverOperationalAlert(fixture(), 'changed-key', transport);
  assert.equal(first.providerId, '22222222-2222-4222-8222-222222222222');
  assert.equal(requests[0].body, requests[1].body);
  assert.equal(new Headers(requests[0].headers).get('Idempotency-Key'), new Headers(requests[1].headers).get('Idempotency-Key'));
});

test('queue metrics extend new receipts without changing older messages on retry',()=>{
  const old=renderOperationalAlert(fixture());
  assert.doesNotMatch(old.text,/Modelo Vivo|Radar|Pesquisas externas|Mapas de crescimento/);
  const queues={business_model_overdue:1,radar_overdue:2,external_overdue:3,growth_overdue:4};
  const current={...fixture(),metrics:{...fixture().metrics,...queues}};
  const rendered=renderOperationalAlert(current);
  for(const phrase of ['Modelo Vivo','Radar','Pesquisas externas','Mapas de crescimento'])assert.match(rendered.text,new RegExp(phrase));
  assert.equal(rendered.text.replace(/\n(?:Tarefas do Modelo Vivo|Empresas com processamento do Radar|Pesquisas externas|Mapas de crescimento)[^\n]*/g,''),old.text);
  for(const key of Object.keys(queues))for(const invalid of [undefined,null,'1',-1,0.1,Infinity])
    assert.throws(()=>renderOperationalAlert({...current,metrics:{...current.metrics,[key]:invalid}}));
});
test('transient failures retry but rejected credentials, invalid content and malformed input do not', async () => {
  for (const status of [429, 500, 503]) {
    const result = await deliverOperationalAlert(fixture(), '', async () => new Response('PRIVATE PROVIDER ERROR', {status}));
    assert.deepEqual(result, {providerId: null, retry: true, code: 'PROVIDER_TRANSIENT'});
  }
  for (const status of [400, 401, 403, 409, 422]) {
    assert.deepEqual(await deliverOperationalAlert(fixture(), '', async () => new Response('private', {status})),
      {providerId: null, retry: false, code: 'PROVIDER_REJECTED'});
  }
  assert.equal((await deliverOperationalAlert(fixture(), '', async () => {throw Error('key=PRIVATE');})).code, 'NETWORK_FAILURE');
  assert.equal((await deliverOperationalAlert(fixture(), '', async () => Response.json({body: 'PRIVATE'}))).code, 'INVALID_RESPONSE');
  assert.deepEqual(await deliverOperationalAlert(null, '', async () => {throw Error('Must not call');}),
    {providerId: null, retry: false, code: 'INVALID_ALERT'});
});
