create or replace function public.ma2_assign_stock_combo(p_request uuid,p_client uuid,p_client_version integer,p_name text,p_phone text,p_title text,p_kind text,p_items jsonb,p_payload text,p_document text)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare item record; s public.stock_items; n integer; today date:=(now() at time zone 'America/Monterrey')::date;
begin
 if p_kind not in ('profile','complete') or jsonb_typeof(p_items)<>'array' then raise exception 'Combo inválido';end if;
 n:=jsonb_array_length(p_items);
 if n<2 or n>20 or (select count(distinct x.id) from jsonb_to_recordset(p_items) x(id uuid))<>n then raise exception 'Selecciona entre dos y veinte cuentas distintas';end if;
 perform 1 from public.ma2_ops_records where id=p_client and module='clients' and status='active' and archived_at is null and version=p_client_version for update;
 if not found then raise exception 'El cliente cambió o no está disponible';end if;
 if exists(select 1 from public.ma2_ops_records where id=p_request) then
  if (select count(*) from public.stock_items where related_order_id=p_request::text and id in (select x.id from jsonb_to_recordset(p_items) x(id uuid)))=n then return p_request;end if;
  raise exception 'Solicitud ya utilizada';
 end if;
 for item in select * from jsonb_to_recordset(p_items) x(id uuid,version timestamptz,price numeric) order by id loop
  select * into s from public.stock_items where id=item.id and business_id is null for update;
  if not found or s.updated_at is distinct from item.version or s.status<>'available' or s.stock_kind<>p_kind or s.account_type='split_parent' or exists(select 1 from public.stock_items where parent_stock_id=s.id) or s.username='' or s.password_cipher='' or (s.expires_on is not null and s.expires_on<today) or item.price is null or item.price<0 or item.price>1000000 then raise exception 'Una cuenta cambió o dejó de estar disponible. No se asignó ninguna.';end if;
 end loop;
 if p_document is not null then insert into public.notification_log(id,channel,kind,attempt,status,detail) values(p_request,'protected_delivery','delivery',0,'active',p_document);end if;
 insert into public.ma2_ops_records(id,module,title,status,payload_cipher) values(p_request,'requests',p_title,'completed',p_payload);
 for item in select * from jsonb_to_recordset(p_items) x(id uuid,version timestamptz,price numeric) order by id loop
  update public.stock_items set status='assigned',client_name=p_name,client_whatsapp=p_phone,delivered_on=today,expires_on=case when starts_on_sale then (today+make_interval(months=>duration_months))::date else expires_on end,sale_price=item.price,related_order_id=p_request::text,protected_delivery_id=case when p_document is not null then p_request else null end,updated_at=clock_timestamp() where id=item.id;
  insert into public.stock_history(stock_id,business_id,action,detail) values(item.id,null,'entregado','Combo · '||p_request::text);
 end loop;
 return p_request;
end;$$;
revoke execute on function public.ma2_assign_stock_combo(uuid,uuid,integer,text,text,text,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.ma2_assign_stock_combo(uuid,uuid,integer,text,text,text,text,jsonb,text,text) to service_role;
