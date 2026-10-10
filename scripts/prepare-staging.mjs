import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {buildStagingBootstrap} from './staging-bootstrap.mjs';
import {loadStagingEnvironment,stagingDatabaseConfig} from './staging-config.mjs';

try{
  const {project}=stagingDatabaseConfig(await loadStagingEnvironment(),{requireKeys:false});
  const dir=new URL('../supabase/migrations/',import.meta.url);
  const migrations=await Promise.all((await readdir(dir)).filter(name=>name.endsWith('.sql')).sort().map(async name=>({name,sql:await readFile(new URL(name,dir),'utf8')})));
  const sql=buildStagingBootstrap(migrations,project);
  await mkdir(new URL('../.test-build/',import.meta.url),{recursive:true});
  await writeFile(new URL('../.test-build/staging-bootstrap.sql',import.meta.url),sql);
  console.log(JSON.stringify({project,migrations:migrations.length,output:'.test-build/staging-bootstrap.sql',remoteChanges:false}));
}catch(error){console.error(error.code==='ENOENT'?'Prepare primeiro o arquivo .env.staging.local.':error.message);process.exitCode=1;}
