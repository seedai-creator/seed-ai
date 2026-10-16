"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";
import { currentUser, companyContext } from "@/lib/auth/context";
import { COUNTRIES, validTimezone } from "@/lib/i18n/market";
import { getTranslator } from "@/lib/i18n/server";
import type { ActionState } from "@/lib/auth/validation";
export async function changeLocale(value: unknown): Promise<ActionState> {
  const t = await getTranslator();
  if (!isLocale(value)) return { error: t("settings.invalid") };
  try {
    const context = await currentUser().catch(() => null);
    if (context) {
      const { data, error } = await context.supabase.from("profiles").update({ locale: value }).eq("id", context.user.id).select("id").single();
      if (error || !data) return { error: t("settings.error") };
    }
    (await cookies()).set(LOCALE_COOKIE, value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 31536000 });
    revalidatePath("/", "layout");
    return { success: "OK" };
  } catch { return { error: t("settings.error") }; }
}
export async function saveMarket(_state: ActionState, form: FormData): Promise<ActionState> {
  const t = await getTranslator();
  const value = (key: string) => String(form.get(key) ?? "").trim() || null;
  const country = value("country"), currency = value("currency"), locale = value("locale"), language = value("preferred_language"), timezone = value("timezone");
  const version = (key: string) => value(key) === null ? null : Number(value(key));
  const countryVersion = version("country_version"), currencyVersion = version("currency_version");
  if ((country && !(COUNTRIES as readonly string[]).includes(country)) ||
    (currency && !/^[A-Z]{3}$/.test(currency)) || (locale && !isLocale(locale)) ||
    (language && !isLocale(language)) || (timezone && !validTimezone(timezone)) ||
    [countryVersion, currencyVersion].some(v => v !== null && (!Number.isSafeInteger(v) || v < 1)) ||
    (currency && currency !== value("previous_currency") && form.get("confirm_currency") !== "on"))
    return { error: t("settings.invalid") };
  try {
    const { supabase, companyId } = await companyContext(form.get("companyId"));
    const { error } = await supabase.rpc("save_company_market", {
      p_company_id: companyId, p_country: country, p_currency: currency, p_locale: locale,
      p_preferred_language: language, p_timezone: timezone, p_expected_updated_at: value("updated_at"),
      p_country_version: countryVersion, p_currency_version: currencyVersion,
    });
    if (error) return { error: t("settings.error") };
    revalidatePath("/companies"); revalidatePath("/");
    return { success: t("settings.saved") };
  } catch { return { error: t("settings.error") }; }
}
