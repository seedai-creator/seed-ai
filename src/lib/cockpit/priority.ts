import {type Candidate,type Priority,referenceKey} from './domain';
// Display order, not a business health/impact score. Central, deterministic and testable.
export const PRIORITY_ORDER:readonly Priority[]=['HIGH_ATTENTION','BLOCKED','NEXT_STEP','GOAL_RISK','REVIEW','ATTENTION','GOAL','WEEKLY','GROWTH','RESULT','OPPORTUNITY','CONTINUITY'];
export function prioritize(items:Candidate[],company:string,now:Date,order:readonly Priority[]=PRIORITY_ORDER):Candidate[]{
 if(items.some(x=>x.company!==company))throw Error('COCKPIT_TENANT_MISMATCH');
 const rank=(x:Candidate)=>{const index=order.indexOf(x.priority);return index<0?order.length:index;};
 const eligible=items.filter(x=>!x.acknowledged&&Date.parse(x.expiresAt)>now.getTime()&&x.item.summary.trim());
 eligible.sort((a,b)=>rank(a)-rank(b)||b.item.updatedAt.localeCompare(a.item.updatedAt)||referenceKey(a.item.ref).localeCompare(referenceKey(b.item.ref)));
 const selected:Candidate[]=[],seen=new Set<string>();
 for(const item of eligible){
  if(selected.some(x=>x.item.ref.type===item.item.ref.type)||item.storyKeys.some(k=>seen.has(k)))continue;
  selected.push(item);for(const key of item.storyKeys)seen.add(key);
  if(selected.length===3)break;
 }
 return selected;
}
