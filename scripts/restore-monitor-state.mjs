import {execFileSync} from 'node:child_process';
import {mkdir,readFile,readdir} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {validateMonitorState} from './monitor-notifications.mjs';

const repository='seedai-creator/seed-ai',workflow='.github/workflows/operational-health.yml';
export async function findMonitorState(env,api){
 if(env.GITHUB_REPOSITORY!==repository||env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_RUN_ATTEMPT!=='1'||!/^\d+$/.test(env.GITHUB_RUN_ID??''))throw Error('UNTRUSTED_MONITOR_RUN');
 const initialize=env.SEED_MONITOR_INITIALIZE==='true';
 const response=await api('actions/workflows/operational-health.yml/runs?branch=main&per_page=30');
 if(!Array.isArray(response.workflow_runs))throw Error('INVALID_RUN_LIST');
 const runs=response.workflow_runs.filter(r=>String(r.id)!==env.GITHUB_RUN_ID).sort((a,b)=>b.run_number-a.run_number);
 for(const run of runs){
  if(!Number.isSafeInteger(run.id)||run.head_branch!=='main'||run.head_repository?.full_name!==repository||run.path!==workflow||!['schedule','workflow_dispatch'].includes(run.event))throw Error('UNTRUSTED_STATE_SOURCE');
  const {jobs}=await api(`actions/runs/${run.id}/jobs?per_page=100`);
  if(!Array.isArray(jobs))throw Error('INVALID_JOB_LIST');
  const job=jobs.find(j=>j.name==='independent-monitor');
  // Older read-only workflow and deliberately disabled runs have no state.
  if(!job||job.conclusion==='skipped')continue;
  if(run.status!=='completed'||job.status!=='completed')throw Error('MONITOR_RUN_NOT_FINISHED');
  if(initialize)throw Error('EXISTING_MONITOR_REQUIRES_RECONCILIATION');
  const {artifacts}=await api(`actions/runs/${run.id}/artifacts?per_page=100`);
  const name=`seedai-health-state-${run.run_attempt}`;
  const matches=artifacts?.filter(a=>a.name===name);
  if(!matches||matches.length!==1||matches[0].expired||matches[0].size_in_bytes>65536||matches[0].size_in_bytes<1)throw Error('MONITOR_STATE_MISSING_OR_EXPIRED');
  return {runId:run.id,artifact:name};
 }
 if(response.total_count>30)throw Error('MONITOR_STATE_HISTORY_REQUIRES_REVIEW');
 if(!initialize)throw Error('MONITOR_STATE_INITIALIZATION_REQUIRED');
 return null;
}

async function main(){
 const env=process.env;
 const api=path=>JSON.parse(execFileSync('gh',['api',`repos/${repository}/${path}`],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:15000,maxBuffer:1048576}));
 const selection=await findMonitorState(env,api);
 if(!selection){console.log('MONITOR_STATE_EXPLICIT_INITIALIZATION');return;}
 const directory=new URL('../.test-build/monitor-state/',import.meta.url);
 await mkdir(directory,{recursive:true});
 if((await readdir(directory)).length)throw Error('MONITOR_STATE_DIRECTORY_NOT_EMPTY');
 execFileSync('gh',['run','download',String(selection.runId),'--repo',repository,'--name',selection.artifact,'--dir',fileURLToPath(directory)],{stdio:['ignore','pipe','pipe'],timeout:20000});
 if((await readdir(directory)).join(',')!=='state.json')throw Error('INVALID_MONITOR_ARTIFACT');
 const raw=await readFile(new URL('state.json',directory),'utf8');
 if(raw.length>4096)throw Error('INVALID_MONITOR_ARTIFACT');
 validateMonitorState(JSON.parse(raw));
 console.log('MONITOR_STATE_RESTORED');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('MONITOR_STATE_RESTORE_FAILED_REVIEW_PREVIOUS_RUN');process.exitCode=1;});
