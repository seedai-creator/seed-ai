-- Local preparation only. No scheduler is installed by this migration.
-- Thirty elapsed days from registration; the server clock cannot be overridden.
create index seedai_waitlist_audit_lead on public.seedai_waitlist_audit(lead_id);
grant delete on public.seedai_waitlist_audit to service_role;

create function public.seedai_waitlist_retention(p_dry_run boolean default true, p_batch integer default 500)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 v_cutoff timestamptz := transaction_timestamp() - interval '720 hours';
 v_ids uuid[];
 v_deleted integer := 0;
 v_audit_deleted integer := 0;
 v_remaining boolean;
begin
 if p_dry_run is null or p_batch is null or p_batch not between 1 and 1000 then
  raise exception 'invalid retention arguments';
 end if;
 -- Serialize maintenance runs. Registration and withdrawal retain their own locks.
 perform pg_catalog.pg_advisory_xact_lock(813307261);
 if p_dry_run then
  select coalesce(array_agg(id),'{}'::uuid[]) into v_ids from (
   select id from public.seedai_waitlist_leads where created_at <= v_cutoff order by created_at,id limit p_batch
  ) candidates;
 else
  select coalesce(array_agg(id),'{}'::uuid[]) into v_ids from (
   select id from public.seedai_waitlist_leads where created_at <= v_cutoff order by created_at,id limit p_batch for update skip locked
  ) candidates;
  delete from public.seedai_waitlist_audit where lead_id=any(v_ids);
  get diagnostics v_audit_deleted = row_count;
  -- Consent records are removed by the existing ON DELETE CASCADE.
  delete from public.seedai_waitlist_leads where id=any(v_ids) and created_at <= v_cutoff;
  get diagnostics v_deleted = row_count;
 end if;
 select exists(select 1 from public.seedai_waitlist_leads where created_at <= v_cutoff) into v_remaining;
 return jsonb_build_object('dry_run',p_dry_run,'retention_days',30,'cutoff',v_cutoff,
  'candidates',cardinality(v_ids),'deleted',v_deleted,'audit_deleted',v_audit_deleted,'expired_remaining',v_remaining);
 -- No names, contacts, lead IDs or hashes are returned. Suppressions are untouched.
end; $$;
revoke all on function public.seedai_waitlist_retention(boolean,integer) from public,anon,authenticated;
grant execute on function public.seedai_waitlist_retention(boolean,integer) to service_role;
