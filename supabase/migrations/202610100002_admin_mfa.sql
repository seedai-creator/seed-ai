begin;
-- Administrative reads through PostgREST must require the same verified AAL as
-- server actions. Own-account and public catalog policies remain unchanged.
create or replace function public.seed_admin_role() returns text
language sql stable security definer set search_path='' as $$
 select role from public.admin_roles
 where user_id=auth.uid()
 and (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'aal')='aal2'
$$;
revoke all on function public.seed_admin_role() from public,anon;
grant execute on function public.seed_admin_role() to authenticated;
commit;
