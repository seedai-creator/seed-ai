import {healthResponse} from '@/lib/operations/health';
import {readOperationalHealth} from '@/lib/operations/health-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=10;
export async function GET(request:Request) {
  return healthResponse(request,process.env.SEED_HEALTH_TOKEN,readOperationalHealth);
}
