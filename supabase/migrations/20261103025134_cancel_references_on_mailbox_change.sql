create function public.ma2_cancel_old_recharge_refs() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if new.started_at is distinct from old.started_at then
  update public.ma2_recharge_requests set status='cancelled' where status='pending';
 end if;
 return new;
end;$$;
revoke execute on function public.ma2_cancel_old_recharge_refs() from public,anon,authenticated;
create trigger ma2_recharge_identity_changed after update of started_at on public.ma2_recharge_config
for each row execute function public.ma2_cancel_old_recharge_refs();
