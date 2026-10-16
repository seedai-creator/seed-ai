"use server";
import { revalidatePath } from "next/cache";
import { authorizeChat, companyContext } from "@/lib/auth/context";
import { validId } from "@/lib/auth/validation";
import { parseDecision, parseReview } from "@/lib/decisions/contracts";
import { getTranslator } from "@/lib/i18n/server";
export type DecisionState = { error?: string; id?: string; success?: string };
export async function saveDecision(companyId: string, id: string, value: unknown): Promise<DecisionState> {
  const t = await getTranslator(); let draft;
  try { if (!validId(id)) throw new Error(); draft = parseDecision(value); }
  catch { return { error: t("decision.invalid") }; }
  try {
    await authorizeChat({ companyId }); const { supabase } = await companyContext(companyId);
    const { data, error } = await supabase.rpc("save_decision", { p_company_id: companyId, p_id: id, p_draft: draft });
    if (error || !data) return { error: t(error?.code === "40001" ? "decision.conflict" : "decision.error") };
    revalidatePath("/decisions"); return { id: data };
  } catch { return { error: t("decision.error") }; }
}
export async function reviewDecision(_state: DecisionState, form: FormData): Promise<DecisionState> {
  const t = await getTranslator(); const companyId = String(form.get("companyId") ?? ""), id = String(form.get("id") ?? ""), version = Number(form.get("version")); let review;
  try { if (!validId(id) || !Number.isSafeInteger(version) || version < 1) throw new Error(); review = parseReview({ result: form.get("result"), learning: form.get("learning") }); }
  catch { return { error: t("decision.invalid") }; }
  try {
    await authorizeChat({ companyId }); const { supabase } = await companyContext(companyId);
    const { error } = await supabase.rpc("review_decision", { p_company_id: companyId, p_id: id, p_version: version, p_result: review.result, p_learning: review.learning });
    if (error) return { error: t(error.code === "40001" ? "decision.conflict" : "decision.error") };
    revalidatePath("/decisions"); return { success: t("decision.reviewSaved") };
  } catch { return { error: t("decision.error") }; }
}
