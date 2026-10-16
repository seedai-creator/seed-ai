"use client";
import { createContext, useContext } from "react";
import { DEFAULT_LOCALE, type Locale } from "./config";
import { translator, translateMessage } from "./messages";
const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}
export function useI18n() {
  const locale = useContext(LocaleContext);
  return { locale, t: translator(locale), tr: (message: string) => translateMessage(locale, message) };
}
