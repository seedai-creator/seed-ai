begin;

-- Immutable contract versions. Availability is independent of existing access.
-- No price, market, subscription or billing switch is activated by this migration.
create table public.commercial_offers (
 id text primary key,
 code text not null check(code in ('PRO_1','PRO_3','PRO_5')),
 version integer not null check(version>0),
 plan_code text not null default 'PRO' references public.commercial_plans,
 market_code text not null default 'BR' references public.commercial_markets,
 currency text not null default 'BRL', amount_minor bigint not null check(amount_minor>0),
 company_limit integer not null check(company_limit in (1,3,5)),
 policy jsonb not null,
 available boolean not null default false,
 created_at timestamptz not null default now(),
 unique(code,version), check(plan_code='PRO' and market_code='BR' and currency='BRL'),
 check(id=code||'_V'||version::text),
 check(jsonb_typeof(policy)='object' and policy->>'analysis_limit_mode'='budget' and policy->>'window'='month')
);
alter table public.commercial_offers enable row level security;
revoke all on public.commercial_offers from public,anon,authenticated;
grant select on public.commercial_offers to service_role;

insert into public.commercial_offers(id,code,version,amount_minor,company_limit,policy)
select code||'_V1',code,1,amount,companies,jsonb_build_object(
 'window','month','analysis_limit_mode','budget',
 'target_usd',cap*0.5,'approaching_usd',cap*0.7,'soft_usd',cap*0.8,
 'warning_usd',cap*0.85,'heavy_usd',cap*0.95,'hard_usd',cap,
 'interactions',200,'diagnoses',200,'max_concurrent',1,'requests_per_minute',10,
 'user_day_usd',cap,'user_month_usd',cap,'global_day_usd',10)
from (values('PRO_1',9999,1,4),('PRO_3',19999,3,8),('PRO_5',39999,5,16)) as v(code,amount,companies,cap);

create function public.guard_offer_version() returns trigger
language plpgsql set search_path='' as $$
begin
 if (to_jsonb(new)-'available') is distinct from (to_jsonb(old)-'available') then
  raise exception 'Create a new offer version; contracts are immutable';
 end if;
 return new;
end $$;
revoke all on function public.guard_offer_version() from public,anon,authenticated;
create trigger immutable_offer before update on public.commercial_offers for each row execute function public.guard_offer_version();

alter table public.commercial_prices add column offer_id text references public.commercial_offers;
create index commercial_prices_offer on public.commercial_prices(offer_id) where offer_id is not null;
drop index public.one_open_market_price;
create unique index one_open_market_price on public.commercial_prices(plan_code,market_code,provider)
 where effective_to is null and offer_id is null;
create unique index one_open_offer_price on public.commercial_prices(offer_id,provider)
 where effective_to is null and offer_id is not null;

create function public.guard_offer_price() returns trigger
language plpgsql security definer set search_path='' as $$
declare offer public.commercial_offers%rowtype;
begin
 -- Never rebind an old price to a new contract, including legacy prices.
 if tg_op='UPDATE' and new.offer_id is distinct from old.offer_id then raise exception 'Price offer is immutable'; end if;
 if new.offer_id is null then return new; end if;
 select * into offer from public.commercial_offers where id=new.offer_id;
 if not found or new.plan_code<>offer.plan_code or new.market_code<>offer.market_code
  or new.currency<>offer.currency or new.amount_minor<>offer.amount_minor
  or new.billing_interval<>'month' or new.provider<>'stripe' then raise exception 'Offer price mismatch'; end if;
 if tg_op='UPDATE' and (new.provider_price_id is distinct from old.provider_price_id
   or new.provider_product_id is distinct from old.provider_product_id) then raise exception 'Provider mapping is immutable'; end if;
 return new;
end $$;
revoke all on function public.guard_offer_price() from public,anon,authenticated;
create trigger validated_offer_price before insert or update on public.commercial_prices for each row execute function public.guard_offer_price();

-- Single resolver for company creation, AI reservations and application UI.
-- Billing events still derive price_id from verified provider data + checkout.
create function public.commercial_effective_plan(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare plan public.commercial_plans%rowtype; sub public.subscriptions%rowtype;
 ov public.commercial_overrides%rowtype; offer public.commercial_offers%rowtype; result jsonb;
begin
 select * into sub from public.subscriptions where user_id=p_user
  and status in ('active','trialing') and current_period_end>now() order by current_period_end desc limit 1;
 if found and (sub.current_period_start is null or sub.current_period_start>now()
  or sub.current_period_start>=sub.current_period_end) then raise exception 'Subscription period unavailable'; end if;
 select * into ov from public.commercial_overrides where user_id=p_user and revoked_at is null
  and expires_at>now() order by created_at desc limit 1;
 select * into plan from public.commercial_plans where code=coalesce(ov.settings->>'plan_code',sub.plan_code,'FREE') and available;
 if not found then raise exception 'Plan unavailable'; end if;
 result:=to_jsonb(plan);
 if sub.id is not null and plan.code=sub.plan_code then
  select o.* into offer from public.commercial_prices p join public.commercial_offers o on o.id=p.offer_id where p.id=sub.price_id;
  if found then result:=result||jsonb_build_object('company_limit',offer.company_limit,'policy',offer.policy,'offer_id',offer.id); end if;
 end if;
 if ov.settings ? 'policy' then result:=result||jsonb_build_object('policy',ov.settings->'policy'); end if;
 return result;
end $$;
revoke all on function public.commercial_effective_plan(uuid) from public,anon,authenticated;
grant execute on function public.commercial_effective_plan(uuid) to service_role;

-- Guarded replacements preserve the existing concurrency, retention of history,
-- legacy contracts, cycle accounting, kill switches and authenticated checks.
do $$ declare definition text; fragment text;
begin
 definition:=pg_get_functiondef('public.guard_commercial_insert()'::regprocedure);
 fragment:='select * into plan from public.commercial_plans where code=public.commercial_user_plan(uid) and available;';
 if position(fragment in definition)=0 then raise exception 'Company guard definition changed'; end if;
 execute replace(definition,fragment,'select * into plan from jsonb_populate_record(null::public.commercial_plans,public.commercial_effective_plan(uid));');

 definition:=pg_get_functiondef('public.commercial_usage(uuid,text)'::regprocedure);
 fragment:='select p.policy into policy from public.commercial_plans p where p.code=plan and available;';
 if position(fragment in definition)=0 then raise exception 'Usage definition changed'; end if;
 execute replace(definition,fragment,'policy:=public.commercial_effective_plan(p_user)->''policy'';');

 definition:=pg_get_functiondef('public.begin_checkout(uuid,text,uuid)'::regprocedure);
 fragment:='select * into found_row from public.checkout_attempts';
 if position(fragment in definition)=0 then raise exception 'Checkout definition changed'; end if;
 execute replace(definition,fragment,
  'if exists(select 1 from public.commercial_prices p join public.commercial_offers o on o.id=p.offer_id where p.id=p_price and not o.available) then raise exception ''Offer unavailable''; end if; '||fragment);

 definition:=pg_get_functiondef('public.apply_billing_event(text,text,bigint,jsonb)'::regprocedure);
 fragment:='if found and (existing.user_id<>uid or existing.provider_customer_id<>p_subscription->>''provider_customer_id'')';
 if position(fragment in definition)=0 then raise exception 'Billing definition changed'; end if;
 -- Up/down changes are intentionally rejected until an explicit transition flow exists.
 execute replace(definition,fragment,'if found and (existing.price_id is distinct from price.id or existing.user_id<>uid or existing.provider_customer_id<>p_subscription->>''provider_customer_id'')');

 definition:=pg_get_functiondef('public.change_commercial_catalog_base(uuid,text,jsonb,text)'::regprocedure);
 fragment:='where market_code=market and plan_code=''PRO'' and provider=''stripe'' and effective_to is null';
 if position(fragment in definition)=0 then raise exception 'Price editor definition changed'; end if;
 execute replace(definition,fragment,fragment||' and offer_id is null');
end $$;

create or replace function public.commercial_global_day_budget() returns numeric
language plpgsql stable security definer set search_path='' as $$
declare base numeric; funded numeric:=0;
begin
 select min((policy->>'global_day_usd')::numeric) into base from public.commercial_plans
 where available and jsonb_typeof(policy->'global_day_usd')='number' and (policy->>'global_day_usd')::numeric>0;
 if base is null then raise exception 'Operational budget unavailable'; end if;
 with subs as (
  select distinct on(user_id) user_id,plan_code,price_id from public.subscriptions
  where status in ('active','trialing') and current_period_start<=now() and current_period_end>now()
  order by user_id,current_period_end desc
 ), overrides as (
  select distinct on(user_id) user_id,settings from public.commercial_overrides
  where revoked_at is null and expires_at>now() order by user_id,created_at desc
 ), effective as (
  select coalesce(o.settings->>'plan_code',s.plan_code,'FREE') plan,
    coalesce(o.settings->'policy',case when p.code=s.plan_code then offer.policy end,p.policy) policy
  from subs s full join overrides o using(user_id)
  join public.commercial_plans p on p.code=coalesce(o.settings->>'plan_code',s.plan_code,'FREE') and p.available
  left join public.commercial_prices price on price.id=s.price_id
  left join public.commercial_offers offer on offer.id=price.offer_id
 ) select coalesce(sum((policy->>'hard_usd')::numeric),0) into funded from effective
 where plan<>'FREE' and policy->>'analysis_limit_mode'='budget';
 return base+funded;
end $$;
commit;
