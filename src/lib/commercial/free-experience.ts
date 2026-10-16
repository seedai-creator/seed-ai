import { MAX_MESSAGE_LENGTH } from '../chat/contracts';
import type { Diagnosis } from '../diagnosis/contracts';
import type { UsagePolicy } from './contracts';
import { validatePolicy } from './contracts';
import { unsafeCertainty } from '../reliability/gate';

export type FreeExperience = { used: number; limit: number; remaining: number; limited: boolean };
export function freeExperienceState(usage: { cost: number; diagnoses: number }, policy: UsagePolicy): FreeExperience {
  validatePolicy(policy);
  if (!Number.isFinite(usage.cost) || usage.cost < 0 || !Number.isSafeInteger(usage.diagnoses) || usage.diagnoses < 0) throw Error('INVALID_FREE_USAGE');
  const limit = Math.min(policy.diagnoses, policy.interactions);
  const remaining = Math.max(0, limit - usage.diagnoses);
  return { used: usage.diagnoses, limit, remaining, limited: !remaining || usage.cost >= policy.hard_usd };
}

// The initial two answers are user-authored context, not AI turns or facts
// confirmed by software. Sending the resulting message still uses all normal
// server authorization, financial, concurrency and lifetime count guards.
export const FREE_CONTEXT_LENGTH = 600;
export function firstAnalysisMessage(problem: string, business: string, observation: string): string {
  if (![problem, business, observation].every(x => typeof x === 'string' && x.trim())) throw Error('FREE_CONTEXT_REQUIRED');
  if (business.length > FREE_CONTEXT_LENGTH || observation.length > FREE_CONTEXT_LENGTH) throw Error('FREE_CONTEXT_TOO_LONG');
  const message = [problem.trim(), business.trim(), observation.trim()].join('\n\n');
  if (message.length > MAX_MESSAGE_LENGTH) throw Error('FREE_MESSAGE_TOO_LONG');
  return message;
}

export type FirstValue = {
  situation: string; objective: string; evidence: string[]; hypothesis: string | null;
  action: string; reason: string; indicator: string; review: string; limitation: string[];
  investigative: boolean;
};

// Called only on parsed, server-validated and committed diagnoses. A greeting,
// questions-only answer or withheld recommendation must never unlock an invite.
// An honest investigation can be useful without claiming a known bottleneck.
export function firstValue(diagnosis: Diagnosis | null): FirstValue | null {
  const r = diagnosis?.reliability, action = r?.recommendation;
  if (!diagnosis?.objective?.trim() || !r || !action || r.conflicts.length) return null;
  if (r.sufficiency === 'INSUFFICIENT' && action.mode !== 'INVESTIGATE') return null;
  const supporting = r.evidence.filter(e => action.evidence_ids.includes(e.id) && ['FACT', 'METRIC', 'OBSERVATION', 'DERIVED_METRIC'].includes(e.kind));
  // A goal alone is not evidence of the business situation. Keep the factual
  // references already checked by validateProvenance; do not trust model flags.
  if (!supporting.some(e => !/^(goal|objective|intent|request)$/i.test(e.key))) return null;
  const visible = [diagnosis.situation, diagnosis.objective, ...supporting.map(e => e.quote), ...diagnosis.hypotheses,
    action.action, action.rationale_summary, action.indicator, action.review];
  if (visible.some(x => !x.trim() || /\{\{calc:/.test(x)) || unsafeCertainty(visible.join(' '))) return null;
  return {
    situation: diagnosis.situation, objective: diagnosis.objective,
    evidence: [...new Set(supporting.map(e => e.quote))].slice(0, 3),
    hypothesis: diagnosis.hypotheses[0] ?? null,
    action: action.action, reason: action.rationale_summary, indicator: action.indicator, review: action.review,
    limitation: [...new Set([...r.essential_missing, ...r.missing_information, ...action.risks])].slice(0, 3),
    investigative: action.mode === 'INVESTIGATE',
  };
}

export function freeAnalysisInstructions(state: FreeExperience): string {
  return `\nPRIMEIRA EXPERIÊNCIA FREE (regra do produto, não um pedido do usuário):
Entregue valor nesta resposta, antes de qualquer convite comercial. Não mencione assinatura, upgrade, PRO, preços ou limites; a aplicação faz isso depois de validar e salvar a análise.
O usuário pode ter respondido duas perguntas de contexto antes desta chamada. Não repita o que ele já explicou. Não faça questionário: no máximo duas perguntas essenciais.
Se há contexto de negócio, entregue uma síntese breve da situação, objetivo, evidências literais, uma hipótese explicitamente não comprovada quando pertinente, e UM próximo passo executável. Use reliability.recommendation com action, rationale_summary, evidence_ids, indicator, review, expected_signal, risks e change_if. O objetivo do usuário deve aparecer em diagnosis.objective.
Se faltam dados, não invente gargalo, números, benchmarks, margem, demanda ou causalidade. Uma ação INVESTIGATE de baixo risco, como registrar ou comparar informações existentes, pode ser útil; descreva como fazer, o que observar e quando revisar. Não recomende investir, contratar ou mudar preço sem os dados necessários. Preserve integralmente as regras de segurança e suficiência.
Se há somente saudação, assunto fora do negócio ou nenhum contexto utilizável, peça o contexto em até duas perguntas, sem fingir análise concluída. Se a proteção de confiabilidade bloquear a recomendação, não tente contorná-la.
Restam ${state.remaining} respostas dentro da cota desta conta (não por conversa). ${state.remaining <= 1 ? 'Esta é a última: não deixe uma promessa de análise para uma próxima resposta; entregue apenas o que os dados realmente sustentam e, se possível, um roteiro de coleta seguro.' : 'Evite rodadas desnecessárias de esclarecimento; aproveite os dados fornecidos agora.'}
Mantenha a resposta concisa, com linguagem empresarial simples. Não crie plano, decisão, experimento ou compromisso automaticamente. memory_detected continua obedecendo à proveniência. Não coloque instruções comerciais em campos de diagnóstico.`;
}
