import { commercialDatabase } from "@/lib/commercial/server";
import { getTranslator } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { AuthForm } from "@/components/auth-form";
import { SetupNotice } from "@/components/setup-notice";
import { supabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServer } from "@/lib/supabase/server";
import {getLocale} from '@/lib/i18n/server';
import {recoveryCopy} from '@/lib/operations/recovery-copy';
export const dynamic = "force-dynamic";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ confirmation?: string; password?: string }> }) {
  const t = await getTranslator();
  if (!supabaseConfig()) return <SetupNotice />;
  const client = await createSupabaseServer();
  const { data } = await client.auth.getUser();
  if (data.user) redirect("/companies");
  const params = await searchParams;
  const markets=await Promise.resolve().then(()=>commercialDatabase().from("commercial_markets").select("code,name").eq("status","ACTIVE").eq("signup_enabled",true).eq("disable_new_signups",false)).catch(()=>null);
  return <main className="account-shell"><Brand /><section className="account-card">
    <p className="account-kicker">{t("home.tagline")}</p>
    <h1>{t("auth.title")}</h1>
    <p>{t("auth.subtitle")}</p>
    {params.confirmation === "failed" && <p className="error" role="alert">{t("auth.confirmFailed")}</p>}
    {params.password === 'updated' && <p role="status">{recoveryCopy(await getLocale()).updated}</p>}
    <AuthForm markets={markets?.data??[]} />
  </section></main>;
}
