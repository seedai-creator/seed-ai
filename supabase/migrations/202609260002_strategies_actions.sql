begin;
create table public.strategies (
  id uuid primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  objective text not null check (char_length(btrim(objective)) between 1 and 2000),
  situation text not null check (char_length(btrim(situation)) between 1 and 2000),
  bottleneck text not null check (char_length(bottleneck) <= 2000),
  hypothesis text not null check (char_length(hypothesis) <= 2000),
  strategy text not null check (char_length(btrim(strategy)) between 1 and 4000),
  review_date date check (review_date between date '1900-01-01' and date '9999-12-31'),
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','COMPLETED','CANCELLED')),
  version integer not null default 1,
  request_hash text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id,company_id)
);
create table public.actions (
  id uuid primary key default gen_random_uuid(), company_id uuid not null,
  strategy_id uuid not null, position integer not null check (position between 1 and 10),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text not null check (char_length(btrim(description)) between 1 and 2000),
  reason text not null check (char_length(btrim(reason)) between 1 and 2000),
  responsible text not null check (char_length(responsible) <= 120),
  deadline date check (deadline between date '1900-01-01' and date '9999-12-31'),
  metric text not null check (char_length(metric) <= 500), target text not null check (char_length(target) <= 500),
  status text not null default 'TODO' check (status in ('TODO','IN_PROGRESS','COMPLETED','CANCELLED')),
  version integer not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(strategy_id,company_id) references public.strategies(id,company_id) on delete cascade,
  unique(strategy_id,position)
);
create index strategies_company_created on public.strategies(company_id,created_at desc);
create index actions_company_strategy on public.actions(company_id,strategy_id);
alter table public.strategies enable row level security;
alter table public.actions enable row level security;
revoke all on public.strategies,public.actions from anon,authenticated;
grant select on public.strategies,public.actions to authenticated;
create policy strategies_read on public.strategies for select to authenticated using (
  exists(select 1 from public.company_members m where m.company_id=strategies.company_id and m.user_id=(select auth.uid()))
);
create policy actions_read on public.actions for select to authenticated using (
  exists(select 1 from public.company_members m where m.company_id=actions.company_id and m.user_id=(select auth.uid()))
);
create trigger strategies_updated before update on public.strategies for each row execute function public.touch_updated_at();
create trigger actions_updated before update on public.actions for each row execute function public.touch_updated_at();
-- Confirmation is explicit in the application; writes are atomic and scoped to membership.
create function public.save_strategy(p_company_id uuid,p_id uuid,p_draft jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); existing public.strategies%rowtype; item jsonb; idx integer:=0; field text;
begin
  if caller is null or not exists(select 1 from public.company_members where company_id=p_company_id and user_id=caller) then
    raise exception 'Access denied' using errcode='42501'; end if;
  if p_draft is null or jsonb_typeof(p_draft) <> 'object' or octet_length(p_draft::text)>60000 then raise exception 'Invalid draft'; end if;
  if jsonb_typeof(p_draft->'actions') is distinct from 'array' then raise exception 'Invalid actions'; end if;
  if jsonb_array_length(p_draft->'actions') not between 1 and 10 then raise exception 'Invalid actions'; end if;
  foreach field in array array['name','objective','situation','bottleneck','hypothesis','strategy'] loop
    if jsonb_typeof(p_draft->field) is distinct from 'string' then raise exception 'Invalid field'; end if;
  end loop;
  if not (p_draft ? 'review_date') or jsonb_typeof(p_draft->'review_date') not in ('string','null') then raise exception 'Invalid date'; end if;
  -- Serialize repeat submissions and prevent partial strategies on a failed action.
  perform 1 from public.companies where id=p_company_id for update;
  select * into existing from public.strategies where id=p_id;
  if found then
    if existing.company_id<>p_company_id or existing.created_by is distinct from caller or existing.request_hash<>md5(p_draft::text) then
      raise exception 'Submission conflict' using errcode='40001'; end if;
    return existing.id;
  end if;
  insert into public.strategies(id,company_id,created_by,name,objective,situation,bottleneck,hypothesis,strategy,review_date,request_hash)
  values(p_id,p_company_id,caller,p_draft->>'name',p_draft->>'objective',p_draft->>'situation',p_draft->>'bottleneck',p_draft->>'hypothesis',p_draft->>'strategy',nullif(p_draft->>'review_date','')::date,md5(p_draft::text));
  for item in select value from jsonb_array_elements(p_draft->'actions') loop
    foreach field in array array['title','description','reason','responsible','metric','target'] loop
      if jsonb_typeof(item->field) is distinct from 'string' then raise exception 'Invalid action field'; end if;
    end loop;
    if not (item ? 'deadline') or jsonb_typeof(item->'deadline') not in ('string','null') then raise exception 'Invalid date'; end if;
    idx:=idx+1;
    insert into public.actions(company_id,strategy_id,position,title,description,reason,responsible,deadline,metric,target)
    values(p_company_id,p_id,idx,item->>'title',item->>'description',item->>'reason',item->>'responsible',nullif(item->>'deadline','')::date,item->>'metric',item->>'target');
  end loop;
  return p_id;
end;
$$;
create function public.set_strategy_status(p_company_id uuid,p_id uuid,p_status text,p_version integer) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.company_members where company_id=p_company_id and user_id=auth.uid()) then
    raise exception 'Access denied' using errcode='42501'; end if;
  update public.strategies set status=p_status,version=version+1 where id=p_id and company_id=p_company_id and version=p_version;
  if not found then raise exception 'Strategy changed' using errcode='40001'; end if;
end;
$$;
create function public.set_action_status(p_company_id uuid,p_id uuid,p_status text,p_version integer) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.company_members where company_id=p_company_id and user_id=auth.uid()) then
    raise exception 'Access denied' using errcode='42501'; end if;
  update public.actions set status=p_status,version=version+1 where id=p_id and company_id=p_company_id and version=p_version;
  if not found then raise exception 'Action changed' using errcode='40001'; end if;
end;
$$;
revoke all on function public.save_strategy(uuid,uuid,jsonb),public.set_strategy_status(uuid,uuid,text,integer),public.set_action_status(uuid,uuid,text,integer) from public,anon;
grant execute on function public.save_strategy(uuid,uuid,jsonb),public.set_strategy_status(uuid,uuid,text,integer),public.set_action_status(uuid,uuid,text,integer) to authenticated;
commit;
