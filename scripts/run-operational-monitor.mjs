import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {checkOperationalHealth} from './check-operational-health.mjs';
import {validateMonitorState,prepareMonitorNotice,deliverMonitorNotice,newMonitorState} from './monitor-notifications.mjs';

const directory=new URL('../.test-build/monitor-state/',import.meta.url),file=new URL('state.json',directory);
async function persist(state){await mkdir(directory,{recursive:true});await writeFile(new URL('state.tmp',directory),JSON.stringify(state));await rename(new URL('state.tmp',directory),file);}
try{
 if(process.env.SEED_MONITOR_ALERTS_ENABLED!=='true')throw Error('MONITOR_NOT_ENABLED');
 let previous;
 try{const raw=await readFile(file,'utf8');if(raw.length>4096)throw Error('STATE_TOO_LARGE');previous=JSON.parse(raw);}
 catch(error){if(error.code==='ENOENT'&&process.env.SEED_MONITOR_INITIALIZE==='true')previous=newMonitorState();else throw error;}
 validateMonitorState(previous);
 const result=await checkOperationalHealth(process.env);
 const state=prepareMonitorNotice(previous,result.healthy,Date.now(),{from:process.env.SEED_MONITOR_FROM,to:process.env.SEED_MONITOR_TO});
 await persist(state); // Preserve the stable event before any network send.
 const delivery=await deliverMonitorNotice(state,process.env.SEED_MONITOR_RESEND_KEY,Date.now());
 await persist(delivery.state);
 console.log(JSON.stringify({healthy:result.healthy,code:result.code,notification:delivery.code}));
 if(!result.healthy||delivery.state.pending)process.exitCode=1;
}catch{console.error('OPERATIONAL_MONITOR_FAILED_CHECK_CONFIGURATION_AND_STATE');process.exitCode=1;}
