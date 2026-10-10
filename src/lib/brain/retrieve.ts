import type { Intent } from "../intent/router";
import identity from "./modules/identity";
import method from "./modules/method-seed";
import diagnosis from "./modules/diagnosis";
import sales from "./modules/sales";
import marketing from "./modules/marketing";
import positioning from "./modules/positioning";
import pricing from "./modules/pricing";
import growth from "./modules/growth";
import decision from "./modules/decision";
import expansion from "./modules/expansion";
import launch from "./modules/launch";
import limits from "./modules/limits";

const catalog = { identity, "method-seed": method, diagnosis, sales, marketing, positioning, pricing, growth, decision, expansion, launch, limits };
export type BrainModuleId = keyof typeof catalog;
export const BRAIN_VERSION = "1.0.0";
export type BrainContext = { version: string; moduleIds: BrainModuleId[]; text: string };
const topics: Record<Intent, BrainModuleId[]> = {
  GENERAL: [], DIAGNOSIS: ["diagnosis"], SALES: ["sales", "growth"],
  MARKETING: ["marketing", "growth"], POSITIONING: ["positioning"],
  PRICING: ["pricing"], DECISION: ["decision"], GROWTH: ["growth", "diagnosis"],
  LAUNCH: ["launch", "marketing"], EXPANSION: ["expansion", "decision"],
};
// Bounded local retrieval. This seam can gain a search provider when the corpus grows.
// No company data is ever stored in the shared catalog.
export function retrieveBrain(intent: Intent): BrainContext {
  if (!Object.hasOwn(topics, intent)) throw new Error("Invalid brain intent");
  const moduleIds = [...new Set<BrainModuleId>(["identity", "method-seed", "limits", ...topics[intent]])];
  const text = moduleIds.map(id => "[" + id + "]\n" + catalog[id]).join("\n\n");
  if (text.length > 10000) throw new Error("Brain context exceeds budget");
  return { version: BRAIN_VERSION, moduleIds, text };
}
