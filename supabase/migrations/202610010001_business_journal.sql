begin;
create table public.business_journal_entries (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 user_id uuid not null references public.profiles(id), conversation_id uuid references public.conversations(id) on delete set null,
 source_message_id uuid references public.messages(id) on delete set null,
 entry_type text not null check(entry_type in ('FACT','METRIC','PROBLEM','OPPORTUNITY','DECISION','HYPOTHESIS','EXPERIMENT','RESULT','LEARNING')),
 description text not null check(length(description)<=600), evidence text not null default '' check(length(evidence)<=600),
 event_date date,period_start date,period_end date, metric_type text,value numeric,unit text,currency_code text check(currency_code is null or currency_code ~ '^[A-Z]{3}$'),
 channel text,product text,location text,confidence text not null check(confidence in ('LOW','MEDIUM','HIGH')),
 source_type text not null default 'CHAT' check(source_type in ('CHAT','MANUAL','INTEGRATION','IMPORT','SYSTEM')),
 status text not null default 'ACTIVE' check(status in ('ACTIVE','DELETED')),metadata jsonb not null default '{}',
 identity_key text not null,version integer not null default 1,manual boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check((period_start is null and period_end is null) or (period_start is not null and period_end is not null and period_start<=period_end)),
 check(value is null or (entry_type='METRIC' and value>=0 and value<=1e15)),unique(company_id,identity_key)
);
create index journal_recent on public.business_journal_entries(company_id,period_start desc,created_at desc) where status='ACTIVE';
create table public.business_journal_history(id uuid primary key default gen_random_uuid(),entry_id uuid not null references public.business_journal_entries(id) on delete cascade,company_id uuid not null references public.companies(id) on delete cascade,snapshot jsonb not null,changed_at timestamptz not null default now(),changed_by uuid references public.profiles(id));
create table public.journal_jobs(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,user_id uuid not null references public.profiles(id),
 source_message_id uuid unique references public.messages(id) on delete cascade,kind text not null check(kind in ('EXTRACTION','WEEKLY')),
 dedupe_key text not null unique,status text not null default 'QUEUED' check(status in ('QUEUED','RUNNING','READY','COMPLETED','FAILED','UNKNOWN')),
 available_at timestamptz not null default now(),context jsonb not null default '{}',payload jsonb,attempts integer not null default 0,lease_token uuid,locked_at timestamptz,error_code text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index journal_queue on public.journal_jobs(status,created_at);
create table public.weekly_intelligence_reports(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,
 job_id uuid not null unique references public.journal_jobs(id),period_start date not null,period_end date not null,timezone text not null,locale text not null,
 status text not null default 'AVAILABLE' check(status in ('AVAILABLE','INVALIDATED')),summary text not null,
 confidence text not null,next_priority text,primary_indicator text,structured_report jsonb not null,
 source_ids uuid[] not null,generation_version text not null,model_metadata jsonb not null default '{}',generated_at timestamptz not null default now(),
 check(period_start<=period_end)
);
create index weekly_recent on public.weekly_intelligence_reports(company_id,generated_at desc);
alter table public.business_journal_entries enable row level security;
revoke all on public.business_journal_entries from anon,authenticated;
grant all on public.business_journal_entries to service_role;
grant select on public.business_journal_entries to authenticated;
create policy member_read on public.business_journal_entries for select to authenticated using(exists(select 1 from public.company_members m where m.company_id=business_journal_entries.company_id and m.user_id=auth.uid()));
alter table public.business_journal_history enable row level security;
revoke all on public.business_journal_history from anon,authenticated;
grant all on public.business_journal_history to service_role;
grant select on public.business_journal_history to authenticated;
create policy member_read on public.business_journal_history for select to authenticated using(exists(select 1 from public.company_members m where m.company_id=business_journal_history.company_id and m.user_id=auth.uid()));
alter table public.journal_jobs enable row level security;
revoke all on public.journal_jobs from anon,authenticated;
grant all on public.journal_jobs to service_role;
alter table public.weekly_intelligence_reports enable row level security;
revoke all on public.weekly_intelligence_reports from anon,authenticated;
grant all on public.weekly_intelligence_reports to service_role;
grant select on public.weekly_intelligence_reports to authenticated;
create policy member_read on public.weekly_intelligence_reports for select to authenticated using(exists(select 1 from public.company_members m where m.company_id=weekly_intelligence_reports.company_id and m.user_id=auth.uid()));

-- Outbox and chat are committed atomically; no AI request runs in the database.
create function public.enqueue_journal_message() returns trigger language plpgsql security definer set search_path='' as $$
declare c public.conversations%rowtype; market public.companies%rowtype;
begin
 if new.role<>'user' or current_setting('seed.skip_journal',true) is distinct from 'false' then return new; end if;
 select * into c from public.conversations where id=new.conversation_id;
 select * into market from public.companies where id=c.company_id;
 insert into public.journal_jobs(company_id,user_id,source_message_id,kind,dedupe_key,context)
 values(c.company_id,c.user_id,new.id,'EXTRACTION','message:'||new.id,jsonb_build_object('timezone',market.timezone,'locale',coalesce(market.preferred_language,market.locale,'en-US'),'at',new.created_at)) on conflict do nothing;
 return new;
end $$;
revoke all on function public.enqueue_journal_message() from public,anon,authenticated;
create trigger journal_message after insert on public.messages for each row execute function public.enqueue_journal_message();
create function public.commit_seed_turn_v93(p_user uuid,p_company uuid,p_conversation uuid,p_request uuid,p_version integer,p_message text,p_answer text,p_diagnosis jsonb,p_memories jsonb,p_skip_journal boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
 perform set_config('seed.skip_journal',p_skip_journal::text,true);
 perform public.commit_seed_turn(p_user,p_company,p_conversation,p_request,p_version,p_message,p_answer,p_diagnosis,p_memories);
end $$;
revoke all on function public.commit_seed_turn_v93(uuid,uuid,uuid,uuid,integer,text,text,jsonb,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.commit_seed_turn_v93(uuid,uuid,uuid,uuid,integer,text,text,jsonb,jsonb,boolean) to service_role;
create function public.claim_journal_job(p_company uuid default null) returns setof public.journal_jobs language plpgsql security definer set search_path='' as $$
declare j public.journal_jobs%rowtype;
begin
 -- An expired in-flight provider call is never automatically charged a second time.
 update public.journal_jobs set status='UNKNOWN',error_code='LEASE_EXPIRED',updated_at=now() where status='RUNNING' and locked_at<now()-interval '5 minutes';
 select * into j from public.journal_jobs where status in ('QUEUED','READY') and available_at<=now() and attempts<4 and (p_company is null or company_id=p_company)
 and not exists(select 1 from public.journal_jobs busy where busy.company_id=journal_jobs.company_id and busy.status='RUNNING')
 order by created_at for update skip locked limit 1;
 if not found then return; end if;
 -- Serialize jobs per company (including multiple workers).
 if not pg_try_advisory_xact_lock(hashtext(j.company_id::text)) then return; end if;
 if exists(select 1 from public.journal_jobs where company_id=j.company_id and status='RUNNING') then return; end if;
 return query update public.journal_jobs set status='RUNNING',lease_token=gen_random_uuid(),attempts=attempts+1,locked_at=now(),updated_at=now() where id=j.id returning *;
end $$;
revoke all on function public.claim_journal_job(uuid) from public,anon,authenticated;
grant execute on function public.claim_journal_job(uuid) to service_role;
create function public.apply_journal_extraction(p_job uuid,p_lease uuid) returns void language plpgsql security definer set search_path='' as $$
declare j public.journal_jobs%rowtype; item jsonb; old public.business_journal_entries%rowtype; m public.messages%rowtype; key text; eid uuid; meta jsonb; ref jsonb; valid_relation boolean;
begin
 select * into j from public.journal_jobs where id=p_job for update;
 if j.status='COMPLETED' then return; end if;
 if j.status<>'RUNNING' or j.lease_token is distinct from p_lease or j.kind<>'EXTRACTION' or j.payload is null then raise exception 'Invalid job'; end if;
 if not exists(select 1 from public.company_members where user_id=j.user_id and company_id=j.company_id) then raise exception 'Access denied'; end if;
 perform 1 from public.companies where id=j.company_id for update;
 select * into m from public.messages where id=j.source_message_id;
 if m.role<>'user' or not exists(select 1 from public.conversations where id=m.conversation_id and company_id=j.company_id and user_id=j.user_id) then raise exception 'Invalid source'; end if;
 if jsonb_typeof(j.payload)<>'array' or jsonb_array_length(j.payload)>12 then raise exception 'Invalid payload'; end if;
 for item in select * from jsonb_array_elements(j.payload) loop
  if item->>'scope'<>'CURRENT_COMPANY' or length(item->>'evidence')<1 or strpos(m.content,item->>'evidence')=0 then raise exception 'Invalid evidence'; end if;
  if item->>'epistemic'='POSSIBLE' and item->>'entry_type' not in ('HYPOTHESIS','OPPORTUNITY') then raise exception 'Invalid certainty'; end if;
  meta=jsonb_build_object('entity_refs',coalesce(item->'entity_refs','[]'),'related_ids',coalesce(item->'related_ids','[]'),'hypothesis',item->'hypothesis','action',item->'action','indicator',item->'indicator','baseline',item->'baseline','target',item->'target','review_date',item->'review_date');
  if exists(select 1 from jsonb_array_elements_text(coalesce(item->'related_ids','[]')) rel(id) where not exists(select 1 from public.business_journal_entries where id=rel.id::uuid and company_id=j.company_id and status='ACTIVE')) then raise exception 'Invalid relation'; end if;
  for ref in select * from jsonb_array_elements(coalesce(item->'entity_refs','[]')) loop
   valid_relation:=false;
   case ref->>'type'
    when 'STRATEGY' then select exists(select 1 from public.strategies where id=(ref->>'id')::uuid and company_id=j.company_id) into valid_relation;
    when 'ACTION' then select exists(select 1 from public.actions where id=(ref->>'id')::uuid and company_id=j.company_id) into valid_relation;
    when 'DECISION' then select exists(select 1 from public.decisions where id=(ref->>'id')::uuid and company_id=j.company_id) into valid_relation;
    when 'EXPERIMENT' then select exists(select 1 from public.experiments where id=(ref->>'id')::uuid and company_id=j.company_id) into valid_relation;
    when 'DIAGNOSIS' then select exists(select 1 from public.messages msg join public.conversations c on c.id=msg.conversation_id where msg.id=(ref->>'id')::uuid and c.company_id=j.company_id and msg.diagnosis is not null) into valid_relation;
    else null;
   end case;
   if not valid_relation then raise exception 'Invalid entity relation'; end if;
  end loop;
  old:=null;
  if item->>'operation'<>'NEW' then
   select * into old from public.business_journal_entries where id=(item->>'target_id')::uuid and company_id=j.company_id for update;
   if not found or old.version<>(item->>'target_version')::int or old.entry_type<>item->>'entry_type' then raise exception 'Entry changed'; end if;
   if old.manual or old.status='DELETED' then continue; end if;
   if item->>'operation'='ENRICH' and old.value is distinct from (item->>'value')::numeric then raise exception 'Enrichment changed metric'; end if;
   key:=old.identity_key;
  else
   key:=md5(concat_ws('|',item->>'entry_type',case when item->>'entry_type'='METRIC' then item->>'metric_type' else lower(item->>'description') end,
    coalesce(item->>'period_start',m.id::text),item->>'period_end',item->>'unit',item->>'currency_code',lower(item->>'channel'),lower(item->>'product'),lower(item->>'location')));
   select * into old from public.business_journal_entries where company_id=j.company_id and (identity_key=key or (entry_type='METRIC' and item->>'entry_type'='METRIC' and metric_type=item->>'metric_type' and period_start=(item->>'period_start')::date and period_end=(item->>'period_end')::date and unit is not distinct from item->>'unit' and currency_code is not distinct from item->>'currency_code' and channel is not distinct from item->>'channel' and product is not distinct from item->>'product' and location is not distinct from item->>'location')) limit 1 for update;
   -- An ambiguous repeated observation never silently replaces an existing value.
   if found then continue; end if;
  end if;
  if old.id is not null then
   insert into public.business_journal_history(entry_id,company_id,snapshot,changed_by) values(old.id,j.company_id,to_jsonb(old),j.user_id);
   update public.business_journal_entries set description=item->>'description',evidence=item->>'evidence',value=(item->>'value')::numeric,
    channel=item->>'channel',product=item->>'product',location=item->>'location',metadata=meta,version=version+1,updated_at=now(),source_message_id=m.id,
    period_start=(item->>'period_start')::date,period_end=(item->>'period_end')::date,event_date=(item->>'period_start')::date,unit=item->>'unit',currency_code=item->>'currency_code'
    where id=old.id returning id into eid;
   update public.weekly_intelligence_reports set status='INVALIDATED' where company_id=j.company_id and old.id=any(source_ids);
  else
   insert into public.business_journal_entries(company_id,user_id,conversation_id,source_message_id,entry_type,description,evidence,event_date,period_start,period_end,metric_type,value,unit,currency_code,channel,product,location,confidence,metadata,identity_key)
   values(j.company_id,j.user_id,m.conversation_id,m.id,item->>'entry_type',item->>'description',item->>'evidence',(item->>'period_start')::date,(item->>'period_start')::date,(item->>'period_end')::date,item->>'metric_type',(item->>'value')::numeric,item->>'unit',item->>'currency_code',item->>'channel',item->>'product',item->>'location',item->>'confidence',meta,key) returning id into eid;
  end if;
 end loop;
 update public.journal_jobs set status='COMPLETED',payload=null,updated_at=now() where id=p_job;
end $$;
revoke all on function public.apply_journal_extraction(uuid,uuid) from public,anon,authenticated;
grant execute on function public.apply_journal_extraction(uuid,uuid) to service_role;
create function public.edit_journal_entry(p_company uuid,p_id uuid,p_version int,p_description text,p_value numeric,p_delete boolean) returns void language plpgsql security definer set search_path='' as $$
declare old public.business_journal_entries%rowtype;
begin
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
revoke all on function public.edit_journal_entry(uuid,uuid,int,text,numeric,boolean) from public,anon;
grant execute on function public.edit_journal_entry(uuid,uuid,int,text,numeric,boolean) to authenticated;
create or replace function public.reserve_ai_request(p_user uuid,p_company uuid,p_id uuid,p_reserve numeric,p_feature text default 'diagnosis',p_fingerprint text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare plan text:='FREE'; market text; policy jsonb; used numeric; day_used numeric; month_used numeric; global_used numeric; count_used bigint; window_start timestamptz; override_row record;
begin
 perform pg_advisory_xact_lock(9128001);
 if p_reserve is null or p_reserve<=0 or p_reserve>1000 then raise exception 'Invalid reservation'; end if;
 if not exists(select 1 from public.company_members where user_id=p_user and company_id=p_company) then raise exception 'Access denied'; end if;
 if exists(select 1 from public.ai_requests where id=p_id) then raise exception 'Duplicate request' using errcode='40001'; end if;
 select market_code into market from public.commercial_accounts where user_id=p_user;
 if market is null or not exists(select 1 from public.commercial_markets where code=market and (status in ('ACTIVE','PAUSED') or (status='READY' and exists(select 1 from public.commercial_overrides o where o.user_id=p_user and o.expires_at>now() and o.revoked_at is null and o.settings->>'market_access'='true'))) and not disable_ai_requests) then raise exception 'Market unavailable'; end if;
 select plan_code into plan from public.subscriptions where user_id=p_user and status in ('active','trialing') and current_period_end>now() order by current_period_end desc limit 1;
 plan:=coalesce(plan,'FREE');
 select settings into override_row from public.commercial_overrides where user_id=p_user and expires_at>now() and revoked_at is null order by created_at desc limit 1;
 if found then plan:=coalesce(override_row.settings->>'plan_code',plan); end if;
 select p.policy into policy from public.commercial_plans p where code=plan and available;
 if override_row.settings is not null and override_row.settings ? 'policy' then policy:=override_row.settings->'policy'; end if;
 if policy is null then raise exception 'Policy unavailable'; end if;
 if p_feature not in ('classification','diagnosis','BUSINESS_JOURNAL_EXTRACTION','BUSINESS_JOURNAL_CLASSIFICATION','WEEKLY_INTELLIGENCE_GENERATION') then raise exception 'Invalid feature'; end if;
 if p_fingerprint is not null and exists(select 1 from public.ai_requests where user_id=p_user and fingerprint=p_fingerprint and created_at>now()-interval '30 seconds') then return jsonb_build_object('allowed',false,'reason','DUPLICATE_REQUEST'); end if;
 window_start:=case when policy->>'window'='lifetime' then '-infinity'::timestamptz else date_trunc('month',now() at time zone 'UTC') at time zone 'UTC' end;
 select coalesce(sum(coalesce(accounted_usd,reserved_usd)),0),count(*) into used,count_used from public.ai_requests where user_id=p_user and created_at>=window_start;
 select coalesce(sum(coalesce(accounted_usd,reserved_usd)),0) into day_used from public.ai_requests where user_id=p_user and created_at>=(date_trunc('day',now() at time zone 'UTC') at time zone 'UTC');
 select coalesce(sum(coalesce(accounted_usd,reserved_usd)),0) into month_used from public.ai_requests where user_id=p_user and created_at>=(date_trunc('month',now() at time zone 'UTC') at time zone 'UTC');
 select coalesce(sum(coalesce(accounted_usd,reserved_usd)),0) into global_used from public.ai_requests where created_at>=(date_trunc('day',now() at time zone 'UTC') at time zone 'UTC');
 if (select count(*) from public.ai_requests where user_id=p_user and feature in ('diagnosis','WEEKLY_INTELLIGENCE_GENERATION') and created_at>=window_start)>=(policy->>'diagnoses')::bigint then return jsonb_build_object('allowed',false,'reason','DIAGNOSIS_LIMIT'); end if;
 if used+p_reserve>(policy->>'hard_usd')::numeric or count_used>=(policy->>'interactions')::bigint or day_used+p_reserve>(policy->>'user_day_usd')::numeric or month_used+p_reserve>(policy->>'user_month_usd')::numeric or global_used+p_reserve>(policy->>'global_day_usd')::numeric then
  insert into public.commercial_events(user_id,market_code,event,dedupe_key) values(p_user,market,case when plan='FREE' then 'free_hard_limit_reached' else 'pro_protection_reached' end,'hard:'||p_user||':'||current_date) on conflict(dedupe_key) do nothing;
  return jsonb_build_object('allowed',false,'reason','HARD_LIMIT');
 end if;
 if (select count(*) from public.ai_requests where user_id=p_user and status='RESERVED' and created_at>now()-interval '2 minutes')>=(policy->>'max_concurrent')::int or (select count(*) from public.ai_requests where user_id=p_user and created_at>now()-interval '1 minute')>=(policy->>'requests_per_minute')::int then
  return jsonb_build_object('allowed',false,'reason','RATE_LIMIT');
 end if;
 if plan='FREE' and used>=(policy->>'soft_usd')::numeric then
 insert into public.commercial_events(user_id,market_code,event,dedupe_key) values(p_user,market,'free_soft_limit_reached','soft:'||p_user||':'||current_date) on conflict(dedupe_key) do nothing; end if;
 insert into public.ai_requests(id,user_id,company_id,plan_code,market_code,status,reserved_usd,feature,fingerprint) values(p_id,p_user,p_company,plan,market,'RESERVED',p_reserve,p_feature,p_fingerprint);
 return jsonb_build_object('allowed',true,'plan',plan,'market',market,'used_usd',used,'policy',policy);
end $$;
revoke all on function public.reserve_ai_request(uuid,uuid,uuid,numeric,text,text) from public,anon,authenticated;
grant execute on function public.reserve_ai_request(uuid,uuid,uuid,numeric,text,text) to service_role;

create function public.finish_weekly_job(p_job uuid,p_lease uuid) returns void language plpgsql security definer set search_path='' as $$
declare j public.journal_jobs%rowtype; data jsonb; item jsonb;
begin
 select * into j from public.journal_jobs where id=p_job for update;
 if j.status='COMPLETED' then return; end if;
 if j.status<>'RUNNING' or j.kind<>'WEEKLY' or j.lease_token is distinct from p_lease or j.payload is null then raise exception 'Invalid job'; end if;
 if not exists(select 1 from public.company_members where company_id=j.company_id and user_id=j.user_id) then raise exception 'Access denied'; end if;
 perform 1 from public.companies where id=j.company_id for update;
 data:=j.payload;
 for item in select * from jsonb_array_elements(data->'sources') loop
  if not exists(select 1 from public.business_journal_entries where id=(item->>'id')::uuid and company_id=j.company_id and status='ACTIVE' and version=(item->>'version')::integer) then raise exception 'Sources changed'; end if;
 end loop;
 insert into public.weekly_intelligence_reports(company_id,job_id,period_start,period_end,timezone,locale,summary,confidence,next_priority,primary_indicator,structured_report,source_ids,generation_version,model_metadata)
 values(j.company_id,j.id,(j.context->>'start')::date,(j.context->>'end')::date,j.context->>'timezone',j.context->>'locale',data->'report'->'summary'->>'text',data->'report'->>'confidence',data->'report'->'next_priority'->>'text',data->'report'->>'primary_indicator',data,
 array(select (x->>'id')::uuid from jsonb_array_elements(data->'sources') x),data->>'generation_version',data->'model_metadata') on conflict(job_id) do nothing;
 update public.journal_jobs set status='COMPLETED',payload=null,updated_at=now() where id=j.id;
end $$;
revoke all on function public.finish_weekly_job(uuid,uuid) from public,anon,authenticated;
grant execute on function public.finish_weekly_job(uuid,uuid) to service_role;
commit;
