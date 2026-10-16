begin;
create table public.external_preferences (
 company_id uuid not null references public.companies(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 enabled boolean not null default true,sensitive_mode boolean not null default false,updated_at timestamptz not null default now(),primary key(company_id,user_id),
 foreign key(company_id,user_id) references public.company_members(company_id,user_id) on delete cascade
);
create table public.external_research_runs (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,
 conversation_id uuid references public.conversations(id) on delete cascade,request_id uuid not null unique,
 trigger_type text not null,depth text not null check(depth in ('QUICK','STANDARD','DEEP')),
 status text not null default 'QUEUED' check(status in ('QUEUED','RUNNING','COMPLETED','PARTIAL','FAILED','CANCELLED')),
 sanitized_query text not null check(length(sanitized_query)<=2000),cache_key text not null,locale text not null,market_code text,
 report jsonb,feedback text check(feedback in ('USEFUL','NOT_USEFUL','STALE','WRONG_MARKET')),error_code text,
 tool_calls integer not null default 0,source_count integer not null default 0,latency_ms integer,estimated_cost numeric,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),completed_at timestamptz,expires_at timestamptz,
 unique(id,company_id),foreign key(company_id,user_id) references public.company_members(company_id,user_id) on delete cascade
);
create index external_research_context on public.external_research_runs(company_id,created_at desc);
create index external_research_cache on public.external_research_runs(company_id,user_id,cache_key,expires_at);
create table public.external_sources (
 research_run_id uuid not null,company_id uuid not null,id text not null,url text not null,metadata jsonb not null,
 primary key(research_run_id,id),foreign key(research_run_id,company_id) references public.external_research_runs(id,company_id) on delete cascade
);
create table public.external_claims (
 research_run_id uuid not null,company_id uuid not null,id text not null,payload jsonb not null,primary key(research_run_id,id),
 foreign key(research_run_id,company_id) references public.external_research_runs(id,company_id) on delete cascade
);
create table public.external_claim_sources (
 research_run_id uuid not null,company_id uuid not null,claim_id text not null,source_id text not null,
 primary key(research_run_id,claim_id,source_id),
 foreign key(research_run_id,company_id) references public.external_research_runs(id,company_id) on delete cascade,
 foreign key(research_run_id,claim_id) references public.external_claims(research_run_id,id) on delete cascade,
 foreign key(research_run_id,source_id) references public.external_sources(research_run_id,id) on delete cascade
);
create table public.external_research_jobs (
 run_id uuid primary key,company_id uuid not null,plan jsonb not null,internal_context text not null check(length(internal_context)<=50000),
 lease_token uuid,lease_until timestamptz,provider_state jsonb,evidence jsonb,cached_report jsonb,attempts integer not null default 0,
 foreign key(run_id,company_id) references public.external_research_runs(id,company_id) on delete cascade
);
create table public.external_competitors (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,
 domain text not null,name text not null,relationship text not null default 'SUGGESTED' check(relationship in ('SUGGESTED','CONFIRMED','REJECTED')),
 last_run_id uuid,updated_at timestamptz not null default now(),unique(company_id,domain),foreign key(last_run_id,company_id) references public.external_research_runs(id,company_id) on delete cascade
);
create table public.external_watchlist (
 id uuid primary key default gen_random_uuid(),company_id uuid not null,user_id uuid not null,run_id uuid not null,reason text not null check(length(reason) between 5 and 500),
 enabled boolean not null default false,frequency_days integer not null default 7 check(frequency_days between 7 and 90),next_run_at timestamptz,last_run_at timestamptz,
 foreign key(company_id,user_id) references public.company_members(company_id,user_id) on delete cascade,
 foreign key(run_id,company_id) references public.external_research_runs(id,company_id) on delete cascade,unique(company_id,user_id,run_id)
);
create table public.external_events (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,user_id uuid references auth.users(id) on delete cascade,
 run_id uuid references public.external_research_runs(id) on delete cascade,kind text not null,metadata jsonb not null default '{}',created_at timestamptz not null default now()
);
do $$ declare t text;begin
 foreach t in array array['external_preferences','external_research_runs','external_sources','external_claims','external_claim_sources','external_research_jobs','external_competitors','external_watchlist','external_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 if t not in ('external_research_jobs','external_events') then
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy tenant_read on public.%I for select to authenticated using (exists(select 1 from public.company_members m where m.company_id=%I.company_id and m.user_id=auth.uid()))',t,t);
 end if;
 end loop;
end $$;
-- Research settings and financial guards are operational caps, not new subscription prices.
insert into public.commercial_settings(id,value) values('external_research','{"enabled":true,"max_calls":6,"max_user_day_usd":2,"max_company_month_usd":10,"max_deep_concurrency":1,"max_runs_day":10,"refresh_seconds":300,"tool_call_usd":"0.01","price_source":"https://developers.openai.com/api/docs/pricing","price_as_of":"2026-10-08","free_depths":["QUICK"],"pro_depths":["QUICK","STANDARD","DEEP"]}'::jsonb) on conflict(id) do nothing;
-- Reuse the single commercial reservation mechanism and its lock; no budget reset.
do $$ declare f text;begin
 f:=pg_get_functiondef('public.reserve_ai_request(uuid,uuid,uuid,numeric,text,text)'::regprocedure);
 f:=replace(f,'''WEEKLY_INTELLIGENCE_GENERATION'') then raise exception ''Invalid feature''','''WEEKLY_INTELLIGENCE_GENERATION'',''EXTERNAL_RESEARCH_PLANNING'',''WEB_SEARCH_QUICK'',''WEB_SEARCH_STANDARD'',''WEB_SEARCH_DEEP'',''EXTERNAL_SYNTHESIS'') then raise exception ''Invalid feature''');
 execute f;
end $$;
create function public.reserve_external_ai(p_user uuid,p_company uuid,p_id uuid,p_reserve numeric,p_feature text,p_fingerprint text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg jsonb;snap jsonb;depth text;day_cost numeric;company_cost numeric;begin
 perform pg_advisory_xact_lock(9128001);
 if p_feature not in ('EXTERNAL_RESEARCH_PLANNING','WEB_SEARCH_QUICK','WEB_SEARCH_STANDARD','WEB_SEARCH_DEEP','EXTERNAL_SYNTHESIS') then raise exception 'EXTERNAL_FEATURE_INVALID';end if;
 select value into cfg from public.commercial_settings where id='external_research';
 if cfg is null or not coalesce((cfg->>'enabled')::boolean,false) or exists(select 1 from public.external_preferences where company_id=p_company and user_id=p_user and (not enabled or sensitive_mode)) then return jsonb_build_object('allowed',false,'reason','EXTERNAL_DISABLED');end if;
 snap:=public.commercial_usage(p_user,'lifetime');
 if p_feature like 'WEB_SEARCH_%' then
 depth:=replace(p_feature,'WEB_SEARCH_','');
 if not coalesce((case when snap->>'plan'='PRO' then cfg->'pro_depths' else cfg->'free_depths' end) ? depth,false) then return jsonb_build_object('allowed',false,'reason','PRO_REQUIRED');end if;
 end if;
 select coalesce(sum(coalesce(accounted_usd,reserved_usd)),0) into day_cost from public.ai_requests where user_id=p_user and feature in ('EXTERNAL_RESEARCH_PLANNING','WEB_SEARCH_QUICK','WEB_SEARCH_STANDARD','WEB_SEARCH_DEEP','EXTERNAL_SYNTHESIS') and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 select coalesce(sum(coalesce(accounted_usd,reserved_usd)),0) into company_cost from public.ai_requests where company_id=p_company and feature in ('EXTERNAL_RESEARCH_PLANNING','WEB_SEARCH_QUICK','WEB_SEARCH_STANDARD','WEB_SEARCH_DEEP','EXTERNAL_SYNTHESIS') and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
 if day_cost+p_reserve>(cfg->>'max_user_day_usd')::numeric or company_cost+p_reserve>(cfg->>'max_company_month_usd')::numeric then return jsonb_build_object('allowed',false,'reason','HARD_LIMIT');end if;
 if p_feature='WEB_SEARCH_DEEP' and (select count(*) from public.ai_requests where feature='WEB_SEARCH_DEEP' and status='RESERVED' and created_at>now()-interval '15 minutes')>=(cfg->>'max_deep_concurrency')::int then return jsonb_build_object('allowed',false,'reason','RATE_LIMIT');end if;
 return public.reserve_ai_request(p_user,p_company,p_id,p_reserve,p_feature,p_fingerprint);
end $$;
create function public.queue_external_research(p_user uuid,p_company uuid,p_run uuid,p_conversation uuid,p_request uuid,p_version integer,p_message text,p_answer text,p_plan jsonb,p_context text,p_cache_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare cfg jsonb;old uuid;begin
 perform pg_advisory_xact_lock(hashtext(p_user::text));
 if not exists(select 1 from public.company_members where company_id=p_company and user_id=p_user) then raise exception 'EXTERNAL_ACCESS_DENIED';end if;
 select id into old from public.external_research_runs where request_id=p_request and company_id=p_company and user_id=p_user;if old is not null then return old;end if;
 if exists(select 1 from public.external_preferences where company_id=p_company and user_id=p_user and(not enabled or sensitive_mode)) then raise exception 'EXTERNAL_DISABLED';end if;
 select value into cfg from public.commercial_settings where id='external_research';
 if cfg is null or not (cfg->>'enabled')::boolean then raise exception 'EXTERNAL_DISABLED';end if;
 if (select count(*) from public.external_research_runs where user_id=p_user and created_at>=date_trunc('day',now()))>=(cfg->>'max_runs_day')::int then raise exception 'EXTERNAL_RATE_LIMIT';end if;
 if exists(select 1 from public.external_research_runs where user_id=p_user and company_id=p_company and sanitized_query=p_plan->>'query' and created_at>now()-make_interval(secs=>(cfg->>'refresh_seconds')::int)) then raise exception 'EXTERNAL_REFRESH_LIMIT';end if;
 perform public.commit_seed_turn(p_user,p_company,p_conversation,p_request,p_version,p_message,p_answer,null,'[]'::jsonb);
 insert into public.external_research_runs(id,company_id,user_id,conversation_id,request_id,trigger_type,depth,sanitized_query,cache_key,locale,market_code) values(p_run,p_company,p_user,p_conversation,p_request,p_plan->>'trigger',p_plan->>'depth',p_plan->>'query',p_cache_key,p_plan->>'locale',p_plan->>'country');
 insert into public.external_research_jobs(run_id,company_id,plan,internal_context) values(p_run,p_company,p_plan,p_context);
 insert into public.external_events(company_id,user_id,run_id,kind) values(p_company,p_user,p_run,'external_research_started');return p_run;
end $$;
create function public.claim_external_job(p_run uuid default null) returns setof public.external_research_jobs
language plpgsql security definer set search_path='' as $$
declare job public.external_research_jobs%rowtype;begin
 select j.* into job from public.external_research_jobs j join public.external_research_runs r on r.id=j.run_id where r.status in ('QUEUED','RUNNING') and (p_run is null or j.run_id=p_run) and(j.lease_until is null or j.lease_until<now()) order by r.created_at for update of j skip locked limit 1;
 if job.run_id is null then return;end if;
 update public.external_research_runs set status='RUNNING',updated_at=now() where id=job.run_id;
 return query update public.external_research_jobs set lease_token=gen_random_uuid(),lease_until=now()+interval '110 seconds',attempts=attempts+1 where run_id=job.run_id returning *;
end $$;
create function public.finish_external_job(p_run uuid,p_lease uuid,p_report jsonb,p_answer text,p_ttl integer) returns void
language plpgsql security definer set search_path='' as $$
declare job public.external_research_jobs%rowtype;r public.external_research_runs%rowtype;s jsonb;c jsonb;sid text;begin
 select * into job from public.external_research_jobs where run_id=p_run for update;
 select * into r from public.external_research_runs where id=p_run for update;
 if job.lease_token is distinct from p_lease or r.status<>'RUNNING' then raise exception 'EXTERNAL_LEASE_CHANGED';end if;
 if not exists(select 1 from public.company_members where company_id=r.company_id and user_id=r.user_id) or exists(select 1 from public.external_preferences where company_id=r.company_id and user_id=r.user_id and (not enabled or sensitive_mode)) then raise exception 'EXTERNAL_ACCESS_DENIED';end if;
 if jsonb_typeof(p_report->'sources')<>'array' or jsonb_typeof(p_report->'claims')<>'array' or length(p_report::text)>150000 then raise exception 'EXTERNAL_INVALID_REPORT';end if;
 for s in select * from jsonb_array_elements(p_report->'sources') loop
 insert into public.external_sources(research_run_id,company_id,id,url,metadata) values(r.id,r.company_id,s->>'id',s->>'url',s);end loop;
 for c in select * from jsonb_array_elements(p_report->'claims') loop
 if jsonb_array_length(c->'sourceIds')<1 then raise exception 'EXTERNAL_UNCITED_CLAIM';end if;
 insert into public.external_claims(research_run_id,company_id,id,payload) values(r.id,r.company_id,c->>'id',c);
 for sid in select jsonb_array_elements_text(c->'sourceIds') loop insert into public.external_claim_sources(research_run_id,company_id,claim_id,source_id) values(r.id,r.company_id,c->>'id',sid);end loop;end loop;
 update public.external_research_runs set estimated_cost=(select case when count(*) filter(where cost_status='UNKNOWN')>0 then null else sum(estimated_total_cost_usd) end from public.usage_logs where company_id=r.company_id and (router_decision->>'external_key' in (r.id::text,r.request_id::text))),latency_ms=least(2147483647,(extract(epoch from(now()-r.created_at))*1000)::bigint),report=p_report,status=case when (p_report->>'partial')::boolean then 'PARTIAL' else 'COMPLETED' end,completed_at=now(),updated_at=now(),expires_at=now()+make_interval(secs=>greatest(0,p_ttl)),source_count=jsonb_array_length(p_report->'sources'),tool_calls=coalesce((job.evidence->>'calls')::integer,0) where id=r.id;
 update public.messages set content=left(p_answer,12000) where conversation_id=r.conversation_id and request_id=r.request_id and role='assistant';
 insert into public.external_events(company_id,user_id,run_id,kind,metadata) values(r.company_id,r.user_id,r.id,'external_research_completed',jsonb_build_object('sources',jsonb_array_length(p_report->'sources')));
 update public.external_research_jobs set internal_context='',evidence=null,provider_state=null,cached_report=null,lease_token=null,lease_until=null where run_id=r.id;
end $$;
revoke all on function public.reserve_external_ai(uuid,uuid,uuid,numeric,text,text),public.queue_external_research(uuid,uuid,uuid,uuid,uuid,integer,text,text,jsonb,text,text),public.claim_external_job(uuid),public.finish_external_job(uuid,uuid,jsonb,text,integer) from public,anon,authenticated;
grant execute on function public.reserve_external_ai(uuid,uuid,uuid,numeric,text,text),public.queue_external_research(uuid,uuid,uuid,uuid,uuid,integer,text,text,jsonb,text,text),public.claim_external_job(uuid),public.finish_external_job(uuid,uuid,jsonb,text,integer) to service_role;
-- Watchlists are opt-in and bounded; one due watch is claimed per scheduler invocation.
alter table public.external_watchlist add column previous_result_id uuid references public.external_research_runs(id) on delete set null;
alter table public.external_watchlist add column last_result_id uuid references public.external_research_runs(id) on delete set null;
alter table public.external_research_runs add column watch_id uuid references public.external_watchlist(id) on delete set null;
create function public.claim_external_watch() returns setof public.external_watchlist language plpgsql security definer set search_path='' as $$
declare w uuid;begin
 select id into w from public.external_watchlist where enabled and next_run_at<=now() order by next_run_at for update skip locked limit 1;
 if w is null then return;end if;
 return query update public.external_watchlist set next_run_at=now()+make_interval(days=>frequency_days),last_run_at=now() where id=w returning *;
end $$;
create function public.enqueue_external_watch_run(p_watch uuid,p_run uuid,p_plan jsonb,p_context text,p_cache_key text) returns void language plpgsql security definer set search_path='' as $$
declare w public.external_watchlist%rowtype;begin
 select * into w from public.external_watchlist where id=p_watch and enabled for update;if w.id is null then raise exception 'EXTERNAL_WATCH_DISABLED';end if;
 if not exists(select 1 from public.company_members where company_id=w.company_id and user_id=w.user_id) or exists(select 1 from public.external_preferences where company_id=w.company_id and user_id=w.user_id and(not enabled or sensitive_mode)) then raise exception 'EXTERNAL_ACCESS_DENIED';end if;
 if public.commercial_usage(w.user_id,'lifetime')->>'plan'<>'PRO' then raise exception 'PRO_REQUIRED';end if;
 if exists(select 1 from public.external_research_runs where watch_id=w.id and status in ('QUEUED','RUNNING')) then return;end if;
 insert into public.external_research_runs(id,company_id,user_id,request_id,trigger_type,depth,sanitized_query,cache_key,locale,market_code,watch_id) values(p_run,w.company_id,w.user_id,gen_random_uuid(),'RADAR_ENRICHMENT',p_plan->>'depth',p_plan->>'query',p_cache_key,p_plan->>'locale',p_plan->>'country',w.id);
 insert into public.external_research_jobs(run_id,company_id,plan,internal_context) values(p_run,w.company_id,p_plan,p_context);
end $$;
create function public.external_report_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status in ('COMPLETED','PARTIAL') and old.status='RUNNING' and new.watch_id is not null then
 update public.external_watchlist set previous_result_id=coalesce(last_result_id,run_id),last_result_id=new.id where id=new.watch_id and company_id=new.company_id;
 end if;
 insert into public.radar_company_state(company_id,next_scan_at) values(new.company_id,now()) on conflict(company_id) do update set generation=public.radar_company_state.generation+1,next_scan_at=now();
 return new;
end $$;
create trigger external_report_to_radar after update of report,feedback on public.external_research_runs for each row execute function public.external_report_changed();
-- Expand the existing Radar provenance contract, keeping its gate and surfacing limits.
alter table public.radar_signals drop constraint radar_signals_payload_check;
alter table public.radar_signals add constraint radar_signals_payload_check check(jsonb_typeof(payload)='object' and payload->>'knowledge_source_scope' in ('INTERNAL','EXTERNAL_INTELLIGENCE'));
do $$ declare f text;begin
 f:=pg_get_functiondef('public.apply_radar_job(uuid,uuid,bigint,jsonb,jsonb,jsonb,boolean,integer)'::regprocedure);
 f:=replace(f,'x->''signal''->>''knowledge_source_scope'' is distinct from ''INTERNAL''','coalesce(x->''signal''->>''knowledge_source_scope'','''') not in (''INTERNAL'',''EXTERNAL_INTELLIGENCE'')');
 f:=replace(f,'h:=md5((x->''signal'')::text);','if x->''signal''->>''knowledge_source_scope''=''EXTERNAL_INTELLIGENCE'' and not exists(select 1 from public.external_research_runs er where er.company_id=p_company and er.id=(x->''signal''->''evidence''->0->>''id'')::uuid and er.status in (''COMPLETED'',''PARTIAL'')) then raise exception ''EXTERNAL_ACCESS_DENIED'';end if; h:=md5((x->''signal'')::text);');
 execute f;
end $$;
revoke all on function public.claim_external_watch(),public.enqueue_external_watch_run(uuid,uuid,jsonb,text,text),public.external_report_changed() from public,anon,authenticated;
grant execute on function public.claim_external_watch(),public.enqueue_external_watch_run(uuid,uuid,jsonb,text,text) to service_role;

create function public.invalidate_external_radar() returns trigger language plpgsql security definer set search_path='' as $$
declare c uuid;rid uuid;begin
 if TG_OP='UPDATE' and new.feedback not in ('STALE','WRONG_MARKET') then return new;end if;
 c:=old.company_id;rid:=old.id;
 delete from public.radar_insights ri where ri.company_id=c and exists(select 1 from public.radar_signals rs where rs.company_id=c and rs.id=any(ri.signal_ids) and rs.payload->>'knowledge_source_scope'='EXTERNAL_INTELLIGENCE' and rs.payload->'evidence' @> jsonb_build_array(jsonb_build_object('id',rid::text)));
 delete from public.radar_signals rs where rs.company_id=c and rs.payload->>'knowledge_source_scope'='EXTERNAL_INTELLIGENCE' and rs.payload->'evidence' @> jsonb_build_array(jsonb_build_object('id',rid::text));
 if TG_OP='DELETE' then return old;end if;return new;
end $$;
create trigger external_radar_invalidation before delete or update of feedback on public.external_research_runs for each row execute function public.invalidate_external_radar();
revoke all on function public.invalidate_external_radar() from public,anon,authenticated;
commit;
