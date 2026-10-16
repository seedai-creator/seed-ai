import "server-only";
import { createClient } from "@supabase/supabase-js";
import { currentUser } from "../auth/context";
import { effectivePlan, getPlanEntitlements, getUsagePolicy } from "./entitlements";
import type { Flags, Market, Override, Plan, Subscription } from "./contracts";
export function commercialDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("COMMERCIAL_SERVER_NOT_CONFIGURED");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function commercialContext() {
  const { user } = await currentUser();
  return commercialContextForUser(user);
}
// Internal worker use: durable job ownership and membership must be verified first.
export async function commercialContextForUser(user: {id:string}) {
  const db = commercialDatabase();
  const [account, subscriptions, overrides, global] = await Promise.all([
    db.from("commercial_accounts").select("*").eq("user_id", user.id).maybeSingle(),
    db.from("subscriptions").select("*").eq("user_id", user.id).in("status", ["active", "trialing"]).order("current_period_end", { ascending: false }).limit(1),
    db.from("commercial_overrides").select("settings,expires_at").eq("user_id", user.id).is("revoked_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1),
    db.from("commercial_settings").select("value").eq("id", "global_flags").single(),
  ]);
  if ([account, subscriptions, overrides, global].some(r => r.error) || !global.data) throw new Error("COMMERCIAL_DATABASE_UNAVAILABLE");
  if (!account.data?.market_code) throw new Error("COMMERCIAL_MARKET_REQUIRED");
  const item = overrides.data?.[0];
  const override: Override | null = item ? { ...item.settings, expires_at: item.expires_at } : null;
  const subscription = subscriptions.data?.[0] as Subscription | undefined;
  const planCode = effectivePlan(subscription ?? null, override, new Date());
  const [planResult, marketResult] = await Promise.all([
    db.from("commercial_plans").select("*").eq("code", planCode).single(),
    db.from("commercial_markets").select("*").eq("code", account.data.market_code).single(),
  ]);
  if (planResult.error || marketResult.error) throw new Error("COMMERCIAL_CONFIGURATION_UNAVAILABLE");
  const plan = planResult.data as Plan, market = marketResult.data as Market;
  return { db, user, plan, market, subscription, flags: getPlanEntitlements(global.data.value as Flags, plan, market, override, new Date()), policy: getUsagePolicy(plan, override, new Date()), override };
}
export async function requireAdmin(minimum: "ADMIN_VIEWER" | "ADMIN_OPERATOR" | "SUPER_ADMIN" = "ADMIN_VIEWER") {
  const { user } = await currentUser(); const db = commercialDatabase();
  const { data, error } = await db.from("admin_roles").select("role").eq("user_id", user.id).maybeSingle();
  const levels = ["ADMIN_VIEWER", "ADMIN_OPERATOR", "SUPER_ADMIN"];
  if (error || !data || levels.indexOf(data.role) < levels.indexOf(minimum)) throw new Error("ADMIN_FORBIDDEN");
  return { db, user, role: String(data.role) };
}
