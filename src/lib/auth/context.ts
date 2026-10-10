import "server-only";
import { cookies } from "next/headers";
import { createSupabaseServer } from "../supabase/server";
import { ChatError } from "../chat/contracts";
import { authorizeCompany } from "./authorization";
import {operationsEnabled} from '../operations/server';
export const ACTIVE_COMPANY_COOKIE = "seed-active-company";

export async function currentUser() {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new ChatError(401, "UNAUTHENTICATED", "Entre na sua conta para continuar.");
  if(operationsEnabled()){
    const access=await supabase.rpc('operations_user_allowed');
    if(access.error)throw new ChatError(503,'OPERATIONS_UNAVAILABLE','O serviço está temporariamente indisponível.');
    if(access.data!==true)throw new ChatError(403,'BETA_ACCESS_REQUIRED','O acesso ao beta precisa ser liberado. Entre em contato pelo suporte.');
    const terms=await supabase.rpc('operations_terms_current');
    if(terms.error)throw new ChatError(503,'OPERATIONS_UNAVAILABLE','O serviço está temporariamente indisponível.');
    if(terms.data!==true)throw new ChatError(403,'TERMS_REQUIRED','Confira os termos e a política de privacidade para continuar.');
  }
  return { supabase, user: data.user };
}
export async function companyContext(companyId: unknown) {
  const { supabase, user } = await currentUser();
  const context = await authorizeCompany(user.id, companyId, async (userId, id) => {
    const { data, error } = await supabase.from("company_members").select("company_id").eq("company_id", id).eq("user_id", userId).maybeSingle();
    if (error) throw new ChatError(503, "DATABASE_UNAVAILABLE", "Não foi possível acessar sua empresa. Tente novamente.");
    return !!data;
  });
  return { ...context, supabase };
}
export async function authorizeChat(body: unknown) {
  const companyId = body && typeof body === "object" && "companyId" in body ? body.companyId : undefined;
  await companyContext(companyId);
  const active = (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value;
  if (active !== companyId) throw new ChatError(409, "COMPANY_CHANGED", "A empresa ativa mudou. Atualize esta página antes de continuar.");
}
export async function setActiveCompany(companyId: string) {
  (await cookies()).set(ACTIVE_COMPANY_COOKIE, companyId, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
}
