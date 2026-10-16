begin;
insert into public.commercial_settings(id,value) values('model_routing','{"classification_output_tokens":800,"diagnosis_output_tokens":3800}');
create function public.activation_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.activated_at is null and new.activated_at is not null then
  insert into public.commercial_events(user_id,market_code,event,dedupe_key) values(new.user_id,new.market_code,'free_value_moment_reached','activation:'||new.user_id) on conflict(dedupe_key) do nothing;
 end if;
 if old.activated_at is not null then new.activated_at:=old.activated_at; end if;
 return new;
end $$;
revoke all on function public.activation_event() from public,anon,authenticated;
create trigger commercial_activation before update on public.commercial_accounts for each row execute function public.activation_event();
commit;
