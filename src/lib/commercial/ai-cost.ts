export type AiPricing = {
  id: string; provider: string; model: string; effective_from: string; effective_to: string | null;
  input_per_million: string; cached_per_million: string | null; output_per_million: string;
  currency: "USD"; processing_tier: string; context_tier: string; cache_write_per_million?: string | null;
};
export type TokenUsage = { input_tokens: number; cached_input_tokens: number | null; cache_write_tokens?: number | null; output_tokens: number; reasoning_tokens: number | null; total_tokens: number };
// Integer picodollars avoid binary floating point rounding in accumulated costs.
const SCALE = BigInt(1_000_000_000_000);
function decimal(value: string): bigint {
  if (!/^\d{1,9}(\.\d{1,6})?$/.test(value)) throw new Error("Invalid pricing");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(1_000_000) + BigInt(fraction.padEnd(6, "0"));
}
function usd(value: bigint): string { return `${value / SCALE}.${(value % SCALE).toString().padStart(12, "0")}`; }
export function calculateAiCost(input: { provider: string; model: string; at: string; processing_tier: string; context_tier: string; usage: TokenUsage | null; pricing: AiPricing | null; tool_cost_usd: string | null }) {
  const p = input.pricing, u = input.usage;
  const unknown = (reason: string) => ({ status: "UNKNOWN" as const, reason, total_usd: null });
  if (!u) return unknown("USAGE_MISSING");
  if ([u.input_tokens, u.output_tokens, u.total_tokens, ...(u.cached_input_tokens === null ? [] : [u.cached_input_tokens]), ...(u.reasoning_tokens === null ? [] : [u.reasoning_tokens])].some(v => !Number.isSafeInteger(v) || v < 0) || u.total_tokens !== u.input_tokens + u.output_tokens || (u.cached_input_tokens ?? 0) > u.input_tokens || (u.reasoning_tokens ?? 0) > u.output_tokens) throw new Error("Invalid provider usage");
  if (!p || p.provider !== input.provider || p.model !== input.model || p.currency !== "USD" || p.processing_tier !== input.processing_tier || p.context_tier !== input.context_tier || !Number.isFinite(Date.parse(input.at)) || !Number.isFinite(Date.parse(p.effective_from)) || Date.parse(input.at) < Date.parse(p.effective_from) || (p.effective_to !== null && (!Number.isFinite(Date.parse(p.effective_to)) || Date.parse(input.at) >= Date.parse(p.effective_to)))) return unknown("PRICING_MISSING");
  if (u.cached_input_tokens === null || (u.cached_input_tokens > 0 && p.cached_per_million === null)) return unknown("CACHE_PRICING_OR_USAGE_MISSING");
  if (input.tool_cost_usd === null) return unknown("TOOL_COST_MISSING");
  if (p.cache_write_per_million != null && u.cache_write_tokens == null) return unknown("CACHE_WRITE_USAGE_MISSING");
  const writes = u.cache_write_tokens ?? 0;
  if (!Number.isSafeInteger(writes) || writes < 0 || writes + u.cached_input_tokens > u.input_tokens) throw new Error("Invalid cache write usage");
  if (writes > 0 && p.cache_write_per_million == null) return unknown("CACHE_WRITE_PRICING_MISSING");
  const writeCost = BigInt(writes) * decimal(p.cache_write_per_million ?? "0");
  const regular = BigInt(u.input_tokens - u.cached_input_tokens - writes) * decimal(p.input_per_million);
  const cached = BigInt(u.cached_input_tokens) * decimal(p.cached_per_million ?? "0");
  // Reasoning tokens are already included in output_tokens: never charge them twice.
  const output = BigInt(u.output_tokens) * decimal(p.output_per_million);
  const tools = decimal(input.tool_cost_usd) * BigInt(1_000_000);
  return { status: "ESTIMATED" as const, pricing_id: p.id, input_usd: usd(regular), cached_usd: usd(cached), cache_write_usd: usd(writeCost), output_usd: usd(output), tool_usd: usd(tools), total_usd: usd(regular + cached + writeCost + output + tools), cache_savings_usd: usd(BigInt(u.cached_input_tokens) * decimal(p.input_per_million) >= cached ? BigInt(u.cached_input_tokens) * decimal(p.input_per_million) - cached : BigInt(0)), cache_hit_rate: u.input_tokens ? u.cached_input_tokens / u.input_tokens : null };
}
