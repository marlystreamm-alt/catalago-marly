alter table public.stock_items drop constraint if exists stock_items_status_check;
alter table public.stock_items add constraint stock_items_status_check check (status in ('available','assigned','expiring','expired','client_replacement','provider_replacement','review'));

update public.stock_items
set status=case when expires_on<(now() at time zone 'America/Monterrey')::date then 'expired' else 'review' end,
    updated_at=clock_timestamp()
where status in ('available','assigned','expiring') and lower(renewal_status) like 'no renov%';

create table public.ma2_released_stock_sales (
  id uuid primary key default gen_random_uuid(),
  stock_id uuid not null,
  business_id uuid references public.menu_businesses(id) on delete cascade,
  platform text not null, account_type text not null, stock_kind text not null,
  parent_stock_id uuid, client_name text not null, client_whatsapp text not null,
  delivered_on date not null, expires_on date, sale_price numeric not null, cost numeric not null,
  created_at timestamptz not null default now()
);
alter table public.ma2_released_stock_sales enable row level security;
revoke all on public.ma2_released_stock_sales from public,anon,authenticated;
grant select,insert on public.ma2_released_stock_sales to service_role;

create function public.ma2_review_stock(p_id uuid,p_business uuid,p_version timestamptz,p_action text,p_expiry date,p_document text)
returns text language plpgsql security invoker set search_path=public,pg_temp as $$
declare s public.stock_items; today date:=(now() at time zone 'America/Monterrey')::date; next_status text;
begin
 select * into s from public.stock_items where id=p_id and business_id is not distinct from p_business for update;
 if not found or s.updated_at is distinct from p_version then raise exception 'La cuenta cambió. Actualiza el inventario.';end if;
 if p_action='nonrenewal' and s.status in ('assigned','expiring','expired') then
  next_status:=case when s.status='expired' or s.expires_on<today then 'expired' else 'review' end;
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
  update public.stock_items set status=next_status,renewal_status=case when next_status='review' then 'No renovó · Validar cuenta' else 'No renovó' end,renewal_notified_at=null,updated_at=clock_timestamp() where id=s.id;
 end if;
 insert into public.stock_history(stock_id,business_id,action,detail) values(s.id,s.business_id,case next_status when 'available' then 'liberado' when 'review' then 'validación' else 'vencido' end,'No renovación · '||coalesce(s.related_order_id,'')||' · '||s.client_name);
 return next_status;
end $$;
revoke all on function public.ma2_review_stock(uuid,uuid,timestamptz,text,date,text) from public,anon,authenticated;
grant execute on function public.ma2_review_stock(uuid,uuid,timestamptz,text,date,text) to service_role;
notify pgrst,'reload schema';
