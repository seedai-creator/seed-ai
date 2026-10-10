import { isLocale, resolveLocale, type Locale } from "./config";
import type { CompanyFact } from "../memory/contracts";
export const COUNTRIES = ["BR", "PT", "US", "ES"] as const;
export type MarketSettings = { preferred_language: string | null; locale: string | null; timezone: string | null };
export type MarketContext = {
  user_language: Locale; company_country: string | null; company_currency: string | null;
  company_locale: Locale | null; company_preferred_language: Locale | null; company_timezone: string | null;
};
export function validTimezone(value: string) {
  if (value.length > 100) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }); return true; } catch { return false; }
}
export function buildMarketContext(userLocale: unknown, settings: MarketSettings, facts: CompanyFact[]): MarketContext {
  const country = facts.find(f => f.key === "country")?.value ?? null;
  const currency = facts.find(f => f.key === "currency")?.value ?? null;
  return {
    user_language: resolveLocale(userLocale),
    company_country: country && /^[A-Z]{2}$/.test(country) ? country : null,
    company_currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : null,
    company_locale: isLocale(settings.locale) ? settings.locale : null,
    company_preferred_language: isLocale(settings.preferred_language) ? settings.preferred_language : null,
    company_timezone: settings.timezone && validTimezone(settings.timezone) ? settings.timezone : null,
  };
}
export const EMPTY_MARKET: MarketContext = buildMarketContext("pt-BR", { locale: null, preferred_language: null, timezone: null }, []);
