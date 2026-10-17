import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/context";
import { Brand } from "@/components/brand";
import { commercialContext, commercialDatabase } from "@/lib/commercial/server";
import { getTranslator, getLocale } from "@/lib/i18n/server";
import { isPlanAvailable } from "@/lib/commercial/markets";
import { usageState } from "@/lib/commercial/entitlements";
import { startCheckout, openCustomerPortal, selectBillingCountry } from "./actions";
import { PaymentConfirmation } from "./payment-confirmation";
export const dynamic="force-dynamic";
export default async function BillingPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  await currentUser().catch(()=>redirect("/login"));
  const t=await getTranslator(),locale=await getLocale(),query=await searchParams;
  const c=await commercialContext().catch(()=>null);
  if(c?.plan.code==="FREE")await c.db.from("commercial_events").upsert({user_id:c.user.id,market_code:c.market.code,event:"upgrade_viewed",dedupe_key:"upgrade:"+c.user.id+":"+new Date().toISOString().slice(0,10)},{onConflict:"dedupe_key",ignoreDuplicates:true});
  const [customer, usage, rollout] = c ? await Promise.all([
    c.db.from("subscriptions").select("provider_customer_id").eq("user_id",c.user.id).eq("provider","stripe").order("updated_at",{ascending:false}).limit(1).maybeSingle(),
    c.db.rpc("commercial_usage",{p_user:c.user.id,p_window:c.policy.window}),
    c.db.from("commercial_settings").select("value").eq("id","rollout").single(),
  ]) : [null,null,null];
  const state = c && !usage?.error && usage?.data && rollout?.data?.value.enabled === true
    ? usageState(Number(usage.data.cost),Number(usage.data.count),c.policy,Number(usage.data.diagnoses??0)) : null;
  const countries=!c?await Promise.resolve().then(()=>commercialDatabase().from("commercial_markets").select("code,name").eq("status","ACTIVE").eq("signup_enabled",true).eq("disable_new_signups",false)).catch(()=>null):null;
  const offers=c?await c.db.from("commercial_offers").select("id,currency,amount_minor,company_limit,available,commercial_prices(status,provider_price_id,effective_to,effective_from)").eq("market_code",c.market.code).order("company_limit"):null;
  return <main className="account-shell"><div className="account-top"><Brand/><Link href="/">{t("strategy.back")}</Link></div><section className="account-card">
    <p className="account-kicker">SeedAI</p><h1>{t("billing.title")}</h1><p>{t("billing.description")}</p>
    {query.error&&<p role="alert">{t("billing.error")}</p>}
    {query.checkout==="returned"&&(c?.plan.code==="PRO"
      ? <p role="status">{t("billing.confirmed")}</p>
      : <PaymentConfirmation message={t("billing.confirming")} refreshLabel={t("billing.refresh")}/>)}
    {!c?<><p>{t("billing.setup")}</p>{countries?.data?.length&&<form action={selectBillingCountry}><label>{t("fact.country")}<select name="country" required defaultValue=""><option value="" disabled>—</option>{countries.data.map(m=><option key={m.code} value={m.code}>{m.name}</option>)}</select></label><button className="primary-button">{t("billing.confirmCountry")}</button></form>}</>:<>
      <p>{t("billing.current")}: <strong>{c.plan.code}{c.plan.offer_id ? ` · ${t("billing.companies",{count:c.plan.company_limit})}` : ""}</strong></p>
      {state&&<p role="status">{t(`billing.usage.${state}`)}</p>}
      {state&&usage?.data&&<div>
        {c.policy.analysis_limit_mode !== 'budget' && <p>{t("billing.analysisBalance",{used:Number(usage.data.diagnoses??0),limit:Number(usage.data.analysis_limit??c.policy.diagnoses)})}</p>}
        <p>{t("billing.analysisDefinition")}</p>
        {usage.data.allowance_expires_at
          ? <p>{t("billing.testAllowanceUntil",{date:new Intl.DateTimeFormat(locale,{dateStyle:"medium",timeStyle:"short",timeZone:"UTC"}).format(new Date(usage.data.allowance_expires_at))})}</p>
          : usage.data.period_end
            ? <p>{t("billing.renewsAt",{date:new Intl.DateTimeFormat(locale,{dateStyle:"medium",timeStyle:"short",timeZone:"UTC"}).format(new Date(usage.data.period_end))})}</p>
            : <p>{t("billing.freeLifetime")}</p>}
        <p>{t("billing.automaticPro")}</p>
        <p>{t("billing.financialProtection")}</p>
      </div>}
      <p>{t("billing.dataPreserved")}</p>
      <h2>SeedAI PRO</h2>
      {offers?.data?.map(offer=>{
        const purchasable=offer.available&&isPlanAvailable(c.market,"PRO")&&offer.commercial_prices.some(p=>p.status==="ACTIVE"&&p.provider_price_id&&p.effective_to===null&&Date.parse(p.effective_from)<=Date.now());
        return <section key={offer.id} aria-label={`PRO · ${offer.company_limit}`}>
          <h3>{t("billing.companies",{count:offer.company_limit})}</h3>
          <p>{new Intl.NumberFormat(locale,{style:"currency",currency:offer.currency}).format(Number(offer.amount_minor)/100)} / {t("billing.month")}</p>
          {c.plan.code==="FREE"&&(purchasable
            ? <form action={startCheckout}><input type="hidden" name="offer_id" value={offer.id}/><button className="primary-button">{t("billing.upgrade")}</button></form>
            : <p>{t("billing.unavailable")}</p>)}
        </section>;
      })}
      <p>{t("billing.continuous")}</p>
      <p>{t("billing.test")}</p>
      {customer?.data?.provider_customer_id&&<form action={openCustomerPortal}><button className="text-button">{t("billing.manage")}</button></form>}
    </>}
  </section></main>;
}
