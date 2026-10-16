-- Isolated waitlist lifecycle. No remote application performed.
create table public.seedai_waitlist_campaigns (
 id text primary key check(length(id) between 1 and 100),
 created_at timestamptz not null default now(), closed_at timestamptz
);
create table public.seedai_waitlist_suppression_campaigns (
 channel text not null, contact_hash text not null,
 campaign text not null references public.seedai_waitlist_campaigns(id),
 primary key(channel,contact_hash,campaign),
 foreign key(channel,contact_hash) references public.seedai_waitlist_suppressions(channel,contact_hash) on delete cascade
);
create index seedai_waitlist_suppression_campaign on public.seedai_waitlist_suppression_campaigns(campaign);
alter table public.seedai_waitlist_suppressions add column legacy_unresolved boolean not null default false;
insert into public.seedai_waitlist_campaigns(id) select distinct campaign from public.seedai_waitlist_leads;
insert into public.seedai_waitlist_suppression_campaigns(channel,contact_hash,campaign)
 select distinct s.channel,s.contact_hash,l.campaign from public.seedai_waitlist_suppressions s
 join public.seedai_waitlist_leads l on (s.channel='email' and s.contact_hash=l.email_hash) or (s.channel='whatsapp' and s.contact_hash=l.phone_hash);
-- Historic records may have lost OTHER campaign associations after lead cleanup.
-- Never infer complete provenance from remaining leads.
update public.seedai_waitlist_suppressions set legacy_unresolved=true;
alter table public.seedai_waitlist_campaigns enable row level security;
alter table public.seedai_waitlist_suppression_campaigns enable row level security;
revoke all on public.seedai_waitlist_campaigns,public.seedai_waitlist_suppression_campaigns from public,anon,authenticated;
grant select,insert,update on public.seedai_waitlist_campaigns to service_role;
grant select,insert,delete on public.seedai_waitlist_suppression_campaigns to service_role;
grant delete on public.seedai_waitlist_suppressions to service_role;
create or replace function public.seedai_waitlist_register(p_lead jsonb,p_campaign text,p_version text,p_email_text text,p_phone_text text)
returns void language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_email_suppressed boolean; v_phone_suppressed boolean;
begin
 perform pg_catalog.pg_advisory_xact_lock(813307262);
 if p_campaign is null or length(p_campaign) not between 1 and 100 then raise exception 'invalid campaign'; end if;
 insert into public.seedai_waitlist_campaigns(id) values(p_campaign) on conflict do nothing;
 if exists(select 1 from public.seedai_waitlist_campaigns where id=p_campaign and closed_at is not null) then raise exception 'campaign closed'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('email:'||(p_lead->>'emailHash'),0));
 if p_lead->>'phoneHash' is not null then perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('whatsapp:'||(p_lead->>'phoneHash'),0)); end if;
 if not coalesce((p_lead->>'consentEmail')::boolean,false) and not coalesce((p_lead->>'consentWhatsapp')::boolean,false) then raise exception 'consent required'; end if;
 if (p_lead->>'consentWhatsapp')::boolean and nullif(p_lead->>'whatsapp','') is null then raise exception 'phone required'; end if;
 if length(p_campaign) not between 1 and 100 or length(p_version) not between 1 and 100 then raise exception 'invalid configuration'; end if;
 select exists(select 1 from public.seedai_waitlist_suppressions where channel='email' and contact_hash=p_lead->>'emailHash') into v_email_suppressed;
 select exists(select 1 from public.seedai_waitlist_suppressions where channel='whatsapp' and contact_hash=p_lead->>'phoneHash') into v_phone_suppressed;
 insert into public.seedai_waitlist_leads(campaign,name,email,email_hash,whatsapp,phone_hash,phone_country,locale,email_optin,whatsapp_optin,email_state,whatsapp_state,attribution)
 values(p_campaign,p_lead->>'name',lower(p_lead->>'email'),p_lead->>'emailHash',case when (p_lead->>'consentWhatsapp')::boolean then p_lead->>'whatsapp' end,case when (p_lead->>'consentWhatsapp')::boolean then p_lead->>'phoneHash' end,p_lead->>'phoneCountry',p_lead->>'locale',(p_lead->>'consentEmail')::boolean and not v_email_suppressed,(p_lead->>'consentWhatsapp')::boolean and not v_phone_suppressed,case when v_email_suppressed then 'suppressed' else 'unverified' end,case when v_phone_suppressed then 'suppressed' else 'unverified' end,coalesce(p_lead->'attribution','{}'))
 on conflict(campaign,email) do nothing returning id into v_id;
 insert into public.seedai_waitlist_suppression_campaigns(channel,contact_hash,campaign)
 select channel,contact_hash,p_campaign from public.seedai_waitlist_suppressions
 where (channel='email' and contact_hash=p_lead->>'emailHash') or (channel='whatsapp' and contact_hash=p_lead->>'phoneHash') on conflict do nothing;
 if v_id is null then return; end if;
 if (p_lead->>'consentEmail')::boolean and not v_email_suppressed then
 insert into public.seedai_waitlist_consents(lead_id,channel,event,consent_text,version,locale) values(v_id,'email','grant',p_email_text,p_version,p_lead->>'locale'); end if;
 if (p_lead->>'consentWhatsapp')::boolean and not v_phone_suppressed then
 insert into public.seedai_waitlist_consents(lead_id,channel,event,consent_text,version,locale) values(v_id,'whatsapp','grant',p_phone_text,p_version,p_lead->>'locale'); end if;
end; $$;
create or replace function public.seedai_waitlist_withdraw(p_id uuid,p_channel text,p_actor uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare v_lead public.seedai_waitlist_leads; v_changed record;
begin
 perform pg_catalog.pg_advisory_xact_lock(813307262);
 if p_channel not in ('email','whatsapp') or p_actor is null then raise exception 'invalid request'; end if;
 select * into strict v_lead from public.seedai_waitlist_leads where id=p_id;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('email:'||v_lead.email_hash,0));
 if v_lead.phone_hash is not null then perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('whatsapp:'||v_lead.phone_hash,0)); end if;
 select * into strict v_lead from public.seedai_waitlist_leads where id=p_id for update;
 if (p_channel='email' and not v_lead.email_optin) or (p_channel='whatsapp' and not v_lead.whatsapp_optin) then return; end if;
 insert into public.seedai_waitlist_suppressions(channel,contact_hash) values(p_channel,case when p_channel='email' then v_lead.email_hash else v_lead.phone_hash end) on conflict do nothing;
 insert into public.seedai_waitlist_suppression_campaigns(channel,contact_hash,campaign)
 select distinct p_channel,case when p_channel='email' then email_hash else phone_hash end,campaign
 from public.seedai_waitlist_leads where (p_channel='email' and email_hash=v_lead.email_hash) or (p_channel='whatsapp' and phone_hash=v_lead.phone_hash) on conflict do nothing;
 for v_changed in update public.seedai_waitlist_leads set email_optin=case when p_channel='email' then false else email_optin end,whatsapp_optin=case when p_channel='whatsapp' then false else whatsapp_optin end,email_state=case when p_channel='email' then 'suppressed' else email_state end,whatsapp_state=case when p_channel='whatsapp' then 'suppressed' else whatsapp_state end,updated_at=now()
 where (p_channel='email' and email_hash=v_lead.email_hash and email_optin) or (p_channel='whatsapp' and phone_hash=v_lead.phone_hash and whatsapp_optin) returning id,locale loop
 insert into public.seedai_waitlist_consents(lead_id,channel,event,consent_text,version,locale) values(v_changed.id,p_channel,'withdraw','Withdrawal processed by authorized administrator','withdraw-v1',v_changed.locale);
 end loop;
 insert into public.seedai_waitlist_audit(actor,action,lead_id) values(p_actor,'withdraw:'||p_channel,p_id);
end; $$;

create function public.seedai_waitlist_close_campaign(p_campaign text)
returns timestamptz language plpgsql security invoker set search_path='' as $$
declare v_closed timestamptz;
begin
 perform pg_catalog.pg_advisory_xact_lock(813307262);
 update public.seedai_waitlist_campaigns set closed_at=coalesce(closed_at,clock_timestamp()) where id=p_campaign returning closed_at into v_closed;
 if not found then raise exception 'unknown campaign'; end if;
 return v_closed;
end; $$;
create function public.seedai_waitlist_suppression_retention(p_dry_run boolean default true,p_batch integer default 500)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_count integer; v_deleted integer:=0; v_item record; v_remaining boolean; v_unresolved bigint;
begin
 if p_dry_run is null or p_batch is null or p_batch not between 1 and 1000 then raise exception 'invalid retention arguments'; end if;
 perform pg_catalog.pg_advisory_xact_lock(813307262);
 v_count:=0;
 for v_item in select s.channel,s.contact_hash from public.seedai_waitlist_suppressions s
 where not s.legacy_unresolved
 and exists(select 1 from public.seedai_waitlist_suppression_campaigns l where l.channel=s.channel and l.contact_hash=s.contact_hash)
 and not exists(select 1 from public.seedai_waitlist_suppression_campaigns l join public.seedai_waitlist_campaigns c on c.id=l.campaign
 where l.channel=s.channel and l.contact_hash=s.contact_hash and (c.closed_at is null or c.closed_at>statement_timestamp()-interval '720 hours'))
 order by s.created_at,s.channel,s.contact_hash limit p_batch loop
 v_count:=v_count+1;
 if not p_dry_run then
 delete from public.seedai_waitlist_suppressions where channel=v_item.channel and contact_hash=v_item.contact_hash;
 v_deleted:=v_deleted+1;
 end if;
 end loop;
 select exists(select 1 from public.seedai_waitlist_suppressions s where not s.legacy_unresolved
 and exists(select 1 from public.seedai_waitlist_suppression_campaigns l where l.channel=s.channel and l.contact_hash=s.contact_hash)
 and not exists(select 1 from public.seedai_waitlist_suppression_campaigns l join public.seedai_waitlist_campaigns c on c.id=l.campaign
 where l.channel=s.channel and l.contact_hash=s.contact_hash and (c.closed_at is null or c.closed_at>statement_timestamp()-interval '720 hours'))) into v_remaining;
 select count(*) into v_unresolved from public.seedai_waitlist_suppressions where legacy_unresolved;
 return jsonb_build_object('dry_run',p_dry_run,'retention_days',30,'candidates',v_count,'deleted',v_deleted,'expired_remaining',v_remaining,'legacy_unresolved',v_unresolved);
end; $$;
revoke all on function public.seedai_waitlist_close_campaign(text),public.seedai_waitlist_suppression_retention(boolean,integer) from public,anon,authenticated;
grant execute on function public.seedai_waitlist_close_campaign(text),public.seedai_waitlist_suppression_retention(boolean,integer) to service_role;
