import { DEFAULT_LOCALE, type Locale } from "./config";
export function formatNumber(value: number, locale: Locale = DEFAULT_LOCALE) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}
export function formatCurrency(value: number, currency: string, locale: Locale = DEFAULT_LOCALE) {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
}
// Input is a ratio: 0.15 = 15%.
export function formatPercent(value: number, locale: Locale = DEFAULT_LOCALE) {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(value);
}
export function formatDate(value: string | Date, locale: Locale = DEFAULT_LOCALE, timezone = "UTC") {
  return new Intl.DateTimeFormat(locale, { timeZone: timezone }).format(new Date(value));
}
