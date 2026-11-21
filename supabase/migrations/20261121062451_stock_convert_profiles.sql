-- Only the authenticated server may split stock; one transaction locks the parent.
create or replace function public.ma2_stock_convert_profiles(p_id uuid, p_business uuid, p_count integer)
returns integer language plpgsql security invoker set search_path = public as $$
declare parent public.stock_items; child public.stock_items; i integer;
begin
  if p_count is null or p_count < 1 or p_count > 10 then
    raise exception 'Indica entre 1 y 10 perfiles';
  end if;
  select * into parent from public.stock_items
    where id=p_id and business_id is not distinct from p_business for update;
  if not found then raise exception 'No se encontró la cuenta completa'; end if;
  if parent.stock_kind <> 'complete' or parent.status <> 'available'
    or parent.protected_delivery_id is not null or parent.related_order_id <> '' then
    raise exception 'Solo puedes convertir una cuenta completa disponible y sin entregar';
  end if;
  if exists(select 1 from public.stock_items where parent_stock_id=parent.id) then
    raise exception 'Esta cuenta ya tiene perfiles; no se duplicó el stock';
  end if;
  for i in 1..p_count loop
    child := parent;
    child.id := gen_random_uuid();
    child.stock_kind := 'profile'; child.account_type := 'Perfil'; child.parent_stock_id := parent.id;
    child.profile_pin := 'Perfil ' || i;
    child.client_name := ''; child.client_whatsapp := ''; child.delivered_on := null;
    child.related_order_id := ''; child.protected_delivery_id := null;
    child.renewal_status := ''; child.renewal_notified_at := null;
    child.notes := 'Perfil ' || i || ' derivado de cuenta completa';
    child.created_at := clock_timestamp(); child.updated_at := child.created_at; child.revision := 1;
    insert into public.stock_items select child.*;
    insert into public.stock_history(stock_id,business_id,action,detail)
      values(child.id,p_business,'agregado','Perfil creado desde cuenta completa');
  end loop;
  update public.stock_items set status='expired', notes=concat_ws(E'\n',nullif(parent.notes,''),'Convertida a ' || p_count || ' perfiles'),updated_at=clock_timestamp() where id=parent.id;
  insert into public.stock_history(stock_id,business_id,action,detail)
    values(parent.id,p_business,'convertido','Cuenta convertida a ' || p_count || ' perfiles');
  return p_count;
end;
$$;
revoke all on function public.ma2_stock_convert_profiles(uuid,uuid,integer) from public, anon, authenticated;
grant execute on function public.ma2_stock_convert_profiles(uuid,uuid,integer) to service_role;
