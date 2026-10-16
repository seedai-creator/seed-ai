import test from 'node:test';
import assert from 'node:assert/strict';
import {findMonitorState} from '../scripts/restore-monitor-state.mjs';
const env={GITHUB_REPOSITORY:'seedai-creator/seed-ai',GITHUB_REF:'refs/heads/main',GITHUB_RUN_ATTEMPT:'1',GITHUB_RUN_ID:'300'};
const run={id:200,run_number:2,head_branch:'main',head_repository:{full_name:env.GITHUB_REPOSITORY},path:'.github/workflows/operational-health.yml',event:'workflow_dispatch',status:'completed',run_attempt:1};
const job={name:'independent-monitor',status:'completed',conclusion:'failure'};
const artifact={name:'seedai-health-state-1',expired:false,size_in_bytes:500};
function fixture({runs=[run],jobs=[job],artifacts=[artifact]}={}){return async path=>path.includes('/jobs?')?{jobs}:path.includes('/artifacts?')?{artifacts}:{workflow_runs:runs};}
test('state resumes the latest failed monitor run, without falling back to an older healthy state',async()=>{
 assert.deepEqual(await findMonitorState(env,fixture()),{runId:200,artifact:'seedai-health-state-1'});
 for(const artifacts of [[],[{...artifact,expired:true}],[{...artifact,size_in_bytes:65537}],[artifact,artifact]])await assert.rejects(findMonitorState(env,fixture({artifacts})),/MONITOR_STATE/);
 await assert.rejects(findMonitorState({...env,SEED_MONITOR_INITIALIZE:'true'},fixture()),/RECONCILIATION/);
});
test('monitor state cannot come from a PR, fork, unrelated workflow, unfinished run or rerun',async()=>{
 for(const override of [{head_branch:'feature'},{head_repository:{full_name:'external/fork'}},{path:'.github/workflows/other.yml'},{event:'pull_request'},{status:'in_progress'}])await assert.rejects(findMonitorState(env,fixture({runs:[{...run,...override}]})));
 for(const override of [{GITHUB_REPOSITORY:'external/fork'},{GITHUB_REF:'refs/heads/feature'},{GITHUB_RUN_ATTEMPT:'2'}])await assert.rejects(findMonitorState({...env,...override},fixture()),/UNTRUSTED/);
});
test('first initialization is explicit and disabled/older read-only jobs do not provide state',async()=>{
 await assert.rejects(findMonitorState(env,fixture({runs:[]})),/INITIALIZATION_REQUIRED/);
 assert.equal(await findMonitorState({...env,SEED_MONITOR_INITIALIZE:'true'},fixture({runs:[]})),null);
 for(const jobs of [[{...job,conclusion:'skipped'}],[{...job,name:'health'}]])assert.equal(await findMonitorState({...env,SEED_MONITOR_INITIALIZE:'true'},fixture({jobs})),null);
});
