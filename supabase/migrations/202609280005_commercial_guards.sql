begin;
create function public.commercial_user_plan(p_user uuid) returns text language sql stable security definer set search_path='' as $$
 select coalesce(
 (select settings->>'plan_code' from public.commercial_overrides where user_id=p_user and revoked_at is null and expires_at>now() and settings ? 'plan_code' order by created_at desc limit 1),
 (select plan_code from public.subscriptions where user_id=p_user and status in ('active','trialing') and current_period_end>now() order by current_period_end desc limit 1),'FREE')
$$;
revoke all on function public.commercial_user_plan(uuid) from public,anon,authenticated;
create function public.guard_commercial_insert() returns trigger language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); plan public.commercial_plans%rowtype; flags jsonb; market_flags jsonb; override_flags jsonb; feature text;
begin
 if not coalesce((select (value->>'enabled')::boolean from public.commercial_settings where id='rollout'),false) then return new; end if;
 -- Auth signup creates the first company before a JWT exists; subsequent creations carry auth.uid().
 if uid is null and tg_table_name='companies' then return new; end if;
 if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform 1 from public.profiles where id=uid for update;
 select * into plan from public.commercial_plans where code=public.commercial_user_plan(uid) and available;
 if not found then raise exception 'Plan unavailable'; end if;
 if tg_table_name='companies' then
  if (select count(*) from public.company_members where user_id=uid and role='owner')>=plan.company_limit then raise exception 'Company limit reached'; end if;
  return new;
 end if;
 feature:=tg_table_name;
 select value into flags from public.commercial_settings where id='global_flags';
 select m.flags into market_flags from public.commercial_accounts a join public.commercial_markets m on m.code=a.market_code where a.user_id=uid;
 select settings->'flags' into override_flags from public.commercial_overrides where user_id=uid and expires_at>now() and revoked_at is null order by created_at desc limit 1;
 flags:=coalesce(flags,'{}')||plan.flags||coalesce(market_flags,'{}')||coalesce(override_flags,'{}');
 if not coalesce((flags->>feature)::boolean,false) then raise exception 'Feature unavailable'; end if;
 if feature='strategies' and plan.strategy_limit is not null and (select count(*) from public.strategies where created_by=uid)>=plan.strategy_limit then raise exception 'Strategy limit reached'; end if;
 return new;
end $$;
revoke all on function public.guard_commercial_insert() from public,anon,authenticated;
create trigger commercial_company_guard before insert on public.companies for each row execute function public.guard_commercial_insert();
create trigger commercial_strategy_guard before insert on public.strategies for each row execute function public.guard_commercial_insert();
create trigger commercial_decision_guard before insert on public.decisions for each row execute function public.guard_commercial_insert();
create trigger commercial_experiment_guard before insert on public.experiments for each row execute function public.guard_commercial_insert();
create function public.guard_commercial_signup() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if coalesce((select (value->>'enabled')::boolean from public.commercial_settings where id='rollout'),false) then
  if not exists(select 1 from public.commercial_markets where code=new.raw_user_meta_data->>'commercial_country' and status='ACTIVE' and signup_enabled and not disable_new_signups) then raise exception 'Signup unavailable for market'; end if;
 end if;
 return new;
end $$;
revoke all on function public.guard_commercial_signup() from public,anon,authenticated;
create trigger seed_market_signup before insert on auth.users for each row execute function public.guard_commercial_signup();
create function public.create_commercial_account() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.commercial_accounts(user_id,market_code) values(new.id,case when exists(select 1 from public.commercial_markets where code=new.raw_user_meta_data->>'commercial_country' and status='ACTIVE' and signup_enabled and not disable_new_signups) then new.raw_user_meta_data->>'commercial_country' else null end) on conflict do nothing;
 return new;
end $$;
revoke all on function public.create_commercial_account() from public,anon,authenticated;
-- Runs after seed_user_created (alphabetical trigger order), when the profile exists.
create trigger seed_z_commercial_account after insert on auth.users for each row execute function public.create_commercial_account();
commit;
