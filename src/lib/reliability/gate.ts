import type { ChatMessage } from "../chat/contracts";
import type { Diagnosis } from "../diagnosis/contracts";
import type { StructuredAnswer } from "../memory/contracts";
import { parseReliability } from "./contracts";
import type { StrategicRoute } from "./routing";
import { assessSufficiency, calculateDerived, renderCalculations, safeMemoryCandidates, validateProvenance } from "./validate";

const clarification = {
  "pt-BR": "Ainda não tenho informação suficiente para recomendar essa decisão com segurança. Qual é o objetivo e quais dados atuais você tem sobre custos, resultados e capacidade? Podemos começar pelo que você já sabe.",
  "pt-PT": "Ainda não tenho informação suficiente para recomendar esta decisão com segurança. Qual é o objetivo e que dados atuais tem sobre custos, resultados e capacidade? Podemos começar pelo que já sabe.",
  "en-US": "I don't yet have enough information to recommend this decision safely. What is your objective, and what current information do you have about costs, results and capacity? We can start with what you already know.",
  "es-ES": "Todavía no tengo información suficiente para recomendar esta decisión con seguridad. ¿Cuál es tu objetivo y qué datos actuales tienes sobre costes, resultados y capacidad? Podemos empezar por lo que ya sabes.",
};
const discountQuestions = {
  "pt-BR": "Antes de recomendar o desconto, preciso confirmar o preço atual e quanto custa cada venda. Qual é o objetivo da promoção e quantas unidades você vende hoje?",
  "pt-PT": "Antes de recomendar o desconto, preciso de confirmar o preço atual e quanto custa cada venda. Qual é o objetivo da promoção e quantas unidades vende atualmente?",
  "en-US": "Before recommending a discount, I need to confirm the current price and cost per sale. What is the promotion's objective and how many units do you currently sell?",
  "es-ES": "Antes de recomendar el descuento, necesito confirmar el precio actual y el coste por venta. ¿Cuál es el objetivo de la promoción y cuántas unidades vendes actualmente?",
};
// Supplemental language tripwire, not a semantic guarantee or the primary validator.
export function unsafeCertainty(text: string) {
  return /(?:certamente|com certeza) (?:vai|aumentar|funciona)|garant(?:e|irá|ido) (?:o |um |a |sucesso|crescimento|resultado)|will definitely|guaranteed (?:growth|success|result)|garantiza(?:rá)? (?:el |un )?(?:crecimiento|resultado)|\b\d+(?:[.,]\d+)?\s*%\s*(?:de chance|de probabilidade|chance of success|de probabilidad)/iu.test(text);
}
export function applyReliabilityGate(raw: unknown, result: StructuredAnswer, diagnosis: Diagnosis | null, route: StrategicRoute, messages: ChatMessage[], memory: string, locale: string) {
  if (route.task === "SOCIAL") {
    if (raw !== null || diagnosis !== null || result.memory_detected?.length) throw Error("SOCIAL_RESPONSE_INVALID");
    return { ...result, diagnosis, reliability: null, validation: "PASSED" as const };
  }
  const reliability = parseReliability(raw);
  validateProvenance(reliability, messages, memory);
  const assessment = assessSufficiency(reliability, route, memory);
  const recommendation = reliability.recommendation;
  const invalidRecommendation = recommendation && (
    (recommendation.mode !== "INVESTIGATE" && !recommendation.evidence_ids.length) ||
    (recommendation.mode === "COMMIT" && assessment.state !== "SUFFICIENT") ||
    (assessment.state === "INSUFFICIENT" && recommendation.mode !== "INVESTIGATE") ||
    (route.materiality === "HIGH" && !recommendation.risks.length));
  const overstated = ["INSUFFICIENT", "PARTIALLY_SUFFICIENT", "SUFFICIENT"].indexOf(reliability.sufficiency) > ["INSUFFICIENT", "PARTIALLY_SUFFICIENT", "SUFFICIENT"].indexOf(assessment.state);
  let blocked = Boolean((overstated && assessment.state === "INSUFFICIENT" && recommendation?.mode !== "INVESTIGATE") || invalidRecommendation || unsafeCertainty(result.answer + JSON.stringify(recommendation)));
  let calculations: ReturnType<typeof calculateDerived> = [];
  let calculationBlocked = false;
  try { calculations = calculateDerived(reliability,memory); }
  catch {
    // Do not emit a guessed number, retry the provider or save invalid operands.
    blocked = true;
    calculationBlocked = true;
    reliability.calculations = [];
  }
  reliability.sufficiency = assessment.state;
  reliability.confidence = assessment.confidence;
  const language = Object.hasOwn(clarification, locale) ? locale as keyof typeof clarification : "pt-BR";
  let answer = blocked ? "" : renderCalculations(result.answer, calculations, locale);
  if (blocked) {
    answer = route.profile === "DISCOUNT" ? discountQuestions[language] : clarification[language];
    if (reliability.essential_missing.length) {
      const intro = {
        "pt-BR": "Antes de recomendar essa decisão, preciso esclarecer estes pontos:",
        "pt-PT": "Antes de recomendar esta decisão, preciso de esclarecer estes pontos:",
        "en-US": "Before recommending this decision, I need to clarify these points:",
        "es-ES": "Antes de recomendar esta decisión, necesito aclarar estos puntos:",
      };
      answer = intro[language] + "\n" + reliability.essential_missing.map(item => "• " + item).join("\n");
    }
    if (calculationBlocked) {
      const questions = {
        "pt-BR": "Antes de calcular, preciso confirmar se os valores se referem ao mesmo produto e período. Qual produto e período devemos usar como base?",
        "pt-PT": "Antes de calcular, preciso de confirmar se os valores se referem ao mesmo produto e período. Que produto e período devemos usar como base?",
        "en-US": "Before calculating, I need to confirm that the values refer to the same product and period. Which product and period should we use?",
        "es-ES": "Antes de calcular, necesito confirmar que los valores corresponden al mismo producto y periodo. ¿Qué producto y periodo debemos usar?",
      };
      answer = questions[language];
    }
    if (reliability.revision && !unsafeCertainty(reliability.revision)) answer = reliability.revision + "\n\n" + answer;
    reliability.recommendation = null;
    reliability.confidence = "LOW";
  }
  // Never keep a strong diagnosis or strategy draft after withholding a recommendation.
  const format = (value: string) => renderCalculations(value, calculations, locale);
  const safeDiagnosis = diagnosis ? { ...diagnosis, confidence: (["LOW","MEDIUM","HIGH"].indexOf(diagnosis.confidence) < ["LOW","MEDIUM","HIGH"].indexOf(reliability.confidence) ? diagnosis.confidence : reliability.confidence),
    ...(blocked ? { main_bottleneck: null, secondary_bottlenecks: [], priorities: [], opportunities: [] } : {}),
    situation: blocked ? answer : format(diagnosis.situation),
    reliability,
  } : null;
  // Only the business summaries may contain calculation markers; evidence quotes stay literal.
  if (safeDiagnosis && !blocked) {
    safeDiagnosis.objective = safeDiagnosis.objective ? format(safeDiagnosis.objective) : null;
    safeDiagnosis.main_bottleneck = safeDiagnosis.main_bottleneck ? format(safeDiagnosis.main_bottleneck) : null;
    safeDiagnosis.priorities = safeDiagnosis.priorities.map(format);
    safeDiagnosis.opportunities = safeDiagnosis.opportunities.map(format);
  }
  return { ...result, answer, diagnosis: safeDiagnosis, reliability,
    memory_detected: blocked ? [] : safeMemoryCandidates(result.memory_detected ?? [], reliability.evidence, messages.length - 1),
    validation: blocked ? "WITHHELD" as const : "PASSED" as const };
}
