// Separate routing namespaces prevent a shared Stripe test account from
// granting staging subscriptions through the published webhook (or vice versa).
type BillingReference = {userId:string;market:string;priceId:string};
function prefix(environment:string|undefined) {
  if(environment==='production')return 'seed_';
  if(environment==='staging'||environment==='development')return 'seed_staging_';
  throw new Error('BILLING_ENVIRONMENT_REQUIRED');
}
export function billingMetadata(reference:BillingReference,environment:string|undefined) {
  const p=prefix(environment);
  return {[p+'user_id']:reference.userId,[p+'market']:reference.market,[p+'price_id']:reference.priceId};
}
export function billingReference(metadata:Record<string,string>,environment:string|undefined):BillingReference|null {
  const p=prefix(environment),other=p==='seed_'?'seed_staging_':'seed_';
  if(['user_id','market','price_id'].some(key=>metadata[other+key]))return null;
  const userId=metadata[p+'user_id'],market=metadata[p+'market'],priceId=metadata[p+'price_id'];
  if(!userId||!market||!priceId)return null;
  return {userId,market,priceId};
}
