"use client";
import { useI18n } from "@/lib/i18n/provider";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();

  return <main className="account-shell"><section className="account-card"><p className="account-kicker">SEED AI</p><h1>{t("error.title")}</h1><p>{t("error.load")}</p><button className="send-button" onClick={reset}>{t("common.retry")}</button></section></main>;
}

