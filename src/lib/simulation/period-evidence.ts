import {supportedNumber} from '../business-model/domain';
import type {Quantity} from './calculation';

// This is a conservative evidence check on a structured quantity, not an
// extraction of business facts. Ambiguous language requires confirmation.
const cues={DAY:/\b(por dia|ao dia|diari[oa]s?|per day|daily|al dia)\b/,
 WEEK:/\b(por semana|semanal|semanales|semanalmente|per week|weekly)\b/,
 MONTH:/\b(por mes|ao mes|mensal|mensais|mensual|mensuales|per month|monthly)\b/,
 YEAR:/\b(por ano|ao ano|anual|anuais|anuales|per year|yearly|annual)\b/};
const normalized=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function hasPeriodEvidence(quote:string,q:Quantity):boolean {
  if(q.unit==='MONEY_PER_UNIT'||q.unit==='RATIO')return q.period==='ONCE';
  // Typed memory exports can prove the exact value AND period in one object.
  try {const v=JSON.parse(quote);if(v&&typeof v==='object'&&v.period===q.period&&
    ((v.min===q.min&&v.max===q.max)||(v.value===q.min&&q.min===q.max)))return true;}catch{/* prose below */}
  // Never borrow "per month" from a neighbouring fact in a long quotation.
  const clauses=normalized(quote).split(/[,;!?\n]|\.(?!\d)|\b(?:e|and|y|mas|but|pero)\b/);
  return clauses.some(clause=>{
    if(!supportedNumber(clause,q.min)||!supportedNumber(clause,q.max))return false;
    const found=Object.entries(cues).filter(([,cue])=>cue.test(clause)).map(([period])=>period);
    if(q.period==='ONCE')return found.length===0 && /\b(unica|unico|one time|one-time|once|pontual|estoque|stock|saldo|balance)\b/.test(clause);
    return found.length===1&&found[0]===q.period;
  });
}
