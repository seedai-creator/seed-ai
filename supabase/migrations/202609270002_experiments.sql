begin;
create table public.experiments (
 id uuid primary key, company_id uuid not null references public.companies(id) on delete cascade,
 created_by uuid references public.profiles(id) on delete set null,
 name text not null check (char_length(btrim(name)) between 1 and 160),
 problem text not null check (char_length(btrim(problem)) between 1 and 2000),
 hypothesis text not null check (char_length(btrim(hypothesis)) between 1 and 2000),
 action text not null check (char_length(btrim(action)) between 1 and 2000),
 baseline text not null check (baseline ~ '^-?(0|[1-9][0-9]{0,8})(\.[0-9]{1,6})?$'),
 target text not null check (target ~ '^-?(0|[1-9][0-9]{0,8})(\.[0-9]{1,6})?$'),
 metric text not null check (char_length(btrim(metric)) between 1 and 300),
 start_date date not null check (start_date between date '1900-01-01' and date '9999-12-31'),
 end_date date not null check (end_date between start_date and date '9999-12-31'),
 status text not null default 'PLANNED' check (status in ('PLANNED','RUNNING','VALIDATED','INVALIDATED','INCONCLUSIVE')),
 result text check (result ~ '^-?(0|[1-9][0-9]{0,8})(\.[0-9]{1,6})?$'),
 learning text not null default '' check (char_length(learning)<=4000),
 started_at timestamptz, finished_at timestamptz, finished_by uuid references public.profiles(id) on delete set null,
 version integer not null default 1 check (version>0), request_hash text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check ((status='PLANNED' and started_at is null and finished_at is null and result is null and learning='') or
   (status='RUNNING' and started_at is not null and finished_at is null and result is null and learning='') or
   (status in ('VALIDATED','INVALIDATED','INCONCLUSIVE') and started_at is not null and finished_at is not null and char_length(btrim(learning))>0 and (result is not null or status='INCONCLUSIVE')))
);
create index experiments_company_created on public.experiments(company_id,created_at desc);
alter table public.experiments enable row level security;
revoke all on public.experiments from anon,authenticated;
grant select on public.experiments to authenticated;
create policy experiments_read on public.experiments for select to authenticated using (
 exists(select 1 from public.company_members m where m.company_id=experiments.company_id and m.user_id=(select auth.uid()))
);
create trigger experiments_updated before update on public.experiments for each row execute function public.touch_updated_at();
create function public.save_experiment(p_company_id uuid,p_id uuid,p_draft jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); existing public.experiments%rowtype; field text;
begin
 if caller is null or not exists(select 1 from public.company_members where company_id=p_company_id and user_id=caller) then raise exception 'Access denied' using errcode='42501'; end if;
 if p_draft is null or jsonb_typeof(p_draft)<>'object' or octet_length(p_draft::text)>40000 then raise exception 'Invalid draft'; end if;
 foreach field in array array['name','problem','hypothesis','action','baseline','target','metric','start_date','end_date'] loop
  if jsonb_typeof(p_draft->field) is distinct from 'string' then raise exception 'Invalid field'; end if;
 end loop;
 perform 1 from public.companies where id=p_company_id for update;
 select * into existing from public.experiments where id=p_id;
 if found then
  if existing.company_id<>p_company_id or existing.created_by is distinct from caller or existing.request_hash<>md5(p_draft::text) then raise exception 'Submission conflict' using errcode='40001'; end if;
  return existing.id;
 end if;
 insert into public.experiments(id,company_id,created_by,name,problem,hypothesis,action,baseline,target,metric,start_date,end_date,request_hash)
 values(p_id,p_company_id,caller,p_draft->>'name',p_draft->>'problem',p_draft->>'hypothesis',p_draft->>'action',p_draft->>'baseline',p_draft->>'target',p_draft->>'metric',(p_draft->>'start_date')::date,(p_draft->>'end_date')::date,md5(p_draft::text));
 return p_id;
end;
$$;
create function public.start_experiment(p_company_id uuid,p_id uuid,p_version integer) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.company_members where company_id=p_company_id and user_id=auth.uid()) then raise exception 'Access denied' using errcode='42501'; end if;
 update public.experiments set status='RUNNING',started_at=now(),version=version+1 where id=p_id and company_id=p_company_id and status='PLANNED' and version=p_version;
 if not found then raise exception 'Experiment changed' using errcode='40001'; end if;
end;
$$;
create function public.finish_experiment(p_company_id uuid,p_id uuid,p_version integer,p_status text,p_result text,p_learning text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.company_members where company_id=p_company_id and user_id=auth.uid()) then raise exception 'Access denied' using errcode='42501'; end if;
 if p_status is null or p_status not in ('VALIDATED','INVALIDATED','INCONCLUSIVE') or p_learning is null or char_length(btrim(p_learning)) not between 1 and 4000 then raise exception 'Invalid outcome'; end if;
 update public.experiments set status=p_status,result=p_result,learning=btrim(p_learning),finished_at=now(),finished_by=auth.uid(),version=version+1
  where id=p_id and company_id=p_company_id and status='RUNNING' and version=p_version;
 if not found then raise exception 'Experiment changed' using errcode='40001'; end if;
end;
$$;
revoke all on function public.save_experiment(uuid,uuid,jsonb),public.start_experiment(uuid,uuid,integer),public.finish_experiment(uuid,uuid,integer,text,text,text) from public,anon;
grant execute on function public.save_experiment(uuid,uuid,jsonb),public.start_experiment(uuid,uuid,integer),public.finish_experiment(uuid,uuid,integer,text,text,text) to authenticated;
commit;
