import {obj,list,nullable,validDate,localDay} from '../journal/domain';
import {validateSchema} from '../reliability/contracts';
import {validTimezone} from '../i18n/market';

export const GOAL_TYPES=['GROWTH','PROFITABILITY','EFFICIENCY','CUSTOMER','SALES','MARKETING','OPERATIONAL','CAPACITY','STRATEGIC','RISK_REDUCTION','GENERAL'] as const;
export const DIRECTIONS=['INCREASE','DECREASE','MAINTAIN','REACH','RANGE','COMPLETE'] as const;
export const STATUSES=['DRAFT','ACTIVE','PAUSED','ACHIEVED','MISSED','CANCELLED','SUPERSEDED'] as const;
export const PERIODS=['DAY','WEEK','MONTH','QUARTER','YEAR','CUSTOM_RANGE','UNKNOWN'] as const;
export const SCOPES=['COMPANY','LOCATION','PRODUCT','SERVICE','CHANNEL','CUSTOMER_SEGMENT','TEAM','SALES_PROCESS','OPERATION','BUSINESS_UNIT','PLAN','EXPERIMENT'] as const;
const en=(values:readonly string[])=>({type:'string',enum:values});
const text={type:'string',minLength:1,maxLength:500},short={type:'string',minLength:1,maxLength:120};
const num=nullable({type:'number',minimum:-1e15,maximum:1e15});
export const RANGE_SCHEMA=obj({value:num,min:num,max:num,approximate:{type:'boolean'}});
export type Amount={value:number|null;min:number|null;max:number|null;approximate:boolean};
export const EMPTY_AMOUNT:Amount={value:null,min:null,max:null,approximate:false};
export const SCOPE_SCHEMA=obj({type:en(SCOPES),id:nullable(short)});
export type Scope={type:typeof SCOPES[number];id:string|null};
export const COMPANY_SCOPE:Scope={type:'COMPANY',id:null};
export const LINK_SCHEMA=obj({metric:short,role:en(['PRIMARY','SUPPORTING','GUARDRAIL']),timing:en(['LEADING','LAGGING','CONTEXT']),min:num,max:num});
export type MetricLink={metric:string;role:'PRIMARY'|'SUPPORTING'|'GUARDRAIL';timing:'LEADING'|'LAGGING'|'CONTEXT';min:number|null;max:number|null};
export const GOAL_SCHEMA=obj({title:short,description:nullable(text),type:en(GOAL_TYPES),direction:en(DIRECTIONS),baseline:RANGE_SCHEMA,target:RANGE_SCHEMA,unit:nullable(short),currency:nullable(short),period:en(PERIODS),baseline_start:nullable(short),baseline_end:nullable(short),start:nullable(short),deadline:nullable(short),review_on:nullable(short),scope:SCOPE_SCHEMA,primary_metric:nullable(short),primary:{type:'boolean'},parent_id:nullable(short),plan_id:nullable(short),reason:nullable(text),success:nullable(text),consistency_periods:{type:'integer',minimum:1,maximum:12},milestones:list(obj({id:short,title:short,done:{type:'boolean'},deadline:nullable(short),weight:nullable({type:'number',minimum:0.001,maximum:100})}),12),links:list(LINK_SCHEMA,8)});
export type GoalSpec={title:string;description:string|null;type:typeof GOAL_TYPES[number];direction:typeof DIRECTIONS[number];baseline:Amount;target:Amount;unit:string|null;currency:string|null;period:typeof PERIODS[number];baseline_start:string|null;baseline_end:string|null;start:string|null;deadline:string|null;review_on:string|null;scope:Scope;primary_metric:string|null;primary:boolean;parent_id:string|null;plan_id:string|null;reason:string|null;success:string|null;consistency_periods:number;milestones:{id:string;title:string;done:boolean;deadline:string|null;weight:number|null}[];links:MetricLink[]};
export type Goal={id:string;company_id:string;version:number;status:typeof STATUSES[number];spec:GoalSpec;timezone:string;locale:string;created_at:string;updated_at:string};
export const OBSERVATION_SCHEMA=obj({metric:short,amount:RANGE_SCHEMA,boolean:nullable({type:'boolean'}),text:nullable(text),unit:short,currency:nullable(short),period:en(PERIODS),start:nullable(short),end:nullable(short),complete:{type:'boolean'},scope:SCOPE_SCHEMA,confidence:en(['LOW','MEDIUM','HIGH']),source:en(['USER_EXPLICIT','CHAT','JOURNAL','DOCUMENT','IMPORT','INTEGRATION','SYSTEM_DERIVED','MANUAL_EDIT','EXTERNAL']),quality:en(['VALID','PROVISIONAL','CONFLICTING','STALE','INVALID','UNKNOWN']),attribution:nullable(text)});
export type ObservationData={metric:string;amount:Amount;boolean:boolean|null;text:string|null;unit:string;currency:string|null;period:typeof PERIODS[number];start:string|null;end:string|null;complete:boolean;scope:Scope;confidence:'LOW'|'MEDIUM'|'HIGH';source:'USER_EXPLICIT'|'CHAT'|'JOURNAL'|'DOCUMENT'|'IMPORT'|'INTEGRATION'|'SYSTEM_DERIVED'|'MANUAL_EDIT'|'EXTERNAL';quality:'VALID'|'PROVISIONAL'|'CONFLICTING'|'STALE'|'INVALID'|'UNKNOWN';attribution:string|null};
export type Observation=ObservationData&{id:string;company_id:string;version:number;observed_at:string;source_message_id:string|null;source_table:string;trace?:CalculationTrace};
export type CalculationTrace={formula:string;version:1;inputs:{id:string;version:number;table:string}[];calculated_at:string;period:[string|null,string|null];scope:Scope;output:Amount};
export function bounds(v:Amount){return v.value!==null?{min:v.value,max:v.value}:v.min!==null&&v.max!==null?{min:v.min,max:v.max}:null;}
export function validateAmount(v:Amount){if(!validateSchema(v,RANGE_SCHEMA)||(v.min===null)!==(v.max===null)||v.min!==null&&(v.min>v.max!||v.value!==null))throw Error('GOAL_AMOUNT_INVALID');}
export function sameScope(a:Scope,b:Scope){return a.type===b.type&&a.id===b.id;}
function validateScope(s:Scope){if((s.type==='COMPANY')!==(s.id===null))throw Error('GOAL_SCOPE_INVALID');}
function dates(start:string|null,end:string|null){if((start===null)!==(end===null)||start&&(!validDate(start)||!validDate(end!)||start>end!))throw Error('GOAL_PERIOD_INVALID');}
function currency(unit:string|null,code:string|null){if(unit==='money'&&!code||unit!=='money'&&code||code&&!Intl.supportedValuesOf('currency').includes(code))throw Error('GOAL_CURRENCY_INVALID');}
export function validateGoal(raw:unknown):GoalSpec{
 if(!validateSchema(raw,GOAL_SCHEMA))throw Error('GOAL_INVALID');const s=raw as GoalSpec;
 validateAmount(s.baseline);validateAmount(s.target);validateScope(s.scope);dates(s.baseline_start,s.baseline_end);currency(s.unit,s.currency);
 for(const d of [s.start,s.deadline,s.review_on,...s.milestones.map(m=>m.deadline)])if(d&&!validDate(d))throw Error('GOAL_DATE_INVALID');
 if(s.start&&s.deadline&&s.start>=s.deadline)throw Error('GOAL_DEADLINE_INVALID');
 if(s.direction==='INCREASE'&&s.target.value!==null&&s.baseline.value!==null&&s.target.value<=s.baseline.value||s.direction==='DECREASE'&&s.target.value!==null&&s.baseline.value!==null&&s.target.value>=s.baseline.value)throw Error('GOAL_DIRECTION_INVALID');
 if(new Set(s.milestones.map(m=>m.id)).size!==s.milestones.length||s.milestones.some(m=>m.weight!==null)&&s.milestones.some(m=>m.weight===null))throw Error('GOAL_MILESTONE_INVALID');
 if(s.links.filter(l=>l.role==='PRIMARY').length>1||s.links.some(l=>l.role==='PRIMARY'&&l.metric!==s.primary_metric)||s.links.some(l=>l.min!==null&&l.max!==null&&l.min>l.max))throw Error('GOAL_LINK_INVALID');
 return s;
}
export function goalMissing(s:GoalSpec){const m:string[]=[];
 if(!s.deadline&&!s.review_on)m.push('deadline');
 if(s.direction==='COMPLETE'){if(!s.success||!s.milestones.length)m.push('success');return m;}
 if(!s.primary_metric)m.push('metric');if(!s.unit)m.push('unit');if(s.period==='UNKNOWN')m.push('period');
 if(!bounds(s.target)||s.direction==='RANGE'&&s.target.min===null)m.push('target');
 if(['INCREASE','DECREASE'].includes(s.direction)&&!bounds(s.baseline))m.push('baseline');return m;
}
export function validateObservation(raw:unknown):ObservationData{
 if(!validateSchema(raw,OBSERVATION_SCHEMA))throw Error('METRIC_INVALID');const o=raw as ObservationData;
 validateAmount(o.amount);validateScope(o.scope);dates(o.start,o.end);currency(o.unit,o.currency);
 if(o.complete&&o.period!=='CUSTOM_RANGE'&&o.period!=='UNKNOWN'&&periodShape(o.start,o.end)!==o.period)throw Error('METRIC_INCOMPLETE_PERIOD');
 if(o.complete&&(!o.start||!o.end||o.period==='UNKNOWN'))throw Error('METRIC_PERIOD_REQUIRED');
 if([bounds(o.amount)!==null,o.boolean!==null,o.text!==null].filter(Boolean).length>1)throw Error('METRIC_VALUE_INVALID');
 const signedPercentage=['gross_margin','contribution_margin','operating_margin','net_margin'].includes(o.metric);
 if(o.unit==='percent'&&bounds(o.amount)&&[bounds(o.amount)!.min,bounds(o.amount)!.max].some(n=>(!signedPercentage&&n<0)||n>100))throw Error('METRIC_PERCENT_INVALID');
 if(o.unit==='count'&&bounds(o.amount)&&[bounds(o.amount)!.min,bounds(o.amount)!.max].some(n=>!Number.isSafeInteger(n)||n<0))throw Error('METRIC_COUNT_INVALID');
 if(o.source==='EXTERNAL'&&o.quality==='VALID')throw Error('METRIC_EXTERNAL_NOT_INTERNAL');
 return o;
}
export function periodShape(start:string|null,end:string|null):typeof PERIODS[number]{
 if(!start||!end||!validDate(start)||!validDate(end))return 'UNKNOWN';const days=(Date.parse(end)-Date.parse(start))/86400000+1;
 if(days===1)return 'DAY';if(days===7)return 'WEEK';
 const e=new Date(end+'T12:00:00Z'),next=new Date(e);next.setUTCDate(e.getUTCDate()+1);
 if(start.endsWith('-01')&&next.getUTCDate()===1){if(start.slice(0,7)===end.slice(0,7))return 'MONTH';if([90,91,92].includes(days))return 'QUARTER';if([365,366].includes(days))return 'YEAR';}
 return 'CUSTOM_RANGE';
}
export function businessDay(timezone:string,now=new Date()){if(!validTimezone(timezone))throw Error('GOAL_TIMEZONE_REQUIRED');return localDay(now,timezone)!;}
