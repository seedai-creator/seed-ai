import Link from "next/link";
import {notFound} from "next/navigation";
import {requireAdmin} from "@/lib/commercial/server";
import {translator} from "@/lib/i18n/messages";
import {resolveLocale} from "@/lib/i18n/config";
import {validateMarketReadiness} from "@/lib/commercial/markets";
import type {Market} from "@/lib/commercial/contracts";
export const dynamic="force-dynamic";
export default async function PreviewPage({params}:{params:Promise<{market:string}>}){
 const c=await requireAdmin().catch(()=>null);if(!c)notFound();const code=(await params).market;
 if(!["BR","PT","ES","US"].includes(code))notFound();
 const [m,p,ai]=await Promise.all([c.db.from("commercial_markets").select("*").eq("code",code).single(),c.db.from("commercial_prices").select("*").eq("market_code",code).eq("plan_code","PRO").is("effective_to",null).single(),c.db.from("ai_model_pricing").select("id").is("effective_to",null).limit(1)]);
 if(m.error||!m.data)notFound();const market=m.data as Market,t=translator(resolveLocale(market.locale));
 const readiness=validateMarketReadiness(market,{validPrice:!!p.data?.provider_price_id,providerConfigured:!!process.env.STRIPE_SECRET_KEY&&!!process.env.STRIPE_WEBHOOK_SECRET,costProtectionReady:!!ai.data?.length});
 return <main className="account-shell"><Link href="/admin">Admin</Link><section className="account-card" lang={market.locale}><p className="account-kicker">PREVIEW · {code} · {market.status}</p><h1>{t("billing.title")}</h1><p>{t("billing.description")}</p><h2>SEED PRO</h2>{p.data&&<p>{new Intl.NumberFormat(market.locale,{style:"currency",currency:market.currency}).format(Number(p.data.amount_minor)/100)} / {t("billing.month")}</p>}<p>{t("billing.continuous")}</p><button disabled>{t("billing.upgrade")}</button><p>Prévia administrativa: não habilita cadastro ou pagamento público.</p><h2>Readiness</h2><p>{readiness.ready?"Checklist completo; lançamento não autorizado nesta fase.":"Ativação bloqueada"}</p><ul>{readiness.missing.map(k=><li key={k}>{k}</li>)}</ul></section></main>;
}
