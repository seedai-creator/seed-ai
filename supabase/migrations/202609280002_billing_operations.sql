begin;
create table public.checkout_attempts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles,
 market_code text not null references public.commercial_markets, price_id uuid not null references public.commercial_prices,
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '24 hours'
);
alter table public.checkout_attempts enable row level security;
revoke all on public.checkout_attempts from anon,authenticated;
grant select,insert on public.checkout_attempts to service_role;
create function public.begin_checkout(p_user uuid,p_market text,p_price uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare found_row public.checkout_attempts%rowtype;
begin
 perform 1 from public.profiles where id=p_user for update;
 if not found then raise exception 'Unknown user'; end if;
 if exists(select 1 from public.subscriptions where user_id=p_user and status in ('active','trialing','past_due','unpaid','incomplete') and (current_period_end>now() or status='incomplete')) then raise exception 'Subscription exists'; end if;
 if not exists(select 1 from public.commercial_accounts a join public.commercial_markets m on a.market_code=m.code where a.user_id=p_user and m.code=p_market and m.status='ACTIVE' and m.pro_enabled and m.billing_enabled and not m.disable_new_subscriptions) then raise exception 'Market unavailable'; end if;
 if not exists(select 1 from public.commercial_prices where id=p_price and market_code=p_market and plan_code='PRO' and status='ACTIVE' and effective_from<=now() and effective_to is null) then raise exception 'Price unavailable'; end if;
 select * into found_row from public.checkout_attempts where user_id=p_user and expires_at>now() order by created_at desc limit 1;
 if found then
  if found_row.price_id<>p_price then raise exception 'Checkout already pending'; end if;
  return to_jsonb(found_row);
 end if;
 insert into public.checkout_attempts(user_id,market_code,price_id) values(p_user,p_market,p_price) returning * into found_row;
 insert into public.commercial_events(user_id,market_code,event,dedupe_key) values(p_user,p_market,'checkout_started',found_row.id::text);
 return to_jsonb(found_row);
end $$;
revoke all on function public.begin_checkout(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.begin_checkout(uuid,text,uuid) to service_role;

create function public.apply_billing_event(p_event_id text,p_type text,p_created bigint,p_subscription jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid:=(p_subscription->>'user_id')::uuid; existing public.subscriptions%rowtype; price public.commercial_prices%rowtype;
begin
 perform 1 from public.profiles where id=uid for update;
 if not found then raise exception 'Unknown account'; end if;
 if exists(select 1 from public.billing_events where provider_event_id=p_event_id) then return; end if;
 select * into price from public.commercial_prices where id=(p_subscription->>'price_id')::uuid;
 if not found or price.market_code<>p_subscription->>'market_code' or price.provider_price_id is distinct from p_subscription->>'provider_price_id' or price.currency<>p_subscription->>'currency' or price.amount_minor<>(p_subscription->>'amount_minor')::bigint then raise exception 'Price mismatch'; end if;
 if not exists(select 1 from public.checkout_attempts where user_id=uid and price_id=price.id) then raise exception 'No authorized checkout'; end if;
 select * into existing from public.subscriptions where provider_subscription_id=p_subscription->>'provider_subscription_id';
 if found and (existing.user_id<>uid or existing.provider_customer_id<>p_subscription->>'provider_customer_id') then raise exception 'Account mismatch'; end if;
 if existing.provider_updated_at is not null and existing.provider_updated_at>p_created then
  insert into public.billing_events values(p_event_id,p_type,p_created,now()); return;
 end if;
 insert into public.subscriptions(user_id,plan_code,market_code,provider,provider_customer_id,provider_subscription_id,status,currency,amount_minor,price_id,current_period_start,current_period_end,cancel_at_period_end,canceled_at,provider_updated_at)
 values(uid,'PRO',price.market_code,'stripe',p_subscription->>'provider_customer_id',p_subscription->>'provider_subscription_id',p_subscription->>'status',price.currency,price.amount_minor,price.id,(p_subscription->>'current_period_start')::timestamptz,(p_subscription->>'current_period_end')::timestamptz,(p_subscription->>'cancel_at_period_end')::boolean,(p_subscription->>'canceled_at')::timestamptz,p_created)
 on conflict(provider_subscription_id) do update set status=excluded.status,current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,cancel_at_period_end=excluded.cancel_at_period_end,canceled_at=excluded.canceled_at,provider_updated_at=excluded.provider_updated_at,updated_at=now();
 insert into public.billing_events values(p_event_id,p_type,p_created,now());
 insert into public.commercial_events(user_id,market_code,event,dedupe_key) values(uid,price.market_code,
 case when p_type='invoice.payment_failed' then 'payment_failed' when p_subscription->>'status'='canceled' then 'subscription_cancelled' when p_subscription->>'status'='active' then 'subscription_activated' else 'subscription_updated' end,p_event_id);
end $$;
revoke all on function public.apply_billing_event(text,text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.apply_billing_event(text,text,bigint,jsonb) to service_role;
commit;
