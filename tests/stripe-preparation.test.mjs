import test from 'node:test';
import assert from 'node:assert/strict';
import {testOnlyKey, inventoryTestOffers} from '../scripts/stripe-preparation.mjs';
import {PRO_PROPOSAL} from '../.test-build/src/lib/commercial/pro-proposal.js';

const price = amount => ({livemode: false, active: true, currency: 'brl', unit_amount: amount,
  type: 'recurring', billing_scheme: 'per_unit', product: {active: true},
  recurring: {interval: 'month', interval_count: 1, usage_type: 'licensed'}});

test('preparation refuses live, public and malformed credentials', () => {
  for (const key of [undefined, '', 'sk_live_example', 'rk_live_example', 'pk_test_example', 'sk_test_with spaces']) assert.throws(() => testOnlyKey(key));
  assert.equal(testOnlyKey('rk_test_fixture'), 'rk_test_fixture');
});
test('compatible prices never authorize live activation or establish entitlements', () => {
  const result = inventoryTestOffers(PRO_PROPOSAL, PRO_PROPOSAL.map(p => price(p.amount_minor)), true);
  assert.equal(result.readyForActivation, false);
  assert.ok(result.offers.every(p => p.compatibleTestPriceCount === 1 && p.bindingVerified === false));
  assert.ok(result.blockers.includes('VERSIONED_OFFER_BINDING_AND_ENTITLEMENTS'));
});
test('amount alone cannot validate currency, recurrence, mode or product', () => {
  const variants = [{livemode: true}, {active: false}, {currency: 'usd'}, {unit_amount: 9990},
    {type: 'one_time'}, {billing_scheme: 'tiered'}, {transform_quantity: {divide_by: 5}},
    {product: 'prod_unexpanded'}, {product: {active: false}}, {product: {active: true, deleted: true}},
    {recurring: {interval: 'year', interval_count: 1, usage_type: 'licensed'}},
    {recurring: {interval: 'month', interval_count: 2, usage_type: 'licensed'}},
    {recurring: {interval: 'month', interval_count: 1, usage_type: 'metered'}}];
  for (const variant of variants) assert.equal(inventoryTestOffers(PRO_PROPOSAL, [{...price(9999), ...variant}], true).offers[0].compatibleTestPriceCount, 0);
});
test('rejects price, company or allowance drift and duplicate offers', () => {
  for (const override of [{amount_minor: 4999}, {company_limit: 5}, {allowance_usd: 8}])
    assert.throws(() => inventoryTestOffers([{...PRO_PROPOSAL[0], ...override}, ...PRO_PROPOSAL.slice(1)], [], true));
  assert.throws(() => inventoryTestOffers([PRO_PROPOSAL[0], PRO_PROPOSAL[0], PRO_PROPOSAL[2]], [], true));
});
test('partial inventory remains explicitly incomplete', () => {
  assert.ok(inventoryTestOffers(PRO_PROPOSAL, [], false).blockers.includes('PRICE_INVENTORY_INCOMPLETE'));
});
