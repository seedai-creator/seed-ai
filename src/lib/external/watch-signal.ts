import {EMPTY_SCOPE,type Signal} from '../radar/domain';
import type {ResearchReport} from './domain';
export function externalChangeSignal(watch:string,reason:string,run:string,previous:ResearchReport,next:ResearchReport,confirmedDomains:string[],now=Date.now()):Signal|null {
 if(!reason.trim()||next.partial||now-Date.parse(next.retrievedAt)>7*86400000||next.conflicts.length)return null;
 for(const c of next.claims){
 if(c.kind!=='EXTERNAL_FACT'||!c.isCurrent||c.value===null||!c.definition||c.status!=='SUPPORTED')continue;
 const sources=next.sources.filter(s=>c.sourceIds.includes(s.id));if(!sources.length||sources.some(s=>s.freshness!=='CURRENT'||s.geographicFit==='MISMATCH'||s.type!=='OFFICIAL_GOVERNMENT'&&!confirmedDomains.includes(s.domain)))continue;
 const before=previous.claims.find(p=>p.definition===c.definition&&p.geography===c.geography&&p.period===c.period&&p.unit===c.unit&&p.currency===c.currency&&p.conditions===c.conditions&&p.value!==null&&p.kind==='EXTERNAL_FACT'&&p.sourceIds.some(id=>previous.sources.some(s=>s.id===id&&sources.some(n=>n.url===s.url))));if(!before||before.value===c.value)continue;
 return {fingerprint:'external:'+watch+':'+c.definition,type:'CHANGE',domain:'MARKETING',rule:'EXTERNAL_WATCH_CHANGE',ruleVersion:'9.8.0',scope:{...EMPTY_SCOPE,location:c.geography},metric:c.definition,direction:c.value>before.value!?'UP':'DOWN',evidence:[{table:'external_research_runs',id:run,version:1}],values:[],baseline:{min:before.value!,max:before.value!,approximate:false},current:{min:c.value,max:c.value,approximate:false},confidence:'MEDIUM',impact:'MODERATE',urgency:'LOW',actionable:true,strategic:true,persistence:2,quality:[],knowledge_source_scope:'EXTERNAL_INTELLIGENCE',details:{label:c.text,unit:c.unit,currency:c.currency,watchReason:reason,sources:sources.map(s=>({url:s.url,title:s.title,at:s.retrievedAt})),notice:'Public change, not a proven cause of internal results.'}};
 }
 return null;
}
