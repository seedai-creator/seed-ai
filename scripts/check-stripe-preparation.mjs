// Explicit read-only Stripe TEST inventory. Never contacts live mode or Supabase.
import Stripe from 'stripe';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {PRO_PROPOSAL} from '../.test-build/src/lib/commercial/pro-proposal.js';
import {testOnlyKey, inventoryTestOffers} from './stripe-preparation.mjs';

try {
  if (process.argv.length !== 3 || process.argv[2] !== '--run') throw Error('EXPLICIT_RUN_REQUIRED');
  const env = parseEnv(await readFile(new URL('../.env.local', import.meta.url), 'utf8'));
  const stripe = new Stripe(testOnlyKey(env.STRIPE_SECRET_KEY?.trim()), {maxNetworkRetries: 0, timeout: 15000});
  if ((await stripe.balance.retrieve()).livemode !== false) throw Error('TEST_MODE_NOT_CONFIRMED');
  const prices = [];
  let after, complete = false;
  for (let page = 0; page < 5; page++) {
    const result = await stripe.prices.list({limit: 100, active: true, expand: ['data.product'], ...(after ? {starting_after: after} : {})});
    prices.push(...result.data);
    if (!result.has_more) { complete = true; break; }
    if (!result.data.length) throw Error('INCONSISTENT_PAGINATION');
    after = result.data.at(-1).id;
  }
  const report = {checkedAt: new Date().toISOString(), mutationCount: 0, ...inventoryTestOffers(PRO_PROPOSAL, prices, complete)};
  await mkdir(new URL('../.test-build/', import.meta.url), {recursive: true});
  await writeFile(new URL('../.test-build/stripe-preparation.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  if (!complete) process.exitCode = 1;
} catch (error) {
  // SDK errors may carry request headers or data; expose only our allowlisted codes.
  const codes = ['EXPLICIT_RUN_REQUIRED', 'STRIPE_TEST_KEY_REQUIRED', 'TEST_MODE_NOT_CONFIRMED', 'INCONSISTENT_PAGINATION', 'APPROVED_OFFER_MISMATCH'];
  console.error(JSON.stringify({passed: false, code: codes.includes(error?.message) ? error.message : 'STRIPE_PREPARATION_CHECK_FAILED', readyForActivation: false}));
  process.exitCode = 1;
}
