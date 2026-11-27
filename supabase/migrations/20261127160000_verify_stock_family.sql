create or replace function public.ma2_review_stock(p_id uuid,p_business uuid,p_version timestamptz,p_action text,p_expiry date,p_document text)
returns text language plpgsql security invoker set search_path=public,pg_temp as $$
declare s public.stock_items; today date:=(now() at time zone 'America/Monterrey')::date; next_status text;
begin
 select * into s from public.stock_items where id=p_id and business_id is not distinct from p_business for update;
 if not found or s.updated_at is distinct from p_version then raise exception 'La cuenta cambió. Actualiza el inventario.';end if;
 if p_action='nonrenewal' and s.status in ('assigned','expiring','expired') then
  next_status:=case when s.status='expired' or s.expires_on<today then 'expired' else 'review' end;
 elsif p_action='verified_invalid' and p_business is null then next_status:='expired';
 elsif p_action='verified_release' and p_business is null then
  if p_expiry is null or p_expiry<=today or s.account_type='split_parent' or s.username='' or s.password_cipher='' then raise exception 'Verifica los accesos y la vigencia antes de liberar.';end if;
  if s.status in ('assigned','expiring','client_replacement','provider_replacement') and (s.expires_on is null or s.expires_on>today) then raise exception 'Hay un perfil aún asignado o en reposición. Revisa su vigencia antes de liberar.';end if;
  next_status:='available';
 elsif p_action='expire' and s.status='review' then next_status:='expired';
 elsif p_action='release' and s.status='review' then
  if p_expiry is null or p_expiry<=today or s.account_type='split_parent' or exists(select 1 from public.stock_items where parent_stock_id=s.id) or s.username='' or s.password_cipher='' then raise exception 'Comprueba el acceso y registra una vigencia futura antes de liberar.';end if;
  if s.expires_on is not null and s.expires_on<today then raise exception 'La cuenta ya venció; márcala como vencida.';end if;
  next_status:='available';
 else raise exception 'La cuenta no se encuentra en el estado requerido.';end if;

 if next_status='available' or next_status='expired' then
  -- Terminate the former purchase access while keeping the order and payment history.
  update public.ma2_customer_orders set expires_on=least(coalesce(expires_on,today-1),today-1)
   where id::text=s.related_order_id and business_id is not distinct from p_business;
  if p_business is null then
   update public.cyberdocs_orders set expires_on=least(coalesce(expires_on,today-1),today-1),renewal_status='No renovó',updated_at=clock_timestamp()
    where id::text=s.related_order_id and stock_item_id=s.id;
  end if;
  -- A combo can share one document. Keep the remaining services accessible.
  if s.protected_delivery_id is not null and not exists(select 1 from public.stock_items x where x.id<>s.id and x.protected_delivery_id=s.protected_delivery_id and x.status in ('assigned','expiring','review') and (x.expires_on is null or x.expires_on>=today)) then
   if p_document is not null then update public.notification_log set status='revoked',detail=p_document where id=s.protected_delivery_id and channel='protected_delivery';end if;
  end if;
 end if;

 if next_status='available' then
  if s.delivered_on is not null then
   insert into public.ma2_released_stock_sales(stock_id,business_id,platform,account_type,stock_kind,parent_stock_id,client_name,client_whatsapp,delivered_on,expires_on,sale_price,cost)
   values(s.id,s.business_id,s.platform,s.account_type,s.stock_kind,s.parent_stock_id,s.client_name,s.client_whatsapp,s.delivered_on,s.expires_on,coalesce(s.sale_price,0),coalesce(s.cost,0));
  end if;
  update public.stock_items set status='available',client_name='',client_whatsapp='',delivered_on=null,related_order_id='',protected_delivery_id=null,expires_on=p_expiry,starts_on_sale=false,renewal_status='Acceso verificado',renewal_notified_at=null,updated_at=clock_timestamp() where id=s.id;
 else
  update public.stock_items set status=next_status,renewal_status=case when next_status='review' then 'No renovó · Validar cuenta' when p_action='verified_invalid' then 'Sin suscripción' else 'No renovó' end,expires_on=case when p_action='verified_invalid' then least(coalesce(expires_on,today-1),today-1) else expires_on end,renewal_notified_at=null,updated_at=clock_timestamp() where id=s.id;
 end if;
 insert into public.stock_history(stock_id,business_id,action,detail) values(s.id,s.business_id,case next_status when 'available' then 'liberado' when 'review' then 'validación' else 'vencido' end,'No renovación · '||coalesce(s.related_order_id,'')||' · '||s.client_name);
 return next_status;
end $$;

create function public.ma2_verify_stock_family(p_root uuid,p_members jsonb,p_action text,p_expiry date)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare root public.stock_items; member public.stock_items; entry jsonb; seen int:=0; stamp timestamptz:=clock_timestamp();
begin
 if p_action not in ('verified_release','verified_invalid') then raise exception 'Acción inválida';end if;
 select * into root from public.stock_items where id=p_root and business_id is null and parent_stock_id is null for update;
 if not found then raise exception 'No se encontró la cuenta principal';end if;
 if (root.status not in ('expired','review') or root.account_type='split_parent') and (root.expires_on is null or root.expires_on>(now() at time zone 'America/Monterrey')::date)
 and not exists(select 1 from public.stock_items where business_id is null and parent_stock_id=p_root and (status in ('expired','review') or expires_on<=(now() at time zone 'America/Monterrey')::date))
 then raise exception 'La cuenta ya no requiere revisión';end if;
 for member in select * from public.stock_items where business_id is null and (id=p_root or parent_stock_id=p_root) order by id for update loop
  select value into entry from jsonb_array_elements(p_members) where value->>'id'=member.id::text;
  if entry is null or (entry->>'version')::timestamptz is distinct from member.updated_at then raise exception 'Alguna cuenta o perfil cambió. Actualiza la lista.';end if;
  seen:=seen+1;
 end loop;
 if seen<>jsonb_array_length(p_members) then raise exception 'La lista de perfiles cambió. Actualiza la lista.';end if;
 for member in select * from public.stock_items where business_id is null and (id=p_root or parent_stock_id=p_root) order by id loop
  select value into entry from jsonb_array_elements(p_members) where value->>'id'=member.id::text;
  if member.id=p_root and seen>1 and p_action='verified_release' then
   update public.stock_items set expires_on=p_expiry,renewal_status='Acceso verificado',renewal_notified_at=null,updated_at=stamp where id=p_root;
  else
   perform public.ma2_review_stock(member.id,null,member.updated_at,p_action,p_expiry,entry->>'document');
  end if;
 end loop;
end $$;
revoke all on function public.ma2_verify_stock_family(uuid,jsonb,text,date) from public,anon,authenticated;
grant execute on function public.ma2_verify_stock_family(uuid,jsonb,text,date) to service_role;
notify pgrst,'reload schema';
