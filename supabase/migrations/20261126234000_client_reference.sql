create sequence public.ma2_client_reference_sequence maxvalue 999999;
alter table public.ma2_ops_records add column client_reference text unique;
create function public.ma2_assign_client_reference() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if new.module='clients' and new.client_reference is null then
    new.client_reference='MA-'||lpad(nextval('public.ma2_client_reference_sequence')::text,6,'0');
  end if;
  return new;
end $$;
revoke all on sequence public.ma2_client_reference_sequence from public,anon,authenticated;
grant usage on sequence public.ma2_client_reference_sequence to service_role;
revoke all on function public.ma2_assign_client_reference() from public,anon,authenticated;
grant execute on function public.ma2_assign_client_reference() to service_role;
create trigger ma2_client_reference_insert before insert on public.ma2_ops_records
  for each row execute function public.ma2_assign_client_reference();
update public.ma2_ops_records set client_reference='MA-'||lpad(nextval('public.ma2_client_reference_sequence')::text,6,'0')
where module='clients' and client_reference is null;
