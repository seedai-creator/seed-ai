"use client";
import { useActionState, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { LOCALES, LOCALE_NAMES } from "@/lib/i18n/config";
import { COUNTRIES, type MarketSettings } from "@/lib/i18n/market";
import { saveMarket } from "@/app/preferences/actions";
import type { CompanyFact } from "@/lib/memory/contracts";
export function MarketForm({ company, facts }: { company: MarketSettings & { id: string; updated_at: string }; facts: CompanyFact[] }) {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState(saveMarket, {});
  const country = facts.find(f => f.key === "country"), currencyFact = facts.find(f => f.key === "currency");
  const [currency, setCurrency] = useState(currencyFact?.value ?? "");
  const knownCountry = country && (COUNTRIES as readonly string[]).includes(country.value) ? country.value : "";
  const countryNames = new Intl.DisplayNames([locale], { type: "region" });
  return <form action={action} className="account-form">
    <input type="hidden" name="companyId" value={company.id} />
    <input type="hidden" name="updated_at" value={company.updated_at} />
    <input type="hidden" name="country_version" value={country?.version ?? ""} />
    <input type="hidden" name="currency_version" value={currencyFact?.version ?? ""} />
    <input type="hidden" name="previous_currency" value={currencyFact?.value ?? ""} />
    <p className="account-note">{t("settings.note")}</p>
    {country && !knownCountry && <p>{t("settings.legacy", { value: country.value })}</p>}
    <label>{t("settings.country")}<select name="country" defaultValue={knownCountry} disabled={pending}>
      <option value="">{t("settings.unknown")}</option>{COUNTRIES.map(c => <option key={c} value={c}>{countryNames.of(c)}</option>)}
    </select></label>
    <label>{t("settings.currency")}<select name="currency" value={currency} onChange={e => setCurrency(e.target.value)} disabled={pending}>
      <option value="">{t("settings.unknown")}</option>{[...new Set(["BRL", "EUR", "USD", ...(currencyFact ? [currencyFact.value] : [])])].map(c => <option key={c}>{c}</option>)}
    </select></label>
    {currency && currency !== currencyFact?.value && <label><input name="confirm_currency" type="checkbox" required disabled={pending} />{t("settings.currencyConfirm")}</label>}
    {(["preferred_language", "locale"] as const).map(field => <label key={field}>{t(field === "locale" ? "settings.locale" : "settings.preferredLanguage")}
      <select name={field} defaultValue={company[field] ?? ""} disabled={pending}><option value="">{t("settings.unknown")}</option>{LOCALES.map(l => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}</select>
    </label>)}
    <label>{t("settings.timezone")}<input name="timezone" defaultValue={company.timezone ?? ""} placeholder="America/Sao_Paulo · Europe/Lisbon" maxLength={100} disabled={pending} /></label>
    {state.error && <p className="error" role="alert">{state.error}</p>}{state.success && <p role="status">{state.success}</p>}
    <button className="account-button" disabled={pending}>{pending ? t("common.saving") : t("common.save")}</button>
  </form>;
}
