'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useI18n } from '../lib/i18n/provider';
import { FREE_CONTEXT_LENGTH, firstAnalysisMessage, type FirstValue, type FreeExperience } from '../lib/commercial/free-experience';

export function FreeContextPrompt({ problem, onAnalyze, onCancel }: { problem: string; onAnalyze: (message: string) => void; onCancel: () => void }) {
  const { t } = useI18n();
  const [business, setBusiness] = useState(''), [observation, setObservation] = useState(''), [error, setError] = useState(false);
  const first = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { first.current?.focus(); }, []);
  function submit(e: FormEvent) {
    e.preventDefault();
    try { const message = firstAnalysisMessage(problem, business, observation); setError(false); onAnalyze(message); }
    catch { setError(true); }
  }
  return <form className="free-context" onSubmit={submit} aria-labelledby="free-context-title">
    <h2 id="free-context-title">{t('free.contextTitle')}</h2>
    <p>{t('free.contextHelp')}</p>
    <label htmlFor="free-business">{t('free.business')}<textarea id="free-business" ref={first} value={business} onChange={e => setBusiness(e.target.value)} maxLength={FREE_CONTEXT_LENGTH} rows={2} required /></label>
    <label htmlFor="free-observation">{t('free.observation')}<textarea id="free-observation" value={observation} onChange={e => setObservation(e.target.value)} maxLength={FREE_CONTEXT_LENGTH} rows={3} required /></label>
    {error && <p role="alert">{t('free.contextError')}</p>}
    <div className="free-actions"><button className="primary-button" type="submit">{t('free.analyze')}</button><button className="text-button" type="button" onClick={onCancel}>{t('free.editProblem')}</button></div>
  </form>;
}

export function FreeValueCard({ value, onPlan }: { value: FirstValue; onPlan?: () => void }) {
  const { t } = useI18n();
  return <section className="free-value" aria-labelledby="free-value-title">
    <p className="core-eyebrow">{t('free.valueEyebrow')}</p><h2 id="free-value-title">{t('free.valueTitle')}</h2>
    <p>{value.situation}</p><p><strong>{t('free.objective')}</strong> {value.objective}</p>
    <details><summary>{t('free.evidence')}</summary>{value.evidence.map((quote, i) => <blockquote key={i}>{quote}</blockquote>)}</details>
    {value.hypothesis && <p><strong>{t('free.hypothesis')}</strong> {value.hypothesis}</p>}
    <h3>{t(value.investigative ? 'free.investigate' : 'free.nextStep')}</h3><p>{value.action}</p><p>{value.reason}</p>
    <dl><div><dt>{t('free.indicator')}</dt><dd>{value.indicator}</dd></div><div><dt>{t('free.review')}</dt><dd>{value.review}</dd></div></dl>
    {!!value.limitation.length && <details><summary>{t('free.uncertainty')}</summary><ul>{value.limitation.map((item, i) => <li key={i}>{item}</li>)}</ul></details>}
    <div className="free-invite"><h3>{t('free.inviteTitle')}</h3><p>{t('free.inviteBody')}</p><p className="free-caption">{t('free.saved')}</p>
      <div className="free-actions"><Link className="primary-button" href="/billing">{t('free.upgrade')}</Link>{onPlan && <button type="button" className="text-button" onClick={onPlan}>{t('free.keepReading')}</button>}</div>
    </div>
  </section>;
}

export function FreeLimitNotice({ state, hasValue }: { state: FreeExperience; hasValue: boolean }) {
  const { t } = useI18n();
  if (!state.limited) return null;
  return <aside className="free-limit" role="status"><p>{t(hasValue ? 'free.limitAfterValue' : 'free.limitBeforeValue')}</p><p>{t('billing.dataPreserved')}</p>{!hasValue && <a href="mailto:suporte@appseedai.com">{t('free.support')}</a>}</aside>;
}
