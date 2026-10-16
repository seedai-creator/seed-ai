import test from 'node:test';
import assert from 'node:assert/strict';
import {stripeTestKey,fixtureMetadata,cleanupStripeFixture} from '../scripts/staging-stripe.mjs';
const run='00000000-0000-4000-8000-000000000000';
test('provider rehearsal rejects live credentials and cannot route test fixtures into published subscriptions',()=>{
 for(const key of [undefined,'','sk_live_placeholder','rk_live_placeholder','sb_secret_placeholder'])assert.throws(()=>stripeTestKey(key));
 assert.equal(stripeTestKey('sk_test_placeholder'),'sk_test_placeholder');
 const metadata=fixtureMetadata(run);
 assert.equal(metadata.phase13_fixture,run);
 for(const key of ['seed_user_id','seed_market','seed_price_id'])assert.equal(metadata[key],undefined);
 assert.throws(()=>fixtureMetadata('unbounded'));
});
test('cleanup refuses a live object even if fixture metadata matches',async()=>{
 let deleted=false;
 const stripe={customers:{list:async()=>({data:[{id:'cus_fixture',livemode:true,metadata:fixtureMetadata(run)}],has_more:false}),del:async()=>{deleted=true;}}};
 await assert.rejects(cleanupStripeFixture(stripe,{started:1,productId:'prod_fixture'},run));
 assert.equal(deleted,false);
});
test('cleanup never deletes a customer belonging to a different fixture',async()=>{
 let deleted=false;
 const stripe={customers:{list:async()=>({data:[{id:'cus_other',livemode:false,metadata:fixtureMetadata('11111111-1111-4111-8111-111111111111')}],has_more:false}),del:async()=>{deleted=true;}},products:{retrieve:async()=>{throw {statusCode:404};}}};
 await cleanupStripeFixture(stripe,{started:1,productId:'prod_fixture'},run);
 assert.equal(deleted,false);
});

test('clock cleanup refuses mismatched ownership before deleting any simulation',async()=>{
 let deleted=false;
 const stripe={testHelpers:{testClocks:{retrieve:async()=>({id:'clock_fixture',livemode:false,name:'Different test'}),del:async()=>{deleted=true;}}}};
 await assert.rejects(cleanupStripeFixture(stripe,{clockId:'clock_fixture'},run),/clock_ownership/);
 assert.equal(deleted,false);
});
