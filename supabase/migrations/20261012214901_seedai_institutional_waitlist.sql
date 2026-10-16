-- Isolated SeedAI institutional tables. No application tables/policies are changed.
create table public.seedai_waitlist_leads (
 id uuid primary key default gen_random_uuid(), campaign text not null,
 name text not null check (length(name) between 1 and 100),
 email text not null check(length(email)<=254), email_hash text not null,
 whatsapp text, phone_hash text, phone_country text,
 locale text not null check(locale in ('pt-BR','pt-PT','en-US','en-GB','es-ES','fr-FR')),
 email_optin boolean not null, whatsapp_optin boolean not null,
 email_state text not null default 'unverified' check(email_state in ('unverified','suppressed')),
 whatsapp_state text not null default 'unverified' check(whatsapp_state in ('unverified','suppressed')),
 attribution jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(campaign,email), check(whatsapp is null or whatsapp ~ '^\+[1-9][0-9]{6,14}$')
);
create index seedai_waitlist_created on public.seedai_waitlist_leads(created_at desc,id);
create table public.seedai_waitlist_consents (
 id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.seedai_waitlist_leads(id) on delete cascade,
 channel text not null check(channel in ('email','whatsapp')), event text not null check(event in ('grant','withdraw')),
 consent_text text not null, version text not null, locale text not null, created_at timestamptz not null default now()
);
create index seedai_waitlist_consent_lead on public.seedai_waitlist_consents(lead_id,created_at);
create table public.seedai_waitlist_suppressions (
 channel text not null check(channel in ('email','whatsapp')), contact_hash text not null,
 created_at timestamptz not null default now(), primary key(channel,contact_hash)
);
create table public.seedai_waitlist_audit (
 id uuid primary key default gen_random_uuid(), actor uuid not null, action text not null,
 lead_id uuid, created_at timestamptz not null default now()
);
create table public.seedai_waitlist_rate_limits (key_hash text primary key, hits integer not null, expires_at timestamptz not null);
create index seedai_waitlist_rate_expiry on public.seedai_waitlist_rate_limits(expires_at);
alter table public.seedai_waitlist_leads enable row level security;
alter table public.seedai_waitlist_consents enable row level security;
alter table public.seedai_waitlist_suppressions enable row level security;
alter table public.seedai_waitlist_audit enable row level security;
alter table public.seedai_waitlist_rate_limits enable row level security;
revoke all on public.seedai_waitlist_leads,public.seedai_waitlist_consents,public.seedai_waitlist_suppressions,public.seedai_waitlist_audit,public.seedai_waitlist_rate_limits from public,anon,authenticated;
grant select,insert,update,delete on public.seedai_waitlist_leads,public.seedai_waitlist_rate_limits to service_role;
grant select,insert on public.seedai_waitlist_consents,public.seedai_waitlist_suppressions,public.seedai_waitlist_audit to service_role;

create function public.seedai_waitlist_register(p_lead jsonb,p_campaign text,p_version text,p_email_text text,p_phone_text text)
returns void language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_email_suppressed boolean; v_phone_suppressed boolean;
begin
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
 if v_id is null then return; end if;
 if (p_lead->>'consentEmail')::boolean and not v_email_suppressed then
 insert into public.seedai_waitlist_consents(lead_id,channel,event,consent_text,version,locale) values(v_id,'email','grant',p_email_text,p_version,p_lead->>'locale'); end if;
 if (p_lead->>'consentWhatsapp')::boolean and not v_phone_suppressed then
 insert into public.seedai_waitlist_consents(lead_id,channel,event,consent_text,version,locale) values(v_id,'whatsapp','grant',p_phone_text,p_version,p_lead->>'locale'); end if;
end; $$;
create function public.seedai_waitlist_rate_limit(p_key text,p_max integer)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v_hits integer;
begin
 if length(p_key)<>64 or p_max not between 1 and 100 then raise exception 'invalid limit'; end if;
 delete from public.seedai_waitlist_rate_limits where expires_at<now()-interval '1 day';
 insert into public.seedai_waitlist_rate_limits(key_hash,hits,expires_at) values(p_key,1,now()+interval '15 minutes')
 on conflict(key_hash) do update set hits=case when seedai_waitlist_rate_limits.expires_at<now() then 1 else seedai_waitlist_rate_limits.hits+1 end,expires_at=case when seedai_waitlist_rate_limits.expires_at<now() then now()+interval '15 minutes' else seedai_waitlist_rate_limits.expires_at end returning hits into v_hits;
 return v_hits<=p_max;
end; $$;
create function public.seedai_waitlist_withdraw(p_id uuid,p_channel text,p_actor uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare v_lead public.seedai_waitlist_leads; v_changed record;
begin
 if p_channel not in ('email','whatsapp') or p_actor is null then raise exception 'invalid request'; end if;
 select * into strict v_lead from public.seedai_waitlist_leads where id=p_id;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('email:'||v_lead.email_hash,0));
 if v_lead.phone_hash is not null then perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('whatsapp:'||v_lead.phone_hash,0)); end if;
 select * into strict v_lead from public.seedai_waitlist_leads where id=p_id for update;
 if (p_channel='email' and not v_lead.email_optin) or (p_channel='whatsapp' and not v_lead.whatsapp_optin) then return; end if;
 insert into public.seedai_waitlist_suppressions(channel,contact_hash) values(p_channel,case when p_channel='email' then v_lead.email_hash else v_lead.phone_hash end) on conflict do nothing;
 for v_changed in update public.seedai_waitlist_leads set email_optin=case when p_channel='email' then false else email_optin end,whatsapp_optin=case when p_channel='whatsapp' then false else whatsapp_optin end,email_state=case when p_channel='email' then 'suppressed' else email_state end,whatsapp_state=case when p_channel='whatsapp' then 'suppressed' else whatsapp_state end,updated_at=now()
 where (p_channel='email' and email_hash=v_lead.email_hash and email_optin) or (p_channel='whatsapp' and phone_hash=v_lead.phone_hash and whatsapp_optin) returning id,locale loop
 insert into public.seedai_waitlist_consents(lead_id,channel,event,consent_text,version,locale) values(v_changed.id,p_channel,'withdraw','Withdrawal processed by authorized administrator','withdraw-v1',v_changed.locale);
 end loop;
 insert into public.seedai_waitlist_audit(actor,action,lead_id) values(p_actor,'withdraw:'||p_channel,p_id);
end; $$;
revoke all on function public.seedai_waitlist_register(jsonb,text,text,text,text),public.seedai_waitlist_rate_limit(text,integer),public.seedai_waitlist_withdraw(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.seedai_waitlist_register(jsonb,text,text,text,text),public.seedai_waitlist_rate_limit(text,integer),public.seedai_waitlist_withdraw(uuid,text,uuid) to service_role;
