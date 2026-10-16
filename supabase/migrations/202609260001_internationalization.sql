begin;
alter table public.profiles add column locale text check (locale in ('pt-BR','pt-PT','en-US','es-ES'));
grant update(locale) on public.profiles to authenticated;
alter table public.companies
  add column preferred_language text check (preferred_language in ('pt-BR','pt-PT','en-US','es-ES')),
  add column locale text check (locale in ('pt-BR','pt-PT','en-US','es-ES')),
  add column timezone text check (char_length(timezone) between 1 and 100);
-- No country/currency columns: their source of truth is the existing confirmed facts.
-- Exact, unambiguous legacy country names only. Never infer market from user locale.
update public.company_facts set value = case lower(btrim(value))
  when 'brasil' then 'BR' when 'brazil' then 'BR' when 'br' then 'BR'
  when 'portugal' then 'PT' when 'pt' then 'PT'
  when 'estados unidos' then 'US' when 'united states' then 'US' when 'us' then 'US'
  when 'espanha' then 'ES' when 'españa' then 'ES' when 'spain' then 'ES' when 'es' then 'ES'
  end, version = version + 1
where key='country' and lower(btrim(value)) in ('brasil','brazil','br','portugal','pt','estados unidos','united states','us','espanha','españa','spain','es');
-- Preserve unknown legacy descriptions, but require canonical codes on future writes.
alter table public.company_facts add constraint country_code_format
  check (key <> 'country' or value ~ '^[A-Z]{2}$') not valid;

create function public.save_company_market(
  p_company_id uuid, p_country text, p_currency text,
  p_preferred_language text, p_locale text, p_timezone text,
  p_expected_updated_at timestamptz, p_country_version integer, p_currency_version integer
) returns void language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); current_updated timestamptz;
begin
  if caller is null or not exists (
    select 1 from public.company_members where company_id=p_company_id and user_id=caller and role='owner'
  ) then raise exception 'Access denied' using errcode='42501'; end if;
  select updated_at into current_updated from public.companies where id=p_company_id for update;
  if p_expected_updated_at is null or current_updated <> p_expected_updated_at then
    raise exception 'Company changed' using errcode='40001'; end if;
  if p_country is not null and p_country not in ('BR','PT','US','ES') then
    raise exception 'Invalid country' using errcode='22023'; end if;
  if p_currency is not null and p_currency !~ '^[A-Z]{3}$' then
    raise exception 'Invalid currency' using errcode='22023'; end if;
  if p_timezone is not null and not exists (select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then
    raise exception 'Invalid timezone' using errcode='22023'; end if;
  update public.companies set preferred_language=p_preferred_language, locale=p_locale, timezone=p_timezone
    where id=p_company_id;
  -- Reuse confirmation/version checks. All operations commit or roll back together.
  if p_country is not null then
    perform public.save_company_fact(p_company_id,'country',p_country,p_country_version);
  end if;
  if p_currency is not null then
    perform public.save_company_fact(p_company_id,'currency',p_currency,p_currency_version);
  end if;
end;
$$;
revoke all on function public.save_company_market(uuid,text,text,text,text,text,timestamptz,integer,integer) from public,anon;
grant execute on function public.save_company_market(uuid,text,text,text,text,text,timestamptz,integer,integer) to authenticated;
commit;
