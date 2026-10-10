-- Preserve one source of truth when the existing memory editor changes a typed goal.
begin;
create function public.sync_goal_memory_edit() returns trigger language plpgsql security definer set search_path=public as $$
declare g goals;next_status text;begin
 -- save_goal changes the title projection but does not change observed_at/manual.
 if new.kind<>'GOAL' or (new.deleted is not distinct from old.deleted and new.observed_at is not distinct from old.observed_at) then return new;end if;
 select * into g from goals where company_id=new.company_id and id=new.id for update;if not found then return new;end if;
 next_status:=case when new.deleted then 'CANCELLED' else 'DRAFT' end;
 update goals set status=next_status,spec=jsonb_set(jsonb_set(spec,'{title}',to_jsonb(left(new.value,120))),'{primary}','false'),version=version+1,updated_at=now() where id=g.id;
 insert into goal_events(company_id,goal_id,kind,snapshot,reason,changed_by,request_key)
 values(new.company_id,new.id,'goal_memory_corrected',jsonb_build_object('before',to_jsonb(g),'memory_version',new.version,'status',next_status),case when new.deleted then 'Removed through the memory editor' else 'Memory changed; structured goal requires review' end,auth.uid(),'memory:'||new.id||':'||new.version);
 return new;
end$$;
revoke all on function public.sync_goal_memory_edit() from public,anon,authenticated;
create trigger goal_memory_integrity after update on public.business_memories for each row execute function public.sync_goal_memory_edit();
-- Retire derived alerts immediately when their canonical goal changes.
create trigger radar_change after insert or update or delete on public.goals for each row execute function public.radar_dirty();
commit;
