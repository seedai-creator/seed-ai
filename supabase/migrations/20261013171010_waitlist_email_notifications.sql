create table public.seedai_waitlist_notifications (
 lead_id uuid primary key references public.seedai_waitlist_leads(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','sending','accepted','review')),
 payload jsonb, first_attempt_at timestamptz, available_at timestamptz not null default now(),
 attempts integer not null default 0, provider_id text, lease uuid,
 created_at timestamptz not null default now()
);
alter table public.seedai_waitlist_notifications enable row level security;
revoke all on public.seedai_waitlist_notifications from public,anon,authenticated;
grant select,insert,update,delete on public.seedai_waitlist_notifications to service_role;
create index seedai_waitlist_notification_due on public.seedai_waitlist_notifications(available_at) where status in ('pending','sending');
create function public.seedai_waitlist_queue_notification() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.email_optin or new.whatsapp_optin then
 insert into public.seedai_waitlist_notifications(lead_id) values(new.id);
 end if;
 return new;
end; $$;
revoke all on function public.seedai_waitlist_queue_notification() from public,anon,authenticated;
grant execute on function public.seedai_waitlist_queue_notification() to service_role;
create trigger seedai_waitlist_notification_created after insert on public.seedai_waitlist_leads for each row execute function public.seedai_waitlist_queue_notification();
create function public.seedai_waitlist_claim_notification(p_from text,p_id uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare n public.seedai_waitlist_notifications; l public.seedai_waitlist_leads; v_payload jsonb; v_lease uuid;
begin
 if p_from is null or p_from !~ '^[A-Za-z0-9._+-]+@([A-Za-z0-9-]+\.)*appseedai\.com$' then raise exception 'invalid sender'; end if;
 update public.seedai_waitlist_notifications set status='review' where status in ('pending','sending') and first_attempt_at<=now()-interval '23 hours' and available_at<=now();
 select q.* into n from public.seedai_waitlist_notifications q join public.seedai_waitlist_leads a on a.id=q.lead_id
 where q.status in ('pending','sending') and q.available_at<=now() and (p_id is null or q.lead_id=p_id)
 and a.created_at>now()-interval '720 hours'
 order by q.created_at limit 1 for update of q skip locked;
 if not found then return null; end if;
 select * into strict l from public.seedai_waitlist_leads where id=n.lead_id;
 v_payload:=coalesce(n.payload,jsonb_build_object('from',p_from,'to',jsonb_build_array('seedtecnologias.suporte@gmail.com'),
 'subject','SEED AI — nova inscrição na lista de espera',
 'text','Nova inscrição (dados fornecidos pelo visitante, contato não verificado).'||E'\n\nNome: '||l.name||E'\nEmail: '||l.email||E'\nIdioma: '||l.locale||E'\nWhatsApp: '||coalesce(l.whatsapp,'Não informado')||E'\nAutoriza email: '||l.email_optin::text||E'\nAutoriza WhatsApp: '||l.whatsapp_optin::text||E'\nInscrito em: '||l.created_at::text||E'\n\nConsulte cancelamentos antes de qualquer contato. Elimine esta cópia após o prazo de retenção de 30 dias desde a inscrição.'));
 v_lease:=gen_random_uuid();
 update public.seedai_waitlist_notifications set status='sending',payload=v_payload,first_attempt_at=coalesce(first_attempt_at,now()),available_at=now()+interval '5 minutes',attempts=attempts+1,lease=v_lease where lead_id=n.lead_id;
 return jsonb_build_object('id',n.lead_id,'lease',v_lease,'payload',v_payload);
end; $$;
create function public.seedai_waitlist_finish_notification(p_id uuid,p_lease uuid,p_outcome text,p_provider_id text default null)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_outcome not in ('accepted','retry','review') then raise exception 'invalid outcome'; end if;
 update public.seedai_waitlist_notifications set status=case when p_outcome='retry' then 'pending' else p_outcome end,
 provider_id=p_provider_id,available_at=now()+interval '5 minutes',lease=null
 where lead_id=p_id and lease=p_lease and status='sending';
 if not found then raise exception 'lease expired'; end if;
end; $$;
revoke all on function public.seedai_waitlist_claim_notification(text,uuid),public.seedai_waitlist_finish_notification(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.seedai_waitlist_claim_notification(text,uuid),public.seedai_waitlist_finish_notification(uuid,uuid,text,text) to service_role;
