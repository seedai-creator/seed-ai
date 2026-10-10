import type {ExecutionSnapshot,ExecutionCommand} from '../execution/domain';
import "server-only";
import OpenAI from "openai";
import { ChatError, type ChatMessage } from "../chat/contracts";
import { runSeedAnalysis } from "./pipeline";
import type { StructuredAnswer } from "../memory/contracts";
import type { Diagnosis } from "../diagnosis/contracts";
import { EMPTY_MARKET, type MarketContext } from "../i18n/market";
import { meteredCompletion } from "../commercial/metering";
import type {Simulation,SimulationLifecycle} from '../simulation/domain';

export async function respond(messages: ChatMessage[], memory: string, signal?: AbortSignal, market: MarketContext = EMPTY_MARKET, metering?: { companyId: string; requestId: string }, previousDiagnosis: Diagnosis | null = null, execution?: ExecutionSnapshot, attachment=false,lifecycle?:SimulationLifecycle): Promise<StructuredAnswer & { diagnosis: Diagnosis | null;execution_commands:ExecutionCommand[];simulation:Simulation|null }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim();
  if (!apiKey || !model) throw new ChatError(503, "NOT_CONFIGURED", "A SEED ainda precisa ser configurada no servidor.");
  const client = new OpenAI({ apiKey, timeout: 60000, maxRetries: 0 });
  try {
    const timeout = AbortSignal.timeout(60000);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const complete = metering ? await meteredCompletion(client, metering.companyId, metering.requestId) : (request: Parameters<typeof client.responses.create>[0], activeSignal: AbortSignal) => client.responses.create({ ...request, model: request.text?.format?.type === "json_schema" && request.text.format.name === "seed_route" || request.metadata?.seed_task === "SOCIAL" ? process.env.OPENAI_ECONOMY_MODEL?.trim() || model : process.env.OPENAI_STRATEGIC_MODEL?.trim() || model, stream: false }, { signal: activeSignal });
    return await runSeedAnalysis(complete, model, messages, memory, combined, market, previousDiagnosis, execution, attachment,lifecycle);
  } catch (error) {
    if (error instanceof ChatError) throw error;
    if (error instanceof OpenAI.APIError) {
      if (error.status === 429) throw new ChatError(429, "PROVIDER_LIMIT", "O limite do serviço de IA foi atingido. Verifique o saldo ou tente novamente mais tarde.");
      if ([400, 401, 403, 404].includes(error.status ?? 0))
        throw new ChatError(503, "PROVIDER_CONFIGURATION", "Verifique a chave e se o modelo configurado aceita respostas estruturadas.");
    }
    throw new ChatError(502, "PROVIDER_UNAVAILABLE", "Não foi possível concluir a análise agora. Tente novamente.");
  }
}

