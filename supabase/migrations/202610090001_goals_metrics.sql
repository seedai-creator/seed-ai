-- Phase 10. Goals extend memory identities; observations remain in the existing Journal.
begin;
alter table public.business_memories add constraint memory_company_identity unique(company_id,id);
create table public.metric_definitions(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,
 code text not null check(code ~ '^[a-z][a-z0-9_]{1,79}$'),name text not null check(length(name) between 1 and 120),
 unit text not null check(length(unit) between 1 and 120),metric_type text not null check(metric_type in ('CURRENCY','COUNT','PERCENTAGE','RATIO','DURATION','DECIMAL','INTEGER','BOOLEAN','TEXTUAL_STATUS','RANGE')),
 directionality text not null default 'CONTEXT_DEPENDENT',aggregation_method text not null default 'NONE' check(aggregation_method in ('NONE','SUM','AVERAGE','LAST','RATIO')),
 formula_id text,formula_version integer,status text not null default 'ACTIVE',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(company_id,id),unique(company_id,code)
);
alter table public.business_journal_entries add column metric_definition_id uuid;
alter table public.business_journal_entries add column metric_data jsonb;
alter table public.business_journal_entries add constraint journal_metric_definition_tenant foreign key(company_id,metric_definition_id) references public.metric_definitions(company_id,id);
create index journal_metric_series on public.business_journal_entries(company_id,metric_type,period_end desc,id) where entry_type='METRIC' and status='ACTIVE';
-- Existing Journal sign constraint permitted only nonnegative values. Typed financial metrics may be negative.
do $$declare c record;begin
 for c in select conname from pg_constraint where conrelid='public.business_journal_entries'::regclass and contype='c' and pg_get_constraintdef(oid) like '%value >=%' loop
 execute format('alter table public.business_journal_entries drop constraint %I',c.conname);end loop;
end$$;
alter table public.business_journal_entries add constraint journal_numeric_bound check(value is null or entry_type='METRIC' and value between -1e15 and 1e15 and (metric_data is not null or value>=0));
create table public.goals(
 id uuid primary key,company_id uuid not null references public.companies(id) on delete cascade,created_by_user_id uuid not null references public.profiles(id),
 spec jsonb not null check(jsonb_typeof(spec)='object'),status text not null check(status in ('DRAFT','ACTIVE','PAUSED','ACHIEVED','MISSED','CANCELLED','SUPERSEDED')),
 version integer not null default 1,timezone text not null,locale text not null check(locale in ('pt-BR','pt-PT','en-US','es-ES')),
 source_message_id uuid references public.messages(id) on delete set null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(company_id,id),foreign key(company_id,id) references public.business_memories(company_id,id) on delete cascade
);
create index goal_context on public.goals(company_id,status,updated_at desc);
create unique index goal_primary on public.goals(company_id) where status='ACTIVE' and spec->>'primary'='true';
create table public.goal_events(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,goal_id uuid not null,
 kind text not null,snapshot jsonb not null,reason text not null check(length(reason) between 1 and 500),changed_by uuid references public.profiles(id),
 request_key text not null check(length(request_key) between 1 and 200),created_at timestamptz not null default now(),
 foreign key(company_id,goal_id) references public.goals(company_id,id) on delete cascade,unique(company_id,request_key)
);
create index goal_history on public.goal_events(company_id,goal_id,created_at desc);
create table public.goal_metric_links(
 company_id uuid not null,goal_id uuid not null,metric_definition_id uuid not null,role text not null check(role in ('PRIMARY','SUPPORTING','GUARDRAIL')),
 timing text not null check(timing in ('LEADING','LAGGING','CONTEXT')),min_value numeric,max_value numeric,
 primary key(company_id,goal_id,metric_definition_id,role),foreign key(company_id,goal_id) references public.goals(company_id,id) on delete cascade,
 foreign key(company_id,metric_definition_id) references public.metric_definitions(company_id,id),check(min_value is null or max_value is null or min_value<=max_value)
);
create unique index one_primary_goal_metric on public.goal_metric_links(goal_id) where role='PRIMARY';
do $$declare tab text;begin
 foreach tab in array array['goals','goal_events','goal_metric_links','metric_definitions'] loop
 execute format('alter table public.%I enable row level security',tab);
 execute format('revoke all on public.%I from public,anon,authenticated',tab);
 execute format('grant all on public.%I to service_role',tab);
 execute format('grant select on public.%I to authenticated',tab);
 execute format('create policy tenant_read on public.%I for select to authenticated using(exists(select 1 from public.company_members m where m.company_id=%I.company_id and m.user_id=auth.uid()))',tab,tab);
 end loop;end$$;
-- A read adapter, never a second metric ledger. RLS is evaluated as the caller.
create view public.metric_observations with(security_invoker=true) as
 select id,company_id,metric_definition_id,metric_type,value,unit,currency_code,period_start,period_end,confidence,source_type,source_message_id,version,created_at,updated_at,channel,product,location,metric_data,metadata
 from public.business_journal_entries where entry_type='METRIC' and status='ACTIVE';
grant select on public.metric_observations to authenticated,service_role;

create function public.save_goal(p_user uuid,p_company uuid,p_id uuid,p_version int,p_spec jsonb,p_status text,p_reason text,p_source uuid,p_key text,p_timezone text,p_locale text) returns uuid language plpgsql security definer set search_path=public as $$
declare old goals;gid uuid;mid uuid;ln jsonb;did uuid;parent uuid;depth int;oldmem business_memories;
begin
 if not exists(select 1 from company_members where company_id=p_company and user_id=p_user) then raise exception 'GOAL_ACCESS_DENIED';end if;
 perform 1 from companies where id=p_company for update;
 select goal_id into gid from goal_events where company_id=p_company and request_key=p_key;if found then return gid;end if;
 if p_id is null then select id into gid from goals where company_id=p_company and spec=p_spec and status=p_status;if found then return gid;end if;end if;
 if length(p_reason) not between 1 and 500 or p_reason is null or p_status not in ('DRAFT','ACTIVE','PAUSED','ACHIEVED','MISSED','CANCELLED','SUPERSEDED') then raise exception 'GOAL_INVALID';end if;
 if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'GOAL_TIMEZONE_REQUIRED';end if;
 if p_source is not null and not exists(select 1 from messages m join conversations c on c.id=m.conversation_id where m.id=p_source and m.role='user' and c.company_id=p_company and c.user_id=p_user) then raise exception 'GOAL_SOURCE_INVALID';end if;
 if length(p_spec->>'title') not between 1 and 120 or not p_spec ?& array['title','baseline','target','scope','primary_metric','direction','period','links','milestones'] or p_spec->>'direction' not in ('INCREASE','DECREASE','MAINTAIN','REACH','RANGE','COMPLETE') then raise exception 'GOAL_INVALID';end if;
 if p_status='ACTIVE' and (coalesce(p_spec->>'deadline',p_spec->>'review_on') is null or (p_spec->>'direction'<>'COMPLETE' and (p_spec->>'primary_metric' is null or p_spec->>'unit' is null or p_spec->>'period'='UNKNOWN' or coalesce(p_spec#>>'{target,value}',p_spec#>>'{target,min}') is null)) or (p_spec->>'direction' in ('INCREASE','DECREASE') and coalesce(p_spec#>>'{baseline,value}',p_spec#>>'{baseline,min}') is null) or (p_spec->>'direction'='COMPLETE' and (p_spec->>'success' is null or jsonb_array_length(p_spec->'milestones')=0))) then raise exception 'GOAL_INCOMPLETE';end if;
 if (p_spec->>'plan_id') is not null and not exists(select 1 from strategies where id=(p_spec->>'plan_id')::uuid and company_id=p_company) then raise exception 'GOAL_PLAN_INVALID';end if;
 if p_spec#>>'{scope,type}'<>'COMPANY' and not exists(select 1 from business_entities where company_id=p_company and id=(p_spec#>>'{scope,id}')::uuid) and not exists(select 1 from strategies where company_id=p_company and id=(p_spec#>>'{scope,id}')::uuid and p_spec#>>'{scope,type}'='PLAN') and not exists(select 1 from experiments where company_id=p_company and id=(p_spec#>>'{scope,id}')::uuid and p_spec#>>'{scope,type}'='EXPERIMENT') then raise exception 'GOAL_SCOPE_INVALID';end if;
 if p_id is not null then
 select * into old from goals where id=p_id and company_id=p_company for update;
 if old.id is not null and old.version<>p_version then raise exception 'GOAL_CHANGED';end if;
 select * into oldmem from business_memories where id=p_id and company_id=p_company and kind='GOAL' and not deleted;
 if not found then raise exception 'GOAL_ID_INVALID';end if;
 elsif p_version<>0 then raise exception 'GOAL_CHANGED';end if;
 gid:=coalesce(p_id,gen_random_uuid());parent:=nullif(p_spec->>'parent_id','')::uuid;depth:=0;
 while parent is not null loop
 if parent=gid or depth>=3 then raise exception 'GOAL_HIERARCHY_INVALID';end if;
 select nullif(spec->>'parent_id','')::uuid into mid from goals where id=parent and company_id=p_company;if not found then raise exception 'GOAL_PARENT_INVALID';end if;parent:=mid;depth:=depth+1;
 end loop;
 if old.id is not null and old.status in ('CANCELLED','SUPERSEDED') and p_status not in ('CANCELLED','SUPERSEDED') then raise exception 'GOAL_STATUS_INVALID';end if;
 if oldmem.id is null then
 insert into business_memories(id,company_id,key,kind,value,evidence,source_message_id) values(gid,p_company,'goal_'||replace(gid::text,'-',''),'GOAL',p_spec->>'title',p_reason,p_source);
 else
 insert into business_memory_history(memory_id,company_id,snapshot) values(gid,p_company,to_jsonb(oldmem));
 update business_memories set value=p_spec->>'title',version=version+1,updated_at=now() where id=gid;
 end if;
 insert into goals(id,company_id,created_by_user_id,spec,status,timezone,locale,source_message_id) values(gid,p_company,p_user,p_spec,p_status,p_timezone,p_locale,p_source)
 on conflict(id) do update set spec=excluded.spec,status=excluded.status,version=goals.version+1,updated_at=now();
 insert into goal_events(company_id,goal_id,kind,snapshot,reason,changed_by,request_key) values(p_company,gid,case when old.id is null then 'goal_created' else 'goal_updated' end,jsonb_build_object('before',to_jsonb(old),'after',p_spec,'status',p_status),p_reason,p_user,p_key);
 delete from goal_metric_links where goal_id=gid;
 for ln in select * from jsonb_array_elements(p_spec->'links') loop
 select id into did from metric_definitions where company_id=p_company and code=ln->>'metric';
 if did is null then raise exception 'GOAL_METRIC_UNKNOWN';end if;
 insert into goal_metric_links values(p_company,gid,did,ln->>'role',ln->>'timing',(ln->>'min')::numeric,(ln->>'max')::numeric);
 end loop;
 if p_spec->>'primary_metric' is not null then
 select id into did from metric_definitions where company_id=p_company and code=p_spec->>'primary_metric';if did is null then raise exception 'GOAL_METRIC_UNKNOWN';end if;
 insert into goal_metric_links values(p_company,gid,did,'PRIMARY','LAGGING',null,null) on conflict do nothing;
 end if;
 if p_spec->>'plan_id' is not null then update strategies set goal_id=gid where id=(p_spec->>'plan_id')::uuid and company_id=p_company;end if;
 return gid;
end$$;
revoke all on function public.save_goal(uuid,uuid,uuid,int,jsonb,text,text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.save_goal(uuid,uuid,uuid,int,jsonb,text,text,uuid,text,text,text) to service_role;

create function public.record_goal_metric(p_user uuid,p_company uuid,p_id uuid,p_version int,p_data jsonb,p_description text,p_evidence text,p_source uuid,p_key text) returns uuid language plpgsql security definer set search_path=public as $$
declare old business_journal_entries;eid uuid;did uuid;conv uuid;d jsonb;src text;sc text;foundunit text;
begin
 if not exists(select 1 from company_members where company_id=p_company and user_id=p_user) then raise exception 'METRIC_ACCESS_DENIED';end if;
 perform 1 from companies where id=p_company for update;
 select id into eid from business_journal_entries where company_id=p_company and identity_key=p_key;if found and p_id is null then return eid;end if;
 if p_source is not null then
 select m.content,c.id into src,conv from messages m join conversations c on c.id=m.conversation_id where m.id=p_source and m.role='user' and c.company_id=p_company and c.user_id=p_user;
 if src is null or length(p_evidence)<1 or position(p_evidence in src)=0 then raise exception 'METRIC_SOURCE_INVALID';end if;
 end if;
 select id,unit into did,foundunit from metric_definitions where company_id=p_company and code=p_data->>'metric';if did is null or foundunit<>p_data->>'unit' then raise exception 'METRIC_DEFINITION_INVALID';end if;
 if p_data->>'source'='EXTERNAL' or p_data->>'unit'='money' and p_data->>'currency' is null or p_data->>'unit'<>'money' and p_data->>'currency' is not null then raise exception 'METRIC_CURRENCY_INVALID';end if;
 if (p_data#>>'{amount,min}')::numeric>(p_data#>>'{amount,max}')::numeric or p_data#>>'{amount,value}' is not null and p_data#>>'{amount,min}' is not null then raise exception 'METRIC_RANGE_INVALID';end if;
 if p_data#>>'{scope,type}'<>'COMPANY' and not exists(select 1 from business_entities where company_id=p_company and id=(p_data#>>'{scope,id}')::uuid) and not exists(select 1 from strategies where company_id=p_company and id=(p_data#>>'{scope,id}')::uuid and p_data#>>'{scope,type}'='PLAN') and not exists(select 1 from experiments where company_id=p_company and id=(p_data#>>'{scope,id}')::uuid and p_data#>>'{scope,type}'='EXPERIMENT') then raise exception 'METRIC_SCOPE_INVALID';end if;
 d:=jsonb_set(p_data,'{amount,value}','null');
 if p_id is not null then
 select * into old from business_journal_entries where company_id=p_company and id=p_id and entry_type='METRIC' and status='ACTIVE' for update;
  if old.metadata->>'last_metric_key'=p_key then return p_id;end if;
 if not found or old.version<>p_version or old.metric_type<>p_data->>'metric' then raise exception 'METRIC_CHANGED';end if;
 if old.manual and p_source is not null then raise exception 'METRIC_MANUAL_PROTECTED';end if;
 insert into business_journal_history(entry_id,company_id,snapshot,changed_by) values(old.id,p_company,to_jsonb(old),p_user);
  update business_journal_entries set value=(p_data#>>'{amount,value}')::numeric,metric_data=d,period_start=(p_data->>'start')::date,period_end=(p_data->>'end')::date,unit=p_data->>'unit',currency_code=p_data->>'currency',description=p_description,evidence=p_evidence,metric_definition_id=did,manual=p_source is null,version=version+1,updated_at=now(),source_message_id=p_source,metadata=metadata||jsonb_build_object('last_metric_key',p_key) where id=p_id;
 update weekly_intelligence_reports set status='INVALIDATED' where company_id=p_company and p_id=any(source_ids);return p_id;
 end if;
 insert into business_journal_entries(company_id,user_id,conversation_id,source_message_id,entry_type,description,evidence,period_start,period_end,event_date,metric_type,value,unit,currency_code,confidence,source_type,identity_key,metric_definition_id,metric_data,manual)
 values(p_company,p_user,conv,p_source,'METRIC',p_description,p_evidence,(p_data->>'start')::date,(p_data->>'end')::date,(p_data->>'end')::date,p_data->>'metric',(p_data#>>'{amount,value}')::numeric,p_data->>'unit',p_data->>'currency',p_data->>'confidence',case when p_source is null then 'MANUAL' else 'CHAT' end,p_key,did,d,p_source is null) returning id into eid;
 return eid;
end$$;
revoke all on function public.record_goal_metric(uuid,uuid,uuid,int,jsonb,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.record_goal_metric(uuid,uuid,uuid,int,jsonb,text,text,uuid,text) to service_role;
alter table public.journal_jobs add column goals_payload jsonb;
alter table public.journal_jobs add column goals_applied boolean not null default false;
-- Typed records and journal completion are committed in one transaction by the existing worker.
alter function public.apply_journal_extraction(uuid,uuid) rename to apply_journal_extraction_v98;
create function public.apply_journal_extraction(p_job uuid,p_lease uuid) returns void language plpgsql security definer set search_path=public as $$
declare j journal_jobs;item jsonb;def jsonb;begin
 select * into j from journal_jobs where id=p_job for update;
 perform apply_journal_extraction_v98(p_job,p_lease);
 if j.goals_applied or j.goals_payload is null then return;end if;
 for def in select * from jsonb_array_elements(j.goals_payload->'definitions') loop
 insert into metric_definitions(company_id,code,name,unit,metric_type) values(j.company_id,def->>'code',def->>'name',def->>'unit',def->>'type') on conflict(company_id,code) do nothing;end loop;
 for item in select * from jsonb_array_elements(j.goals_payload->'goals') loop
 perform save_goal(j.user_id,j.company_id,(item->>'id')::uuid,(item->>'version')::int,item->'spec',item->>'status',item->>'evidence',j.source_message_id,item->>'key',j.context->>'timezone',coalesce(j.context->>'locale','en-US'));
 end loop;
 for item in select * from jsonb_array_elements(j.goals_payload->'observations') loop
 perform record_goal_metric(j.user_id,j.company_id,(item->>'id')::uuid,(item->>'version')::int,item->'data',item->>'evidence',item->>'evidence',j.source_message_id,item->>'key');end loop;
 update journal_jobs set goals_applied=true where id=p_job;
end$$;
revoke all on function public.apply_journal_extraction(uuid,uuid) from public,anon,authenticated;
grant execute on function public.apply_journal_extraction(uuid,uuid) to service_role;
commit;
