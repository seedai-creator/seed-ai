begin;
create table public.conversations(id uuid primary key,company_id uuid not null references public.companies(id) on delete cascade,user_id uuid not null references public.profiles(id),title text not null check(length(title) between 1 and 120),version integer not null default 0,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.messages(id uuid primary key default gen_random_uuid(),conversation_id uuid not null references public.conversations(id) on delete cascade,request_id uuid not null,role text not null check(role in ('user','assistant')),content text not null check(length(content) between 1 and 12000),diagnosis jsonb,created_at timestamptz not null default now(),unique(request_id,role));
create table public.business_memories(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,key text not null check(key ~ '^[a-z][a-z0-9_]{1,79}$'),kind text not null check(kind in ('FACT','METRIC','GOAL','BUSINESS_PREFERENCE','CONSTRAINT','DECISION','HYPOTHESIS','RESULT','LEARNING')),value text not null check(length(btrim(value)) between 1 and 500),evidence text not null default '',observed_at timestamptz not null default now(),version integer not null default 1,manual boolean not null default false,deleted boolean not null default false,source_message_id uuid references public.messages(id) on delete set null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(company_id,key));
create table public.business_memory_history(id uuid primary key default gen_random_uuid(),memory_id uuid not null references public.business_memories(id) on delete cascade,company_id uuid not null references public.companies(id) on delete cascade,snapshot jsonb not null,valid_until timestamptz not null default now());
insert into public.business_memories(company_id,key,kind,value,observed_at,manual,created_at,updated_at) select company_id,key,case when key='business_objective' then 'GOAL' when key in ('monthly_revenue','average_ticket','team_size') then 'METRIC' else 'FACT' end,value,updated_at,true,created_at,updated_at from public.company_facts;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.business_memories enable row level security;
alter table public.business_memory_history enable row level security;
revoke all on public.conversations,public.messages,public.business_memories,public.business_memory_history from anon,authenticated;
grant select on public.conversations,public.messages,public.business_memories,public.business_memory_history to authenticated;
create policy conversation_read on public.conversations for select to authenticated using(user_id=auth.uid() and exists(select 1 from public.company_members m where m.company_id=conversations.company_id and m.user_id=auth.uid()));
create policy message_read on public.messages for select to authenticated using(exists(select 1 from public.conversations c where c.id=messages.conversation_id));
create policy memory_read on public.business_memories for select to authenticated using(exists(select 1 from public.company_members m where m.company_id=business_memories.company_id and m.user_id=auth.uid()));
create policy memory_history_read on public.business_memory_history for select to authenticated using(exists(select 1 from public.company_members m where m.company_id=business_memory_history.company_id and m.user_id=auth.uid()));
create index conversation_recent on public.conversations(user_id,company_id,updated_at desc);
create index message_order on public.messages(conversation_id,created_at,id);
create index memory_current on public.business_memories(company_id,deleted,observed_at desc);
-- Only the server commits model output; authenticated users cannot forge assistant turns or automatic memory.
create function public.commit_seed_turn(p_user uuid,p_company uuid,p_conversation uuid,p_request uuid,p_version integer,p_message text,p_answer text,p_diagnosis jsonb,p_memories jsonb) returns void language plpgsql security definer set search_path='' as $$
declare c public.conversations%rowtype; item jsonb; old public.business_memories%rowtype; message_id uuid; at_time timestamptz; v text; k text;
begin
 if not exists(select 1 from public.company_members where company_id=p_company and user_id=p_user) then raise exception 'Access denied'; end if;
 perform 1 from public.companies where id=p_company for update;
 select * into c from public.conversations where id=p_conversation for update;
 if found and (c.user_id<>p_user or c.company_id<>p_company) then raise exception 'Access denied'; end if;
 if exists(select 1 from public.messages where request_id=p_request and conversation_id=p_conversation) then return; end if;

 if c.id is null then
  if p_version<>0 then raise exception 'Conversation changed'; end if;
  insert into public.conversations(id,company_id,user_id,title) values(p_conversation,p_company,p_user,left(p_message,120));
 elsif c.version<>p_version then raise exception 'Conversation changed'; end if;
 if length(p_message)>4000 or jsonb_typeof(p_memories)<>'array' or jsonb_array_length(p_memories)>8 then raise exception 'Invalid turn'; end if;
 insert into public.messages(conversation_id,request_id,role,content) values(p_conversation,p_request,'user',p_message) returning id into message_id;
 insert into public.messages(conversation_id,request_id,role,content,diagnosis) values(p_conversation,p_request,'assistant',p_answer,p_diagnosis);
 update public.conversations set version=version+1,updated_at=now() where id=p_conversation;
 for item in select * from jsonb_array_elements(p_memories) loop
  if item->>'certainty'<>'EXPLICIT' or item->>'scope'<>'CURRENT_COMPANY' or length(item->>'evidence')<1 or strpos(p_message,item->>'evidence')=0 then continue; end if;
  k:=item->>'key';v:=item->>'value';at_time:=coalesce((item->>'observed_at')::timestamptz,now());
  if at_time>now()+interval '1 day' then continue; end if;
  select * into old from public.business_memories where company_id=p_company and key=k for update;
  -- A manual correction/deletion is protected; older observations cannot replace current state.
  if found and (old.manual or old.deleted or old.value=v or at_time<old.observed_at or coalesce((item->>'replaces_current')::boolean,false)=false) then continue; end if;
  if old.id is not null then
   insert into public.business_memory_history(memory_id,company_id,snapshot) values(old.id,p_company,to_jsonb(old));
   update public.business_memories set value=v,kind=item->>'kind',evidence=item->>'evidence',observed_at=at_time,source_message_id=message_id,version=version+1,updated_at=now() where id=old.id;
  else
   insert into public.business_memories(company_id,key,kind,value,evidence,observed_at,source_message_id) values(p_company,k,item->>'kind',v,item->>'evidence',at_time,message_id);
  end if;
 end loop;
end $$;
revoke all on function public.commit_seed_turn(uuid,uuid,uuid,uuid,integer,text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.commit_seed_turn(uuid,uuid,uuid,uuid,integer,text,text,jsonb,jsonb) to service_role;
create function public.edit_business_memory(p_company uuid,p_id uuid,p_version integer,p_value text,p_delete boolean) returns void language plpgsql security definer set search_path='' as $$
declare old public.business_memories%rowtype;
begin
 if auth.uid() is null or not exists(select 1 from public.company_members where company_id=p_company and user_id=auth.uid()) then raise exception 'Access denied'; end if;
 select * into old from public.business_memories where id=p_id and company_id=p_company for update;
 if not found or old.version<>p_version then raise exception 'Memory changed'; end if;
 if not p_delete and (p_value is null or length(btrim(p_value)) not between 1 and 500) then raise exception 'Invalid value'; end if;
 insert into public.business_memory_history(memory_id,company_id,snapshot) values(old.id,p_company,to_jsonb(old));
 update public.business_memories set value=case when p_delete then value else btrim(p_value) end,deleted=p_delete,manual=true,version=version+1,observed_at=now(),updated_at=now() where id=old.id;
 -- Legacy facts are no longer authoritative in the new chat, but do not retain a deleted copy.
 if p_delete then delete from public.company_facts where company_id=p_company and key=old.key; end if;
end $$;
revoke all on function public.edit_business_memory(uuid,uuid,integer,text,boolean) from public,anon;
grant execute on function public.edit_business_memory(uuid,uuid,integer,text,boolean) to authenticated;
-- Preserve edits from the existing company/market settings forms.
create function public.sync_legacy_business_fact() returns trigger language plpgsql security definer set search_path='' as $$
declare old public.business_memories%rowtype;
begin
 select * into old from public.business_memories where company_id=new.company_id and key=new.key for update;
 if found then
  if old.value=new.value and not old.deleted then return new; end if;
  insert into public.business_memory_history(memory_id,company_id,snapshot) values(old.id,old.company_id,to_jsonb(old));
  update public.business_memories set value=new.value,manual=true,deleted=false,version=version+1,observed_at=now(),updated_at=now() where id=old.id;
 else
  insert into public.business_memories(company_id,key,kind,value,manual) values(new.company_id,new.key,case when new.key='business_objective' then 'GOAL' when new.key in ('team_size','average_ticket','monthly_revenue') then 'METRIC' else 'FACT' end,new.value,true);
 end if;
 return new;
end $$;
revoke all on function public.sync_legacy_business_fact() from public,anon,authenticated;
create trigger sync_business_fact after insert or update on public.company_facts for each row execute function public.sync_legacy_business_fact();
grant select on public.conversations,public.messages,public.business_memories,public.business_memory_history to service_role;
commit;
