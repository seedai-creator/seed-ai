import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { ChatError } from "../chat/contracts";
import type { CompanyFact } from "./contracts";
export async function loadCompanyFacts(supabase: SupabaseClient<Database>, companyId: string): Promise<CompanyFact[]> {
  const { data, error } = await supabase.from("company_facts").select("*").eq("company_id", companyId).order("key").limit(12);
  if (error) throw new ChatError(503, "MEMORY_UNAVAILABLE", "Não foi possível carregar a memória da empresa. Tente novamente.");
  return data ?? [];
}
