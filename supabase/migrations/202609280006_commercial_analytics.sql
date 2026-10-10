begin;
create function public.commercial_usage(p_user uuid,p_window text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('cost',coalesce(sum(coalesce(accounted_usd,reserved_usd)),0),'count',count(*)) from public.ai_requests where user_id=p_user and (p_window='lifetime' or created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC')
$$;
revoke all on function public.commercial_usage(uuid,text) from public,anon,authenticated;
grant execute on function public.commercial_usage(uuid,text) to service_role;
create function public.commercial_overview(p_actor uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare report jsonb;
begin
 if not exists(select 1 from public.admin_roles where user_id=p_actor) then raise exception 'Forbidden' using errcode='42501'; end if;
 select jsonb_build_object(
 'users',(select count(*) from public.profiles),
 'free_users',(select count(*) from public.profiles p where public.commercial_user_plan(p.id)='FREE'),
 'pro_users',(select count(*) from public.profiles p where public.commercial_user_plan(p.id)='PRO'),
 'activated_users',(select count(*) from public.commercial_accounts where activated_at is not null),
 'mrr_by_currency',(select coalesce(jsonb_agg(x),'[]') from (select currency,sum(amount_minor)/100.0 amount from public.subscriptions where status='active' and current_period_end>now() group by currency)x),
 'ai_cost_today_usd',(select sum(estimated_total_cost_usd) from public.usage_logs where created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'),
 'ai_cost_month_usd',(select sum(estimated_total_cost_usd) from public.usage_logs where created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'),
 'unknown_cost_operations',(select count(*) from public.ai_requests where accounted_usd is null),
 'cached_tokens',(select sum(cached_input_tokens) from public.usage_logs),
 'input_tokens',(select sum(input_tokens) from public.usage_logs),
 'ai_errors',(select count(*) from public.usage_logs where status<>'completed'),
 'by_plan',(select coalesce(jsonb_agg(x),'[]') from(select plan_code,sum(estimated_total_cost_usd) cost_usd from public.usage_logs group by plan_code)x),
 'by_market',(select coalesce(jsonb_agg(x),'[]') from(select market_code,sum(estimated_total_cost_usd) cost_usd from public.usage_logs group by market_code)x),
 'by_feature',(select coalesce(jsonb_agg(x),'[]') from(select feature,sum(estimated_total_cost_usd) cost_usd from public.usage_logs group by feature)x),
 'by_model',(select coalesce(jsonb_agg(x),'[]') from(select model,sum(estimated_total_cost_usd) cost_usd from public.usage_logs group by model)x),
 'top_users',(select coalesce(jsonb_agg(x),'[]') from(select user_id,sum(estimated_total_cost_usd) cost_usd from public.usage_logs group by user_id order by sum(estimated_total_cost_usd) desc nulls last limit 10)x)
 ) into report;
 return report;
end $$;
revoke all on function public.commercial_overview(uuid) from public,anon,authenticated;
grant execute on function public.commercial_overview(uuid) to service_role;
commit;
