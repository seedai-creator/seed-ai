'use server';
import {authorizeChat,companyContext} from '@/lib/auth/context';
import {getLocale} from '@/lib/i18n/server';
import {commercialDatabase,requireAdmin} from '@/lib/commercial/server';
import {radarHome,radarPreferences,radarObservability} from '@/lib/radar/server';
import {radarEnabled} from '@/lib/radar/domain';
import {validId} from '@/lib/auth/validation';
async function context(company:string){await authorizeChat({companyId:company});const c=await companyContext(company);if(!radarEnabled())throw Error('RADAR_DISABLED');return c;}
export async function readRadarHome(company:string){const c=await context(company);return radarHome(c.companyId,c.userId,await getLocale());}
export async function readRadarPreference(company:string){const c=await context(company);return radarPreferences(c.companyId,c.userId);}
export async function setRadarPreference(company:string,enabled:boolean){const c=await context(company);if(typeof enabled!=='boolean')throw Error('RADAR_INVALID_INPUT');const r=await commercialDatabase().from('radar_preferences').upsert({company_id:c.companyId,user_id:c.userId,proactive_insights_enabled:enabled,updated_at:new Date().toISOString()},{onConflict:'company_id,user_id'});if(r.error)throw Error('RADAR_SAVE_FAILED');}
export async function radarFeedback(company:string,id:string,action:'ACKNOWLEDGED'|'INVESTIGATING'|'DISMISSED'|'RESOLVED',feedback:'NOT_RELEVANT'|'WRONG_CONTEXT'|'ALREADY_KNOWN'|'INSUFFICIENT_DATA'|null=null){const c=await context(company);if(!validId(id)||!['ACKNOWLEDGED','INVESTIGATING','DISMISSED','RESOLVED'].includes(action))throw Error('RADAR_INVALID_INPUT');const r=await commercialDatabase().rpc('radar_feedback',{p_user:c.userId,p_company:c.companyId,p_insight:id,p_action:action,p_feedback:feedback});if(r.error)throw Error('RADAR_SAVE_FAILED');}
export async function readRadarAdmin(){await requireAdmin();return radarObservability();}
