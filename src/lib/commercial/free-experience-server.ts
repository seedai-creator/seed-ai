import 'server-only';
import { ChatError } from '../chat/contracts';
import { commercialContextForUser } from './server';
import { commercialRolloutEnabled } from './metering';
import { freeExperienceState } from './free-experience';

// Internal only: userId must come from companyContext/currentUser, never input.
// No financial amounts, secrets or other tenants' state are sent to the browser.
export async function freeExperienceForUser(userId: string) {
  if (!await commercialRolloutEnabled()) return null;
  const c = await commercialContextForUser({ id: userId });
  if (c.plan.code !== 'FREE') return null;
  const usage = await c.db.rpc('commercial_usage', { p_user: userId, p_window: c.policy.window });
  if (usage.error || !usage.data) throw new ChatError(503, 'COMMERCIAL_UNAVAILABLE', 'Não foi possível verificar sua assinatura.');
  return freeExperienceState({ cost: Number(usage.data.cost), diagnoses: Number(usage.data.diagnoses) }, c.policy);
}
