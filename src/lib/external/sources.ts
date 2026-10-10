import {domains,matchesDomain,publicUrl,type Citation,type ResearchPlan,type Source} from './domain';
export const OFFICIAL_DOMAINS:Record<string,string[]>={BR:['gov.br','ibge.gov.br','bcb.gov.br'],PT:['gov.pt','diariodarepublica.pt','portaldasfinancas.gov.pt','ine.pt','bportugal.pt'],ES:['boe.es','ine.es','administracion.gob.es','agenciatributaria.es'],US:['usa.gov','census.gov','bls.gov','irs.gov','federalregister.gov']};
export type WebEvidence={text:string;sources:Source[];citations:Citation[];calls:number;partial:boolean};
type Item={type?:string;status?:string;action?:{sources?:{url?:string;title?:string}[]};content?:{type?:string;text?:string;annotations?:{type?:string;url?:string;title?:string;start_index?:number;end_index?:number}[]}[]};
export function evaluateSource(url:string,title:string,plan:ResearchPlan,at:string,role:Source['role'],id:string):Source {
 const domain=new URL(url).hostname;const official=matchesDomain(domain,OFFICIAL_DOMAINS[plan.country??'']??[]);
 const foreign=Object.entries(OFFICIAL_DOMAINS).find(([country,ds])=>country!==plan.country&&matchesDomain(domain,ds));
 return {id,url,domain,title:title.slice(0,250)||domain,type:official?'OFFICIAL_GOVERNMENT':matchesDomain(domain,['glovoapp.com','ubereats.com','ifood.com.br','doordash.com'])?'MARKETPLACE':matchesDomain(domain,['tripadvisor.com','tripadvisor.pt','tripadvisor.com.br'])?'REVIEW_PLATFORM':matchesDomain(domain,['reddit.com','quora.com'])?'FORUM':/instagram\.com|facebook\.com|tiktok\.com/.test(domain)?'SOCIAL_MEDIA':/\.edu$|\.ac\./.test(domain)?'ACADEMIC':'OTHER',retrievedAt:at,publishedAt:null,country:official?plan.country:foreign?.[0]??null,language:null,role,availability:'UNKNOWN',freshness:'POTENTIALLY_STALE',authority:official&&plan.officialOnly?'OFFICIAL_FOR_TOPIC':'UNVERIFIED',geographicFit:official?'MATCH':foreign?'MISMATCH':'UNKNOWN',commercialBias:null};
}
export function collectEvidence(response:{output?:unknown[];status?:string},plan:ResearchPlan,at=new Date().toISOString()):WebEvidence {
 const sources:Source[]=[],citations:Citation[]=[];let text='',calls=0;
 const allowed=domains(plan.allowedDomains),blocked=domains(plan.blockedDomains);
 const add=(url:string|undefined,title:string|undefined,role:Source['role'])=>{const safe=url&&publicUrl(url);if(!safe)return null;const host=new URL(safe).hostname;if(matchesDomain(host,blocked)||allowed.length&&!matchesDomain(host,allowed))return null;
 const old=sources.find(s=>s.url===safe);if(old){if(role==='CITED')old.role=role;return old.id;}if(sources.length>=80)return null;const id='S'+(sources.length+1);sources.push(evaluateSource(safe,title??host,plan,at,role,id));return id;};
 for(const item of (response.output??[]) as Item[]){
 if(item.type==='web_search_call'){calls++;for(const s of item.action?.sources??[])add(s.url,s.title,'CONSULTED');}
 if(item.type==='message')for(const part of item.content??[]){if(part.type!=='output_text'||!part.text)continue;const offset=text.length;text+=part.text+'\n';
 for(const a of part.annotations??[]){if(a.type!=='url_citation'||!Number.isInteger(a.start_index)||!Number.isInteger(a.end_index)||a.start_index!<0||a.end_index!>part.text.length||a.end_index!<=a.start_index!)continue;const sourceId=add(a.url,a.title,'CITED');if(sourceId)citations.push({sourceId,start:offset+a.start_index!,end:offset+a.end_index!});}}
 }
 if(text.length>24000)throw Error('EXTERNAL_EVIDENCE_TOO_LARGE');
 return {text,sources,citations,calls,partial:response.status!=='completed'};
}
export function sourceFreshness(published:string|null,retrieved:string,trigger:string,now=Date.now()):Source['freshness']{
 if(!published)return 'POTENTIALLY_STALE';const p=Date.parse(published),r=Date.parse(retrieved);if(!Number.isFinite(p)||p>r+86400000)return 'POTENTIALLY_STALE';
 const days=trigger==='CURRENT_INFORMATION_REQUIRED'?3:trigger==='PRICE_CHECK'?7:trigger==='REGULATORY_CHECK'?1:90;
 return now-p>days*86400000?'STALE':'CURRENT';
}
