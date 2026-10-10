import {growthEnabled} from '@/lib/growth/domain';
import {cockpitEnabled} from '@/lib/cockpit/domain';
import {externalEnabled} from '@/lib/external/domain';
import {goalsEnabled} from '@/lib/goals/server';
import {radarEnabled} from '@/lib/radar/domain';

import { journalEnabled } from "@/lib/journal/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SeedWorkspace } from "@/components/seed-workspace";
import { SetupNotice } from "@/components/setup-notice";
import { supabaseConfig } from "@/lib/supabase/config";
import { ACTIVE_COMPANY_COOKIE, companyContext } from "@/lib/auth/context";
import { ChatError } from "@/lib/chat/contracts";

export const maxDuration = 120;
export const dynamic = "force-dynamic";
export default async function Home() {
  if (!supabaseConfig()) return <SetupNotice />;
  const id = (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value;
  let context;
  try { context = await companyContext(id); }
  catch (error) {
    if(error instanceof ChatError&&['BETA_ACCESS_REQUIRED','TERMS_REQUIRED'].includes(error.code))redirect('/access');
    if (error instanceof ChatError && error.status === 401) redirect("/login");
    if(error instanceof ChatError&&error.status>=500)throw error;
    redirect("/companies");
  }
  const { data, error } = await context.supabase.from("companies").select("*").eq("id", context.companyId).maybeSingle();
  if (error || !data) redirect("/companies?error=access");

  return <SeedWorkspace cockpitAvailable={cockpitEnabled()} growthAvailable={growthEnabled()} goalsAvailable={goalsEnabled()} externalAvailable={externalEnabled()} radarAvailable={radarEnabled()} journalAvailable={journalEnabled()} key={data.id} company={data} userId={context.userId} />;
}

