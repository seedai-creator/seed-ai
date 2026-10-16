import {createHash} from 'node:crypto';
import {referenceKey,type Candidate,type Reference} from './domain';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
// A reference changes when its displayed evidence changes, including source corrections.
export function stamp(candidate:Candidate):Candidate{
 return {...candidate,item:{...candidate.item,ref:{...candidate.item.ref,version:hash([candidate.item,candidate.context]).slice(0,40)}}};
}
export const acknowledgementKey=(user:string,company:string,ref:Reference)=>'cockpit:ack:'+hash([user,company,referenceKey(ref)]);
export const eventKey=(user:string,company:string,event:string,bucket:string,ref?:Reference)=>'cockpit:event:'+hash([user,company,event,bucket,ref?referenceKey(ref):null]);
export function requireCandidate(candidates:Candidate[],company:string,reference:Reference,now:Date){
 const selected=candidates.find(c=>c.company===company&&referenceKey(c.item.ref)===referenceKey(reference)&&Date.parse(c.expiresAt)>now.getTime());
 if(!selected)throw Error('COCKPIT_CONTEXT_CHANGED');return selected;
}
