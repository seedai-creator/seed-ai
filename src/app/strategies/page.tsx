import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_COMPANY_COOKIE, companyContext } from "@/lib/auth/context";
import { getTranslator, getLocale } from "@/lib/i18n/server";
import { formatDate } from "@/lib/i18n/format";
import { Brand } from "@/components/brand";
import { StrategyStatusForm } from "@/components/strategy-status";
export const dynamic = "force-dynamic";
export default async function StrategiesPage() {
  const t = await getTranslator(), locale = await getLocale();
  const context = await companyContext((await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value).catch(() => null);
  if (!context) redirect("/companies");
  const { supabase, companyId } = context;
  const [company, strategies, actions] = await Promise.all([
    supabase.from("companies").select("name").eq("id", companyId).single(),
    supabase.from("strategies").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
    supabase.from("actions").select("*").eq("company_id", companyId).order("position"),
  ]);
  const failed = company.error || strategies.error || actions.error;
  const displayDate = (value: string | null) => value ? formatDate(value + "T12:00:00Z", locale, "UTC") : t("strategy.unassigned");
  return <main className="account-shell strategies-shell"><div className="account-top"><Brand /><Link href="/">{t("strategy.back")}</Link></div>
    <section className="account-card"><p className="account-kicker">{company.data?.name}</p><h1>{t("strategy.page")}</h1><p>{t("strategy.pageNote")}</p>
      {failed ? <p className="error" role="alert">{t("strategy.error")}</p> : !strategies.data?.length ? <p>{t("strategy.empty")}</p> : strategies.data.map(strategy => <article id={"strategy-" + strategy.id} className="saved-strategy" key={strategy.id}>
        <h2>{strategy.name}</h2>
        <StrategyStatusForm key={strategy.version} companyId={companyId} id={strategy.id} kind="strategy" version={strategy.version} status={strategy.status} />
        <dl>{(["objective", "situation", "bottleneck", "hypothesis", "strategy"] as const).map(key => <div key={key}><dt>{t(`strategy.${key}`)}</dt><dd>{strategy[key] || t("strategy.unassigned")}</dd></div>)}
          <dt>{t("strategy.review_date")}</dt><dd>{displayDate(strategy.review_date)}</dd>
        </dl>
        <h3>{t("strategy.actions")}</h3>
        {actions.data?.filter(action => action.strategy_id === strategy.id).map(action => <section className="saved-action" key={action.id}>
          <h4>{action.position}. {action.title}</h4><dl>
            {(["description", "reason", "responsible", "metric", "target"] as const).map(key => <div key={key}><dt>{t(`strategy.${key}`)}</dt><dd>{action[key] || t("strategy.unassigned")}</dd></div>)}
            <dt>{t("strategy.deadline")}</dt><dd>{displayDate(action.deadline)}</dd>
          </dl>
          <StrategyStatusForm key={action.version} companyId={companyId} id={action.id} kind="action" version={action.version} status={action.status} />
        </section>)}
      </article>)}
    </section>
  </main>;
}
