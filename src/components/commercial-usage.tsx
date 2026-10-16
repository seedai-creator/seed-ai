import Link from "next/link";
import { commercialContext } from "@/lib/commercial/server";
import { commercialRolloutEnabled } from "@/lib/commercial/metering";
import { usageState } from "@/lib/commercial/entitlements";
import { getTranslator } from "@/lib/i18n/server";

export async function CommercialUsage() {
  if (!await commercialRolloutEnabled()) return null;
  const t = await getTranslator();
  const c = await commercialContext().catch(() => null);
  if (!c) return <aside className="account-card"><Link href="/billing">{t("billing.setup")}</Link></aside>;
  const u = await c.db.rpc("commercial_usage", { p_user: c.user.id, p_window: c.policy.window });
  if (u.error || !u.data) return null;
  const state = usageState(Number(u.data.cost), Number(u.data.count), c.policy, Number(u.data.diagnoses??0));
  if (state === "NORMAL") return null;
  return <aside className="account-card" role="status"><p>{t(`billing.usage.${state}`)}</p><p>{t("billing.dataPreserved")}</p><Link href="/billing">{t("billing.title")}</Link></aside>;
}

