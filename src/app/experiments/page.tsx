import Link from "next/link";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {ACTIVE_COMPANY_COOKIE,companyContext} from "@/lib/auth/context";
import {getTranslator,getLocale} from "@/lib/i18n/server";
import {formatDate} from "@/lib/i18n/format";
import {formatExperimentNumber} from "@/lib/experiments/contracts";
import {Brand} from "@/components/brand";
import {ExperimentForm} from "@/components/experiment-form";
import {ExperimentControls} from "@/components/experiment-controls";
export const dynamic="force-dynamic";
export default async function ExperimentsPage(){
 const t=await getTranslator(),locale=await getLocale();
 const context=await companyContext((await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value).catch(()=>null);
 if(!context)redirect("/companies"); const {supabase,companyId}=context;
 const [company,experiments]=await Promise.all([supabase.from("companies").select("name").eq("id",companyId).single(),supabase.from("experiments").select("*").eq("company_id",companyId).order("created_at",{ascending:false})]);
 return <main className="account-shell strategies-shell"><div className="account-top"><Brand/><Link href="/">{t("strategy.back")}</Link></div>
  <section className="account-card"><p className="account-kicker">{company.data?.name}</p><h1>{t("experiment.page")}</h1><p>{t("experiment.pageNote")}</p>
   {company.error||experiments.error?<p role="alert" className="error">{t("experiment.error")}</p>:<>
    <ExperimentForm companyId={companyId}/>{!experiments.data?.length&&<p>{t("experiment.empty")}</p>}
    {experiments.data?.map(experiment=><article className="saved-strategy" id={"experiment-"+experiment.id} key={experiment.id}>
     <h2>{experiment.name}</h2><p>{t(experiment.execution_status==='COMPLETED'?'execution.COMPLETED':`experiment.${experiment.status}`)}</p>{experiment.execution_status==='COMPLETED'&&<p>{t('execution.reported')}</p>}<dl>
      {(["problem","hypothesis","action","metric"] as const).map(key=><div key={key}><dt>{t(`experiment.${key}`)}</dt><dd>{experiment[key]}</dd></div>)}
      {(["baseline","target","result"] as const).map(key=><div key={key}><dt>{t(`experiment.${key}`)}</dt><dd>{experiment[key]===null?t("experiment.unknown"):formatExperimentNumber(experiment[key],locale)}</dd></div>)}
      {(["start_date","end_date"] as const).map(key=><div key={key}><dt>{t(`experiment.${key}`)}</dt><dd>{formatDate(experiment[key]+"T12:00:00Z",locale,"UTC")}</dd></div>)}
      {experiment.started_at&&<><dt>{t("experiment.startedAt")}</dt><dd>{formatDate(experiment.started_at,locale,"UTC")}</dd></>}
      {experiment.finished_at&&<><dt>{t("experiment.finishedAt")}</dt><dd>{formatDate(experiment.finished_at,locale,"UTC")}</dd><dt>{t("experiment.learning")}</dt><dd>{experiment.learning}</dd></>}
     </dl><ExperimentControls key={experiment.version} experiment={experiment}/>
    </article>)}
   </>}
  </section>
 </main>;
}
