import type {Signal} from '../radar/domain';
import type {Snapshot} from './domain';
// Annotate existing signals with their map interpretation; never mint an alert for the same evidence.
export function annotateGrowthSignals(signals:Signal[],snapshot:Snapshot|null):Signal[]{
 if(!snapshot||snapshot.status==='SUPERSEDED')return signals;
 return signals.map(s=>{const d=snapshot.payload.dimensions.find(d=>d.metric===s.metric&&d.evidence.some(e=>s.evidence.some(r=>r.table===e.table&&r.id===e.id&&r.version===e.version)));return d?{...s,details:{...s.details,growth:{snapshot:snapshot.id,dimension:d.dimension,status:d.status,confidence:d.confidence,goal:snapshot.goal_id,notice:'Interpretation of the same evidence; no additional independent proof or causal attribution.'}}}:s;});
}
