create function public.ma2_restore_deleted_stock(p_version uuid)
returns integer language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  v public.entity_versions%rowtype;
  restored integer;
begin
  lock table public.stock_items in share row exclusive mode;
  select * into v from public.entity_versions
    where id=p_version and entity_type='stock_items' and action='delete' and business_id is null;
  if not found then raise exception 'El historial no está disponible'; end if;
  if exists(select 1 from public.stock_items where id::text=v.entity_id) then
    raise exception 'La cuenta ya existe en inventario';
  end if;
  if exists(select 1 from public.entity_versions newer where newer.entity_type=v.entity_type
    and newer.entity_id=v.entity_id and newer.created_at>v.created_at) then
    raise exception 'Este registro tiene cambios posteriores';
  end if;
  insert into public.stock_items
    select (jsonb_populate_record(null::public.stock_items,e.payload)).*
    from public.entity_versions e
    where e.entity_type='stock_items' and e.action='delete' and e.business_id is null
      and e.created_at=v.created_at
      and (e.entity_id=v.entity_id or e.payload->>'parent_stock_id'=v.entity_id)
      and not exists(select 1 from public.stock_items s where s.id::text=e.entity_id)
      and not exists(select 1 from public.entity_versions newer where newer.entity_type=e.entity_type
        and newer.entity_id=e.entity_id and newer.created_at>e.created_at);
  get diagnostics restored = row_count;
  if restored=0 then raise exception 'Este registro tiene cambios posteriores'; end if;
  insert into public.stock_history(stock_id,business_id,action,detail)
    values(v.entity_id::uuid,null,'restaurado','Eliminación deshecha desde inventario');
  return restored;
end $$;
revoke all on function public.ma2_restore_deleted_stock(uuid) from public,anon,authenticated;
grant execute on function public.ma2_restore_deleted_stock(uuid) to service_role;

create function public.ma2_deleted_stock_list()
returns table(id uuid,platform text,deleted_at timestamptz)
language sql security invoker set search_path=public,pg_temp as $$
  select e.id,e.payload->>'platform',e.created_at
  from public.entity_versions e
  where e.entity_type='stock_items' and e.action='delete' and e.business_id is null
    and not exists(select 1 from public.stock_items s where s.id::text=e.entity_id)
    and not exists(select 1 from public.entity_versions newer where newer.entity_type=e.entity_type
        and newer.entity_id=e.entity_id and newer.created_at>e.created_at)
    and not exists(select 1 from public.entity_versions parent where parent.entity_type=e.entity_type
        and parent.action='delete' and parent.created_at=e.created_at and parent.entity_id=e.payload->>'parent_stock_id')
  order by e.created_at desc limit 50;
$$;
revoke all on function public.ma2_deleted_stock_list() from public,anon,authenticated;
grant execute on function public.ma2_deleted_stock_list() to service_role;
