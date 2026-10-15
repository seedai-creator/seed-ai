import {timingSafeEqual} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';

export function healthAuthorized(header:string|null,token:string|undefined) {
  if(!token || token.length<32 || token.length>256 || !/^[A-Za-z0-9_-]+$/.test(token))return false;
  const expected=Buffer.from('Bearer '+token),actual=Buffer.from(header??'');
  return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
export type HealthObservation={database:boolean;lastCron:string|null;alertDeliveryBlocked:boolean};
export async function readOperationalHealthFrom(db:SupabaseClient,now=Date.now()):Promise<HealthObservation> {
  const cutoff=new Date(now-15*60000).toISOString();
  const [controls,cron,delivery]=await Promise.all([
    db.from('operations_controls').select('id').eq('id',true).single(),
    db.from('operational_events').select('created_at').eq('feature','scheduler').eq('code','CRON_FINISHED').order('created_at',{ascending:false}).limit(1).maybeSingle(),
    db.from('operational_alerts').select('id').or(`and(status.eq.FAILED,created_at.gte.${cutoff}),and(status.in.(QUEUED,SENDING),available_at.lt.${cutoff})`).limit(1),
  ]);
  if(controls.error||cron.error||delivery.error||!controls.data||!Array.isArray(delivery.data))throw Error('HEALTH_READ_FAILED');
  return {database:true,lastCron:cron.data?.created_at??null,alertDeliveryBlocked:delivery.data.length>0};
}
export function evaluateHealth(observation:HealthObservation,now:number) {
  const checks:{code:string;healthy:boolean}[]=[{code:'DATABASE',healthy:observation.database}];
  const last=observation.lastCron===null?NaN:Date.parse(observation.lastCron);
  checks.push({code:'SCHEDULER',healthy:Number.isFinite(now)&&Number.isFinite(last)&&last<=now+60000&&now-last<=5*60000});
  checks.push({code:'ALERT_DELIVERY',healthy:!observation.alertDeliveryBlocked});
  return {status:checks.every(c=>c.healthy)?'ok':'degraded',checks};
}
export async function healthResponse(request:Request,token:string|undefined,read:()=>Promise<HealthObservation>,now=Date.now()) {
  const headers={'Cache-Control':'no-store'};
  if(!healthAuthorized(request.headers.get('authorization'),token))return new Response(null,{status:401,headers});
  try {
    const result=evaluateHealth(await read(),now);
    return Response.json(result,{status:result.status==='ok'?200:503,headers});
  } catch {
    // Do not serialize errors, connection strings, metric values or customer data.
    return Response.json({status:'unavailable'},{status:503,headers});
  }
}
