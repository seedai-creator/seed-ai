import {validatePolicy, type UsagePolicy} from './contracts';

// Reviewable proposal only. Importing this module never changes the catalog,
// a subscription, a Stripe price or an account's entitlement.
export const PRO_PROPOSAL = [
  {id:'PRO_1', amount_minor:9999, company_limit:1, allowance_usd:4},
  {id:'PRO_3', amount_minor:19999, company_limit:3, allowance_usd:8},
  {id:'PRO_5', amount_minor:39999, company_limit:5, allowance_usd:16},
] as const;
export function proposedProPolicy(cap:4|8|16):UsagePolicy {
  return validatePolicy({window:'month',analysis_limit_mode:'budget',
    target_usd:cap*.5,approaching_usd:cap*.7,soft_usd:cap*.8,
    warning_usd:cap*.85,heavy_usd:cap*.95,hard_usd:cap,
    // Retained for older readers; budget mode does not gate on these counters.
    interactions:200,diagnoses:200,max_concurrent:1,requests_per_minute:10,
    user_day_usd:cap,user_month_usd:cap,global_day_usd:10});
}
