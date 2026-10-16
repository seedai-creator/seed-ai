import {bounds,type Goal} from './domain';
import type {Progress} from './calculation';
import {EMPTY_SCOPE,type Signal} from '../radar/domain';

// Reuse Radar delivery, cooldown and relevance rules; do not create another scheduler.
export function goalSignals(items:{goal:Goal;progress:Progress}[],today:string):Signal[]{
 const signals:Signal[]=[];
 for(const {goal:g,progress:p} of items){
  if(g.status!=='ACTIVE')continue;
  const breached=p.guardrails.some(x=>x.status==='BREACH');
  const late=g.spec.milestones.some(m=>!m.done&&m.deadline&&m.deadline<today);
  const state=breached?'GUARDRAIL':p.trajectory==='ACHIEVED'?'ACHIEVED':late?'MILESTONE':p.trajectory==='AT_RISK'||p.trajectory==='MISSED'?'DEVIATION':p.limitations.includes('stale')?'STALE':p.missing.includes('observation')?'MISSING':null;
  if(!state)continue;
  const insufficient=state==='STALE'||state==='MISSING';
  signals.push({fingerprint:'goal-progress:'+g.id,type:state==='GUARDRAIL'?'RISK':state==='ACHIEVED'?'OPPORTUNITY':late||insufficient?'EXECUTION_RISK':'GOAL_DEVIATION',domain:'GOALS',rule:'GOAL_PROGRESS_REFERENCE',ruleVersion:'10.0.0',scope:{...EMPTY_SCOPE,entity:g.spec.scope.id},metric:g.spec.primary_metric??'goal',direction:state==='ACHIEVED'?'RECOVERED':late||insufficient?'DUE':'DOWN',evidence:[{table:'goals',id:g.id,version:g.version},...p.sources],values:[],baseline:bounds(g.spec.target)?{...bounds(g.spec.target)!,approximate:g.spec.target.approximate}:null,current:p.current&&bounds(p.current)?{...bounds(p.current)!,approximate:p.current.approximate}:null,confidence:insufficient?'LOW':late?'HIGH':p.confidence,impact:'MODERATE',urgency:'MODERATE',actionable:true,strategic:true,persistence:p.sources.length,quality:insufficient?['INSUFFICIENT_DATA']:p.limitations.filter(l=>l!=='guardrail_breach'&&!l.endsWith('_mismatch')),knowledge_source_scope:'INTERNAL',details:{label:g.spec.title,unit:g.spec.unit,currency:g.spec.currency,period:g.spec.period,goal:g.id,goalState:state,trajectory:p.trajectory,guardrails:p.guardrails,notice:'Reference, not forecast or causal proof.'}});
 }
 return signals.slice(0,8);
}
