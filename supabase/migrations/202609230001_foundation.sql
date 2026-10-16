begin;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);
create index company_members_user_idx on public.company_members(user_id);
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;

-- Membership is read-only to clients. No client can grant itself access.
revoke all on public.profiles, public.companies, public.company_members from anon, authenticated;
grant select on public.profiles, public.companies, public.company_members to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant update (name) on public.companies to authenticated;

create policy profile_read on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profile_edit on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy membership_read on public.company_members for select to authenticated using (user_id = (select auth.uid()));
create policy company_read on public.companies for select to authenticated using (
  exists (select 1 from public.company_members m where m.company_id = companies.id and m.user_id = (select auth.uid()))
);
create policy company_edit on public.companies for update to authenticated using (
  exists (select 1 from public.company_members m where m.company_id = companies.id and m.user_id = (select auth.uid()) and m.role = 'owner')
) with check (
  exists (select 1 from public.company_members m where m.company_id = companies.id and m.user_id = (select auth.uid()) and m.role = 'owner')
);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
create trigger profiles_updated before update on public.profiles for each row execute function public.touch_updated_at();
create trigger companies_updated before update on public.companies for each row execute function public.touch_updated_at();

-- Executed only by the Auth trigger; profile + company + membership are atomic.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare new_company uuid;
begin
  insert into public.profiles(id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'display_name', ''), 120));
  insert into public.companies(name) values ('Minha empresa') returning id into new_company;
  insert into public.company_members(company_id, user_id, role) values (new_company, new.id, 'owner');
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger seed_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Backfill existing Auth accounts when adopting this migration.
insert into public.profiles(id, display_name)
select id, left(coalesce(raw_user_meta_data->>'display_name', ''), 120) from auth.users
on conflict (id) do nothing;
do $$
declare profile_record record; new_company uuid;
begin
 for profile_record in select p.id from public.profiles p where not exists (select 1 from public.company_members m where m.user_id = p.id) loop
   insert into public.companies(name) values ('Minha empresa') returning id into new_company;
   insert into public.company_members(company_id,user_id,role) values (new_company,profile_record.id,'owner');
 end loop;
end $$;

create function public.create_company(company_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); new_company uuid;
begin
  if caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if company_name is null or char_length(btrim(company_name)) not between 1 and 120 then
    raise exception 'Invalid company name' using errcode = '22023';
  end if;
  insert into public.companies(name) values (btrim(company_name)) returning id into new_company;
  insert into public.company_members(company_id,user_id,role) values (new_company,caller,'owner');
  return new_company;
end;
$$;
revoke all on function public.create_company(text) from public, anon;
grant execute on function public.create_company(text) to authenticated;
commit;
