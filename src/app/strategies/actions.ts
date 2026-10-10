"use server";
import { revalidatePath } from "next/cache";
import { authorizeChat, companyContext } from "@/lib/auth/context";
import { validId } from "@/lib/auth/validation";
import { parseStrategy, STRATEGY_STATUSES, ACTION_STATUSES } from "@/lib/strategies/contracts";
import { getTranslator } from "@/lib/i18n/server";
export type StrategyState = { error?: string; id?: string; success?: string };
export async function saveStrategy(companyId: string, id: string, draft: unknown): Promise<StrategyState> {
  const t = await getTranslator();
  let parsed;
  try { if (!validId(id)) throw new Error(); parsed = parseStrategy(draft); }
  catch { return { error: t("strategy.invalid") }; }
  try {
    await authorizeChat({ companyId });
    const { supabase } = await companyContext(companyId);
    const { data, error } = await supabase.rpc("save_strategy", { p_company_id: companyId, p_id: id, p_draft: parsed });
    if (error || !data) return { error: t(error?.code === "40001" ? "strategy.conflict" : "strategy.error") };
    revalidatePath("/strategies");
    return { id: data };
  } catch { return { error: t("strategy.error") }; }
}
export async function updateStatus(_state: StrategyState, form: FormData): Promise<StrategyState> {
  const t = await getTranslator();
  const companyId = String(form.get("companyId") ?? ""), id = String(form.get("id") ?? ""),
    kind = form.get("kind"), status = String(form.get("status") ?? ""), version = Number(form.get("version"));
  const allowed: readonly string[] = kind === "strategy" ? STRATEGY_STATUSES : kind === "action" ? ACTION_STATUSES : [];
  if (!validId(id) || !allowed.includes(status) || !Number.isSafeInteger(version) || version < 1) return { error: t("strategy.invalid") };
  try {
    await authorizeChat({ companyId });
    const { supabase } = await companyContext(companyId);
    const { error } = await supabase.rpc(kind === "strategy" ? "set_strategy_status" : "set_action_status", {
      p_company_id: companyId, p_id: id, p_status: status, p_version: version,
    });
    if (error) return { error: t(error.code === "40001" ? "strategy.conflict" : "strategy.error") };
    revalidatePath("/strategies");
    return { success: t("strategy.updated") };
  } catch { return { error: t("strategy.error") }; }
}
