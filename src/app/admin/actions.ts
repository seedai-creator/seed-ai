"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/commercial/server";
import { validatePolicy, type UsagePolicy } from "@/lib/commercial/contracts";
export async function updateConfiguration(form: FormData) {
  try {
    const { db, user } = await requireAdmin("SUPER_ADMIN");
    const entity=String(form.get("entity")),key=String(form.get("key")),version=Number(form.get("version")),reason=String(form.get("reason")??"").trim();
    if(!Number.isSafeInteger(version)||version<1||reason.length<5||reason.length>1000||form.get("confirmed")!=="on") throw new Error("INVALID_CHANGE");
    let value;
    if(entity==="policy" && ["FREE","PRO"].includes(key)) {
      const fields=["target_usd","approaching_usd","soft_usd","warning_usd","heavy_usd","hard_usd","interactions","diagnoses","max_concurrent","requests_per_minute","user_day_usd","user_month_usd","global_day_usd"];
      value=validatePolicy({window:form.get("window"),...Object.fromEntries(fields.map(k=>[k,Number(form.get(k))]))} as UsagePolicy);
    } else if(entity==="market" && ["BR","PT","ES","US"].includes(key)) {
      const {data,error}=await db.from("commercial_markets").select("*").eq("code",key).single();
      if(error||!data||data.version!==version)throw new Error("STALE_CHANGE");
      const status=String(form.get("status"));if(!["DRAFT","READY","ACTIVE","PAUSED","DISABLED"].includes(status))throw new Error("INVALID_STATUS");
      value={...data,status};
      for(const field of ["signup_enabled","free_enabled","pro_enabled","billing_enabled","disable_new_signups","disable_new_subscriptions","disable_ai_requests"])value[field]=form.get(field)==="on";
    } else throw new Error("INVALID_ENTITY");
    const {error}=await db.rpc("update_commercial_config",{p_actor:user.id,p_entity:entity,p_key:key,p_version:version,p_value:value,p_reason:reason});
    if(error)throw new Error("UPDATE_REJECTED");
  } catch {redirect("/admin?error=update");}
  revalidatePath("/admin");revalidatePath("/billing");redirect("/admin?updated=1");
}
