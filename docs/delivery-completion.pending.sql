-- Pending migration: apply through the database migration tool after Cloud resumes.
create or replace function public.ma2_finalize_cyberdocs_order(
  p_order uuid, p_notes text, p_actor text, p_delivery uuid default null,
  p_action text default 'manually_completed'
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare o public.cyberdocs_orders; stamp timestamptz := clock_timestamp();
begin
  select * into o from public.cyberdocs_orders where id=p_order for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if p_delivery is not null and (o.protected_delivery_id is distinct from p_delivery or not exists(
    select 1 from public.notification_log where id=p_delivery and channel='protected_delivery' and status='active' and coalesce(detail,'')<>''
  )) then raise exception 'El documento guardado no pertenece al pedido o no está activo'; end if;
  if o.status='completed' then return jsonb_build_object('order',to_jsonb(o),'changed',false); end if;
  if o.status in ('rejected','cancelled') then raise exception 'Este pedido está cerrado'; end if;
  update public.cyberdocs_orders set status='completed', delivered_on=coalesce(delivered_on,stamp::date),
    finalized_at=stamp, finalized_by=left(p_actor,120), final_notes=trim(p_notes)
    where id=p_order returning * into o;
  if o.notification_order_id is not null then
    update public.orders set status='atendido',attended_at=stamp where id=o.notification_order_id;
  end if;
  insert into public.cyberdocs_order_events(order_id,action,actor,detail)
    values(o.id,p_action,left(p_actor,120),left(coalesce(nullif(trim(p_notes),''),'Proceso finalizado con confirmación manual'),2000));
  return jsonb_build_object('order',to_jsonb(o),'changed',true);
end;
$$;
revoke all on function public.ma2_finalize_cyberdocs_order(uuid,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.ma2_finalize_cyberdocs_order(uuid,text,text,uuid,text) to service_role;

create or replace function public.ma2_link_cyberdocs_delivery(
  p_order uuid, p_delivery uuid, p_stock uuid, p_actor text, p_detail text,
  p_expires date default null, p_price numeric default null
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare o public.cyberdocs_orders; s public.stock_items; stamp timestamptz := clock_timestamp(); snapshot jsonb;
begin
  select * into o from public.cyberdocs_orders where id=p_order for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if o.status in ('rejected','cancelled') then raise exception 'Este pedido está cerrado'; end if;
  if o.protected_delivery_id is not null then
    if o.stock_item_id is distinct from p_stock then raise exception 'Este pedido ya tiene otra entrega'; end if;
    return to_jsonb(o);
  end if;
  if o.stock_item_id is not null then raise exception 'Este pedido ya tiene stock asignado'; end if;
  if not exists(select 1 from public.notification_log where id=p_delivery and channel='protected_delivery' and status='active' and coalesce(detail,'')<>'') then
    raise exception 'No se guardó el documento protegido';
  end if;
  if p_stock is not null then
    select * into s from public.stock_items where id=p_stock and business_id is null for update;
    if not found or s.status<>'available' then raise exception 'La cuenta dejó de estar disponible'; end if;
    snapshot := jsonb_build_object('status',s.status,'client_name',s.client_name,'client_whatsapp',s.client_whatsapp,
      'delivered_on',s.delivered_on,'related_order_id',s.related_order_id,'protected_delivery_id',s.protected_delivery_id);
    update public.stock_items set status='assigned',client_name=o.client_name,
      client_whatsapp=coalesce(nullif(o.whatsapp,''),case when o.contact_label='WhatsApp' then o.contact_value else '' end),
      delivered_on=stamp::date,related_order_id=o.id::text,protected_delivery_id=p_delivery,
      expires_on=coalesce(p_expires,expires_on),sale_price=coalesce(p_price,sale_price),updated_at=stamp where id=s.id;
    insert into public.stock_history(stock_id,business_id,action,detail)
      values(s.id,null,'asignado_cyberdocs','Asignación manual al pedido '||o.cyberdocs_order_id);
  end if;
  update public.cyberdocs_orders set status=case when status='completed' then status else 'in_process' end,
    assign_from_stock=(p_stock is not null),stock_item_id=p_stock,stock_snapshot_before=snapshot,
    protected_delivery_id=p_delivery,protected_enabled=true,assigned_at=stamp,assigned_by=left(p_actor,120),
    expires_on=coalesce(p_expires,expires_on) where id=o.id returning * into o;
  insert into public.cyberdocs_order_events(order_id,action,actor,detail)
    values(o.id,case when p_stock is null then 'manual_delivery' else 'stock_assigned' end,left(p_actor,120),left(p_detail,2000));
  return to_jsonb(o);
end;
$$;
revoke all on function public.ma2_link_cyberdocs_delivery(uuid,uuid,uuid,text,text,date,numeric) from public,anon,authenticated;
grant execute on function public.ma2_link_cyberdocs_delivery(uuid,uuid,uuid,text,text,date,numeric) to service_role;