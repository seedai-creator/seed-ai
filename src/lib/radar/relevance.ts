import {RADAR_CONFIG as C,type Signal,type Gate} from './domain';
export type Visibility={enabled:boolean;muted:boolean;recentCount:number;seenVersion:boolean;dismissed:boolean;materialChange:boolean;cooling:boolean};
export function relevance(s:Signal,v?:Visibility):Gate{
 const reasons=s.quality.length?'DATA_QUALITY':s.confidence==='LOW'?'LOW_CONFIDENCE':!s.actionable?'NOT_ACTIONABLE':!s.strategic&&s.persistence<C.minimumPeriods?'ISOLATED_CHANGE':null;
 if(reasons)return {attention:'OBSERVE',surface:false,mode:'CONVERSATION_CONTEXT',reason:reasons,suppression:reasons};
 const attention=s.impact==='HIGH'&&s.urgency==='HIGH'&&s.confidence!=='LOW'?'HIGH_ATTENTION':'ATTENTION';
 const suppressed=v?(!v.enabled?'PREFERENCE_OFF':v.muted?'MUTED':v.dismissed&&!v.materialChange?'DISMISSED':v.seenVersion?'ALREADY_SEEN':v.cooling?'COOLDOWN':v.recentCount>=C.dailyBudget?'SURFACING_BUDGET':null):null;
 return {attention,surface:!suppressed,mode:'HOME',reason:s.strategic?'STRATEGIC_LINK':'PERSISTENT_EVIDENCE',suppression:suppressed};
}
export function materiallyChanged(old:Signal,next:Signal){
 if(old.ruleVersion!==next.ruleVersion)return false;
 if(next.evidence.every(e=>old.evidence.some(o=>o.table===e.table&&o.id===e.id&&o.version===e.version)))return false;
 if(old.confidence==='LOW'&&next.confidence!=='LOW'||old.impact!=='HIGH'&&next.impact==='HIGH'||old.urgency!=='HIGH'&&next.urgency==='HIGH')return true;
 if(next.current&&old.current){if(next.direction==='DOWN')return next.current.max<old.current.min;if(next.direction==='UP')return next.current.min>old.current.max;}
 return next.persistence>old.persistence&&next.strategic;
}
const rank={HIGH:3,MODERATE:2,LOW:1};
export function prioritize(signals:Signal[]){return [...signals].sort((a,b)=>rank[b.urgency]-rank[a.urgency]||rank[b.impact]-rank[a.impact]||Number(b.strategic)-Number(a.strategic)||b.persistence-a.persistence||a.fingerprint.localeCompare(b.fingerprint));}
// Only explicit same-scope business relations; clustering never asserts causality.
export function cluster(signals:Signal[]){
 const groups=new Map<string,Signal[]>();
 for(const s of prioritize(signals)){
  const scope=JSON.stringify(s.scope);
  const family=['leads','sales','conversion'].includes(s.metric)?'commercial':['delivery_delay','capacity'].includes(s.metric)?'delivery':s.fingerprint;
  const last=s.values.at(-1);const window=last?[last.start,last.end,last.currency]:[s.details.period??null];
  const key=JSON.stringify([scope,family,window]);groups.set(key,[...(groups.get(key)??[]),s]);
 }
 return [...groups.values()].map(rows=>({key:JSON.stringify(rows.map(s=>s.fingerprint).sort()),signals:rows,primary:rows[0]}));
}
