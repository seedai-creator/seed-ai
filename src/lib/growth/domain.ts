import type {Reliability,KnowledgeType} from '../reliability/contracts';
import type {Goal,Observation,Amount,Scope} from '../goals/domain';
import type {Entity,StoredObservation,Relationship} from '../business-model/domain';

export const DIMENSIONS=['ACQUISITION','CONVERSION','TICKET','FREQUENCY','RETENTION','MARGIN'] as const;
export type Dimension=typeof DIMENSIONS[number];
export const STATUSES=['UNKNOWN','NOT_APPLICABLE','INSUFFICIENT_DATA','STABLE','HEALTHY','ATTENTION','CONSTRAINING','OPPORTUNITY'] as const;
export type Status=typeof STATUSES[number];
export type Trend='IMPROVING'|'STABLE'|'DETERIORATING'|'VOLATILE'|'UNKNOWN';
export type Applicability='APPLICABLE'|'PARTIALLY_APPLICABLE'|'NOT_APPLICABLE'|'UNKNOWN';
export type Confidence=Reliability['confidence'];
export type Sufficiency=Reliability['sufficiency'];
export const RULE_SET_VERSION='11.0.0';
export const SCHEMA_VERSION=1;
export type Source={table:string;id:string;version:number;kind:KnowledgeType};
export type MetricPoint={amount:Amount;start:string;end:string;unit:string;currency:string|null;sources:Source[];kind:'METRIC'|'DERIVED_METRIC';formula:string|null};
export type Assessment={dimension:Dimension;applicability:Applicability;status:Status;trend:Trend;sufficiency:Sufficiency;confidence:Confidence;metric:string|null;metricDefinition:string|null;current:MetricPoint|null;baseline:MetricPoint|null;target:Amount|null;gap:Amount|null;goalId:string|null;reason:string;missing:string[];quality:string[];evidence:Source[];rules:{id:string;version:string}[];opportunity:boolean};
export type Guardrail={kind:'CAPACITY'|'MARGIN'|'CASH'|'TEAM'|'QUALITY'|'OWNER_DEPENDENCY'|'CONSTRAINT';state:'BREACH'|'CONTEXT'|'UNKNOWN';reason:string;sources:Source[];scope:Scope;period:[string|null,string|null]};
export type ExternalReference={id:string;title:string;url:string;retrievedAt:string;summary:string};
export type GrowthInput={company:string;day:string;timezone:string;scope:Scope;goalId:string|null;goals:Goal[];observations:Observation[];entities:Entity[];structural:StoredObservation[];relations:Relationship[];constraints:{id:string;value:string;version:number}[];context:{table:string;id:string;version:number;kind:KnowledgeType}[];external:ExternalReference[];limited:boolean;currency:string|null};
export type GrowthMap={schemaVersion:1;ruleSetVersion:string;summaryVersion:1;company:string;scope:Scope;goalId:string|null;periodStart:string|null;periodEnd:string|null;status:'READY'|'LIMITED';dimensions:Assessment[];guardrails:Guardrail[];primary:Dimension|null;secondary:Dimension[];focusReason:string;nextStep:'INVESTIGATE'|'CLARIFY_GOAL'|'CHECK_GUARDRAIL'|'COMPLETE_DATA'|'MONITOR';confidence:Confidence;limitations:string[];sources:Source[];external:ExternalReference[];generatedDay:string};
export type Snapshot={id:string;request_id:string;company_id:string;goal_id:string|null;scope_type:Scope['type'];scope_id:string|null;status:'READY'|'LIMITED'|'SUPERSEDED';payload:GrowthMap;input_fingerprint:string;created_at:string};
export const growthEnabled=()=>process.env.SEED_GROWTH_MAP_ENABLED==='true'&&process.env.SEED_GOALS_ENABLED==='true';
export const source=(o:Observation):Source[]=>o.trace?o.trace.inputs.map(i=>({...i,kind:'METRIC' as const})):[{table:o.source_table,id:o.id,version:o.version,kind:o.source==='SYSTEM_DERIVED'?'DERIVED_METRIC':'METRIC'}];
export function cleanSources(rows:Source[]){return [...new Map(rows.map(s=>[s.table+':'+s.id+':'+s.version,s])).values()];}
