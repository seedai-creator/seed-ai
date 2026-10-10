import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {loadStagingEnvironment} from './staging-config.mjs';
import {stagingRuntimeEnvironment} from './staging-runtime.mjs';

const command=process.argv[2];
if(!['dev','build','start'].includes(command))throw Error('Use dev, build or start.');
const names=[];
for(const file of ['.env','.env.local','.env.development','.env.development.local','.env.production','.env.production.local']){
  try{names.push(...Object.keys(parseEnv(await readFile(new URL('../'+file,import.meta.url),'utf8'))));}
  catch(error){if(error.code!=='ENOENT')throw Error('Unable to inspect environment variable names.');}
}
const env=stagingRuntimeEnvironment(await loadStagingEnvironment(),names);
env.NODE_ENV=command==='dev'?'development':'production';
console.log('SEED staging core: isolated database, AI and billing disabled, operations enabled.');
const args=command==='build'?['build']:[command,'--hostname','127.0.0.1','--port','3002'];
const child=spawn(process.execPath,['node_modules/next/dist/bin/next',...args],{env,stdio:'inherit'});
child.on('error',()=>{console.error('Unable to start staging.');process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
