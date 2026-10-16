"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import type { Diagnosis } from "@/lib/diagnosis/contracts";
import { draftFromDiagnosis, type StrategyDraft, type ActionDraft } from "@/lib/strategies/contracts";
import { useI18n } from "@/lib/i18n/provider";
import { saveStrategy } from "@/app/strategies/actions";
export function StrategyDraftForm({ diagnosis, companyId, disabled }: { diagnosis: Diagnosis; companyId: string; disabled: boolean }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<StrategyDraft | null>(null);
  const [id, setId] = useState("");
  const [pending, setPending] = useState(false), [error, setError] = useState(""), [saved, setSaved] = useState(false);
  if (saved) return <p role="status">{t("strategy.saved")} <Link href={"/strategies#strategy-" + id}>{t("strategy.view")}</Link></p>;
  if (!draft) return <button type="button" className="account-button" disabled={disabled} onClick={() => { setDraft(draftFromDiagnosis(diagnosis)); setId(crypto.randomUUID()); }}>{t("strategy.convert")}</button>;
  const update = (key: keyof StrategyDraft, value: string) => setDraft({ ...draft, [key]: value || (key === "review_date" ? null : "") });
  const updateAction = (index: number, key: keyof ActionDraft, value: string) => setDraft({ ...draft, actions: draft.actions.map((item, i) => i === index ? { ...item, [key]: value || (key === "deadline" ? null : "") } : item) });
  async function submit(event: FormEvent) {
    event.preventDefault(); if (pending) return;
    setPending(true); setError("");
    try { const result = await saveStrategy(companyId, id, draft); if (result.id) setSaved(true); else setError(result.error ?? t("strategy.error")); }
    catch { setError(t("strategy.error")); } finally { setPending(false); }
  }
  return <form className="strategy-draft account-form" onSubmit={submit}>
    <h3>{t("strategy.review")}</h3><p className="account-note">{t("strategy.reviewNote")}</p>
    <fieldset disabled={pending || disabled}>
      {(["name", "objective", "situation", "bottleneck", "hypothesis", "strategy"] as const).map(key => <label key={key}>{t(`strategy.${key}`)}
        <textarea value={draft[key]} onChange={event => update(key, event.target.value)} rows={key === "name" ? 1 : 3}
          required={["name","objective","situation","strategy"].includes(key)} maxLength={key === "name" ? 120 : key === "strategy" ? 4000 : 2000} />
      </label>)}
      <label>{t("strategy.review_date")}<input type="date" min="1900-01-01" max="9999-12-31" value={draft.review_date ?? ""} onChange={e => update("review_date", e.target.value)} /></label>
      <h3>{t("strategy.actions")}</h3>
      {draft.actions.map((action, index) => <fieldset className="action-draft" key={index}><legend>{t("strategy.action")} {index + 1}</legend>
        {(["title", "description", "reason", "responsible", "metric", "target"] as const).map(key => <label key={key}>{t(`strategy.${key}`)}
          <textarea rows={key === "description" || key === "reason" ? 2 : 1} value={action[key]} onChange={e => updateAction(index, key, e.target.value)} required={["title","description","reason"].includes(key)}
            maxLength={key === "title" ? 160 : key === "responsible" ? 120 : ["metric","target"].includes(key) ? 500 : 2000} />
        </label>)}
        <label>{t("strategy.deadline")}<input type="date" min="1900-01-01" max="9999-12-31" value={action.deadline ?? ""} onChange={e => updateAction(index, "deadline", e.target.value)} /></label>
        <button type="button" className="text-button" disabled={draft.actions.length === 1} onClick={() => setDraft({ ...draft, actions: draft.actions.filter((_, i) => i !== index) })}>{t("strategy.remove")}</button>
      </fieldset>)}
      <button type="button" className="account-button" disabled={draft.actions.length >= 10} onClick={() => setDraft({ ...draft, actions: [...draft.actions, { title: "", description: "", reason: "", responsible: "", deadline: null, metric: "", target: "" }] })}>{t("strategy.add")}</button>
      <button type="submit" className="send-button">{t(pending ? "strategy.saving" : "strategy.save")}</button>
      <button type="button" className="text-button" onClick={() => { setDraft(null); setError(""); }}>{t("strategy.close")}</button>
    </fieldset>
    {error && <p role="alert" className="error">{error}</p>}
  </form>;
}
