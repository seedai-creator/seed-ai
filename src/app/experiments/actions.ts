"use server";
import { revalidatePath } from "next/cache";
import { authorizeChat, companyContext } from "@/lib/auth/context";
import { validId } from "@/lib/auth/validation";
import { parseExperiment, parseExperimentResult } from "@/lib/experiments/contracts";
import { getTranslator } from "@/lib/i18n/server";
export type ExperimentState = { error?: string; id?: string; success?: string };
export async function saveExperiment(companyId: string, id: string, value: unknown): Promise<ExperimentState> {
 const t=await getTranslator(); let draft;
 try { if(!validId(id)) throw new Error(); draft=parseExperiment(value); } catch { return {error:t("experiment.invalid")}; }
 try {
  await authorizeChat({companyId}); const {supabase}=await companyContext(companyId);
  const {data,error}=await supabase.rpc("save_experiment",{p_company_id:companyId,p_id:id,p_draft:draft});
  if(error||!data)return {error:t(error?.code==="40001"?"experiment.conflict":"experiment.error")};
  revalidatePath("/experiments"); return {id:data};
 } catch {return {error:t("experiment.error")};}
}
export async function changeExperiment(_state: ExperimentState,form: FormData): Promise<ExperimentState> {
 const t=await getTranslator(), companyId=String(form.get("companyId")??""),id=String(form.get("id")??""),version=Number(form.get("version")),operation=form.get("operation");
 let outcome;
 try {
  if(!validId(id)||!Number.isSafeInteger(version)||version<1||!["start","finish"].includes(String(operation)))throw new Error();
  if(operation==="finish")outcome=parseExperimentResult({status:form.get("status"),result:form.get("result"),learning:form.get("learning")});
 }catch{return {error:t("experiment.invalid")};}
 try {
  await authorizeChat({companyId}); const {supabase}=await companyContext(companyId);
  const args={p_company_id:companyId,p_id:id,p_version:version};
  const {error}=outcome?await supabase.rpc("finish_experiment",{...args,p_status:outcome.status,p_result:outcome.result,p_learning:outcome.learning}):await supabase.rpc("start_experiment",args);
  if(error)return {error:t(error.code==="40001"?"experiment.conflict":"experiment.error")};
  revalidatePath("/experiments");return {success:t("experiment.updated")};
 }catch{return {error:t("experiment.error")};}
}
