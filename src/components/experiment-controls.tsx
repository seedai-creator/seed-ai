"use client";
import {useActionState,useState} from "react";
import {useI18n} from "@/lib/i18n/provider";
import {changeExperiment} from "@/app/experiments/actions";
import {NUMBER_PATTERN,OUTCOMES,type Experiment,type Outcome} from "@/lib/experiments/contracts";
export function ExperimentControls({experiment}:{experiment:Experiment}){
 const {t}=useI18n(); const [state,action,pending]=useActionState(changeExperiment,{}); const [outcome,setOutcome]=useState<Outcome>("INCONCLUSIVE");
 if(!["PLANNED","RUNNING"].includes(experiment.status))return null;
 const hidden=<><input type="hidden" name="companyId" value={experiment.company_id}/><input type="hidden" name="id" value={experiment.id}/><input type="hidden" name="version" value={experiment.version}/></>;
 const feedback=<>{state.error&&<p role="alert" className="error">{state.error}</p>}{state.success&&<p role="status">{state.success}</p>}</>;
 if(experiment.status==="PLANNED")return <form action={action}>{hidden}<input type="hidden" name="operation" value="start"/><button className="account-button" disabled={pending}>{t("experiment.start")}</button>{feedback}</form>;
 return <details><summary>{t("experiment.finish")}</summary><form action={action} className="strategy-draft account-form">
  {hidden}<input type="hidden" name="operation" value="finish"/><p className="account-note">{t("experiment.finishNote")}</p>
  <fieldset disabled={pending}>
   <label>{t("experiment.outcome")}<select name="status" value={outcome} onChange={e=>setOutcome(e.target.value as Outcome)}>{OUTCOMES.map(value=><option value={value} key={value}>{t(`experiment.${value}`)}</option>)}</select></label>
   <label>{t("experiment.result")}<input name="result" inputMode="decimal" pattern={NUMBER_PATTERN.source} maxLength={17} required={outcome!=="INCONCLUSIVE"}/></label><p className="account-note">{t("experiment.numberHint")}</p>
   <label>{t("experiment.learning")}<textarea name="learning" required rows={4} maxLength={4000}/></label>
   <button className="send-button">{t(pending?"experiment.saving":"experiment.confirmFinish")}</button>
  </fieldset>{feedback}
 </form></details>;
}
