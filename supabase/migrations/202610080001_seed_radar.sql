begin;
alter table public.journal_jobs add column radar_payload jsonb;
-- Derived signals only. Journal/Memory/Execution remain the canonical business data.
create table public.radar_company_state(company_id uuid primary key references public.companies(id) on delete cascade,generation bigint not null default 1,processed_generation bigint not null default 0,next_scan_at timestamptz not null default now(),lease_token uuid,lease_until timestamptz,attempts integer not null default 0,last_success_at timestamptz,last_error text,updated_at timestamptz not null default now());
create table public.radar_signals(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,fingerprint text not null,signal_type text not null check(signal_type in ('CHANGE','TREND','ANOMALY','THRESHOLD','REPETITION','GOAL_DEVIATION','CAPACITY_PRESSURE','EXECUTION_RISK','OPPORTUNITY','RISK','ASSUMPTION_DEVIATION')),domain text not null check(domain in ('SALES','MARKETING','FINANCE','CUSTOMERS','OPERATIONS','CAPACITY','GOALS','EXECUTION')),status text not null check(status in ('DETECTED','OBSERVING','READY_TO_SURFACE','SURFACED','ACKNOWLEDGED','INVESTIGATING','RESOLVED','DISMISSED','SUPERSEDED')),attention text not null check(attention in ('OBSERVE','ATTENTION','HIGH_ATTENTION')),rule_id text not null,rule_version text not null,version integer not null default 1,payload jsonb not null check(jsonb_typeof(payload)='object' and payload->>'knowledge_source_scope'='INTERNAL'),payload_hash text not null,suppression_reason text,first_detected_at timestamptz not null default now(),last_observed_at timestamptz not null default now(),resolved_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(company_id,fingerprint),unique(company_id,id));
create index radar_signal_active on public.radar_signals(company_id,status,last_observed_at desc);
create index radar_signal_sources on public.radar_signals using gin ((payload->'evidence') jsonb_path_ops);
create table public.radar_insights(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,fingerprint text not null,signal_ids uuid[] not null,status text not null check(status in ('READY','RESOLVED','SUPERSEDED')),version integer not null default 1,attention text not null,payload jsonb not null,payload_hash text not null,material_change boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(company_id,fingerprint),unique(company_id,id));
create index radar_insight_ready on public.radar_insights(company_id,status,updated_at desc);
create table public.radar_preferences(company_id uuid not null references public.companies(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,proactive_insights_enabled boolean not null default true,mute_until timestamptz,updated_at timestamptz not null default now(),primary key(company_id,user_id));
create table public.radar_deliveries(company_id uuid not null,user_id uuid not null references public.profiles(id) on delete cascade,insight_id uuid not null,version integer not null,status text not null check(status in ('SURFACED','ACKNOWLEDGED','INVESTIGATING','DISMISSED','RESOLVED')),feedback text check(feedback in ('NOT_RELEVANT','WRONG_CONTEXT','ALREADY_KNOWN','INSUFFICIENT_DATA')),surfaced_at timestamptz not null default now(),updated_at timestamptz not null default now(),primary key(user_id,insight_id),foreign key(company_id,insight_id) references public.radar_insights(company_id,id) on delete cascade);
create index radar_delivery_budget on public.radar_deliveries(company_id,user_id,surfaced_at desc);
create table public.radar_events(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,user_id uuid references public.profiles(id) on delete set null,kind text not null,reference_id uuid,details jsonb not null default '{}',created_at timestamptz not null default now());
create index radar_event_recent on public.radar_events(company_id,created_at desc);
-- Parsed watch configuration references a canonical memory version; it is not a second goal or metric.
create table public.radar_watches(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,memory_id uuid not null references public.business_memories(id) on delete cascade,memory_version integer not null,kind text not null check(kind in ('THRESHOLD','GOAL')),config jsonb not null,evidence text not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(company_id,memory_id));
do $$declare tbl text;begin
 foreach tbl in array array['radar_signals','radar_insights','radar_preferences','radar_deliveries','radar_watches','radar_events','radar_company_state'] loop
 execute format('alter table public.%I enable row level security',tbl);
 execute format('revoke all on public.%I from anon,authenticated',tbl);
 execute format('grant all on public.%I to service_role',tbl);
 if tbl not in ('radar_events','radar_company_state') then
 execute format('grant select on public.%I to authenticated',tbl);
 execute format('create policy member_read on public.%I for select to authenticated using(exists(select 1 from public.company_members m where m.company_id=%I.company_id and m.user_id=auth.uid()) %s)',tbl,tbl,case when tbl in ('radar_preferences','radar_deliveries') then 'and user_id=auth.uid()' else '' end);
 end if;
 end loop;
end $$;
create function public.radar_dirty() returns trigger language plpgsql security definer set search_path=public as $$
declare c uuid;rid uuid;erased boolean;begin
 c:=case when tg_op='DELETE' then old.company_id else new.company_id end;rid:=case when tg_op='DELETE' then old.id else new.id end;
 insert into radar_company_state(company_id) values(c) on conflict(company_id) do update set generation=radar_company_state.generation+1,next_scan_at=least(radar_company_state.next_scan_at,now()),attempts=0,updated_at=now();
 erased:=tg_op='DELETE' or coalesce(to_jsonb(new)->>'deleted','false')='true' or coalesce(to_jsonb(new)->>'status','')='DELETED';
 if erased then
 delete from radar_insights i where i.company_id=c and exists(select 1 from radar_signals s where s.company_id=c and s.id=any(i.signal_ids) and s.payload->'evidence' @> jsonb_build_array(jsonb_build_object('table',tg_table_name,'id',rid::text)));
 delete from radar_signals where company_id=c and payload->'evidence' @> jsonb_build_array(jsonb_build_object('table',tg_table_name,'id',rid::text));
 if tg_table_name='business_memories' then delete from radar_watches where company_id=c and memory_id=rid;end if;
 elsif tg_op<>'INSERT' then
 update radar_signals set status='SUPERSEDED',suppression_reason='SOURCE_CHANGED',updated_at=now() where company_id=c and status not in ('RESOLVED','SUPERSEDED') and payload->'evidence' @> jsonb_build_array(jsonb_build_object('table',tg_table_name,'id',rid::text));
 update radar_insights i set status='SUPERSEDED',updated_at=now() where i.company_id=c and i.status='READY' and exists(select 1 from radar_signals s where s.company_id=c and s.id=any(i.signal_ids) and s.status='SUPERSEDED');
 end if;
 return null;
 exception when others then raise log 'RADAR_DIRTY_FAILED';return null; -- ancillary processing must not abort business writes
end $$;
do $$declare tbl text;begin foreach tbl in array array['business_journal_entries','business_observations','business_entities','business_relationships','business_memories','strategies','actions','decisions','experiments','execution_results','execution_learnings','execution_events','decision_simulations','radar_watches'] loop
 execute format('create trigger radar_change after insert or update or delete on public.%I for each row execute function public.radar_dirty()',tbl);end loop;end $$;
insert into public.radar_company_state(company_id) select id from public.companies;
create function public.claim_radar_job(p_company uuid default null) returns setof public.radar_company_state language plpgsql security definer set search_path=public as $$
declare c uuid;begin
 select s.company_id into c from radar_company_state s where (p_company is null or s.company_id=p_company) and s.next_scan_at<=now() and (s.lease_until is null or s.lease_until<now()) order by s.next_scan_at,s.company_id for update skip locked limit 1;
 if c is null then return;end if;
 return query update radar_company_state set lease_token=gen_random_uuid(),lease_until=now()+interval '90 seconds',attempts=attempts+1 where company_id=c returning *;
end $$;
create function public.apply_radar_job(p_company uuid,p_lease uuid,p_generation bigint,p_signals jsonb,p_insights jsonb,p_recoveries jsonb,p_complete boolean,p_latency integer) returns void language plpgsql security definer set search_path=public as $$
declare state radar_company_state%rowtype; x jsonb;s radar_signals%rowtype;i radar_insights%rowtype;h text;ids uuid[];n integer:=0;begin
 select * into state from radar_company_state where company_id=p_company for update;
 if state.lease_token is distinct from p_lease or state.lease_until<now() or state.generation<>p_generation then raise exception 'RADAR_LEASE_CHANGED';end if;
 if jsonb_typeof(p_signals)<>'array' or jsonb_array_length(p_signals)>80 or jsonb_typeof(p_insights)<>'array' or jsonb_array_length(p_insights)>80 then raise exception 'RADAR_BATCH_INVALID';end if;
 for x in select * from jsonb_array_elements(p_signals) loop
 if x->'signal'->>'knowledge_source_scope' is distinct from 'INTERNAL' or jsonb_array_length(x->'signal'->'evidence')<1 then raise exception 'RADAR_EVIDENCE_REQUIRED';end if;
 h:=md5((x->'signal')::text);select * into s from radar_signals where company_id=p_company and fingerprint=x->'signal'->>'fingerprint';
 insert into radar_signals(company_id,fingerprint,signal_type,domain,status,attention,rule_id,rule_version,payload,payload_hash,suppression_reason)
 values(p_company,x->'signal'->>'fingerprint',x->'signal'->>'type',x->'signal'->>'domain',case when x->'gate'->>'attention'='OBSERVE' then 'OBSERVING' else 'READY_TO_SURFACE' end,x->'gate'->>'attention',x->'signal'->>'rule',x->'signal'->>'ruleVersion',x->'signal',h,x->'gate'->>'suppression')
 on conflict(company_id,fingerprint) do update set payload=excluded.payload,payload_hash=excluded.payload_hash,version=radar_signals.version+case when radar_signals.payload_hash<>excluded.payload_hash then 1 else 0 end,status=excluded.status,attention=excluded.attention,suppression_reason=excluded.suppression_reason,rule_version=excluded.rule_version,last_observed_at=now(),updated_at=now(),resolved_at=null;
 end loop;
 -- Missing evidence is not a recovery. Withdraw unconfirmed signals on every scan.
 update radar_signals rs set status='OBSERVING',suppression_reason='NOT_RECONFIRMED',updated_at=now()
 where company_id=p_company and status='READY_TO_SURFACE' and not exists(select 1 from jsonb_array_elements(p_signals) entry(value) where entry.value->'signal'->>'fingerprint'=rs.fingerprint);
 update radar_insights ri set status='SUPERSEDED',updated_at=now() where company_id=p_company and status='READY' and not exists(select 1 from jsonb_array_elements(p_insights) entry(value) where entry.value->>'key'=ri.fingerprint);
 for x in select * from jsonb_array_elements(p_insights) loop
 select array_agg(rs.id order by rs.id) into ids from radar_signals rs where rs.company_id=p_company and rs.status='READY_TO_SURFACE' and rs.fingerprint in(select jsonb_array_elements_text(x->'fingerprints'));
 if coalesce(cardinality(ids),0)<>jsonb_array_length(x->'fingerprints') or cardinality(ids)<1 then raise exception 'RADAR_CLUSTER_INVALID';end if;
 h:=md5((x->'payload')::text);
 insert into radar_insights(company_id,fingerprint,signal_ids,status,attention,payload,payload_hash,material_change)
 values(p_company,x->>'key',ids,'READY',x->>'attention',x->'payload',h,coalesce((x->>'materialChange')::boolean,false))
 on conflict(company_id,fingerprint) do update set signal_ids=excluded.signal_ids,status='READY',attention=excluded.attention,payload=excluded.payload,payload_hash=excluded.payload_hash,version=radar_insights.version+case when radar_insights.payload_hash<>excluded.payload_hash then 1 else 0 end,material_change=case when radar_insights.payload_hash<>excluded.payload_hash then excluded.material_change else radar_insights.material_change end,updated_at=now();n:=n+1;
 end loop;
 if p_complete then
 update radar_signals set status='RESOLVED',resolved_at=now(),updated_at=now() where company_id=p_company and fingerprint in(select jsonb_array_elements_text(p_recoveries)) and status not in ('RESOLVED','SUPERSEDED');
 end if;
 update radar_insights ri set status='RESOLVED',updated_at=now() where ri.company_id=p_company and ri.status='READY' and exists(select 1 from radar_signals rs where rs.company_id=p_company and rs.id=any(ri.signal_ids) and rs.status<>'READY_TO_SURFACE');
 update radar_company_state set processed_generation=p_generation,lease_token=null,lease_until=null,attempts=0,next_scan_at=now()+interval '6 hours',last_success_at=now(),last_error=null where company_id=p_company;
 insert into radar_events(company_id,kind,details) values(p_company,'SCAN_COMPLETED',jsonb_build_object('signals',jsonb_array_length(p_signals),'insights',n,'suppressed',(select count(*) from jsonb_array_elements(p_signals) entry(value) where entry.value->'gate'->>'attention'='OBSERVE'),'latency_ms',p_latency,'complete',p_complete,'ai_cost_usd',0));
end $$;
create function public.radar_feedback(p_user uuid,p_company uuid,p_insight uuid,p_action text,p_feedback text default null) returns void language plpgsql security definer set search_path=public as $$
declare i radar_insights%rowtype;begin
 if not exists(select 1 from company_members where company_id=p_company and user_id=p_user) then raise exception 'RADAR_ACCESS_DENIED';end if;
 select * into i from radar_insights where id=p_insight and company_id=p_company; if not found then raise exception 'RADAR_UNAVAILABLE';end if;
 if p_action not in ('ACKNOWLEDGED','INVESTIGATING','DISMISSED','RESOLVED') or (p_feedback is not null and p_feedback not in ('NOT_RELEVANT','WRONG_CONTEXT','ALREADY_KNOWN','INSUFFICIENT_DATA')) then raise exception 'RADAR_FEEDBACK_INVALID';end if;
 insert into radar_deliveries(company_id,user_id,insight_id,version,status,feedback) values(p_company,p_user,p_insight,i.version,p_action,p_feedback) on conflict(user_id,insight_id) do update set status=excluded.status,feedback=excluded.feedback,version=excluded.version,updated_at=now();
 insert into radar_events(company_id,user_id,kind,reference_id,details) values(p_company,p_user,'FEEDBACK',p_insight,jsonb_build_object('action',p_action,'reason',p_feedback));
end $$;
create function public.radar_surface(p_user uuid,p_company uuid,p_id uuid,p_version integer,p_daily integer,p_cooldown integer) returns boolean language plpgsql security definer set search_path=public as $$
declare i radar_insights%rowtype;d radar_deliveries%rowtype;pref radar_preferences%rowtype;tz text;begin
 if not exists(select 1 from company_members where company_id=p_company and user_id=p_user) then raise exception 'RADAR_ACCESS_DENIED';end if;
 perform pg_advisory_xact_lock(hashtext(p_user::text||p_company::text));
 select * into pref from radar_preferences where company_id=p_company and user_id=p_user;
 if pref.proactive_insights_enabled=false or pref.mute_until>now() then return false;end if;
 select * into i from radar_insights where id=p_id and company_id=p_company and version=p_version and status='READY';if not found then return false;end if;
 select timezone into tz from companies where id=p_company;if tz is null then return false;end if;
 select * into d from radar_deliveries where user_id=p_user and insight_id=p_id;
 -- Same card can remain on screen during the current day. This is not a new interruption.
 if d.version=i.version and d.status='SURFACED' and (d.surfaced_at at time zone tz)::date=(now() at time zone tz)::date then return true;end if;
 if d.version>=i.version or (d.insight_id is not null and not i.material_change) or d.surfaced_at>now()-make_interval(hours=>greatest(24,least(p_cooldown,168))) then return false;end if;
 if d.status='DISMISSED' and d.updated_at>now()-interval '14 days' then return false;end if;
 if (select count(*) from radar_events where company_id=p_company and user_id=p_user and kind='SURFACED' and (created_at at time zone tz)::date=(now() at time zone tz)::date)>=greatest(1,least(p_daily,2)) then return false;end if;
 insert into radar_deliveries(company_id,user_id,insight_id,version,status) values(p_company,p_user,p_id,i.version,'SURFACED') on conflict(user_id,insight_id) do update set version=excluded.version,status='SURFACED',feedback=null,surfaced_at=now(),updated_at=now();
 insert into radar_events(company_id,user_id,kind,reference_id) values(p_company,p_user,'SURFACED',p_id);return true;
end $$;
create function public.save_radar_watch(p_user uuid,p_company uuid,p_memory uuid,p_version integer,p_kind text,p_config jsonb,p_evidence text) returns void language plpgsql security definer set search_path=public as $$
declare m business_memories%rowtype;begin
 if not exists(select 1 from company_members where company_id=p_company and user_id=p_user) then raise exception 'RADAR_ACCESS_DENIED';end if;
 select * into m from business_memories where id=p_memory and company_id=p_company and version=p_version and not deleted;
 if not found or (p_kind='GOAL' and m.kind<>'GOAL') or (p_kind='THRESHOLD' and m.kind not in ('BUSINESS_PREFERENCE','CONSTRAINT','GOAL')) or length(p_evidence)<1 or strpos(m.value||' '||m.evidence,p_evidence)=0 then raise exception 'RADAR_WATCH_SOURCE_INVALID';end if;
 insert into radar_watches(company_id,memory_id,memory_version,kind,config,evidence) values(p_company,p_memory,p_version,p_kind,p_config,p_evidence) on conflict(company_id,memory_id) do update set memory_version=excluded.memory_version,kind=excluded.kind,config=excluded.config,evidence=excluded.evidence,updated_at=now() where (radar_watches.memory_version,radar_watches.kind,radar_watches.config,radar_watches.evidence) is distinct from (excluded.memory_version,excluded.kind,excluded.config,excluded.evidence);
end $$;
revoke all on function public.radar_dirty() from public,anon,authenticated;
revoke all on function public.claim_radar_job(uuid),public.apply_radar_job(uuid,uuid,bigint,jsonb,jsonb,jsonb,boolean,integer),public.radar_feedback(uuid,uuid,uuid,text,text),public.radar_surface(uuid,uuid,uuid,integer,integer,integer),public.save_radar_watch(uuid,uuid,uuid,integer,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.claim_radar_job(uuid),public.apply_radar_job(uuid,uuid,bigint,jsonb,jsonb,jsonb,boolean,integer),public.radar_feedback(uuid,uuid,uuid,text,text),public.radar_surface(uuid,uuid,uuid,integer,integer,integer),public.save_radar_watch(uuid,uuid,uuid,integer,text,jsonb,text) to service_role;
create or replace function public.apply_journal_extraction(p_job uuid,p_lease uuid) returns void language plpgsql security definer set search_path='' as $$
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
  meta=jsonb_build_object('period',item->'period','entity_refs',coalesce(item->'entity_refs','[]'),'related_ids',coalesce(item->'related_ids','[]'),'hypothesis',item->'hypothesis','action',item->'action','indicator',item->'indicator','baseline',item->'baseline','target',item->'target','review_date',item->'review_date');
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
commit;
