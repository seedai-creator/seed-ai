begin;
create table public.company_facts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  key text not null check (key in ('company_name','segment','city','country','business_model','products_services','target_audience','monthly_revenue','currency','average_ticket','team_size','business_objective')),
  value text not null check (char_length(btrim(value)) between 1 and 500),
  version integer not null default 1 check (version > 0),
  confirmed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,key),
  check (key not in ('monthly_revenue','average_ticket') or value ~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,2})?$'),
  check (key <> 'team_size' or value ~ '^(0|[1-9][0-9]{0,6})$'),
  check (key <> 'currency' or value ~ '^[A-Z]{3}$')
);
alter table public.company_facts enable row level security;
revoke all on public.company_facts from anon, authenticated;
grant select on public.company_facts to authenticated;
create policy facts_read on public.company_facts for select to authenticated using (
  exists (select 1 from public.company_members m where m.company_id = company_facts.company_id and m.user_id = (select auth.uid()))
);
create trigger facts_updated before update on public.company_facts for each row execute function public.touch_updated_at();
-- No direct writes: explicit confirmation uses this scoped, validated function.
create function public.save_company_fact(p_company_id uuid, p_key text, p_value text, p_expected_version integer)
returns setof public.company_facts
language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); existing public.company_facts%rowtype;
begin
  if caller is null or not exists (select 1 from public.company_members where company_id = p_company_id and user_id = caller)
    then raise exception 'Access denied' using errcode = '42501'; end if;
  -- Serialize writes per company, including competing inserts for a new key.
  perform 1 from public.companies where id = p_company_id for update;
  select * into existing from public.company_facts where company_id = p_company_id and key = p_key for update;
  if found then
    if p_expected_version is null or p_expected_version <> existing.version then
      raise exception 'Fact changed' using errcode = '40001';
    end if;
    return query update public.company_facts set value = btrim(p_value), version = version + 1, confirmed_by = caller
      where id = existing.id returning *;
  else
    if p_expected_version is not null then raise exception 'Fact changed' using errcode = '40001'; end if;
    return query insert into public.company_facts(company_id,key,value,confirmed_by)
      values(p_company_id,p_key,btrim(p_value),caller) returning *;
  end if;
end;
$$;
revoke all on function public.save_company_fact(uuid,text,text,integer) from public, anon;
grant execute on function public.save_company_fact(uuid,text,text,integer) to authenticated;
commit;
