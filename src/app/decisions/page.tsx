import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_COMPANY_COOKIE, companyContext } from "@/lib/auth/context";
import { getTranslator, getLocale } from "@/lib/i18n/server";
import { formatDate } from "@/lib/i18n/format";
import { Brand } from "@/components/brand";
import { DecisionForm } from "@/components/decision-form";
import { DecisionReview } from "@/components/decision-review";
export const dynamic = "force-dynamic";
export default async function DecisionsPage() {
  const t = await getTranslator(), locale = await getLocale();
  const context = await companyContext((await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value).catch(() => null);
  if (!context) redirect("/companies");
  const { supabase, companyId } = context;
  const [company, decisions] = await Promise.all([
    supabase.from("companies").select("name").eq("id", companyId).single(),
    supabase.from("decisions").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
  ]);
  const displayDate = (value: string | null) => value ? formatDate(value + "T12:00:00Z", locale, "UTC") : t("decision.unspecified");
  return <main className="account-shell strategies-shell"><div className="account-top"><Brand /><Link href="/">{t("strategy.back")}</Link></div>
    <section className="account-card"><p className="account-kicker">{company.data?.name}</p><h1>{t("decision.page")}</h1><p>{t("decision.pageNote")}</p>
      {company.error || decisions.error ? <p role="alert" className="error">{t("decision.error")}</p> : <>
        <DecisionForm companyId={companyId} />
        {!decisions.data?.length && <p>{t("decision.empty")}</p>}
        {decisions.data?.map(decision => <article className="saved-strategy" id={"decision-" + decision.id} key={decision.id}>
          <h2>{decision.decision}</h2><p>{t(decision.reviewed_at ? "decision.reviewed" : "decision.pending")}</p>
          <dl>{(["context","reason","hypothesis","baseline"] as const).map(key => <div key={key}><dt>{t(`decision.${key}`)}</dt><dd>{decision[key] || t("decision.unspecified")}</dd></div>)}
            <dt>{t("decision.decision_date")}</dt><dd>{displayDate(decision.decision_date)}</dd>
            <dt>{t("decision.review_date")}</dt><dd>{displayDate(decision.review_date)}</dd>
            {decision.reviewed_at && <><dt>{t("decision.result")}</dt><dd>{decision.result}</dd><dt>{t("decision.learning")}</dt><dd>{decision.learning}</dd>
              <dt>{t("decision.reviewedAt")}</dt><dd>{formatDate(decision.reviewed_at, locale, "UTC")}</dd></>}
          </dl><DecisionReview key={decision.version} decision={decision} />
        </article>)}
      </>}
    </section>
  </main>;
}
