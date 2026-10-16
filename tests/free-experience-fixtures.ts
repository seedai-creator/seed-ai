import type {UsagePolicy} from '../src/lib/commercial/contracts';
import type {Diagnosis} from '../src/lib/diagnosis/contracts';
import {firstAnalysisMessage} from '../src/lib/commercial/free-experience';
import {emptyReliability} from './reliability-fixtures';
export const freePolicy: UsagePolicy = {window:'lifetime',target_usd:.1,approaching_usd:.12,soft_usd:.15,warning_usd:.18,heavy_usd:.22,hard_usd:.25,interactions:30,diagnoses:3,max_concurrent:1,requests_per_minute:6,user_day_usd:.25,user_month_usd:.25,global_day_usd:10};
export const freeMessage = firstAnalysisMessage('Quero vender mais.', 'Tenho uma oficina mecânica, para motoristas da cidade.', 'Levamos dois dias para responder aos orçamentos. Não fazemos acompanhamento.');
export function usefulDiagnosis(): Diagnosis {
  return { situation:'A oficina demora a responder aos orçamentos; ainda falta medir as perdas.',objective:'Vender mais sem aumentar investimento',main_bottleneck:null,secondary_bottlenecks:[],
    evidence:[{source:'USER_MESSAGE',quote:'Não fazemos acompanhamento.'}],hypotheses:['A falta de acompanhamento pode contribuir para perder oportunidades.'],missing_data:['Motivos de perda'],opportunities:[],risks:['Ainda não sabemos a causa das perdas.'],priorities:['Revisar os orçamentos pendentes'],confidence:'LOW',
    reliability:{...emptyReliability(),essential_missing:['Motivos de perda'],evidence:[{id:'followup',key:'followup',kind:'FACT',text:'Sem acompanhamento',source:'USER_MESSAGE',reference:'0',quote:'Não fazemos acompanhamento.',scope:'oficina',period:null,numeric_value:null,unit:null}],
      recommendation:{action:'Revise os últimos orçamentos pendentes e registre o motivo de cada desistência.',rationale_summary:'Entender onde o processo parou antes de aumentar investimento.',evidence_ids:['followup'],expected_signal:'Motivos de desistência registrados',indicator:'Orçamentos revisados e motivos de perda',review:'Após revisar os orçamentos desta semana',risks:['A amostra pode ser pequena'],change_if:'Se faltarem registros, começar a anotá-los.',mode:'INVESTIGATE'}}};
}

