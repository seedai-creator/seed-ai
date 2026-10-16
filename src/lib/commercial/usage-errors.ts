import { ChatError } from "../chat/contracts";

export function reservationError(reason: unknown): ChatError {
  switch (reason) {
    case "REQUEST_BUDGET": return new ChatError(429, "REQUEST_BUDGET", "Seu saldo restante não comporta esta análise. Uma pergunta mais curta ou uma pesquisa menor pode caber na franquia. Seus dados continuam disponíveis.");
    case "GLOBAL_BUDGET": return new ChatError(503, "AI_PAUSED", "As análises estão temporariamente pausadas por uma proteção do serviço. Isso não significa que sua franquia acabou. Seus dados continuam disponíveis.");
    case "DAILY_BUDGET": return new ChatError(429, "DAILY_USAGE_LIMIT", "A proteção diária de uso foi atingida. Tente novamente após a renovação diária; seu saldo do ciclo continua disponível.");
    case "EXTERNAL_BUDGET": return new ChatError(429, "EXTERNAL_USAGE_LIMIT", "O limite específico de pesquisas foi atingido. Consulte sua assinatura; seu saldo para outras análises pode continuar disponível.");
    case "DIAGNOSIS_LIMIT": return new ChatError(429, "DIAGNOSIS_LIMIT", "Sua cota de análises foi utilizada. Consulte o saldo e a renovação em Minha assinatura.");
    case "HARD_LIMIT": return new ChatError(429, "USAGE_LIMIT", "Seu limite de uso foi atingido. Seus dados continuam disponíveis.");
    case "RATE_LIMIT": return new ChatError(429, "RATE_LIMIT", "Aguarde a análise em andamento ou tente novamente em um minuto.");
    case "DUPLICATE_REQUEST": return new ChatError(409, "DUPLICATE_REQUEST", "Esta solicitação já foi recebida. Aguarde antes de reenviar.");
    case "PRO_REQUIRED": return new ChatError(403, "PRO_REQUIRED", "Relatórios automáticos estão disponíveis no plano PRO. Seus registros anteriores continuam disponíveis.");
    default: return new ChatError(503, "USAGE_UNAVAILABLE", "Não foi possível verificar seu saldo. Tente novamente em instantes.");
  }
}
