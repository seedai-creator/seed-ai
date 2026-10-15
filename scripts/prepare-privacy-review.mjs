import {mkdir,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {loadStagingEnvironment,stagingDatabaseConfig} from './staging-config.mjs';
import {inspectPrivacyRequest} from './privacy-review.mjs';

// Staging only; read-only. An open DELETE_ACCOUNT request is mandatory.
const request=process.argv[2];
if(!/^[0-9a-f-]{36}$/i.test(request??''))throw Error('Provide the ID of an open staging deletion request.');
const config=stagingDatabaseConfig(await loadStagingEnvironment());
const db=createClient(config.url,config.serverKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(5000)})}});
const report=await inspectPrivacyRequest(db,request);
const directory=new URL('../.test-build/privacy-review/',import.meta.url);
await mkdir(directory,{recursive:true});
await writeFile(new URL(request+'.json',directory),JSON.stringify(report,null,2)+'\n');
console.log('Private review saved. No data changed or deletion scheduled.');
