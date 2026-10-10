import {featureEnabled} from '../operations/flags';
/** Detection limits are evidence/processing safeguards, not universal business thresholds. */
export const RADAR_CONFIG = Object.freeze({version:'9.7.0',minimumPeriods:3,minimumRepetition:3,historyDays:120,staleDays:45,anomalyPeriods:6,maxRows:1200,maxSignals:80,maxHome:1,maxContext:3,cooldownHours:72,dismissDays:14,dailyBudget:2,scanHours:6,leaseSeconds:90,maxAttempts:4});
export const radarEnabled=()=>featureEnabled('radar');
export const DOMAINS=['SALES','MARKETING','FINANCE','CUSTOMERS','OPERATIONS','CAPACITY','GOALS','EXECUTION'] as const;
export const SIGNAL_TYPES=['CHANGE','TREND','ANOMALY','THRESHOLD','REPETITION','GOAL_DEVIATION','CAPACITY_PRESSURE','EXECUTION_RISK','OPPORTUNITY','RISK','ASSUMPTION_DEVIATION'] as const;
export type Domain=typeof DOMAINS[number];
export type SignalType=typeof SIGNAL_TYPES[number];
export type Level='LOW'|'MODERATE'|'HIGH';
export type Source={table:string;id:string;version:number};
export type Range={min:number;max:number;approximate:boolean};
export type Scope={product:string|null;channel:string|null;location:string|null;entity:string|null};
export const EMPTY_SCOPE:Scope={product:null,channel:null,location:null,entity:null};
export const scopeKey=(s:Scope)=>JSON.stringify([s.product,s.channel,s.location,s.entity]);
export type Point={metric:string;value:Range;unit:string;currency:string|null;scope:Scope;start:string;end:string;complete:boolean;quality:'CONFIRMED'|'STALE'|'CONFLICTING'|'PROVISIONAL';sources:Source[]};
export type Problem={topic:string;scope:Scope;day:string;source:Source;occurrence:string;confidence:'LOW'|'MEDIUM'|'HIGH'};
export type Watch={id:string;source:Source;kind:'THRESHOLD'|'GOAL';metric:string;unit:string;currency:string|null;scope:Scope;period:'DAY'|'WEEK'|'MONTH'|'YEAR'|'ANY';bound:number;comparison:'LT'|'GT';baseline:number|null;start:string|null;deadline:string|null;trajectory:'NONE'|'LINEAR_EXPLICIT'};
export type Capacity={period:"DAY"|"WEEK"|"MONTH";value:Range;metric:string;unit:string;currency:string|null;scope:Scope;source:Source;sources?:Source[];quality:Point['quality']};
export type Task={source:Source;kind:'ACTION'|'EXPERIMENT'|'DECISION'|'PLAN';status:string;due:string|null;review:string|null;strategic:boolean;blocked:boolean;hasResult:boolean;scope:Scope;label?:string};
export type Assumption={source:Source;simulationId:string;resultSource:Source;status:'NOT_SUPPORTED'|'SUPPORTED'|'UNKNOWN';scope:Scope;expected:Range;observed:Range|null;unit:string;currency:string|null;metric:string;accepted:boolean;material:boolean};
export type Snapshot={company:string;day:string;points:Point[];problems:Problem[];capacities:Capacity[];watches:Watch[];tasks:Task[];assumptions:Assumption[];limited:boolean;relevantScopes:string[];changes:{source:Source;scope:Scope;kind:string;related:boolean}[]};
export type Signal={fingerprint:string;type:SignalType;domain:Domain;rule:string;ruleVersion:string;scope:Scope;metric:string;direction:'UP'|'DOWN'|'DUE'|'REPEATED'|'RECOVERED';evidence:Source[];values:Point[];baseline:Range|null;current:Range|null;confidence:'LOW'|'MEDIUM'|'HIGH';impact:Level;urgency:Level;actionable:boolean;strategic:boolean;persistence:number;quality:string[];knowledge_source_scope:'INTERNAL'|'EXTERNAL_INTELLIGENCE';details:Record<string,unknown>};
export type Evaluation={signals:Signal[];recoveries:string[];complete:boolean};
export type Gate={attention:'OBSERVE'|'ATTENTION'|'HIGH_ATTENTION';surface:boolean;mode:'HOME'|'CONVERSATION_CONTEXT';reason:string;suppression:string|null};
export function fingerprint(s:Pick<Signal,'type'|'domain'|'scope'|'metric'>&Partial<Pick<Signal,'values'|'details'>>){return JSON.stringify([s.domain,s.type,scopeKey(s.scope),s.metric,s.values?.at(-1)?.unit??s.details?.unit??null,s.values?.at(-1)?.currency??s.details?.currency??null,s.details?.period??null]);}
export function cleanSources(sources:Source[]){return [...new Map(sources.map(s=>[s.table+':'+s.id,s])).values()].slice(0,24);}
export function sameDimension(a:Point,b:Point){return a.metric===b.metric&&a.unit===b.unit&&a.currency===b.currency&&scopeKey(a.scope)===scopeKey(b.scope);}
export function finiteRange(r:Range){return Number.isFinite(r.min)&&Number.isFinite(r.max)&&r.min<=r.max&&Math.abs(r.min)<=1e15&&Math.abs(r.max)<=1e15;}

