import { MarketForm } from "@/components/market-form";
import { getTranslator } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { CompanyForm } from "@/components/company-form";
import { currentUser } from "@/lib/auth/context";
import { supabaseConfig } from "@/lib/supabase/config";
import { selectCompany } from "./actions";
import { logout } from "../auth/actions";
export const dynamic = "force-dynamic";
export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const t = await getTranslator();
  if (!supabaseConfig()) redirect("/login");
  const context = await currentUser().catch(() => null);
  if (!context) redirect("/login");
  const { supabase } = context;
  const [companies, profile, memberships, facts] = await Promise.all([
    supabase.from("companies").select("*").order("created_at"),
    supabase.from("profiles").select("display_name").eq("id", context.user.id).maybeSingle(),
    supabase.from("company_members").select("company_id,role").eq("user_id", context.user.id),
    supabase.from("company_facts").select("*"),
  ]);
  const failed = companies.error || profile.error || memberships.error || facts.error;
  const params = await searchParams;
  return <main className="account-shell companies-shell"><div className="account-top"><Brand /><form action={logout}><button className="text-button">{t("common.logout")}</button></form></div>
    <section className="account-card"><p className="account-kicker">{t("company.kicker")}</p><h1>{t("company.title")}</h1>
    <p>{profile.data?.display_name ? t("company.hello", {name: profile.data.display_name}) : ""}{t("company.choose")}</p>
    {params.error && <p className="error" role="alert">{params.error === "logout" ? t("error.logout") : t("error.access")}</p>}
    {failed ? <p className="error" role="alert">{t("error.companies")}</p> :
      <div className="company-list">{companies.data?.map(company => <article key={company.id} className="company-card">
        <h2>{company.name}</h2>
        <form action={selectCompany}><input type="hidden" name="companyId" value={company.id} /><button className="send-button">{t("company.access")} <span aria-hidden="true">↗</span></button></form>
        {memberships.data?.some(m => m.company_id === company.id && m.role === "owner") && <details><summary>{t("company.edit")}</summary><CompanyForm company={company} /></details>}
        {memberships.data?.some(m => m.company_id === company.id && m.role === "owner") && <details><summary>{t("settings.market")}</summary><MarketForm key={company.updated_at} company={company} facts={facts.data?.filter(f => f.company_id === company.id) ?? []} /></details>}
      </article>)}{companies.data?.length === 0 && <p>{t("company.none")}</p>}</div>}
    {!failed && <details className="new-company"><summary>{t("company.add")}</summary><p className="account-note">{t("company.separate")}</p><CompanyForm /></details>}
    </section>
  </main>;
}

