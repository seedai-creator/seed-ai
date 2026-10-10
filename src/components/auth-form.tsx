"use client";
import { useI18n } from "@/lib/i18n/provider";
import { useActionState, useState } from "react";
import { login, signup } from "@/app/auth/actions";
import Link from 'next/link';
import {recoveryCopy} from '@/lib/operations/recovery-copy';
export function AuthForm({markets}: {markets: {code:string;name:string}[]}) {
  const { t,locale } = useI18n();

  const [mode, setMode] = useState<"login" | "signup">("login");
  return <div>
    <div className="auth-tabs"><button onClick={() => setMode("login")} aria-pressed={mode === "login"}>{t("auth.login")}</button><button onClick={() => setMode("signup")} aria-pressed={mode === "signup"}>{t("auth.signup")}</button></div>
    <Credentials key={mode} mode={mode} markets={markets} />
    {mode==='login'&&<Link href="/forgot-password" className="core-chat-link">{recoveryCopy(locale).forgot}</Link>}
  </div>;
}
function Credentials({ mode, markets }: { mode: "login" | "signup"; markets:{code:string;name:string}[] }) {
  const { t, tr } = useI18n();

  const [state, action, pending] = useActionState(mode === "login" ? login : signup, {});
  return <form action={action} className="account-form">
    {mode === "signup" && <label>{t("auth.name")}<input name="name" autoComplete="name" minLength={2} maxLength={120} required disabled={pending} /></label>}
    {mode === "signup" && <label>{t("fact.country")}<select name="country" required defaultValue="" disabled={pending}><option value="" disabled>—</option>{markets.map(m=><option key={m.code} value={m.code}>{m.name}</option>)}</select></label>}
    <label>{t("auth.email")}<input name="email" type="email" autoComplete="email" maxLength={254} required disabled={pending} /></label>
    <label>{t("auth.password")}<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "signup" ? 8 : 1} maxLength={128} required disabled={pending} /></label>
    {mode === "signup" && <p className="account-note">{t("auth.passwordHint")}</p>}
    {state.error && <p className="error" role="alert">{tr(state.error)}</p>}
    {state.success && <p className="account-success" role="status">{tr(state.success)}</p>}
    <button className="send-button" disabled={pending}>{pending ? t("common.wait") : mode === "login" ? t("auth.enter") : t("auth.create")} <span aria-hidden="true">↗</span></button>
  </form>;
}

