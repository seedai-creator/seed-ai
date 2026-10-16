"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import type { Diagnosis } from "@/lib/diagnosis/contracts";
import { draftDecision, type DecisionDraft } from "@/lib/decisions/contracts";
import { saveDecision } from "@/app/decisions/actions";
export function DecisionForm({ companyId, diagnosis, disabled = false }: { companyId: string; diagnosis?: Diagnosis; disabled?: boolean }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<DecisionDraft | null>(null), [id, setId] = useState("");
  const [pending, setPending] = useState(false), [error, setError] = useState(""), [saved, setSaved] = useState(false);
  if (saved) return <p role="status">{t("decision.saved")} <Link href={"/decisions#decision-" + id}>{t("decision.view")}</Link></p>;
  if (!draft) return <button type="button" className="account-button" disabled={disabled} onClick={() => { setDraft(draftDecision(diagnosis)); setId(crypto.randomUUID()); }}>{t("decision.new")}</button>;
  async function submit(event: FormEvent) {
    event.preventDefault(); if (pending) return; setPending(true); setError("");
    try { const result = await saveDecision(companyId, id, draft); if (result.id) setSaved(true); else setError(result.error ?? t("decision.error")); }
    catch { setError(t("decision.error")); } finally { setPending(false); }
  }
  return <form className="strategy-draft account-form" onSubmit={submit}>
    <h3>{t("decision.new")}</h3><p className="account-note">{t("decision.note")}</p>
    <fieldset disabled={pending || disabled}>
      {(["decision", "context", "reason", "hypothesis", "baseline"] as const).map(key => <label key={key}>{t(`decision.${key}`)}
        <textarea value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} rows={3} required={["decision","context","reason"].includes(key)} maxLength={key === "decision" ? 1000 : ["context","reason"].includes(key) ? 3000 : 2000} />
      </label>)}
      <label>{t("decision.decision_date")}<input required type="date" min="1900-01-01" max="9999-12-31" value={draft.decision_date} onChange={e => setDraft({ ...draft, decision_date: e.target.value })} /></label>
      <label>{t("decision.review_date")}<input type="date" min={draft.decision_date || "1900-01-01"} max="9999-12-31" value={draft.review_date ?? ""} onChange={e => setDraft({ ...draft, review_date: e.target.value || null })} /></label>
      <button type="submit" className="send-button">{t(pending ? "decision.saving" : "decision.save")}</button>
      <button type="button" className="text-button" onClick={() => { setDraft(null); setError(""); }}>{t("decision.close")}</button>
    </fieldset>{error && <p className="error" role="alert">{error}</p>}
  </form>;
}
