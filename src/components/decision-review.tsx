"use client";
import { useActionState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { Decision } from "@/lib/decisions/contracts";
import { reviewDecision } from "@/app/decisions/actions";
export function DecisionReview({ decision }: { decision: Decision }) {
  const { t } = useI18n(); const [state, action, pending] = useActionState(reviewDecision, {});
  return <details><summary>{t(decision.reviewed_at ? "decision.editReview" : "decision.review")}</summary>
    <form action={action} className="strategy-draft account-form">
      <p className="account-note">{t("decision.reviewNote")}</p>
      <input type="hidden" name="companyId" value={decision.company_id} /><input type="hidden" name="id" value={decision.id} /><input type="hidden" name="version" value={decision.version} />
      <fieldset disabled={pending}>
        <label>{t("decision.result")}<textarea name="result" defaultValue={decision.result} required maxLength={4000} rows={4} /></label>
        <label>{t("decision.learning")}<textarea name="learning" defaultValue={decision.learning} required maxLength={4000} rows={4} /></label>
        <button className="send-button">{t(pending ? "decision.saving" : "decision.saveReview")}</button>
      </fieldset>{state.error && <p role="alert" className="error">{state.error}</p>}{state.success && <p role="status">{state.success}</p>}
    </form>
  </details>;
}
