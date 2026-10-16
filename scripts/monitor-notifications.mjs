import {createHash} from 'node:crypto';

const kinds=['healthy','unhealthy'];
const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const sender=value=>typeof value==='string'&&/^[A-Za-z0-9._+-]+@auth\.appseedai\.com$/.test(value);
export const newMonitorState=()=>({version:1,notified:'healthy',pending:null});
export function validateMonitorState(state){
 if(!state||state.version!==1||!kinds.includes(state.notified)||Object.keys(state).sort().join(',')!=='notified,pending,version')throw Error('INVALID_MONITOR_STATE');
 const p=state.pending;if(p===null)return;
 if(!p||Object.keys(p).sort().join(',')!=='attempts,blocked,from,observedAt,retryAt,target,to'||!kinds.includes(p.target)||!date(p.observedAt)||!date(p.retryAt)||!Number.isInteger(p.attempts)||p.attempts<0||p.attempts>6||typeof p.blocked!=='boolean'||!sender(p.from)||p.to!=='seedtecnologias.suporte@gmail.com')throw Error('INVALID_MONITOR_STATE');
}
export function prepareMonitorNotice(previous,healthy,now,config){
 validateMonitorState(previous);
 if(typeof healthy!=='boolean'||!Number.isFinite(now)||!sender(config.from)||config.to!=='seedtecnologias.suporte@gmail.com')throw Error('MONITOR_NOTICE_CONFIGURATION');
 const state=structuredClone(previous),target=healthy?'healthy':'unhealthy';
 if(!state.pending&&state.notified!==target)state.pending={target,observedAt:new Date(now).toISOString(),retryAt:new Date(now).toISOString(),attempts:0,blocked:false,from:config.from,to:config.to};
 // Pending delivery retains its original recipient, event and message on retry.
 return state;
}
export function monitorNoticePayload(p){
 const recovering=p.target==='healthy';
 return {from:p.from,to:[p.to],reply_to:'suporte@appseedai.com',
  subject:recovering?'SeedAI — serviço voltou a responder':'SeedAI — falha detectada pelo monitor externo',
  text:(recovering?'O monitor independente voltou a receber uma resposta saudável de todas as verificações operacionais.':'O monitor independente não recebeu uma resposta saudável de todas as verificações operacionais. Confira a aplicação, o banco, o agendador e a fila de alertas nos painéis dos provedores.')+
   '\n\nObservação em UTC: '+p.observedAt+'\nEndereço verificado: https://appseedai.com/api/internal/health\n\nEste aviso não contém dados empresariais nem credenciais. Uma resposta saudável não certifica cada tarefa ou pagamento individual.'};
}
export async function deliverMonitorNotice(previous,key,now,transport=fetch){
 validateMonitorState(previous);const state=structuredClone(previous),p=state.pending;
 if(!p)return {state,code:'NO_NOTIFICATION'};
 if(!Number.isFinite(now)||!/^re_[A-Za-z0-9_-]{16,}$/.test(key??''))throw Error('MONITOR_NOTICE_CONFIGURATION');
 const age=now-Date.parse(p.observedAt);
 if(p.blocked||p.attempts>=6||age>=23*3600000||age<0){p.blocked=true;return {state,code:'DELIVERY_REVIEW_REQUIRED'};}
 if(now<Date.parse(p.retryAt))return {state,code:'RETRY_WAIT'};
 p.attempts++;
 const payload=monitorNoticePayload(p);
 const idempotencyKey='seedai-health/'+createHash('sha256').update(JSON.stringify(payload)).digest('hex');
 let status=0,accepted=false;
 try{
  const response=await transport('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},body:JSON.stringify(payload),redirect:'error',signal:AbortSignal.timeout(8000)});
  status=response.status;
  if(response.ok){const data=await response.json();accepted=typeof data.id==='string'&&/^[a-f0-9-]{36}$/.test(data.id);}
  else await response.body?.cancel();
 }catch{/* Never serialize provider errors or credentials. Same key on retry. */}
 if(accepted){state.notified=p.target;state.pending=null;return {state,code:'NOTIFICATION_ACCEPTED'};}
 if((status>=400&&status<500&&status!==429)||p.attempts>=6){p.blocked=true;return {state,code:'DELIVERY_REVIEW_REQUIRED'};}
 p.retryAt=new Date(now+Math.min(60,10*2**(p.attempts-1))*60000).toISOString();
 return {state,code:'RETRY_PENDING'};
}
