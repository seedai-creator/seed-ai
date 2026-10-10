-- Phase 11: derived snapshots only; metrics remain in the Phase 10 source ledger.
begin;
create table public.growth_map_requests(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,
 context_key text not null,requested_by uuid not null references public.profiles(id),goal_id uuid,scope_type text not null default 'COMPANY',scope_id uuid,
 generation bigint not null default 1,processed_generation bigint not null default 0,status text not null default 'QUEUED' check(status in ('QUEUED','RUNNING','COMPLETED','FAILED')),
 lease_token uuid,lease_until timestamptz,attempts int not null default 0,next_at timestamptz not null default now(),last_manual_at timestamptz,last_error text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(company_id,context_key),unique(company_id,id),
 foreign key(company_id,goal_id) references public.goals(company_id,id) on delete cascade,
 check((scope_type='COMPANY' and scope_id is null) or (scope_type in ('LOCATION','PRODUCT','SERVICE','CHANNEL','CUSTOMER_SEGMENT','TEAM','SALES_PROCESS','OPERATION','BUSINESS_UNIT','PLAN','EXPERIMENT') and scope_id is not null))
);
create table public.growth_map_snapshots(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,request_id uuid not null,
 goal_id uuid,scope_type text not null,scope_id uuid,period_start date,period_end date,status text not null check(status in ('READY','LIMITED','SUPERSEDED')),
 schema_version int not null,rule_set_version text not null,input_fingerprint text not null check(input_fingerprint ~ '^[a-f0-9]{64}$'),payload jsonb not null,
 source_refs jsonb not null check(jsonb_typeof(source_refs)='array'),created_at timestamptz not null default now(),
 foreign key(company_id,request_id) references public.growth_map_requests(company_id,id) on delete cascade,
 foreign key(company_id,goal_id) references public.goals(company_id,id) on delete cascade,
 unique(request_id,input_fingerprint,rule_set_version),check(jsonb_typeof(payload)='object')
);
create index growth_history on public.growth_map_snapshots(company_id,goal_id,scope_type,scope_id,created_at desc,id);
create index growth_sources on public.growth_map_snapshots using gin(source_refs jsonb_path_ops);
create index growth_pending on public.growth_map_requests(next_at,updated_at) where status in ('QUEUED','RUNNING');
create table public.growth_map_events(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,
 kind text not null check(kind in ('COMPLETED','REUSED','FAILED','INVALIDATED')),details jsonb not null default '{}',created_at timestamptz not null default now()
);
create index growth_events_time on public.growth_map_events(company_id,created_at desc);
do $$declare tab text;begin
 foreach tab in array array['growth_map_requests','growth_map_snapshots','growth_map_events'] loop
 execute format('alter table public.%I enable row level security',tab);
 execute format('revoke all on public.%I from public,anon,authenticated',tab);
 execute format('grant all on public.%I to service_role',tab);
 execute format('grant select on public.%I to authenticated',tab);
 execute format('create policy tenant_read on public.%I for select to authenticated using(exists(select 1 from public.company_members m where m.company_id=%I.company_id and m.user_id=auth.uid()))',tab,tab);
 end loop;end$$;
create view public.growth_dimension_assessments with(security_invoker=true) as
 select s.id as snapshot_id,s.company_id,s.created_at,d.value as assessment from public.growth_map_snapshots s cross join lateral jsonb_array_elements(s.payload->'dimensions') d;
grant select on public.growth_dimension_assessments to authenticated,service_role;

create function public.request_growth_map(p_company uuid,p_user uuid,p_goal uuid,p_scope text,p_scope_id uuid,p_manual boolean) returns uuid language plpgsql security definer set search_path=public as $$
declare k text;rid uuid;previous timestamptz;begin
 if not exists(select 1 from company_members where company_id=p_company and user_id=p_user) then raise exception 'GROWTH_ACCESS_DENIED';end if;
 if p_goal is not null and not exists(select 1 from goals where company_id=p_company and id=p_goal and spec->'scope'->>'type'=p_scope and (spec->'scope'->>'id')::uuid is not distinct from p_scope_id) then raise exception 'GROWTH_GOAL_INVALID';end if;
 if p_scope='COMPANY' then if p_scope_id is not null then raise exception 'GROWTH_SCOPE_INVALID';end if;
 elsif p_scope='PLAN' then if not exists(select 1 from strategies where company_id=p_company and id=p_scope_id) then raise exception 'GROWTH_SCOPE_INVALID';end if;
 elsif p_scope='EXPERIMENT' then if not exists(select 1 from experiments where company_id=p_company and id=p_scope_id) then raise exception 'GROWTH_SCOPE_INVALID';end if;
 elsif not exists(select 1 from business_entities where company_id=p_company and id=p_scope_id and status='ACTIVE' and (type=p_scope or type='PRODUCT_SERVICE' and p_scope in ('PRODUCT','SERVICE') or type='OPERATION' and p_scope='BUSINESS_UNIT')) then raise exception 'GROWTH_SCOPE_INVALID';end if;
 perform 1 from companies where id=p_company for update;
 -- Rate limit is per company, not per arbitrary scope or user.
 select max(last_manual_at) into previous from growth_map_requests where company_id=p_company;
 if p_manual and previous>now()-interval '60 seconds' then raise exception 'GROWTH_REFRESH_COOLDOWN';end if;
 k=coalesce(p_goal::text,'auto')||':'||p_scope||':'||coalesce(p_scope_id::text,'company');
 insert into growth_map_requests(company_id,context_key,requested_by,goal_id,scope_type,scope_id,last_manual_at)
 values(p_company,k,p_user,p_goal,p_scope,p_scope_id,case when p_manual then now() end)
 on conflict(company_id,context_key) do update set requested_by=excluded.requested_by,
 generation=growth_map_requests.generation+1,attempts=0,status=case when growth_map_requests.status='RUNNING' and growth_map_requests.lease_until>now() then 'RUNNING' else 'QUEUED' end,
 next_at=now(),updated_at=now(),last_manual_at=coalesce(excluded.last_manual_at,growth_map_requests.last_manual_at) returning id into rid;
 return rid;
end$$;
create function public.claim_growth_map(p_company uuid default null) returns setof public.growth_map_requests language plpgsql security definer set search_path=public as $$
declare rid uuid;begin
 select id into rid from growth_map_requests where (p_company is null or company_id=p_company) and next_at<=now() and attempts<4
 and (status='QUEUED' or status='RUNNING' and lease_until<now()) order by next_at,updated_at for update skip locked limit 1;
 if rid is null then return;end if;
 return query update growth_map_requests set status='RUNNING',lease_token=gen_random_uuid(),lease_until=now()+interval '90 seconds',attempts=attempts+1,updated_at=now() where id=rid returning *;
end$$;
create function public.finish_growth_map(p_request uuid,p_lease uuid,p_generation bigint,p_hash text,p_payload jsonb,p_latency int) returns uuid language plpgsql security definer set search_path=public as $$
declare r growth_map_requests;s uuid;reused boolean;begin
 select * into r from growth_map_requests where id=p_request for update;
 if not found or r.status<>'RUNNING' or r.lease_token is distinct from p_lease or r.lease_until<now() then raise exception 'GROWTH_LEASE_CHANGED';end if;
 if not exists(select 1 from company_members where company_id=r.company_id and user_id=r.requested_by) then raise exception 'GROWTH_ACCESS_DENIED';end if;
 if r.generation<>p_generation then
 update growth_map_requests set status='QUEUED',lease_token=null,lease_until=null,attempts=0,next_at=now() where id=r.id;return null;end if;
 if p_payload->>'company'<>r.company_id::text or p_payload->'scope'->>'type'<>r.scope_type or (p_payload->'scope'->>'id')::uuid is distinct from r.scope_id or jsonb_array_length(p_payload->'dimensions')<>6
 or (p_payload->>'goalId') is not null and not exists(select 1 from goals where company_id=r.company_id and id=(p_payload->>'goalId')::uuid) then raise exception 'GROWTH_PAYLOAD_INVALID';end if;
 select id into s from growth_map_snapshots where request_id=r.id and input_fingerprint=p_hash and rule_set_version=p_payload->>'ruleSetVersion';reused=found;
 update growth_map_snapshots set status='SUPERSEDED' where request_id=r.id and status<>'SUPERSEDED';
 if reused then update growth_map_snapshots set status=p_payload->>'status' where id=s;
 else insert into growth_map_snapshots(company_id,request_id,goal_id,scope_type,scope_id,period_start,period_end,status,schema_version,rule_set_version,input_fingerprint,payload,source_refs)
 values(r.company_id,r.id,(p_payload->>'goalId')::uuid,r.scope_type,r.scope_id,(p_payload->>'periodStart')::date,(p_payload->>'periodEnd')::date,p_payload->>'status',(p_payload->>'schemaVersion')::int,p_payload->>'ruleSetVersion',p_hash,p_payload,p_payload->'sources') returning id into s;end if;
 update growth_map_requests set processed_generation=p_generation,status='COMPLETED',lease_token=null,lease_until=null,attempts=0,last_error=null,updated_at=now(),next_at=now()+interval '24 hours' where id=r.id;
 insert into growth_map_events(company_id,kind,details) values(r.company_id,case when reused then 'REUSED' else 'COMPLETED' end,jsonb_build_object('latency_ms',p_latency,'ai_calls',0,'rules',p_payload->>'ruleSetVersion','dimensions',6));return s;
end$$;
create function public.growth_source_changed() returns trigger language plpgsql security definer set search_path=public as $$
declare rowdata jsonb;beforedata jsonb;cid uuid;sid text;purge boolean;begin
 rowdata=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;beforedata=case when tg_op='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
 if tg_op='UPDATE' and rowdata-'updated_at' is not distinct from beforedata-'updated_at' then return new;end if;
 cid=(case when tg_table_name='companies' then rowdata->>'id' else rowdata->>'company_id' end)::uuid;
 if cid is null then return coalesce(new,old);end if;
 sid=rowdata->>'id';purge=tg_op='DELETE' or rowdata->>'deleted'='true' or rowdata->>'status' in ('DELETED','ARCHIVED') or rowdata->>'state'='DELETED';
 if purge then delete from growth_map_snapshots where company_id=cid and (source_refs @> jsonb_build_array(jsonb_build_object('table',tg_table_name,'id',sid)) or scope_id::text=sid);
 end if;
 update growth_map_snapshots set status='SUPERSEDED' where company_id=cid and status<>'SUPERSEDED';
 update growth_map_requests set generation=generation+1,status=case when status='RUNNING' and lease_until>now() then 'RUNNING' else 'QUEUED' end,attempts=0,next_at=now(),updated_at=now() where company_id=cid;
 return coalesce(new,old);
end$$;
do $$declare tab text;begin
 foreach tab in array array['goals','business_journal_entries','business_memories','business_entities','business_observations','business_relationships','strategies','actions','execution_results','experiments','decisions'] loop
 execute format('create trigger growth_dirty after insert or update or delete on public.%I for each row execute function public.growth_source_changed()',tab);
 end loop;end$$;
create trigger growth_company_changed after update of timezone,locale,preferred_language on public.companies for each row execute function public.growth_source_changed();
-- No trigger on snapshots or Radar outputs: prevents derived-view feedback loops.
revoke all on function public.request_growth_map(uuid,uuid,uuid,text,uuid,boolean),public.claim_growth_map(uuid),public.finish_growth_map(uuid,uuid,bigint,text,jsonb,int),public.growth_source_changed() from public,anon,authenticated;
grant execute on function public.request_growth_map(uuid,uuid,uuid,text,uuid,boolean),public.claim_growth_map(uuid),public.finish_growth_map(uuid,uuid,bigint,text,jsonb,int) to service_role;
-- Unlock only this delivered feature; do not change budgets, subscriptions or other flags.
update public.commercial_plans set flags=jsonb_set(flags,'{growth_map}',to_jsonb(code<>'FREE')),updated_at=now() where code in ('FREE','PRO','BUSINESS','PARTNER','ADVISORY','ENTERPRISE');
commit;
