begin;
-- Minimal application access record, NOT chat, audit, billing or analytics data.
-- Collection stays disabled until explicitly configured on the deployed server.
create table public.application_access_logs (
 id uuid primary key,
 occurred_at timestamptz not null default now(),
 ip inet not null check(masklen(ip)=case family(ip) when 4 then 32 else 128 end),
 expires_at timestamptz not null,
 hold_until timestamptz,
 hold_reference uuid,
 check((hold_until is null)=(hold_reference is null))
);
create index application_access_expiry on public.application_access_logs(expires_at);
alter table public.application_access_logs enable row level security;
revoke all on public.application_access_logs from public,anon,authenticated,service_role;
comment on table public.application_access_logs is 'Restricted IP/time records. No URL, query, content, user, cookie, token or headers. Six calendar months; documented hold may extend retention.';

create function public.guard_access_record() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then
  new.expires_at:=((new.occurred_at at time zone 'UTC')+interval '6 months') at time zone 'UTC';
 elsif row(new.id,new.ip,new.occurred_at,new.expires_at) is distinct from row(old.id,old.ip,old.occurred_at,old.expires_at) then
  raise exception 'Access evidence is immutable';
 end if;
 return new;
end $$;
revoke all on function public.guard_access_record() from public,anon,authenticated;
create trigger immutable_access_record before insert or update on public.application_access_logs for each row execute function public.guard_access_record();

create function public.record_application_access(p_id uuid,p_ip inet) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_id is null or p_ip is null then raise exception 'Access metadata required'; end if;
 insert into public.application_access_logs(id,ip,expires_at) values(p_id,p_ip,now()) on conflict(id) do nothing;
end $$;
revoke all on function public.record_application_access(uuid,inet) from public,anon,authenticated;
grant execute on function public.record_application_access(uuid,inet) to service_role;

-- A bounded operation over this table ONLY; held records are never discarded.
-- Default is a dry run. Returned values contain counts, no IP or identifiers.
create function public.prune_application_access(p_dry_run boolean default true,p_batch integer default 1000) returns jsonb
language plpgsql security definer set search_path='' as $$
declare due integer; removed integer:=0;
begin
 if p_dry_run is null or p_batch is null or p_batch not between 1 and 1000 then raise exception 'Invalid retention request'; end if;
 perform pg_advisory_xact_lock(9130017);
 select count(*) into due from (select id from public.application_access_logs where expires_at<=now()
  and (hold_until is null or hold_until<=now()) order by expires_at limit p_batch) candidates;
 if not p_dry_run then
  delete from public.application_access_logs where id in (select id from public.application_access_logs
   where expires_at<=now() and (hold_until is null or hold_until<=now()) order by expires_at limit p_batch for update);
  get diagnostics removed=row_count;
 end if;
 return jsonb_build_object('dry_run',p_dry_run,'eligible_in_batch',due,'deleted',removed,'batch_limit',p_batch);
end $$;
revoke all on function public.prune_application_access(boolean,integer) from public,anon,authenticated;
grant execute on function public.prune_application_access(boolean,integer) to service_role;
commit;
