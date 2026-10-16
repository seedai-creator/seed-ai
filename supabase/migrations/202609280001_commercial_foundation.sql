begin;
-- Additive foundation. No existing company, membership or business record is changed.
create table public.commercial_plans (
 code text primary key check(code in ('FREE','PRO','BUSINESS','PARTNER','ADVISORY','ENTERPRISE')),
 available boolean not null default false,
 company_limit integer not null check(company_limit>0), strategy_limit integer check(strategy_limit>=0),
 flags jsonb not null check(jsonb_typeof(flags)='object'), policy jsonb not null check(jsonb_typeof(policy)='object'),
 version integer not null default 1, updated_at timestamptz not null default now()
);
create table public.commercial_markets (
 code text primary key check(code in ('BR','PT','ES','US')), name text not null,
 locale text not null, currency text not null check(currency in ('BRL','EUR','USD')), timezone text not null,
 status text not null check(status in ('DRAFT','READY','ACTIVE','PAUSED','DISABLED')),
 signup_enabled boolean not null default false, free_enabled boolean not null default false,
 pro_enabled boolean not null default false, billing_enabled boolean not null default false,
 disable_new_signups boolean not null default false, disable_new_subscriptions boolean not null default false,
 disable_ai_requests boolean not null default false, flags jsonb not null default '{}', readiness jsonb not null default '{}',
 version integer not null default 1, updated_at timestamptz not null default now()
);
create table public.commercial_prices (
 id uuid primary key default gen_random_uuid(), plan_code text not null references public.commercial_plans,
 market_code text not null references public.commercial_markets, currency text not null,
 amount_minor bigint not null check(amount_minor>0), billing_interval text not null default 'month' check(billing_interval='month'),
 provider text not null default 'stripe' check(provider in ('stripe','apple','google','manual','future_provider')),
 provider_product_id text, provider_price_id text unique, status text not null check(status in ('ACTIVE','INACTIVE')),
 is_planning_hypothesis boolean not null default false, effective_from timestamptz not null default now(), effective_to timestamptz,
 check(effective_to is null or effective_to>effective_from)
);
create unique index one_open_market_price on public.commercial_prices(plan_code,market_code,provider) where effective_to is null;
create table public.commercial_accounts (
 user_id uuid primary key references public.profiles on delete cascade, market_code text references public.commercial_markets,
 activated_at timestamptz, created_at timestamptz not null default now()
);
create table public.admin_roles (
 user_id uuid primary key references public.profiles on delete cascade,
 role text not null check(role in ('ADMIN_VIEWER','ADMIN_OPERATOR','SUPER_ADMIN')),
 created_at timestamptz not null default now()
);
create table public.commercial_overrides (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles on delete cascade,
 kind text not null check(kind in ('INTERNAL','BETA','FOUNDER','TEMPORARY_PRO','CUSTOM_ALLOWANCE')),
 settings jsonb not null, expires_at timestamptz not null, reason text not null check(length(btrim(reason))>0),
 created_by uuid not null references public.profiles, created_at timestamptz not null default now(), revoked_at timestamptz,
 check(expires_at>created_at)
);
create table public.subscriptions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles,
 company_id uuid references public.companies, plan_code text not null references public.commercial_plans,
 market_code text not null references public.commercial_markets, provider text not null check(provider in ('stripe','apple','google','manual','future_provider')),
 provider_customer_id text, provider_subscription_id text unique, status text not null check(status in ('free','trialing','active','past_due','canceled','incomplete','incomplete_expired','unpaid','paused')),
 currency text not null, amount_minor bigint not null check(amount_minor>=0), billing_interval text not null default 'month',
 price_id uuid references public.commercial_prices, current_period_start timestamptz, current_period_end timestamptz,
 cancel_at_period_end boolean not null default false, canceled_at timestamptz, provider_updated_at bigint not null default 0,
 livemode boolean not null default false check(livemode=false), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.ai_model_pricing (
 id uuid primary key default gen_random_uuid(), provider text not null, model text not null,
 effective_from timestamptz not null, effective_to timestamptz,
 input_per_million numeric(18,6) not null check(input_per_million>=0),
 cached_per_million numeric(18,6) check(cached_per_million>=0), output_per_million numeric(18,6) not null check(output_per_million>=0),
 currency text not null default 'USD' check(currency='USD'), processing_tier text not null default 'default', context_tier text not null default 'standard',
 metadata jsonb not null default '{}', check(effective_to is null or effective_to>effective_from)
);
create unique index one_open_ai_price on public.ai_model_pricing(provider,model,processing_tier,context_tier) where effective_to is null;
create table public.ai_requests (
 id uuid primary key, user_id uuid not null references public.profiles, company_id uuid not null references public.companies,
 plan_code text not null references public.commercial_plans, market_code text not null references public.commercial_markets,
 status text not null check(status in ('RESERVED','COMPLETED','UNKNOWN','FAILED')), feature text not null default 'diagnosis', fingerprint text,
 reserved_usd numeric(24,12) not null check(reserved_usd>0), accounted_usd numeric(24,12) check(accounted_usd>=0),
 created_at timestamptz not null default now(), completed_at timestamptz
);
create index ai_requests_user_time on public.ai_requests(user_id,created_at);
create table public.usage_logs (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.ai_requests,
 user_id uuid not null references public.profiles, company_id uuid not null references public.companies,
 plan_code text not null, market_code text not null, feature text not null, provider text not null, model text not null,
 provider_request_id text, input_tokens bigint check(input_tokens>=0), cached_input_tokens bigint check(cached_input_tokens>=0),
 output_tokens bigint check(output_tokens>=0), reasoning_tokens bigint check(reasoning_tokens>=0), total_tokens bigint check(total_tokens>=0),
 pricing_id uuid references public.ai_model_pricing, estimated_input_cost_usd numeric(24,12), estimated_cached_cost_usd numeric(24,12),
 estimated_output_cost_usd numeric(24,12), estimated_tool_cost_usd numeric(24,12), estimated_total_cost_usd numeric(24,12),
 cost_status text not null check(cost_status in ('ESTIMATED','UNKNOWN','PENDING')), latency_ms integer check(latency_ms>=0),
 status text not null, error_code text, router_decision jsonb not null default '{}', created_at timestamptz not null default now(),
 unique(request_id,feature), check(cached_input_tokens<=input_tokens), check(reasoning_tokens<=output_tokens)
);
create table public.commercial_events (
 id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles, market_code text references public.commercial_markets,
 event text not null, dedupe_key text unique, created_at timestamptz not null default now()
);
create table public.billing_events (
 provider_event_id text primary key, event_type text not null, provider_created_at bigint not null,
 processed_at timestamptz not null default now()
);
create table public.admin_audit_log (
 id uuid primary key default gen_random_uuid(), actor uuid references public.profiles, action text not null,
 entity text not null, market_code text, old_state jsonb, new_state jsonb, reason text not null,
 created_at timestamptz not null default now()
);
create table public.commercial_settings (
 id text primary key, value jsonb not null, version integer not null default 1, updated_at timestamptz not null default now()
);
-- Test policies, not a claim of production profitability. No FX rates are seeded.
insert into public.commercial_plans(code,available,company_limit,strategy_limit,flags,policy) values
 ('FREE',true,1,1,'{"chat":true,"memory":true,"diagnosis":true,"strategies":true,"decisions":false,"experiments":false,"advanced_analysis":false}',
 '{"window":"lifetime","target_usd":0.10,"approaching_usd":0.12,"soft_usd":0.15,"warning_usd":0.18,"heavy_usd":0.22,"hard_usd":0.25,"interactions":30,"diagnoses":3,"max_concurrent":1,"requests_per_minute":6,"user_day_usd":0.25,"user_month_usd":0.25,"global_day_usd":10}'),
 ('PRO',true,1,null,'{"chat":true,"memory":true,"diagnosis":true,"strategies":true,"decisions":true,"experiments":true,"advanced_analysis":true}',
 '{"window":"month","target_usd":2,"approaching_usd":3,"soft_usd":4,"warning_usd":5,"heavy_usd":6,"hard_usd":8,"interactions":500,"diagnoses":200,"max_concurrent":1,"requests_per_minute":10,"user_day_usd":2,"user_month_usd":8,"global_day_usd":10}');
insert into public.commercial_markets(code,name,locale,currency,timezone,status,signup_enabled,free_enabled,pro_enabled,billing_enabled) values
 ('BR','Brasil','pt-BR','BRL','America/Sao_Paulo','ACTIVE',true,true,true,false),
 ('PT','Portugal','pt-PT','EUR','Europe/Lisbon','DRAFT',false,true,false,false),
 ('ES','España','es-ES','EUR','Europe/Madrid','DRAFT',false,true,false,false),
 ('US','United States','en-US','USD','America/New_York','DRAFT',false,true,false,false);
insert into public.commercial_prices(plan_code,market_code,currency,amount_minor,status,is_planning_hypothesis) values
 ('PRO','BR','BRL',9999,'ACTIVE',false),('PRO','PT','EUR',1999,'INACTIVE',true),('PRO','ES','EUR',1999,'INACTIVE',true),('PRO','US','USD',1999,'INACTIVE',true);
insert into public.commercial_settings values
 ('rollout','{"enabled":false,"environment":"test"}',1,now()),
 ('global_flags','{"growth_map":false,"weekly_checkin":false,"goals":false,"metrics":false,"reports":false}',1,now());
-- Do not infer commercial country from UI language or existing company facts.
insert into public.commercial_accounts(user_id) select id from public.profiles;

create function public.seed_admin_role() returns text language sql stable security definer set search_path='' as $$
 select role from public.admin_roles where user_id=auth.uid()
$$;
revoke all on function public.seed_admin_role() from public,anon;
grant execute on function public.seed_admin_role() to authenticated;

do $$ declare name text; begin
 foreach name in array array['commercial_plans','commercial_markets','commercial_prices','commercial_accounts','admin_roles','commercial_overrides','subscriptions','ai_model_pricing','ai_requests','usage_logs','commercial_events','billing_events','admin_audit_log','commercial_settings'] loop
  execute format('alter table public.%I enable row level security',name);
  execute format('revoke all on public.%I from anon,authenticated',name);
  execute format('grant select on public.%I to authenticated',name);
  execute format('create policy admin_read on public.%I for select to authenticated using (public.seed_admin_role() is not null)',name);
 end loop;
end $$;
create policy own_account on public.commercial_accounts for select to authenticated using(user_id=auth.uid());
create policy own_subscription on public.subscriptions for select to authenticated using(user_id=auth.uid());
create policy own_role on public.admin_roles for select to authenticated using(user_id=auth.uid());
-- Catalog is available after login. Account consumption and costs remain private.
create policy catalog_read on public.commercial_plans for select to authenticated using(true);
create policy catalog_read on public.commercial_markets for select to authenticated using(true);
create policy catalog_read on public.commercial_prices for select to authenticated using(true);
-- Trusted server operations only; browser cannot forge charges, usage or entitlements.
grant select,insert,update on public.commercial_accounts,public.subscriptions,public.ai_requests,public.usage_logs,public.commercial_events,public.billing_events to service_role;
grant select on public.commercial_plans,public.commercial_markets,public.commercial_prices,public.ai_model_pricing,public.commercial_overrides,public.commercial_settings,public.admin_roles to service_role;
commit;
