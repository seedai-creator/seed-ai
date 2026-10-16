"use client";
import type { Diagnosis } from "@/lib/diagnosis/contracts";
import { useI18n } from "@/lib/i18n/provider";
export function DiagnosisCard({ diagnosis }: { diagnosis: Diagnosis }) {
  const { t } = useI18n();
  return <details className="diagnosis-card">
    <summary>{t("diagnosis.title")}</summary>
    <p className="diagnosis-note">{t("diagnosis.note")}</p>
    <dl>
      <dt>{t("diagnosis.situation")}</dt><dd>{diagnosis.situation}</dd>
      <dt>{t("diagnosis.objective")}</dt><dd>{diagnosis.objective ?? t("diagnosis.unknown")}</dd>
      <dt>{t("diagnosis.main_bottleneck")}</dt><dd>{diagnosis.main_bottleneck ?? t("diagnosis.insufficient")}</dd>
      <dt>{t("diagnosis.confidence")}</dt><dd>{t(`diagnosis.${diagnosis.confidence}`)}</dd>
      {(["secondary_bottlenecks", "hypotheses", "missing_data", "opportunities", "risks", "priorities"] as const).map(key => diagnosis[key].length > 0 && <div key={key}>
        <dt>{t(`diagnosis.${key}`)}</dt><dd><ol>{diagnosis[key].map((item, i) => <li key={i}>{item}</li>)}</ol></dd>
      </div>)}
      {diagnosis.evidence.length > 0 && <><dt>{t("diagnosis.evidence")}</dt><dd>{diagnosis.evidence.map((item, i) => <blockquote key={i}>“{item.quote}”<cite>{t(`diagnosis.${item.source}`)}</cite></blockquote>)}</dd></>}
    </dl>
  </details>;
}
