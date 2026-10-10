begin;

-- Additive rollout: validate in a separate staging project before enabling beta.
create table public.operations_controls (
 id boolean primary key default true check(id), closed_beta boolean not null default false,
 disable_ai boolean not null default false, disable_uploads boolean not null default false,
 paused_features text[] not null default '{}', blocked_models text[] not null default '{}',
 version integer not null default 1, updated_at timestamptz not null default now()
);
insert into public.operations_controls(id) values(true);
create table public.beta_access (
 user_id uuid primary key references public.profiles on delete cascade,
 cohort text not null check(length(cohort) between 1 and 80), expires_at timestamptz not null,
 disabled boolean not null default false, granted_by uuid references public.profiles,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.beta_invitations (
 email text primary key check(email=lower(btrim(email)) and length(email) between 3 and 254),
 cohort text not null check(length(cohort) between 1 and 80), expires_at timestamptz not null,
 revoked boolean not null default false, granted_by uuid references public.profiles,
 created_at timestamptz not null default now()
);
create table public.legal_documents (
 id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('TERMS','PRIVACY')),
 version text not null check(length(version) between 1 and 60), locale text not null check(locale in ('pt-BR','pt-PT','en-US','es-ES')),
 content text not null check(length(content) between 100 and 60000), approved boolean not null default false,
 approved_by uuid references public.profiles, published_at timestamptz not null default now(),
 unique(kind,version,locale),check(not approved or approved_by is not null)
);
create table public.legal_acceptances (
 user_id uuid not null references public.profiles on delete cascade,
 terms_id uuid not null references public.legal_documents, privacy_id uuid not null references public.legal_documents,
 locale text not null, market text not null, source text not null default 'APP' check(source='APP'),
 accepted_at timestamptz not null default now(),primary key(user_id,terms_id,privacy_id)
);
create table public.support_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles on delete cascade,
 company_id uuid references public.companies on delete set null,
 category text not null check(category in ('BUG','AI_QUALITY','DATA_ERROR','BILLING','ACCESS','PRIVACY','FEATURE_REQUEST','OTHER','EXPORT_DATA','DELETE_ACCOUNT')),
 severity text not null default 'P2' check(severity in ('P0','P1','P2','P3')),
 description text not null check(length(btrim(description)) between 10 and 2000),
 status text not null default 'OPEN' check(status in ('OPEN','IN_REVIEW','AWAITING_USER','RESOLVED','CANCELLED')),
 created_at timestamptz not null default now(),resolved_at timestamptz,version integer not null default 1
);
create index support_requests_user_time on public.support_requests(user_id,created_at desc);
create index support_requests_open on public.support_requests(created_at) where status in ('OPEN','IN_REVIEW');
create table public.operational_events (
 id uuid primary key default gen_random_uuid(), request_id uuid, user_id uuid references public.profiles on delete set null,
 company_id uuid references public.companies on delete set null,
 feature text not null check(feature ~ '^[A-Za-z0-9_.:-]{1,80}$'),
 code text not null check(code ~ '^[A-Z0-9_]{1,80}$'),
 level text not null check(level in ('INFO','WARN','ERROR')),duration_ms integer check(duration_ms>=0),
 created_at timestamptz not null default now(),unique(request_id,feature,code)
);
create index operational_events_time on public.operational_events(created_at desc);
create index operational_events_error on public.operational_events(feature,created_at desc) where level='ERROR';

do $$ declare t text; begin
 foreach t in array array['operations_controls','beta_access','beta_invitations','legal_documents','legal_acceptances','support_requests','operational_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to service_role',t);
 end loop;
end $$;
grant select on public.legal_documents to anon,authenticated;
create policy approved_legal on public.legal_documents for select to anon,authenticated using(approved);
grant select on public.support_requests,public.legal_acceptances to authenticated;
create policy own_support on public.support_requests for select to authenticated using(user_id=auth.uid());
create policy own_acceptance on public.legal_acceptances for select to authenticated using(user_id=auth.uid());
grant insert on public.operational_events to service_role;

create function public.operations_user_allowed() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null
 and not exists(select 1 from public.beta_access where user_id=auth.uid() and disabled)
 and (not (select closed_beta from public.operations_controls where id)
  or exists(select 1 from public.admin_roles where user_id=auth.uid())
  or exists(select 1 from public.beta_access where user_id=auth.uid() and not disabled and expires_at>now()))
$$;
revoke all on function public.operations_user_allowed() from public,anon;
grant execute on function public.operations_user_allowed() to authenticated;

-- Restrictive policy is ANDed with existing tenant/ownership policies; it never
-- grants visibility. Auth revocation also applies to direct PostgREST requests.
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='public' and tablename not in
 ('operations_controls','beta_access','beta_invitations','legal_documents','legal_acceptances','support_requests','operational_events') loop
  execute format('create policy operations_access on public.%I as restrictive for all to authenticated using(public.operations_user_allowed()) with check(public.operations_user_allowed())',t.tablename);
 end loop;
end $$;

create function public.operations_signup_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (select closed_beta from public.operations_controls where id) and not exists(
  select 1 from public.beta_invitations where email=lower(btrim(to_jsonb(new)->>'email')) and not revoked and expires_at>now()
 ) then raise exception 'Registration unavailable' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function public.operations_signup_guard() from public,anon,authenticated;
create trigger seed_operations_signup before insert on auth.users for each row execute function public.operations_signup_guard();

create function public.operations_assign_beta() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.beta_access(user_id,cohort,expires_at,granted_by)
 select new.id,cohort,expires_at,granted_by from public.beta_invitations
 where email=lower(btrim((select to_jsonb(u)->>'email' from auth.users u where u.id=new.id))) and not revoked and expires_at>now();
 return new;
end $$;
revoke all on function public.operations_assign_beta() from public,anon,authenticated;
create trigger seed_operations_profile after insert on public.profiles for each row execute function public.operations_assign_beta();

create function public.operations_change(p_actor uuid,p_kind text,p_key text,p_value jsonb,p_version integer,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare prior jsonb; subsequent jsonb;
begin
 if not exists(select 1 from public.admin_roles where user_id=p_actor and role='SUPER_ADMIN') then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_value is null or p_value='null'::jsonb or p_key is null or p_kind is null or length(btrim(coalesce(p_reason,''))) not between 5 and 1000 or octet_length(p_value::text)>12000 then raise exception 'Invalid input'; end if;
 if p_kind='controls' then
  select to_jsonb(c) into prior from public.operations_controls c where id and version=p_version for update;
  if prior is null then raise exception 'Version conflict' using errcode='40001'; end if;
  if p_key not in ('closed_beta','disable_ai','disable_uploads','paused_features','blocked_models') then raise exception 'Invalid control'; end if;
  if p_key in ('closed_beta','disable_ai','disable_uploads') then
   if jsonb_typeof(p_value)<>'boolean' then raise exception 'Boolean required'; end if;
   execute format('update public.operations_controls set %I=$1,version=version+1,updated_at=now() where id',p_key) using (p_value::text)::boolean;
  else
   if jsonb_typeof(p_value)<>'array' or jsonb_array_length(p_value)>30 then raise exception 'Invalid list'; end if;
   if exists(select 1 from jsonb_array_elements_text(p_value) v where v!~'^[A-Za-z0-9_.:-]{1,100}$') then raise exception 'Invalid list entry'; end if;
   execute format('update public.operations_controls set %I=array(select jsonb_array_elements_text($1)),version=version+1,updated_at=now() where id',p_key) using p_value;
  end if;
  select to_jsonb(c) into subsequent from public.operations_controls c where id;
 elsif p_kind='invitation' then
  if p_key<>lower(btrim(p_key)) or p_key!~'^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(p_key)>254
   or length(p_value->>'cohort') not between 1 and 80 or (p_value->>'expires_at')::timestamptz<=now() then raise exception 'Invalid invitation'; end if;
  select to_jsonb(b)-'email' into prior from public.beta_invitations b where email=p_key;
  insert into public.beta_invitations(email,cohort,expires_at,revoked,granted_by) values(p_key,p_value->>'cohort',(p_value->>'expires_at')::timestamptz,coalesce((p_value->>'revoked')::boolean,false),p_actor)
  on conflict(email) do update set cohort=excluded.cohort,expires_at=excluded.expires_at,revoked=excluded.revoked,granted_by=p_actor;
  select to_jsonb(b)-'email' into subsequent from public.beta_invitations b where email=p_key;
 elsif p_kind='access' then
  if length(p_value->>'cohort') not between 1 and 80 or (p_value->>'expires_at')::timestamptz<=now() then raise exception 'Invalid access'; end if;
  select to_jsonb(b) into prior from public.beta_access b where user_id=p_key::uuid;
  insert into public.beta_access(user_id,cohort,expires_at,disabled,granted_by) values(p_key::uuid,p_value->>'cohort',(p_value->>'expires_at')::timestamptz,coalesce((p_value->>'disabled')::boolean,false),p_actor)
  on conflict(user_id) do update set cohort=excluded.cohort,expires_at=excluded.expires_at,disabled=excluded.disabled,granted_by=p_actor,updated_at=now();
  select to_jsonb(b) into subsequent from public.beta_access b where user_id=p_key::uuid;
 else raise exception 'Unsupported operation'; end if;
 insert into public.admin_audit_log(actor,action,entity,old_state,new_state,reason) values(p_actor,'OPERATIONS_CHANGED',p_kind||':'||case when p_kind='invitation' then md5(p_key) else p_key end,prior,subsequent,p_reason);
end $$;
revoke all on function public.operations_change(uuid,text,text,jsonb,integer,text) from public,anon,authenticated;
grant execute on function public.operations_change(uuid,text,text,jsonb,integer,text) to service_role;

create function public.submit_support_request(p_company uuid,p_category text,p_description text) returns uuid
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); result uuid;
begin
 if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_company is not null and not exists(select 1 from public.company_members where company_id=p_company and user_id=u) then raise exception 'Forbidden' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('support:'||u::text,0));
 if (select count(*) from public.support_requests where user_id=u and created_at>now()-interval '1 hour')>=5 then raise exception 'Request limit' using errcode='54000'; end if;
 insert into public.support_requests(user_id,company_id,category,description) values(u,p_company,p_category,p_description) returning id into result;
 insert into public.admin_audit_log(actor,action,entity,reason) values(u,case when p_category in ('EXPORT_DATA','DELETE_ACCOUNT','PRIVACY') then 'PRIVACY_REQUESTED' else 'SUPPORT_REQUESTED' end,'support:'||result::text,'User initiated request');
 return result;
end $$;
revoke all on function public.submit_support_request(uuid,text,text) from public,anon;
grant execute on function public.submit_support_request(uuid,text,text) to authenticated;

create function public.accept_legal_documents(p_terms uuid,p_privacy uuid,p_locale text) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); market text;
begin
 if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_terms is distinct from (select id from public.legal_documents where kind='TERMS' and locale=p_locale and approved order by published_at desc,id limit 1)
 or p_privacy is distinct from (select id from public.legal_documents where kind='PRIVACY' and locale=p_locale and approved order by published_at desc,id limit 1)
 or p_terms is null or p_privacy is null then raise exception 'Document changed'; end if;
 select market_code into market from public.commercial_accounts where user_id=u;
 insert into public.legal_acceptances(user_id,terms_id,privacy_id,locale,market) values(u,p_terms,p_privacy,p_locale,coalesce(market,'UNKNOWN')) on conflict do nothing;
end $$;
revoke all on function public.accept_legal_documents(uuid,uuid,text) from public,anon;
grant execute on function public.accept_legal_documents(uuid,uuid,text) to authenticated;

create function public.operations_terms_current() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.admin_roles where user_id=auth.uid()) or exists(
  select 1 from public.legal_acceptances a where a.user_id=auth.uid()
  and a.terms_id=(select id from public.legal_documents where kind='TERMS' and approved and locale=a.locale order by published_at desc,id limit 1)
  and a.privacy_id=(select id from public.legal_documents where kind='PRIVACY' and approved and locale=a.locale order by published_at desc,id limit 1)
 )
$$;
revoke all on function public.operations_terms_current() from public,anon;
grant execute on function public.operations_terms_current() to authenticated;

create function public.resolve_support_request(p_actor uuid,p_id uuid,p_version integer,p_status text,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare old_row jsonb;
begin
 if not exists(select 1 from public.admin_roles where user_id=p_actor and role in ('ADMIN_OPERATOR','SUPER_ADMIN')) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_status not in ('IN_REVIEW','AWAITING_USER','RESOLVED','CANCELLED') or length(btrim(coalesce(p_reason,''))) not between 5 and 1000 then raise exception 'Invalid resolution'; end if;
 select to_jsonb(s)-'description' into old_row from public.support_requests s where id=p_id and version=p_version for update;
 if old_row is null then raise exception 'Version conflict' using errcode='40001'; end if;
 update public.support_requests set status=p_status,resolved_at=case when p_status in ('RESOLVED','CANCELLED') then now() else null end,version=version+1 where id=p_id;
 insert into public.admin_audit_log(actor,action,entity,old_state,new_state,reason) values(p_actor,'SUPPORT_UPDATED','support:'||p_id::text,old_row,jsonb_build_object('status',p_status),p_reason);
end $$;
revoke all on function public.resolve_support_request(uuid,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.resolve_support_request(uuid,uuid,integer,text,text) to service_role;

create function public.operations_can_call_ai(p_feature text,p_model text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select not disable_ai and not (p_feature=any(paused_features)) and not (p_model=any(blocked_models)) from public.operations_controls where id),false)
 and (select count(*) from (select code from public.operational_events where created_at>now()-interval '2 minutes' and code in ('AI_FAILED','AI_COMPLETED') order by created_at desc,id desc limit 5) recent where code='AI_FAILED')<5
$$;
revoke all on function public.operations_can_call_ai(text,text) from public,anon,authenticated;
grant execute on function public.operations_can_call_ai(text,text) to service_role;
-- Authenticated RPC revocation: SECURITY DEFINER functions bypass table RLS.
-- Preserve their existing tenant checks, validation and version contracts.
create or replace function public.create_company(company_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); new_company uuid;
begin
  if not public.operations_user_allowed() then raise exception 'Beta access required' using errcode='42501'; end if;
  if caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if company_name is null or char_length(btrim(company_name)) not between 1 and 120 then
    raise exception 'Invalid company name' using errcode = '22023';
  end if;
  insert into public.companies(name) values (btrim(company_name)) returning id into new_company;
  insert into public.company_members(company_id,user_id,role) values (new_company,caller,'owner');
  return new_company;
end;
$$;

create or replace function public.save_company_fact(p_company_id uuid, p_key text, p_value text, p_expected_version integer)
returns setof public.company_facts
language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); existing public.company_facts%rowtype;
begin
  if not public.operations_user_allowed() then raise exception 'Beta access required' using errcode='42501'; end if;
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

create or replace function public.save_company_market(
  p_company_id uuid, p_country text, p_currency text,
  p_preferred_language text, p_locale text, p_timezone text,
  p_expected_updated_at timestamptz, p_country_version integer, p_currency_version integer
) returns void language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); current_updated timestamptz;
begin
  if not public.operations_user_allowed() then raise exception 'Beta access required' using errcode='42501'; end if;
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

create or replace function public.save_strategy(p_company_id uuid,p_id uuid,p_draft jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); existing public.strategies%rowtype; item jsonb; idx integer:=0; field text;
begin
  if not public.operations_user_allowed() then raise exception 'Beta access required' using errcode='42501'; end if;
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

create or replace function public.set_strategy_status(p_company_id uuid,p_id uuid,p_status text,p_version integer) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.operations_user_allowed() then raise exception 'Beta access required' using errcode='42501'; end if;
  if auth.uid() is null or not exists(select 1 from public.company_members where company_id=p_company_id and user_id=auth.uid()) then
    raise exception 'Access denied' using errcode='42501'; end if;
  update public.strategies set status=p_status,version=version+1 where id=p_id and company_id=p_company_id and version=p_version;
  if not found then raise exception 'Strategy changed' using errcode='40001'; end if;
end;
$$;

create or replace function public.set_action_status(p_company_id uuid,p_id uuid,p_status text,p_version integer) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.operations_user_allowed() then raise exception 'Beta access required' using errcode='42501'; end if;
  if auth.uid() is null or not exists(select 1 from public.company_members where company_id=p_company_id and user_id=auth.uid()) then
    raise exception 'Access denied' using errcode='42501'; end if;
  update public.actions set status=p_status,version=version+1 where id=p_id and company_id=p_company_id and version=p_version;
  if not found then raise exception 'Action changed' using errcode='40001'; end if;
end;
$$;

create or replace function public.save_decision(p_company_id uuid,p_id uuid,p_draft jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); existing public.decisions%rowtype; field text;
begin
  if not public.operations_user_allowed() then raise exception 'Beta access required' using errcode='42501'; end if;
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

create or replace function public.review_decision(p_company_id uuid,p_id uuid,p_version integer,p_result text,p_learning text) returns void
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid();
begin
  if not public.operations_user_allowed() then raise exception 'Beta access required' using errcode='42501'; end if;
  if caller is null or not exists(select 1 from public.company_members where company_id=p_company_id and user_id=caller) then
    raise exception 'Access denied' using errcode='42501'; end if;
  if p_result is null or p_learning is null or char_length(btrim(p_result)) not between 1 and 4000 or char_length(btrim(p_learning)) not between 1 and 4000 then
    raise exception 'Invalid review'; end if;
  update public.decisions set result=btrim(p_result),learning=btrim(p_learning),reviewed_at=now(),reviewed_by=caller,version=version+1
    where id=p_id and company_id=p_company_id and version=p_version;
  if not found then raise exception 'Decision changed' using errcode='40001'; end if;
end;
$$;

create or replace function public.save_experiment(p_company_id uuid,p_id uuid,p_draft jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); existing public.experiments%rowtype; field text;
begin
  if not public.operations_user_allowed() then raise exception 'Beta access required' using errcode='42501'; end if;
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

create or replace function public.start_experiment(p_company_id uuid,p_id uuid,p_version integer) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.operations_user_allowed() then raise exception 'Beta access required' using errcode='42501'; end if;
 if auth.uid() is null or not exists(select 1 from public.company_members where company_id=p_company_id and user_id=auth.uid()) then raise exception 'Access denied' using errcode='42501'; end if;
 update public.experiments set status='RUNNING',started_at=now(),version=version+1 where id=p_id and company_id=p_company_id and status='PLANNED' and version=p_version;
 if not found then raise exception 'Experiment changed' using errcode='40001'; end if;
end;
$$;

create or replace function public.finish_experiment(p_company_id uuid,p_id uuid,p_version integer,p_status text,p_result text,p_learning text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.operations_user_allowed() then raise exception 'Beta access required' using errcode='42501'; end if;
 if auth.uid() is null or not exists(select 1 from public.company_members where company_id=p_company_id and user_id=auth.uid()) then raise exception 'Access denied' using errcode='42501'; end if;
 if p_status is null or p_status not in ('VALIDATED','INVALIDATED','INCONCLUSIVE') or p_learning is null or char_length(btrim(p_learning)) not between 1 and 4000 then raise exception 'Invalid outcome'; end if;
 update public.experiments set status=p_status,result=p_result,learning=btrim(p_learning),finished_at=now(),finished_by=auth.uid(),version=version+1
  where id=p_id and company_id=p_company_id and status='RUNNING' and version=p_version;
 if not found then raise exception 'Experiment changed' using errcode='40001'; end if;
end;
$$;

create or replace function public.edit_business_memory(p_company uuid,p_id uuid,p_version integer,p_value text,p_delete boolean) returns void language plpgsql security definer set search_path='' as $$
declare old public.business_memories%rowtype;
begin
  if not public.operations_user_allowed() then raise exception 'Beta access required' using errcode='42501'; end if;
 if auth.uid() is null or not exists(select 1 from public.company_members where company_id=p_company and user_id=auth.uid()) then raise exception 'Access denied'; end if;
 select * into old from public.business_memories where id=p_id and company_id=p_company for update;
 if not found or old.version<>p_version then raise exception 'Memory changed'; end if;
 if not p_delete and (p_value is null or length(btrim(p_value)) not between 1 and 500) then raise exception 'Invalid value'; end if;
 insert into public.business_memory_history(memory_id,company_id,snapshot) values(old.id,p_company,to_jsonb(old));
 update public.business_memories set value=case when p_delete then value else btrim(p_value) end,deleted=p_delete,manual=true,version=version+1,observed_at=now(),updated_at=now() where id=old.id;
 -- Legacy facts are no longer authoritative in the new chat, but do not retain a deleted copy.
 if p_delete then delete from public.company_facts where company_id=p_company and key=old.key; end if;
end $$;

create or replace function public.edit_journal_entry(p_company uuid,p_id uuid,p_version int,p_description text,p_value numeric,p_delete boolean) returns void language plpgsql security definer set search_path='' as $$
declare old public.business_journal_entries%rowtype;
begin
  if not public.operations_user_allowed() then raise exception 'Beta access required' using errcode='42501'; end if;
 if auth.uid() is null or not exists(select 1 from public.company_members where company_id=p_company and user_id=auth.uid()) then raise exception 'Access denied'; end if;
 perform 1 from public.companies where id=p_company for update;
 select * into old from public.business_journal_entries where id=p_id and company_id=p_company for update;
 if not found or old.version<>p_version or old.status<>'ACTIVE' then raise exception 'Entry changed'; end if;
 if not p_delete and (length(btrim(p_description)) not between 1 and 600 or (old.entry_type='METRIC' and (p_value is null or p_value<0 or p_value>1e15 or (old.unit='count' and p_value<>trunc(p_value))))) then raise exception 'Invalid correction'; end if;
 insert into public.business_journal_history(entry_id,company_id,snapshot,changed_by) values(old.id,p_company,to_jsonb(old),auth.uid());
 update public.business_journal_entries set description=case when p_delete then '' else p_description end,evidence='',
 value=case when p_delete then null when old.entry_type='METRIC' then p_value else null end,
 metadata=case when p_delete then '{}'::jsonb else metadata end,channel=case when p_delete then null else channel end,product=case when p_delete then null else product end,location=case when p_delete then null else location end,
 status=case when p_delete then 'DELETED' else 'ACTIVE' end,manual=true,version=version+1,updated_at=now() where id=p_id;
 update public.weekly_intelligence_reports set status='INVALIDATED',summary='',next_priority=null,primary_indicator=null,structured_report='{}' where company_id=p_company and p_id=any(source_ids);
 if p_delete then
  update public.business_journal_history set snapshot=jsonb_build_object('deleted',true,'version',snapshot->'version') where entry_id=p_id;
 end if;
end $$;
commit;
