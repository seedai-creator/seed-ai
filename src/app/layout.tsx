import type { Metadata } from "next";
import "./globals.css";
import { getLocale, getTranslator } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/provider";
import { SecondaryLanguage } from "@/components/secondary-language";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: "SeedAI", description: t("home.tagline") };
}
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return <html lang={locale}><body><I18nProvider locale={locale}><SecondaryLanguage/>{children}</I18nProvider></body></html>;
}
