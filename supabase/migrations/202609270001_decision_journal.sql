begin;
create table public.decisions (
  id uuid primary key, company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  decision text not null check (char_length(btrim(decision)) between 1 and 1000),
  context text not null check (char_length(btrim(context)) between 1 and 3000),
  reason text not null check (char_length(btrim(reason)) between 1 and 3000),
  hypothesis text not null check (char_length(hypothesis)<=2000), baseline text not null check (char_length(baseline)<=2000),
  decision_date date not null check (decision_date between date '1900-01-01' and date '9999-12-31'),
  review_date date check (review_date between decision_date and date '9999-12-31'),
  result text not null default '' check (char_length(result)<=4000),
  learning text not null default '' check (char_length(learning)<=4000),
  reviewed_at timestamptz, reviewed_by uuid references public.profiles(id) on delete set null,
  version integer not null default 1 check (version>0), request_hash text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((reviewed_at is null and result='' and learning='') or
    (reviewed_at is not null and char_length(btrim(result))>0 and char_length(btrim(learning))>0))
);
create index decisions_company_created on public.decisions(company_id,created_at desc);
alter table public.decisions enable row level security;
revoke all on public.decisions from anon,authenticated;
grant select on public.decisions to authenticated;
create policy decisions_read on public.decisions for select to authenticated using (
  exists(select 1 from public.company_members m where m.company_id=decisions.company_id and m.user_id=(select auth.uid()))
);
create trigger decisions_updated before update on public.decisions for each row execute function public.touch_updated_at();
create function public.save_decision(p_company_id uuid,p_id uuid,p_draft jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); existing public.decisions%rowtype; field text;
begin
  if caller is null or not exists(select 1 from public.company_members where company_id=p_company_id and user_id=caller) then
    raise exception 'Access denied' using errcode='42501'; end if;
  if p_draft is null or jsonb_typeof(p_draft)<>'object' or octet_length(p_draft::text)>50000 then raise exception 'Invalid draft'; end if;
  foreach field in array array['decision','context','reason','hypothesis','baseline','decision_date'] loop
    if jsonb_typeof(p_draft->field) is distinct from 'string' then raise exception 'Invalid field'; end if;
  end loop;
  if not (p_draft ? 'review_date') or jsonb_typeof(p_draft->'review_date') not in ('string','null') then raise exception 'Invalid date'; end if;
  perform 1 from public.companies where id=p_company_id for update;
  select * into existing from public.decisions where id=p_id;
  if found then
    if existing.company_id<>p_company_id or existing.created_by is distinct from caller or existing.request_hash<>md5(p_draft::text) then
      raise exception 'Submission conflict' using errcode='40001'; end if;
    return existing.id;
  end if;
  insert into public.decisions(id,company_id,created_by,decision,context,reason,hypothesis,baseline,decision_date,review_date,request_hash)
  values(p_id,p_company_id,caller,p_draft->>'decision',p_draft->>'context',p_draft->>'reason',p_draft->>'hypothesis',p_draft->>'baseline',
    (p_draft->>'decision_date')::date,nullif(p_draft->>'review_date','')::date,md5(p_draft::text));
  return p_id;
end;
$$;
create function public.review_decision(p_company_id uuid,p_id uuid,p_version integer,p_result text,p_learning text) returns void
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid();
begin
  if caller is null or not exists(select 1 from public.company_members where company_id=p_company_id and user_id=caller) then
    raise exception 'Access denied' using errcode='42501'; end if;
  if p_result is null or p_learning is null or char_length(btrim(p_result)) not between 1 and 4000 or char_length(btrim(p_learning)) not between 1 and 4000 then
    raise exception 'Invalid review'; end if;
  update public.decisions set result=btrim(p_result),learning=btrim(p_learning),reviewed_at=now(),reviewed_by=caller,version=version+1
    where id=p_id and company_id=p_company_id and version=p_version;
  if not found then raise exception 'Decision changed' using errcode='40001'; end if;
end;
$$;
revoke all on function public.save_decision(uuid,uuid,jsonb),public.review_decision(uuid,uuid,integer,text,text) from public,anon;
grant execute on function public.save_decision(uuid,uuid,jsonb),public.review_decision(uuid,uuid,integer,text,text) to authenticated;
commit;
