import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config";
import type { Database } from "./database.types";
import { ChatError } from "../chat/contracts";

export async function createSupabaseServer() {
  const config = supabaseConfig();
  if (!config) throw new ChatError(503, "AUTH_NOT_CONFIGURED", "O acesso à SEED está sendo configurado. Tente novamente mais tarde.");
  const jar = await cookies();
  return createServerClient<Database>(config.url, config.key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try { for (const { name, value, options } of values) jar.set(name, value, options); }
        catch { /* Server Components cannot write cookies; proxy handles refresh. */ }
      },
    },
  });
}
