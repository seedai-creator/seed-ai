"use client";
import { formatDate } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/provider";
import { useState, type FormEvent } from "react";
import { saveFact } from "@/app/memory/actions";
import { formatFactValue, type CompanyFact, type FactProposal } from "@/lib/memory/contracts";
type Props = {
  timezone?: string | null; companyId: string; facts: CompanyFact[]; proposals: FactProposal[]; disabled: boolean;
  onSaved: (fact: CompanyFact) => void; onDismiss: (key: string) => void;
};
export function BusinessMemory({ timezone, companyId, facts, proposals, disabled, onSaved, onDismiss }: Props) {
  const { t, locale } = useI18n();

  const [editingKey, setEditingKey] = useState<string | null>(null);
  return <section className="business-memory" aria-label={t("memory.title")}>
    {proposals.length > 0 && <div className="memory-suggestions">
      <p className="account-kicker">{t("memory.learned")}</p>
      <h2>{t("memory.confirmTitle")}</h2>
      <p className="account-note">{t("memory.notSaved")}</p>
      {proposals.map(proposal => <FactEditor key={proposal.key + proposal.value + proposal.expectedVersion} companyId={companyId} proposal={proposal}
        disabled={disabled} onSaved={onSaved} onDismiss={() => onDismiss(proposal.key)} />)}
    </div>}
    <details className="memory-panel">
      <summary>{t("memory.title")} <span>{facts.length} {facts.length === 1 ? t("memory.one") : t("memory.many")}</span></summary>
      <p className="account-note">{t("memory.description")}</p>
      {!facts.length && <p className="account-note">{t("memory.empty")}</p>}
      {facts.map(fact => <div className="memory-row" key={fact.id}>
        {editingKey === fact.key ? <FactEditor key={fact.id + fact.version} companyId={companyId}
          proposal={{ key: fact.key, value: fact.value, evidence: "", expectedVersion: fact.version, previousValue: fact.value }}
          startEditing disabled={disabled} onSaved={saved => { onSaved(saved); setEditingKey(null); }} onDismiss={() => setEditingKey(null)} /> :
          <><div><strong>{t(`fact.${fact.key}`)}</strong><p>{formatFactValue(fact.key, fact.value, locale, facts.find(f => f.key === "currency")?.value)}</p><small>{t("memory.date")} {formatDate(fact.updated_at, locale, timezone ?? "UTC")}</small></div>
            <button className="text-button" disabled={disabled} onClick={() => setEditingKey(fact.key)} aria-label={t("common.correct") + " " + t(`fact.${fact.key}`)}>{t("common.correct")}</button></>}
      </div>)}
    </details>
  </section>;
}
function FactEditor({ companyId, proposal, disabled, startEditing = false, onSaved, onDismiss }: {
  companyId: string; proposal: FactProposal; disabled: boolean; startEditing?: boolean; onSaved: (fact: CompanyFact) => void; onDismiss: () => void;
}) {
  const { t, tr, locale } = useI18n();

  const [editing, setEditing] = useState(startEditing);
  const [value, setValue] = useState(proposal.value);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || disabled) return;
    setPending(true); setError(null);
    try {
      const result = await saveFact({ companyId, key: proposal.key, value, expectedVersion: proposal.expectedVersion });
      if (result.error) setError(result.error);
      else if (result.fact) onSaved(result.fact);
    } catch { setError(t("error.save")); }
    finally { setPending(false); }
  }
  return <form className="fact-proposal" onSubmit={submit}>
    <strong>{t(`fact.${proposal.key}`)}</strong>
    {proposal.previousValue !== null && !startEditing && <p className="fact-previous">{t("memory.previous")} {formatFactValue(proposal.key, proposal.previousValue, locale)}{t("memory.replace")}</p>}
    {editing ? <label className="fact-input">{t("memory.value")}<input value={value} onChange={event => setValue(event.target.value)} maxLength={500} required disabled={pending || disabled} />
      {["monthly_revenue", "average_ticket"].includes(proposal.key) && <small>{t("memory.numberHint")}</small>}
      {proposal.key === "currency" && <small>{t("memory.currencyHint")}</small>}
    </label> : <p>{formatFactValue(proposal.key, value, locale)}</p>}
    {proposal.evidence && <blockquote>“{proposal.evidence}”</blockquote>}
    <div className="fact-controls">
      <button type="submit" className="account-button" disabled={pending || disabled}>{pending ? t("common.saving") : editing ? t("memory.confirmSave") : t("common.save")}</button>
      {!editing && <button type="button" className="text-button" disabled={pending || disabled} onClick={() => setEditing(true)}>{t("common.correct")}</button>}
      <button type="button" className="text-button" disabled={pending || disabled} onClick={onDismiss}>{startEditing ? t("common.cancel") : t("common.discard")}</button>
    </div>
    {error && <p className="error" role="alert">{tr(error)}</p>}
  </form>;
}


