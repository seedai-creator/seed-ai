"use server";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ACTIVE_COMPANY_COOKIE } from "@/lib/auth/context";
import { validEmail, validPassword, type ActionState } from "@/lib/auth/validation";
import {recordServerFailure} from '@/lib/operations/alert-worker';

export async function login(_state: ActionState, form: FormData): Promise<ActionState> {
  const email = String(form.get("email") ?? "").trim();
  const password = form.get("password");
  if (!validEmail(email) || typeof password !== "string" || !password || password.length > 128)
    return { error: "Confira o e-mail e a senha." };
  try {
    const client = await createSupabaseServer();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      if ((error.status ?? 0) >= 500) await recordServerFailure('auth', 'AUTH_PROVIDER_FAILED');
      return { error: "Não foi possível entrar. Confira e-mail, senha e confirmação do e-mail." };
    }
    const { data: account } = await client.auth.getUser();
    if (account.user) {
      const { data: profile } = await client.from("profiles").select("locale").eq("id", account.user.id).maybeSingle();
      if (isLocale(profile?.locale)) (await cookies()).set(LOCALE_COOKIE, profile.locale, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 31536000 });
    }
    (await cookies()).delete(ACTIVE_COMPANY_COOKIE);
  } catch { return { error: "Não foi possível entrar agora. Tente novamente." }; }
  redirect("/companies");
}
export async function signup(_state: ActionState, form: FormData): Promise<ActionState> {
  const email = String(form.get("email") ?? "").trim();
  const password = form.get("password");
  const displayName = String(form.get("name") ?? "").trim();
  if (!validEmail(email) || !validPassword(password) || displayName.length < 2 || displayName.length > 120)
    return { error: "Informe seu nome, um e-mail válido e uma senha de 8 a 128 caracteres." };
  let hasSession = false;
  try {
    const client = await createSupabaseServer();
    const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (!site) return { error: "O cadastro está sendo configurado. Tente novamente mais tarde." };
    const { data, error } = await client.auth.signUp({
      email, password, options: { data: { display_name: displayName, commercial_country: String(form.get("country")??"") }, emailRedirectTo: new URL("/auth/callback", site).href },
    });
    if (error) {
      if ((error.status ?? 0) >= 500) await recordServerFailure('auth', 'AUTH_PROVIDER_FAILED');
      return { error: "Não foi possível criar a conta. Confira os dados ou tente novamente mais tarde." };
    }
    hasSession = !!data.session;
    (await cookies()).delete(ACTIVE_COMPANY_COOKIE);
  } catch { return { error: "Não foi possível criar a conta agora. Tente novamente." }; }
  if (hasSession) redirect("/companies");
  return { success: "Se o cadastro puder ser concluído, você receberá um e-mail. Confirme pelo link e depois entre na sua conta." };
}
export async function logout(): Promise<void> {
  const client = await createSupabaseServer();
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) redirect("/companies?error=logout");
  (await cookies()).delete(ACTIVE_COMPANY_COOKIE);
  redirect("/login");
}

