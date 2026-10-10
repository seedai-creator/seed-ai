import {createClient} from '@supabase/supabase-js';
import {loadStagingEnvironment,stagingDatabaseConfig} from './staging-config.mjs';

try{
  const {project,url,publicKey,serverKey}=stagingDatabaseConfig(await loadStagingEnvironment());
  const settings=await fetch(url+'/auth/v1/settings',{headers:{apikey:publicKey},redirect:'error',signal:AbortSignal.timeout(15000)});
  if(settings.status!==200)throw Error('A chave publica nao foi validada. Confira as chaves do projeto de staging.');
  const db=createClient(url,serverKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,redirect:'error',signal:AbortSignal.timeout(15000)})}});
  const result=await db.from('operations_controls').select('closed_beta,disable_ai,disable_uploads').eq('id',true).single();
  if(result.error){
    if(result.error.code==='PGRST205'){console.log(JSON.stringify({project,publicKeyAccepted:true,schemaInstalled:false,next:'Apply the staging bootstrap to the empty staging project.'}));}
    else throw Error('Nao foi possivel validar o banco. Confira a chave secreta e a instalacao do schema.');
    process.exitCode=1;
  }else console.log(JSON.stringify({project,publicKeyAccepted:true,schemaInstalled:true,controls:result.data}));
}catch(error){console.error(error.code==='ENOENT'?'Prepare primeiro o arquivo .env.staging.local.':error.message==='fetch failed'?'Nao foi possivel conectar ao projeto de staging.':error.message);process.exitCode=1;}
