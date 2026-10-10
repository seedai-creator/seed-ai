-- Additive 9.5. No existing business records are rewritten or copied.
begin;
create table public.business_entities (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 type text not null check(type in ('COMPANY','PRODUCT_SERVICE','OFFER','CUSTOMER_SEGMENT','CHANNEL','SALES_PROCESS','SALES_STAGE','TEAM','TEAM_ROLE','OPERATION','CAPACITY','COST_STRUCTURE','REVENUE_STREAM','LOCATION','SUPPLIER','GOAL','CONSTRAINT','METRIC','MARKET','CUSTOMER_JOURNEY')),
 name text not null check(length(name) between 1 and 120), canonical_name text not null check(length(canonical_name) between 1 and 160),
 reference_table text check(reference_table in ('companies','business_memories','business_journal_entries')),reference_id uuid,
 status text not null default 'ACTIVE' check(status in ('ACTIVE','INACTIVE','DISCONTINUED','PLANNED','MERGED')),
 merged_into uuid, version integer not null default 1, schema_version text not null default '9.5.1',
 source_type text not null default 'CHAT' check(source_type in ('CHAT','DOCUMENT','MANUAL_EDIT','SYSTEM_DERIVED')),source_message_id uuid references public.messages(id) on delete set null,evidence text not null default '' check(length(evidence)<=500),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(company_id,id),unique(company_id,type,canonical_name),
 foreign key(company_id,merged_into) references public.business_entities(company_id,id),
 check((reference_table is null)=(reference_id is null)),check(type not in ('COMPANY','GOAL','METRIC') or reference_id is not null)
);
create unique index business_entity_reference on public.business_entities(company_id,type,reference_table,reference_id) where reference_id is not null;
create index business_entity_lookup on public.business_entities(company_id,type,status,updated_at desc,id);
create table public.business_observations (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,
 entity_id uuid not null,attribute text not null check(attribute in ('description','price','margin','count','capacity','cost','revenue','sales','leads','conversion','ticket','frequency','retention','response_time','share','goal','constraint','role','status','primary','industry','business_type','cash','capital','owner_dependence')),
 data jsonb not null check(jsonb_typeof(data)='object'),kind text not null check(kind in ('FACT','METRIC','OBSERVATION','HYPOTHESIS','INFERENCE','DERIVED_METRIC')),
 state text not null check(state in ('CONFIRMED','PROVISIONAL','CONFLICTING','STALE','UNKNOWN')),confidence text not null check(confidence in ('LOW','MEDIUM','HIGH')),
 source_type text not null check(source_type in ('USER_EXPLICIT','CHAT','DOCUMENT','IMPORT','INTEGRATION','SYSTEM_DERIVED','MANUAL_EDIT','EXTERNAL')),
 source_message_id uuid references public.messages(id) on delete set null,memory_id uuid references public.business_memories(id) on delete set null,
 evidence text not null default '' check(length(evidence)<=500), scope_key text not null,
 operation text not null check(operation in ('NEW','CHANGE','CORRECTION')),observed_at timestamptz not null,valid_from timestamptz not null,valid_until timestamptz,
 is_current boolean not null default true,version integer not null default 1,supersedes uuid references public.business_observations(id) on delete set null,
 created_at timestamptz not null default now(),foreign key(company_id,entity_id) references public.business_entities(company_id,id) on delete cascade,
 check(kind not in ('HYPOTHESIS','INFERENCE') or state<>'CONFIRMED'),check(valid_until is null or valid_until>=valid_from)
);
create unique index business_observation_current on public.business_observations(company_id,entity_id,attribute,scope_key) where is_current;
create index business_observation_context on public.business_observations(company_id,entity_id,is_current,observed_at desc);
create table public.business_relationships (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,source_id uuid not null,target_id uuid not null,
 type text not null,kind text not null check(kind in ('FACT','OBSERVATION','HYPOTHESIS','INFERENCE')),
 status text not null check(status in ('ACTIVE','INACTIVE','HISTORICAL','PROVISIONAL')),confidence text not null check(confidence in ('LOW','MEDIUM','HIGH')),
 source_type text not null default 'CHAT',source_message_id uuid references public.messages(id) on delete set null,evidence text not null check(length(evidence) between 1 and 500),
 valid_from timestamptz not null default now(),valid_until timestamptz,created_at timestamptz not null default now(),
 foreign key(company_id,source_id) references public.business_entities(company_id,id) on delete cascade,
 foreign key(company_id,target_id) references public.business_entities(company_id,id) on delete cascade,
 check(source_id<>target_id),check(kind not in ('HYPOTHESIS','INFERENCE') or status in ('PROVISIONAL','HISTORICAL','INACTIVE'))
);
create unique index business_relationship_current on public.business_relationships(company_id,source_id,type,target_id) where valid_until is null;
create index business_relationship_target on public.business_relationships(company_id,target_id) where valid_until is null;
create table public.business_model_events (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,entity_id uuid not null,
 event text not null,source_message_id uuid references public.messages(id) on delete set null,user_id uuid references public.profiles(id) on delete set null,
 before_id uuid references public.business_observations(id) on delete set null,after_id uuid references public.business_observations(id) on delete set null,created_at timestamptz not null default now(),
 foreign key(company_id,entity_id) references public.business_entities(company_id,id) on delete cascade
);
create index business_model_event_history on public.business_model_events(company_id,entity_id,created_at desc);
create table public.business_model_jobs (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,user_id uuid not null references public.profiles(id),
 source_message_id uuid not null references public.messages(id) on delete cascade,payload jsonb not null,schema_version text not null default '9.5.1',
 status text not null default 'QUEUED' check(status in ('QUEUED','COMPLETED','FAILED')),attempts integer not null default 0,error_code text,available_at timestamptz not null default now(),created_at timestamptz not null default now(),completed_at timestamptz,
 unique(source_message_id,schema_version)
);
create index business_model_pending on public.business_model_jobs(available_at,created_at) where status='QUEUED';
alter table public.journal_jobs add column model_payload jsonb;
alter table public.journal_jobs add column model_candidate jsonb;
alter table public.journal_jobs add column model_error text;
alter table public.journal_jobs add column model_attempts integer not null default 0;
do $$declare tab text;begin
 foreach tab in array array['business_entities','business_observations','business_relationships','business_model_events','business_model_jobs'] loop
 execute format('alter table public.%I enable row level security',tab);
 execute format('revoke all on public.%I from anon,authenticated',tab);
 execute format('grant all on public.%I to service_role',tab);
 if tab<>'business_model_jobs' then
 execute format('grant select on public.%I to authenticated',tab);
 execute format('create policy tenant_read on public.%I for select to authenticated using (exists(select 1 from public.company_members m where m.company_id=%I.company_id and m.user_id=auth.uid()))',tab,tab);
 end if;
 end loop;
end$$;

create function public.business_relation_valid(a text,r text,b text) returns boolean language sql immutable set search_path=public as $$
select case r
 when 'SELLS' then a='COMPANY' and b='PRODUCT_SERVICE'
 when 'TARGETS' then a in ('PRODUCT_SERVICE','OFFER') and b='CUSTOMER_SEGMENT'
 when 'PROMOTES' then a='OFFER' and b='PRODUCT_SERVICE'
 when 'GENERATES' then (a='CHANNEL' and b in ('SALES_PROCESS','SALES_STAGE')) or (a='PRODUCT_SERVICE' and b='REVENUE_STREAM')
 when 'USES' then (a in ('CUSTOMER_SEGMENT','SALES_PROCESS','TEAM') and b='CHANNEL') or (a='OPERATION' and b='SUPPLIER')
 when 'OPERATES' then a in ('TEAM','TEAM_ROLE') and b in ('SALES_PROCESS','OPERATION')
 when 'CONSUMES' then a in ('PRODUCT_SERVICE','OPERATION') and b='CAPACITY'
 when 'DELIVERS' then a='OPERATION' and b='PRODUCT_SERVICE'
 when 'LIMITS' then a='CONSTRAINT' and b in ('GOAL','OPERATION','CAPACITY','SALES_PROCESS','TEAM')
 when 'SERVES' then a='LOCATION' and b='CUSTOMER_SEGMENT'
 when 'PARTICIPATES_IN' then (a='CHANNEL' and b='SALES_PROCESS') or (a='SALES_STAGE' and b in ('SALES_PROCESS','CUSTOMER_JOURNEY'))
 when 'HAS' then (a='COMPANY' and b<>'COMPANY') or (a='SALES_PROCESS' and b='SALES_STAGE') or (a='TEAM' and b='TEAM_ROLE')
 when 'MEASURES' then a='METRIC' and b<>'METRIC'
 when 'DEPENDS_ON' then a in ('GOAL','METRIC','OPERATION','SALES_PROCESS','CAPACITY','REVENUE_STREAM') and b in ('METRIC','CHANNEL','TEAM','CAPACITY','OPERATION','SUPPLIER','PRODUCT_SERVICE','OFFER','SALES_PROCESS','COST_STRUCTURE','CONSTRAINT')
 when 'NEXT' then a in ('CHANNEL','SALES_STAGE','OPERATION','TEAM','TEAM_ROLE') and b in ('CHANNEL','SALES_STAGE','OPERATION','TEAM','TEAM_ROLE') else false end$$;
create function public.validate_business_relation() returns trigger language plpgsql set search_path=public as $$
declare a text;b text;begin
 select type into a from business_entities where id=new.source_id and company_id=new.company_id;
 select type into b from business_entities where id=new.target_id and company_id=new.company_id;
 if not coalesce(business_relation_valid(a,new.type,b),false) then raise exception 'BUSINESS_RELATION_INVALID';end if;return new;end$$;
create trigger business_relation_guard before insert or update on public.business_relationships for each row execute function public.validate_business_relation();

create function public.queue_business_model() returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.status='COMPLETED' and new.kind='EXTRACTION' and new.model_payload is not null then
 insert into business_model_jobs(company_id,user_id,source_message_id,payload) values(new.company_id,new.user_id,new.source_message_id,new.model_payload) on conflict(source_message_id,schema_version) do nothing;
 end if;return new;end$$;
create trigger business_model_outbox after update on public.journal_jobs for each row execute function public.queue_business_model();

-- Only the trusted worker can invoke this. It validates membership/source and applies an entire payload atomically.
create function public.apply_business_model(p_job uuid) returns void language plpgsql security definer set search_path=public as $$
declare j business_model_jobs;src text;at_time timestamptz;e jsonb;o jsonb;r jsonb;ids jsonb:='{}';eid uuid;aid uuid;bid uuid;nm text;ref_table text;ref uuid;
 old business_observations;obs_id uuid;st text;curr boolean;obs_time timestamptz;sc text;rs text;before_id uuid;source_kind text;
begin
 select * into j from business_model_jobs where id=p_job for update;
 if j.id is null then raise exception 'BUSINESS_JOB_MISSING';end if;if j.status='COMPLETED' then return;end if;
 if not exists(select 1 from company_members where company_id=j.company_id and user_id=j.user_id) then raise exception 'BUSINESS_ACCESS_DENIED';end if;
 perform 1 from companies where id=j.company_id for update;
 select m.content,m.created_at into src,at_time from messages m join conversations c on c.id=m.conversation_id where m.id=j.source_message_id and m.role='user' and c.company_id=j.company_id and c.user_id=j.user_id;
 if src is null then raise exception 'BUSINESS_SOURCE_INVALID';end if;
 source_kind:=coalesce(j.payload->>'source_type','CHAT');if source_kind not in ('CHAT','DOCUMENT') then raise exception 'BUSINESS_SOURCE_INVALID';end if;
 if jsonb_typeof(j.payload->'entities')<>'array' or jsonb_array_length(j.payload->'entities')>12 or jsonb_array_length(j.payload->'observations')>20 or jsonb_array_length(j.payload->'relationships')>16 then raise exception 'BUSINESS_PAYLOAD_INVALID';end if;
 for e in select * from jsonb_array_elements(j.payload->'entities') loop
 if e->>'scope' is distinct from 'CURRENT_COMPANY' or length(e->>'evidence')=0 or position(e->>'evidence' in src)=0 or ids ? (e->>'key') then raise exception 'BUSINESS_SOURCE_INVALID';end if;
 ref:=nullif(e->>'reference_id','')::uuid;ref_table:=null;
 if ref is not null then
 if e->>'type'='COMPANY' and ref=j.company_id then ref_table:='companies';
 elsif exists(select 1 from business_memories m where m.id=ref and m.company_id=j.company_id and not m.deleted and m.kind=case e->>'type' when 'GOAL' then 'GOAL' when 'METRIC' then 'METRIC' when 'CONSTRAINT' then 'CONSTRAINT' else '?' end) then ref_table:='business_memories';
 elsif e->>'type'='METRIC' and exists(select 1 from business_journal_entries m where m.id=ref and m.company_id=j.company_id and m.entry_type='METRIC' and m.status='ACTIVE') then ref_table:='business_journal_entries';
 else raise exception 'BUSINESS_REFERENCE_INVALID';end if;
 end if;
 nm:=e->>'canonical_name';if nm is null then raise exception 'BUSINESS_IDENTITY_INVALID';end if;
 eid:=nullif(e->>'existing_id','')::uuid;
 if eid is not null then
 if not exists(select 1 from business_entities where id=eid and company_id=j.company_id and type=e->>'type' and version=(e->>'version')::integer and reference_id is not distinct from ref) then raise exception 'BUSINESS_ENTITY_CHANGED';end if;
 else
 if ref is not null then select id into eid from business_entities where company_id=j.company_id and type=e->>'type' and reference_id=ref and reference_table=ref_table;end if;
 if eid is null then
 insert into business_entities(company_id,type,name,canonical_name,reference_table,reference_id,source_type,source_message_id,evidence) values(j.company_id,e->>'type',e->>'name',nm,ref_table,ref,source_kind,j.source_message_id,e->>'evidence')
 on conflict(company_id,type,canonical_name) do update set updated_at=business_entities.updated_at returning id into eid;
 end if;
 end if;
 select coalesce(merged_into,id) into eid from business_entities where id=eid and company_id=j.company_id;
 ids:=ids||jsonb_build_object(e->>'key',eid);
 end loop;
 for o in select * from jsonb_array_elements(j.payload->'observations') loop
 eid:=(ids->>(o->>'entity'))::uuid;
 if eid is null or not (o->>'structural')::boolean or position(o->>'evidence' in src)=0 or length(o->>'evidence')=0 then raise exception 'BUSINESS_SOURCE_INVALID';end if;
 if exists(select 1 from business_entities where id=eid and reference_id is not null) then raise exception 'BUSINESS_REFERENCE_READ_ONLY';end if;
 if nullif(o->>'memory_id','') is not null and not exists(select 1 from business_memories where id=(o->>'memory_id')::uuid and company_id=j.company_id and not deleted) then raise exception 'BUSINESS_REFERENCE_INVALID';end if;
 obs_time:=coalesce(nullif(o->>'observed_on','')::timestamptz,at_time);if obs_time>now()+interval '1 day' then raise exception 'BUSINESS_DATE_INVALID';end if;
 sc:=eid::text;select * into old from business_observations where company_id=j.company_id and entity_id=eid and attribute=o->>'attribute' and scope_key=sc and is_current for update;
 if old.id is not null and old.data=o->'data' and old.kind=o->>'kind' then continue;end if;
 st:=case when source_kind='DOCUMENT' or o->>'kind' in ('HYPOTHESIS','INFERENCE') then 'PROVISIONAL' else 'CONFIRMED' end;curr:=true;
 if old.id is not null then
 if source_kind='DOCUMENT' or obs_time<old.observed_at or (old.source_type='MANUAL_EDIT' and o->>'operation'='NEW') or (st='PROVISIONAL' and old.state='CONFIRMED') then curr:=false;
 elsif o->>'operation'='NEW' or (old.data->>'currency') is distinct from (o->'data'->>'currency') then st:='CONFLICTING';curr:=false;update business_observations set state='CONFLICTING' where id=old.id;
 end if;
 if curr then update business_observations set is_current=false,valid_until=greatest(valid_from,obs_time) where id=old.id;end if;
 end if;
 insert into business_observations(company_id,entity_id,attribute,data,kind,state,confidence,source_type,source_message_id,memory_id,evidence,scope_key,operation,observed_at,valid_from,is_current,version,supersedes)
 values(j.company_id,eid,o->>'attribute',o->'data',o->>'kind',st,o->>'confidence',source_kind,j.source_message_id,nullif(o->>'memory_id','')::uuid,o->>'evidence',sc,o->>'operation',obs_time,obs_time,curr,coalesce(old.version,0)+1,old.id) returning id into obs_id;
 insert into business_model_events(company_id,entity_id,event,source_message_id,user_id,before_id,after_id) values(j.company_id,eid,case when st='CONFLICTING' then 'CONFLICT' else upper(o->>'attribute')||'_'||(o->>'operation') end,j.source_message_id,j.user_id,old.id,obs_id);
 if curr and st='CONFIRMED' and o->>'attribute'='status' then
 update business_entities set status=o->'data'->>'text',version=version+1,updated_at=now() where id=eid;
 if o->'data'->>'text' in ('DISCONTINUED','INACTIVE') then update business_relationships set status='HISTORICAL',valid_until=now() where company_id=j.company_id and (source_id=eid or target_id=eid) and valid_until is null;end if;
 end if;
 end loop;
 for r in select * from jsonb_array_elements(j.payload->'relationships') loop
 aid:=(ids->>(r->>'source'))::uuid;bid:=(ids->>(r->>'target'))::uuid;
 if aid is null or bid is null or position(r->>'evidence' in src)=0 or length(r->>'evidence')=0 then raise exception 'BUSINESS_SOURCE_INVALID';end if;
 if exists(select 1 from business_entities where id in (aid,bid) and status<>'ACTIVE') then continue;end if;
 rs:=case when source_kind='DOCUMENT' or r->>'kind' in ('HYPOTHESIS','INFERENCE') then 'PROVISIONAL' else r->>'status' end;
 if exists(select 1 from business_relationships where company_id=j.company_id and source_id=aid and target_id=bid and type=r->>'type' and valid_until is null and valid_from>at_time) then continue;end if;
 if exists(select 1 from business_relationships where company_id=j.company_id and source_id=aid and target_id=bid and type=r->>'type' and valid_until is null and (status=rs or (status='ACTIVE' and rs='PROVISIONAL'))) then continue;end if;
 update business_relationships set valid_until=now(),status='HISTORICAL' where company_id=j.company_id and source_id=aid and target_id=bid and type=r->>'type' and valid_until is null;
 insert into business_relationships(company_id,source_id,target_id,type,kind,status,confidence,source_type,source_message_id,evidence,valid_from) values(j.company_id,aid,bid,r->>'type',r->>'kind',rs,r->>'confidence',source_kind,j.source_message_id,r->>'evidence',at_time);
 end loop;
 update business_model_jobs set status='COMPLETED',completed_at=now(),error_code=null where id=j.id;
end$$;

create function public.process_business_model_job(p_company uuid default null) returns text language plpgsql security definer set search_path=public as $$
declare j business_model_jobs;begin
 select * into j from business_model_jobs where status='QUEUED' and attempts<4 and available_at<=now() and (p_company is null or company_id=p_company) order by created_at for update skip locked limit 1;
 if j.id is null then return 'EMPTY';end if;
 update business_model_jobs set attempts=attempts+1 where id=j.id;
 begin perform apply_business_model(j.id);return 'COMPLETED';
 exception when others then
 update business_model_jobs set status=case when j.attempts>=3 then 'FAILED' else 'QUEUED' end,error_code='BUSINESS_APPLY_FAILED',available_at=now()+interval '1 minute' where id=j.id;
 return 'RETRY';end;
end$$;

-- Immutable correction history; expected version protects concurrent browser tabs.
create function public.edit_business_observation(p_user uuid,p_company uuid,p_id uuid,p_version integer,p_data jsonb) returns void language plpgsql security definer set search_path=public as $$
declare old business_observations;nid uuid;mv integer;begin
 if not exists(select 1 from company_members where company_id=p_company and user_id=p_user) then raise exception 'BUSINESS_ACCESS_DENIED';end if;
 perform 1 from companies where id=p_company for update;
 select * into old from business_observations where id=p_id and company_id=p_company and is_current and version=p_version for update;
 if old.id is null then raise exception 'BUSINESS_OBSERVATION_CHANGED';end if;
 if jsonb_typeof(p_data)<>'object' then raise exception 'BUSINESS_VALUE_INVALID';end if;
 update business_observations set is_current=false,valid_until=now() where id=old.id;
 if old.memory_id is not null then
 select version into mv from business_memories where id=old.memory_id and company_id=p_company and not deleted for update;
 if mv is null then raise exception 'BUSINESS_SOURCE_CHANGED';end if;
 perform set_config('request.jwt.claim.sub',p_user::text,true);
 perform edit_business_memory(p_company,old.memory_id,mv,coalesce(p_data->>'text',p_data->>'value',(p_data->>'min')||' – '||(p_data->>'max')),false);
 end if;
 insert into business_observations(company_id,entity_id,attribute,data,kind,state,confidence,source_type,evidence,memory_id,scope_key,operation,observed_at,valid_from,is_current,version,supersedes)
 values(p_company,old.entity_id,old.attribute,p_data,case when old.kind in ('HYPOTHESIS','INFERENCE') then 'OBSERVATION' else old.kind end,'CONFIRMED','HIGH','MANUAL_EDIT','',old.memory_id,old.scope_key,'CORRECTION',now(),now(),true,old.version+1,old.id) returning id into nid;
 insert into business_model_events(company_id,entity_id,event,user_id,before_id,after_id) values(p_company,old.entity_id,'MANUAL_CORRECTION',p_user,old.id,nid);
 if old.attribute='status' then
 update business_entities set status=p_data->>'text',version=version+1,updated_at=now() where id=old.entity_id;
 if p_data->>'text' in ('DISCONTINUED','INACTIVE') then update business_relationships set valid_until=now(),status='HISTORICAL' where company_id=p_company and (source_id=old.entity_id or target_id=old.entity_id) and valid_until is null;end if;
 end if;
end$$;

-- A corrected/deleted source cannot leave a confirmed stale projection behind.
create function public.invalidate_business_memory_projection() returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.value is distinct from old.value or new.deleted is distinct from old.deleted then
 update business_observations set state='STALE',is_current=not new.deleted,valid_until=case when new.deleted then now() else valid_until end where memory_id=new.id and is_current;
 update business_entities set status=case when new.deleted then 'INACTIVE' else 'ACTIVE' end,updated_at=now(),version=version+1 where reference_table='business_memories' and reference_id=new.id;
 end if;return new;end$$;
create trigger business_memory_projection after update on public.business_memories for each row execute function public.invalidate_business_memory_projection();
revoke all on function public.apply_business_model(uuid),public.process_business_model_job(uuid),public.edit_business_observation(uuid,uuid,uuid,integer,jsonb),public.queue_business_model(),public.invalidate_business_memory_projection() from public,anon,authenticated;
grant execute on function public.apply_business_model(uuid),public.process_business_model_job(uuid),public.edit_business_observation(uuid,uuid,uuid,integer,jsonb) to service_role;

-- Attachments get an explicit DOCUMENT outbox entry in the same transaction as the chat.
create function public.commit_seed_turn_v95(p_user uuid,p_company uuid,p_conversation uuid,p_request uuid,p_version integer,p_message text,p_answer text,p_diagnosis jsonb,p_memories jsonb,p_skip_journal boolean,p_recommendation jsonb,p_commands jsonb,p_document boolean default false) returns void language plpgsql security definer set search_path=public as $$
declare mid uuid;m companies;stamp timestamptz;begin
 perform commit_seed_turn_v94(p_user,p_company,p_conversation,p_request,p_version,p_message,p_answer,p_diagnosis,p_memories,p_skip_journal or p_document,p_recommendation,p_commands);
 if p_document and not p_skip_journal then
 select id,created_at into mid,stamp from messages where request_id=p_request and role='user' and conversation_id=p_conversation;
 select * into m from companies where id=p_company;
 insert into journal_jobs(company_id,user_id,source_message_id,kind,dedupe_key,context) values(p_company,p_user,mid,'EXTRACTION','message:'||mid,jsonb_build_object('document',true,'timezone',m.timezone,'locale',coalesce(m.preferred_language,m.locale,'en-US'),'at',stamp)) on conflict do nothing;
 end if;
end$$;
revoke all on function public.commit_seed_turn_v95(uuid,uuid,uuid,uuid,integer,text,text,jsonb,jsonb,boolean,jsonb,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.commit_seed_turn_v95(uuid,uuid,uuid,uuid,integer,text,text,jsonb,jsonb,boolean,jsonb,jsonb,boolean) to service_role;

-- Explicit owner-confirmed merge only. Original IDs and evidence remain auditable.
create function public.merge_business_entities(p_user uuid,p_company uuid,p_source uuid,p_target uuid) returns void language plpgsql security definer set search_path=public as $$
declare a business_entities;b business_entities;o business_observations;r business_relationships;sid uuid;tid uuid;begin
 if not exists(select 1 from company_members where company_id=p_company and user_id=p_user and role='owner') then raise exception 'BUSINESS_ACCESS_DENIED';end if;
 perform 1 from companies where id=p_company for update;
 select * into a from business_entities where id=p_source and company_id=p_company for update;
 select * into b from business_entities where id=p_target and company_id=p_company for update;
 if a.id is null or b.id is null or a.id=b.id or a.type<>b.type or a.reference_id is not null or b.reference_id is not null or b.status<>'ACTIVE' then raise exception 'BUSINESS_MERGE_INVALID';end if;
 if a.merged_into=b.id then return;end if;if a.status='MERGED' then raise exception 'BUSINESS_MERGE_INVALID';end if;
 for o in select * from business_observations where entity_id=a.id and company_id=p_company and is_current loop
 update business_observations set is_current=false,valid_until=now() where id=o.id;
 if not exists(select 1 from business_observations where company_id=p_company and entity_id=b.id and attribute=o.attribute and is_current) then
 insert into business_observations(company_id,entity_id,attribute,data,kind,state,confidence,source_type,source_message_id,memory_id,evidence,scope_key,operation,observed_at,valid_from,is_current,version,supersedes)
 values(p_company,b.id,o.attribute,o.data,o.kind,o.state,o.confidence,o.source_type,o.source_message_id,o.memory_id,o.evidence,b.id::text,'CORRECTION',o.observed_at,now(),true,o.version+1,o.id);
 elsif exists(select 1 from business_observations where company_id=p_company and entity_id=b.id and attribute=o.attribute and is_current and data<>o.data) then update business_observations set state='CONFLICTING' where company_id=p_company and entity_id=b.id and attribute=o.attribute and is_current;
 end if;
 end loop;
 for r in select * from business_relationships where company_id=p_company and (source_id=a.id or target_id=a.id) and valid_until is null loop
 update business_relationships set status='HISTORICAL',valid_until=now() where id=r.id;
 sid:=case when r.source_id=a.id then b.id else r.source_id end;tid:=case when r.target_id=a.id then b.id else r.target_id end;
 if sid<>tid then insert into business_relationships(company_id,source_id,target_id,type,kind,status,confidence,source_type,source_message_id,evidence) values(p_company,sid,tid,r.type,r.kind,r.status,r.confidence,r.source_type,r.source_message_id,r.evidence) on conflict do nothing;end if;
 end loop;
 update business_entities set status='MERGED',merged_into=b.id,version=version+1,updated_at=now() where id=a.id;
 update business_entities set merged_into=b.id where company_id=p_company and merged_into=a.id;
 insert into business_model_events(company_id,entity_id,event,user_id) values(p_company,a.id,'MERGED_INTO:'||b.id,p_user);
end$$;
revoke all on function public.merge_business_entities(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.merge_business_entities(uuid,uuid,uuid,uuid) to service_role;
commit;
