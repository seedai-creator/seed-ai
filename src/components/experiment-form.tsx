"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import type { Diagnosis } from "@/lib/diagnosis/contracts";
import { draftExperiment, NUMBER_PATTERN, type ExperimentDraft } from "@/lib/experiments/contracts";
import { saveExperiment } from "@/app/experiments/actions";
export function ExperimentForm({companyId,diagnosis,disabled=false}:{companyId:string;diagnosis?:Diagnosis;disabled?:boolean}) {
 const {t}=useI18n(); const [draft,setDraft]=useState<ExperimentDraft|null>(null),[id,setId]=useState("");
 const [pending,setPending]=useState(false),[saved,setSaved]=useState(false),[error,setError]=useState("");
 if(saved)return <p role="status">{t("experiment.saved")} <Link href={"/experiments#experiment-"+id}>{t("experiment.view")}</Link></p>;
 if(!draft)return <button type="button" className="account-button" disabled={disabled} onClick={()=>{setDraft(draftExperiment(diagnosis));setId(crypto.randomUUID());}}>{t("experiment.new")}</button>;
 async function submit(event:FormEvent){event.preventDefault();if(pending)return;setPending(true);setError("");
  try{const result=await saveExperiment(companyId,id,draft);if(result.id)setSaved(true);else setError(result.error??t("experiment.error"));}catch{setError(t("experiment.error"));}finally{setPending(false);}
 }
 return <form className="strategy-draft account-form" onSubmit={submit}><h3>{t("experiment.new")}</h3><p className="account-note">{t("experiment.note")}</p>
  <fieldset disabled={pending||disabled}>
   {(["name","problem","hypothesis","action","metric"] as const).map(key=><label key={key}>{t(`experiment.${key}`)}<textarea required rows={key==="name"||key==="metric"?1:3} maxLength={key==="name"?160:key==="metric"?300:2000} value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})}/></label>)}
   <p className="account-note">{t("experiment.numberHint")}</p>
   {(["baseline","target"] as const).map(key=><label key={key}>{t(`experiment.${key}`)}<input required inputMode="decimal" pattern={NUMBER_PATTERN.source} maxLength={17} value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})}/></label>)}
   {(["start_date","end_date"] as const).map(key=><label key={key}>{t(`experiment.${key}`)}<input type="date" required min={key==="end_date"?draft.start_date||"1900-01-01":"1900-01-01"} max="9999-12-31" value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})}/></label>)}
   <button className="send-button">{t(pending?"experiment.saving":"experiment.save")}</button>
   <button className="text-button" type="button" onClick={()=>{setDraft(null);setError("");}}>{t("experiment.close")}</button>
  </fieldset>{error&&<p role="alert" className="error">{error}</p>}
 </form>;
}
