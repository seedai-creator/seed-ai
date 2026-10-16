import type { CompanyFact } from "./contracts";
export function memoryContext(companyId: string, facts: CompanyFact[]) {
  // Defense in depth: never include a row from another company, even if a caller errs.
  return JSON.stringify(facts.filter(f => f.company_id === companyId).slice(0, 12).map(f => ({
    key: f.key, value: f.value.slice(0, 500), confirmed_at: f.updated_at,
  })));
}
