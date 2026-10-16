import test from 'node:test';
import assert from 'node:assert/strict';
import {billingMetadata,billingReference} from '../src/lib/billing/metadata';
const reference={userId:'fixture-user',market:'BR',priceId:'fixture-price'};
test('production routing stays compatible while staging is isolated in both directions',()=>{
  const production=billingMetadata(reference,'production'),staging=billingMetadata(reference,'development');
  assert.equal(production.seed_user_id,reference.userId);
  assert.equal(staging.seed_user_id,undefined); // Also ignored by the older published webhook.
  assert.deepEqual(billingReference(production,'production'),reference);
  assert.deepEqual(billingReference(staging,'staging'),reference);
  assert.equal(billingReference(staging,'production'),null);
  assert.equal(billingReference(production,'development'),null);
});
test('missing, mixed or unspecified routing cannot select a billing account',()=>{
  assert.equal(billingReference({},'production'),null);
  assert.equal(billingReference({seed_user_id:'only-user'},'production'),null);
  const mixed={...billingMetadata(reference,'production'),...billingMetadata(reference,'staging')};
  for(const env of ['production','staging'])assert.equal(billingReference(mixed,env),null);
  assert.throws(()=>billingReference({},undefined),/ENVIRONMENT_REQUIRED/);
  assert.throws(()=>billingMetadata(reference,'unknown'),/ENVIRONMENT_REQUIRED/);
});
