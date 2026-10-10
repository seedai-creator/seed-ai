import {featureEnabled} from '../operations/flags';
import {validId} from '../auth/validation';
export const SOURCES=['PLAN','GOAL','RADAR','DIAGNOSIS','GROWTH','WEEKLY','RESULT','DECISION','CONVERSATION'] as const;
export type Source=typeof SOURCES[number];
export type Reference={type:Source;id:string;version:string};
export type Destination='chat'|'conversation'|'company'|'diagnosis'|'plan';
export type Priority='HIGH_ATTENTION'|'BLOCKED'|'NEXT_STEP'|'GOAL_RISK'|'REVIEW'|'ATTENTION'|'GOAL'|'WEEKLY'|'GROWTH'|'RESULT'|'OPPORTUNITY'|'CONTINUITY';
export type HomeState='NEW_USER'|'LOW_CONTEXT'|'ACTIVE_BUSINESS'|'ACTIVE_PLAN'|'ATTENTION_REQUIRED'|'GOAL_AT_RISK'|'NO_ACTIVE_GOAL'|'NO_ACTIVE_PLAN'|'RECENT_RESULT'|'WEEKLY_REVIEW_AVAILABLE';
export type Item={ref:Reference;title:string;summary:string;note:string|null;eyebrow:string;updatedAt:string;cta:string;destination:Destination;facts:{label:string;value:string}[];links?:{url:string;title:string;at:string}[];progress:number|null;progressLabel:string|null;dismissible:boolean};
export type ContextRow={key:string;kind:string;source_id:string;version:number;value:string;observed_at:string};
export type Candidate={company:string;item:Item;priority:Priority;storyKeys:string[];expiresAt:string;acknowledged:boolean;context:ContextRow[];planId?:string;conversationId?:string;growthDimension?:string;radarVersion?:number};
export type ViewModel={companyId:string;generatedAt:string;refreshAfterMs:number;states:HomeState[];items:Item[];partial:boolean;canConverse:boolean};
export type ResolvedAction={reference:Reference;destination:Destination;prompt:string;conversationId:string|null;planId:string|null};
export const cockpitEnabled=()=>featureEnabled('cockpit');
export const REFRESH_MS=60_000;
export function parseReference(value:unknown):Reference{
 if(!value||typeof value!=='object')throw Error('COCKPIT_REFERENCE_INVALID');
 const r=value as Reference;
 if(!SOURCES.includes(r.type)||!validId(r.id)||typeof r.version!=='string'||!/^[A-Za-z0-9:_.+-]{1,80}$/.test(r.version))throw Error('COCKPIT_REFERENCE_INVALID');
 return {type:r.type,id:r.id,version:r.version};
}
export const referenceKey=(r:Reference)=>r.type+':'+r.id+':'+r.version;
export function isFresh(updatedAt:string,days:number,now:Date){const age=now.getTime()-Date.parse(updatedAt);return Number.isFinite(age)&&age>=-300_000&&age<=days*86400_000;}
export const expires=(updatedAt:string,days:number)=>new Date(Date.parse(updatedAt)+days*86400_000).toISOString();
