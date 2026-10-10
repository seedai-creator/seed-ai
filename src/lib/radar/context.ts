import {RADAR_CONFIG as C,type Signal} from './domain';
export type ContextSignal={id:string;signals:Signal[];dismissed?:boolean};
const termsByDomain:Record<string,RegExp>={SALES:/vend|sales|venta|convers|desconto|discount|precio|price/,MARKETING:/anunci|ads|advert|marketing|leads|publicidad/,FINANCE:/marg|cost|cust|preco|price|precio|descont|discount|caixa|cash|revenue|receita/,CAPACITY:/capaci|maquina|machine|equip|contrat|hiring|expan/,OPERATIONS:/entreg|delivery|atras|operac|operat/,GOALS:/meta|objetiv|goal|target/,EXECUTION:/plano|plan|decis|exper|resultado|result/,CUSTOMERS:/cliente|customer|reclam|complaint|retenc|retent/};
/** Bounded original evidence; never truncate JSON or silently fabricate a diagnosis. */
export function conversationSignals(rows:ContextSignal[],question:string,id?:string){
 const terms=question.toLocaleLowerCase().normalize('NFKD').replace(/\p{M}/gu,'');const chosen:{key:string;kind:string;value:string}[]=[];let size=0;
 for(const row of rows){
  if(row.dismissed)continue;
  const signals=row.signals.filter(s=>!s.quality.length&&s.confidence!=='LOW'&&(row.id===id||termsByDomain[s.domain]?.test(terms)));
  if(!signals.length)continue;
  const value=JSON.stringify({signals:signals.slice(0,3),notice:'Observed signals with knowledge_source_scope distinguishing INTERNAL and EXTERNAL_INTELLIGENCE, not confirmed causes or diagnoses. Facts require their original source. Investigate before recommending. Data may be partial.'});
  if(size+value.length>16000)continue;
  chosen.push({key:'radar_'+row.id,kind:'INFERENCE',value});size+=value.length;if(chosen.length>=C.maxContext)break;
 }
 return chosen;
}
export function weeklySignals(signals:Signal[],sourceIds:string[]){
 return signals.filter(s=>!s.quality.length&&s.evidence.length>0&&s.evidence.every(e=>e.table==='business_journal_entries'&&sourceIds.includes(e.id))).slice(0,2);
}
