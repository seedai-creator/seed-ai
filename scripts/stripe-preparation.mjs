// Pure inventory validation. No activation, SDK call, environment or data mutation.
export function testOnlyKey(key) {
  if (typeof key !== 'string' || !/^(sk|rk)_test_[A-Za-z0-9]+$/.test(key)) throw Error('STRIPE_TEST_KEY_REQUIRED');
  return key;
}

export function inventoryTestOffers(offers, prices, complete) {
  if (!Array.isArray(offers) || offers.length !== 3 || !Array.isArray(prices) || typeof complete !== 'boolean') throw Error('INVALID_INVENTORY');
  const expected = new Map([['PRO_1', [9999, 1, 4]], ['PRO_3', [19999, 3, 8]], ['PRO_5', [39999, 5, 16]]]);
  const seen = new Set();
  const result = offers.map(offer => {
    const value = expected.get(offer.id);
    if (!value || seen.has(offer.id) || offer.amount_minor !== value[0] || offer.company_limit !== value[1] || offer.allowance_usd !== value[2]) throw Error('APPROVED_OFFER_MISMATCH');
    seen.add(offer.id);
    const matches = prices.filter(price => price && price.livemode === false && price.active === true
      && price.currency === 'brl' && price.unit_amount === offer.amount_minor
      && price.type === 'recurring' && price.billing_scheme === 'per_unit' && !price.transform_quantity
      && price.recurring?.interval === 'month' && price.recurring.interval_count === 1 && price.recurring.usage_type === 'licensed'
      && price.product && typeof price.product === 'object' && price.product.deleted !== true && price.product.active === true);
    return {...offer, currency: 'BRL', interval: 'month', compatibleTestPriceCount: matches.length,
      // Matching an amount cannot establish an entitlement or live mapping.
      bindingVerified: false};
  });
  return {testModeOnly: true, inventoryComplete: complete, readyForActivation: false, offers: result,
    blockers: [...(!complete ? ['PRICE_INVENTORY_INCOMPLETE'] : []),
      'VERSIONED_OFFER_BINDING_AND_ENTITLEMENTS', 'LIVE_ACCOUNT_AND_CREDENTIALS_NOT_VERIFIED',
      'LIVE_WEBHOOK_AND_PORTAL_NOT_VERIFIED', 'REFUND_AND_PLAN_CHANGE_FLOW',
      'FINAL_LEGAL_DOCUMENTS_AND_PRIVACY_EVIDENCE', 'EXPLICIT_ACTIVATION_AUTHORIZATION']};
}
