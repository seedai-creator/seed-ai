"use server";
import { revalidatePath } from "next/cache";
import { authorizeChat, companyContext } from "@/lib/auth/context";
import { ChatError } from "@/lib/chat/contracts";
import { factValueError, isFactKey, type CompanyFact } from "@/lib/memory/contracts";
type MemoryResult = { error: string; fact?: never } | { fact: CompanyFact; error?: never };
export async function saveFact(input: { companyId: string; key: string; value: string; expectedVersion: number | null }): Promise<MemoryResult> {
  try {
    if (!input || !isFactKey(input.key) || typeof input.value !== "string" ||
      !(input.expectedVersion === null || (Number.isSafeInteger(input.expectedVersion) && input.expectedVersion > 0)))
      return { error: "Revise o dado antes de confirmar." };
    const value = input.value.trim();
    const issue = factValueError(input.key, value);
    if (issue) return { error: issue };
    await authorizeChat({ companyId: input.companyId });
    const { supabase, companyId } = await companyContext(input.companyId);
    const { data, error } = await supabase.rpc("save_company_fact", {
      p_company_id: companyId, p_key: input.key, p_value: value, p_expected_version: input.expectedVersion,
    }).single();
    if (error || !data) {
      if (error && ["40001", "23505"].includes(error.code)) return { error: "Este dado mudou em outra aba. Inicie uma nova conversa ou atualize a página para conferir o valor atual." };
      return { error: "Não foi possível salvar. Confira seu acesso à empresa e tente novamente." };
    }
    revalidatePath("/");
    return { fact: data };
  } catch (error) {
    return { error: error instanceof ChatError ? error.message : "Não foi possível salvar agora. Tente novamente." };
  }
}
