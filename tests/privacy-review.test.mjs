import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPrivacyReview,validateDependencyInventory} from '../scripts/privacy-review.mjs';
const companyId='11111111-1111-4111-8111-111111111111';
const snapshot=(role='owner',members=1,owners=1)=>({memberships:[{companyId,role,members,owners}],subscriptionCount:0,financialRecordCount:0,activeJobCount:0});

test('shared company review never schedules deletion and requires transfer for its last owner',()=>{
 assert.equal(buildPrivacyReview(snapshot()).automaticDeletionAllowed,false);
 assert.equal(buildPrivacyReview(snapshot()).companies[0].handling,'EXCLUSIVE_COMPANY_REVIEW');
 assert.equal(buildPrivacyReview(snapshot('owner',2,1)).companies[0].handling,'TRANSFER_OWNERSHIP_FIRST');
 assert.equal(buildPrivacyReview(snapshot('member',2,1)).companies[0].handling,'PRESERVE_SHARED_COMPANY');
 assert.equal(buildPrivacyReview(snapshot('owner',2,2)).companies[0].handling,'PRESERVE_SHARED_COMPANY');
 assert.equal(buildPrivacyReview(snapshot('member',1,0)).companies[0].handling,'OWNERLESS_COMPANY_REVIEW');
});
test('financial history, subscriptions and jobs require explicit reconciliation, never implicit erasure',()=>{
 const report=buildPrivacyReview({...snapshot(),subscriptionCount:1,financialRecordCount:3,activeJobCount:1});
 for(const review of ['RECONCILE_SUBSCRIPTIONS','REVIEW_FINANCIAL_RETENTION','STOP_AND_RECONCILE_IN_FLIGHT_WORK'])assert.ok(report.requiredReviews.includes(review));
 assert.equal(report.automaticDeletionAllowed,false);
});
test('incomplete inventory is an error, not a false zero or permission to delete',()=>{
 assert.throws(()=>buildPrivacyReview({...snapshot(),financialRecordCount:null}));
 assert.throws(()=>buildPrivacyReview(snapshot('member',2,2)));
 assert.throws(()=>buildPrivacyReview(snapshot('owner',2,0)));
 assert.throws(()=>buildPrivacyReview({...snapshot(),memberships:Array.from({length:26},()=>snapshot().memberships[0])}));
});

test('dependency inventory validates subject and every job family and discards unrelated data',()=>{
 const data={version:1,request_id:companyId,dependencies:[{table:'profiles',column:'id',nullable:false,delete_action:'CASCADE',count:1,content:'CANARY'}],active_jobs:{ai_requests:1,journal_jobs:0,business_model_jobs:0,external_research_runs:0,growth_map_requests:2},private:'CANARY'};
 const parsed=validateDependencyInventory(data,companyId);
 assert.equal(parsed.activeJobs.growth_map_requests,2);assert.doesNotMatch(JSON.stringify(parsed),/CANARY/);
 assert.throws(()=>validateDependencyInventory({...data,request_id:'wrong'},companyId));
 assert.throws(()=>validateDependencyInventory({...data,active_jobs:{...data.active_jobs,growth_map_requests:null}},companyId));
 assert.throws(()=>validateDependencyInventory({...data,dependencies:[]},companyId));
 assert.throws(()=>validateDependencyInventory({...data,dependencies:[...data.dependencies,...data.dependencies]},companyId));
});
