"use client";
import { useI18n } from "@/lib/i18n/provider";
import { Brand } from "./brand";
export function SetupNotice() {
  const { t } = useI18n();

  return <main className="account-shell"><Brand /><section className="account-card">
    <p className="account-kicker">{t("setup.kicker")}</p>
    <h1>{t("setup.title")}</h1>
    <p>{t("setup.body")}</p>
    <p className="account-note">{t("setup.guide")}</p>
  </section></main>;
}

