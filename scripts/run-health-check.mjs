import {checkOperationalHealth} from './check-operational-health.mjs';
try {
 const result=await checkOperationalHealth(process.env);
 console.log(JSON.stringify(result));
 if(!result.healthy)process.exitCode=1;
}catch{console.error('HEALTH_MONITOR_CONFIGURATION');process.exitCode=1;}
