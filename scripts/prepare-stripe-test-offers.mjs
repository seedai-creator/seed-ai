// Preparation only: creates ARCHIVED test products/prices, never a customer,
// Checkout Session, payment, subscription, webhook or live object.
import Stripe from 'stripe';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {PRO_PROPOSAL} from '../.test-build/src/lib/commercial/pro-proposal.js';
import {testOnlyKey} from './stripe-preparation.mjs';
import {validateTestPrice} from '../.test-build/src/lib/billing/contracts.js';
const report={startedAt:new Date().toISOString(),mode:'test',purchasable:false,subscriptionsCreated:0,offers:[]};
try{
 if(process.argv.length!==3||process.argv[2]!=='--prepare-inactive')throw Error('EXPLICIT_PREPARATION_REQUIRED');
 const env=parseEnv(await readFile(new URL('../.env.local',import.meta.url),'utf8'));
 const stripe=new Stripe(testOnlyKey(env.STRIPE_SECRET_KEY?.trim()),{timeout:15000,maxNetworkRetries:1});
 if((await stripe.balance.retrieve()).livemode!==false)throw Error('TEST_MODE_NOT_CONFIRMED');
 for(const offer of PRO_PROPOSAL){
  const version=offer.id+'_V1',productId='seedai_'+version.toLowerCase()+'_prepared_test';
  let product;
  try{product=await stripe.products.retrieve(productId);}catch(error){if(error.statusCode!==404)throw error;}
  if(!product)product=await stripe.products.create({id:productId,name:`SeedAI PRO · ${offer.company_limit} empresa(s) · preparação`,active:false,
   metadata:{seed_offer:version,seed_preparation:'inactive_test_only'}},{idempotencyKey:'seedai-prepare-product-'+version});
  if(product.deleted||product.livemode||product.active||product.metadata.seed_offer!==version)throw Error('PREPARATION_STATE_MISMATCH');
  const lookup='seedai_br_'+version.toLowerCase()+'_prepared_test';
  const list=await stripe.prices.list({lookup_keys:[lookup],limit:2});
  if(list.has_more||list.data.length>1)throw Error('PREPARATION_STATE_MISMATCH');
  const price=list.data[0]??await stripe.prices.create({product:product.id,active:false,currency:'brl',unit_amount:offer.amount_minor,
   recurring:{interval:'month'},lookup_key:lookup,metadata:{seed_offer:version,seed_preparation:'inactive_test_only'}},
   {idempotencyKey:'seedai-prepare-price-'+version});
  if(price.active||price.livemode||price.product!==product.id||price.metadata.seed_offer!==version)throw Error('PREPARATION_STATE_MISMATCH');
  // Validate the contract fields without pretending the archived price is sellable.
  validateTestPrice({...price,active:true},{currency:'BRL',amount_minor:offer.amount_minor});
  report.offers.push({id:version,companyLimit:offer.company_limit,allowanceUsd:offer.allowance_usd,
   amountMinor:offer.amount_minor,currency:'BRL',interval:'month',productId:product.id,priceId:price.id,active:false,livemode:false});
 }
 report.passed=true;
}catch(error){report.passed=false;report.code=['EXPLICIT_PREPARATION_REQUIRED','STRIPE_TEST_KEY_REQUIRED','TEST_MODE_NOT_CONFIRMED','PREPARATION_STATE_MISMATCH'].includes(error.message)?error.message:'PREPARATION_FAILED';process.exitCode=1;}
await mkdir(new URL('../.test-build/',import.meta.url),{recursive:true});
await writeFile(new URL('../.test-build/stripe-inactive-offers.json',import.meta.url),JSON.stringify({...report,finishedAt:new Date().toISOString()},null,2)+'\n');
console.log(JSON.stringify(report));
