import {externalMode} from '../operations/flags';
import type {Locale} from '../i18n/config';
export type Depth='QUICK'|'STANDARD'|'DEEP';
export type ResearchStatus='QUEUED'|'RUNNING'|'COMPLETED'|'PARTIAL'|'FAILED'|'CANCELLED';
export type WebMode='LIVE_WEB_ENABLED'|'OFFLINE_OR_CACHE_ONLY'|'DISABLED';
export const TRIGGERS=['USER_REQUESTED','CURRENT_INFORMATION_REQUIRED','COMPETITOR_ANALYSIS','MARKET_ANALYSIS','REGULATORY_CHECK','PRICE_CHECK','RADAR_ENRICHMENT','DECISION_ENRICHMENT','SOURCE_VERIFICATION','GENERAL_EXTERNAL_CONTEXT'] as const;
export type Trigger=typeof TRIGGERS[number];
export type ResearchPlan={trigger:Trigger;depth:Depth;sector:string|null;city:string|null;country:string|null;subject:string;locale:Locale;searchLanguage:string;allowedDomains:string[];blockedDomains:string[];query:string;officialOnly:boolean;needsClarification:boolean;missing:string[]};
export type Citation={sourceId:string;start:number;end:number};
export const SOURCE_TYPES=['OFFICIAL_GOVERNMENT','REGULATOR','OFFICIAL_COMPANY','PRIMARY_RESEARCH','ACADEMIC','INDUSTRY_ASSOCIATION','REPUTABLE_NEWS','PUBLIC_DATABASE','MARKETPLACE','REVIEW_PLATFORM','SOCIAL_MEDIA','BLOG','FORUM','OTHER'] as const;
export type Source={id:string;url:string;domain:string;title:string;type:typeof SOURCE_TYPES[number];retrievedAt:string;publishedAt:string|null;country:string|null;language:string|null;role:'CITED'|'CONSULTED';availability:'UNKNOWN'|'AVAILABLE'|'UNAVAILABLE';freshness:'CURRENT'|'POTENTIALLY_STALE'|'STALE'|'SUPERSEDED';authority:'OFFICIAL_FOR_TOPIC'|'UNVERIFIED';geographicFit:'MATCH'|'UNKNOWN'|'MISMATCH';commercialBias:boolean|null};
export type Claim={id:string;text:string;kind:'EXTERNAL_FACT'|'EXTERNAL_OBSERVATION'|'EXTERNAL_HYPOTHESIS';sourceIds:string[];quote:string;period:string|null;geography:string|null;definition:string|null;unit:string|null;currency:string|null;conditions:string|null;value:number|null;confidence:'LOW'|'MEDIUM'|'HIGH';status:'SUPPORTED'|'QUALIFIED'|'CONFLICTING';isCurrent:boolean};
export type Finding={text:string;claimIds:string[]};
export type Competitor={name:string;domain:string;relationship:'SUGGESTED'|'CONFIRMED'|'REJECTED';kind:'DIRECT'|'INDIRECT'|'SUBSTITUTE'|'UNKNOWN';claimIds:string[]};
export type ResearchReport={summary:string;internalContext:string[];claims:Claim[];findings:Finding[];conflicts:Finding[];inferences:Finding[];implications:Finding[];nextSteps:Finding[];limitations:string[];competitors:Competitor[];sources:Source[];citations:Citation[];retrievedAt:string;partial:boolean;query:string};
export type ResearchView={id:string;status:ResearchStatus;depth:Depth;created_at:string;completed_at:string|null;expires_at:string|null;report:ResearchReport|null;error_code:string|null;feedback:string|null};
export const externalEnabled=()=>externalMode()!=='DISABLED';
export function webMode():WebMode{return externalMode();}
export const DEPTH_LIMITS={QUICK:{calls:1,output:1800,context:'low',timeout:60000},STANDARD:{calls:3,output:3500,context:'medium',timeout:100000},DEEP:{calls:6,output:6000,context:'high',timeout:480000}} as const;
export function researchTrigger(text:string,attachment=false):Trigger|null {
 if(attachment)return null;
 const q=text.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase();
 if(/\b(nao pesquise|sem (pesquisa|internet|web)|do not search|don't search|no busques|sin internet)\b/.test(q))return null;
 if(/\b(posso vender|can i sell|puedo vender|licenca para|license to|licencia para)\b/.test(q))return 'REGULATORY_CHECK';
 if(/\b(lei|regra|regulacao|regulament|tribut|fiscal|licenca|legisl|regulation|legal|tax|ley|normativa)/.test(q)&&/mud|recente|atual|vender|aplic|vigent|vigor|current|recent|changed|permit|portugal|brasil|brazil/.test(q))return 'REGULATORY_CHECK';
 if(/concorrente|competitor|competidor/.test(q))return 'COMPETITOR_ANALYSIS';
 if(/(prec[oa]|price|precio).{0,70}(mercado|market|public|compet)|(?:mercado|market).{0,50}(prec|price)/.test(q))return 'PRICE_CHECK';
 if(/(abrir|expand|open|expan).{0,40}(unidade|filial|location|braga|leiria|pais|country|cidade|city)/.test(q))return 'DECISION_ENRICHMENT';
 if(/pesquis|busque|busca na|busca en|search|look up|investig[au]e|verifi[qc]/.test(q))return 'USER_REQUESTED';
 if(/(mercado|market|setor|sector).{0,80}(acontec|tendenc|atual|trend|recent)|(?:acontec|tendenc|trend).{0,80}(mercado|market|setor|sector)/.test(q))return 'MARKET_ANALYSIS';
 if(/\b(atualmente|hoje|current|latest|recentemente|reciente)\b/.test(q)&&/notic|taxa|inflac|cambio|econom|president|ceo|regra|rule|price|preco/.test(q))return 'CURRENT_INFORMATION_REQUIRED';
 return null;
}
// Operational freshness, not a guarantee of truth. Sensitive categories always revalidate.
export function ttlMs(trigger:Trigger){return trigger==='REGULATORY_CHECK'||trigger==='PRICE_CHECK'?0:trigger==='CURRENT_INFORMATION_REQUIRED'?3600000:24*3600000;}
export function cacheUsable(report:ResearchReport,plan:ResearchPlan,created:string,refresh:boolean,now=Date.now()){
 return !refresh&&!report.partial&&ttlMs(plan.trigger)>0&&now-Date.parse(created)<ttlMs(plan.trigger)&&report.query===plan.query&&report.sources.filter(s=>s.role==='CITED').every(s=>s.freshness==='CURRENT'&&s.availability!=='UNAVAILABLE');
}
export function publicUrl(raw:string):string|null {
 try{const u=new URL(raw);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.port&&!['443','80'].includes(u.port))return null;
 const h=u.hostname.toLowerCase();if(!h.includes('.')||/^[\d.]+$/.test(h)||h.includes(':')||/^(localhost|metadata)\./.test(h)||/\.(localhost|local|internal|test|invalid|example)$/.test(h)||h==='metadata.google.internal')return null;
 if([...u.searchParams.keys()].some(k=>/token|secret|password|key|credential|signature|auth/i.test(k)))return null;
 u.hash='';return u.toString();}catch{return null;}
}
export function domains(values:string[]){if(values.length>100)throw Error('EXTERNAL_DOMAIN_LIMIT');return [...new Set(values.map(v=>{if(!/^[a-z0-9.-]+$/i.test(v)||!publicUrl('https://'+v)||v.startsWith('.')||v.includes('..'))throw Error('EXTERNAL_INVALID_DOMAIN');return v.toLowerCase();}))];}
export function matchesDomain(domain:string,list:string[]){return list.some(d=>domain===d||domain.endsWith('.'+d));}
export const unsafeSourceText=(value:string)=>/ignore.{0,30}instructions|ignore.{0,30}instru|system prompt|api.?key|sk-(proj-)?[\w-]{10}|sb_secret_|password|senha|credencia/i.test(value);
export const suspicious=(value:string)=>unsafeSourceText(value)||/bank account|conta bancaria|cpf\b|social security|diagnostico medico|medical record|confidencial|confidential|segredo|secret|salario|salary|fatur|revenue|divida|debt|cliente\s+[A-Z]|funcionario\s+[A-Z]/i.test(value);
export function publicTerm(value:unknown,max=140):string|null {if(value===null)return null;if(typeof value!=='string'||!value.trim()||value.length>max||suspicious(value)||/[\d@<>={}\[\]\n\r]/.test(value)||/https?:|[a-f0-9]{8}-/i.test(value))throw Error('EXTERNAL_PRIVATE_QUERY');return value.trim();}
