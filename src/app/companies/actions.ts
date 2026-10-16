"use server";
import { redirect } from "next/navigation";
import { companyContext, currentUser, setActiveCompany } from "@/lib/auth/context";
import { validCompanyName, validId, type ActionState } from "@/lib/auth/validation";

export async function selectCompany(form: FormData) {
  const id = form.get("companyId");
  try {
    await companyContext(id);
    await setActiveCompany(String(id));
  } catch { redirect("/companies?error=access"); }
  redirect("/");
}
export async function createCompany(_state: ActionState, form: FormData): Promise<ActionState> {
  const name = form.get("name");
  if (!validCompanyName(name)) return { error: "Informe um nome de empresa com até 120 caracteres." };
  try {
    const { supabase } = await currentUser();
    const { data, error } = await supabase.rpc("create_company", { company_name: name.trim() });
    if (error || !data || !validId(data)) return { error: "Não foi possível criar a empresa. Tente novamente." };
    await setActiveCompany(data);
  } catch { return { error: "Entre na sua conta para criar uma empresa." }; }
  redirect("/");
}
export async function renameCompany(_state: ActionState, form: FormData): Promise<ActionState> {
  const name = form.get("name");
  if (!validCompanyName(name)) return { error: "Informe um nome de empresa com até 120 caracteres." };
  try {
    const { supabase, companyId } = await companyContext(form.get("companyId"));
    const { data, error } = await supabase.from("companies").update({ name: name.trim() }).eq("id", companyId).select("id").maybeSingle();
    if (error || !data) return { error: "Não foi possível alterar o nome. Apenas o proprietário pode fazer essa alteração." };
  } catch { return { error: "Não foi possível acessar esta empresa." }; }
  redirect("/companies");
}
