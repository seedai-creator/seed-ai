"use client";
import { useI18n } from "@/lib/i18n/provider";
import { useActionState } from "react";
import { createCompany, renameCompany } from "@/app/companies/actions";
export function CompanyForm({ company }: { company?: { id: string; name: string } }) {
  const { t, tr } = useI18n();

  const [state, action, pending] = useActionState(company ? renameCompany : createCompany, {});
  return <form action={action} className="account-form">
    {company && <input type="hidden" name="companyId" value={company.id} />}
    <label>{company ? t("fact.company_name") : t("company.newName")}<input name="name" defaultValue={company?.name} maxLength={120} required disabled={pending} /></label>
    {state.error && <p role="alert" className="error">{tr(state.error)}</p>}
    <button className="account-button" disabled={pending}>{pending ? t("common.saving") : company ? t("company.saveName") : t("company.create")}</button>
  </form>;
}

