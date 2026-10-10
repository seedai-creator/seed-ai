"use client";
import { useActionState } from "react";
import { updateStatus } from "@/app/strategies/actions";
import { STRATEGY_STATUSES, ACTION_STATUSES, type StrategyStatus, type ActionStatus } from "@/lib/strategies/contracts";
import { useI18n } from "@/lib/i18n/provider";
export function StrategyStatusForm({ companyId, id, version, status, kind }: { companyId: string; id: string; version: number; status: StrategyStatus | ActionStatus; kind: "strategy" | "action" }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(updateStatus, {});
  return <form action={action} className="status-form">
    <input type="hidden" name="companyId" value={companyId} /><input type="hidden" name="id" value={id} />
    <input type="hidden" name="version" value={version} /><input type="hidden" name="kind" value={kind} />
    <label>{t("strategy.status")} <select name="status" defaultValue={status} disabled={pending}>
      {String(status)==="BLOCKED"&&<option value="BLOCKED" disabled>{t("execution.BLOCKED")}</option>}
      {(kind === "strategy" ? STRATEGY_STATUSES : ACTION_STATUSES).map(value => <option key={value} value={value}>{t(`strategy.${value}`)}</option>)}
    </select></label><button className="account-button" disabled={pending}>{t("strategy.update")}</button>
    {state.error && <p role="alert" className="error">{state.error}</p>}{state.success && <p role="status">{state.success}</p>}
  </form>;
}
