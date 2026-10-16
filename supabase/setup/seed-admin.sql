-- Run manually only in the explicitly authorized development Supabase project.
-- User designated this address as SEED administrator. No signup metadata grants roles.
begin;
do $$ declare target uuid; previous jsonb;
begin
 select id into strict target from auth.users where lower(email)='seedtecnologias.suporte@gmail.com';
 select to_jsonb(r) into previous from public.admin_roles r where user_id=target;
 insert into public.admin_roles(user_id,role) values(target,'SUPER_ADMIN') on conflict(user_id) do update set role='SUPER_ADMIN';
 insert into public.admin_audit_log(actor,action,entity,old_state,new_state,reason) values(target,'ADMIN_BOOTSTRAP',target::text,previous,jsonb_build_object('role','SUPER_ADMIN'),'Initial administrator explicitly designated by product owner');
end $$;
commit;
