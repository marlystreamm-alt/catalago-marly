create or replace function public.ma2_manual_wallet_delivery(p_request uuid,p_client uuid,p_client_version integer,p_stock uuid,p_stock_version timestamptz,p_name text,p_phone text,p_cents bigint,p_expiry date,p_title text,p_payload text,p_document text)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare s public.stock_items; today date:=(now() at time zone 'America/Monterrey')::date;
begin
 if p_cents<=0 or p_cents>100000000 or p_expiry is null or p_expiry<today or trim(p_name)='' then raise exception 'Importe o vigencia inválidos';end if;
 perform 1 from public.ma2_ops_records where id=p_client and module='clients' and status='active' and archived_at is null and version=p_client_version for update;
 if not found then raise exception 'El cliente cambió o no está disponible';end if;
 select * into s from public.stock_items where id=p_stock and business_id is null for update;
 if not found then raise exception 'Stock no disponible';end if;
 if s.related_order_id=p_request::text and s.protected_delivery_id=p_request and exists(select 1 from public.ma2_wallet_entries where request_id=p_request and client_id=p_client and amount_cents=-p_cents and kind='purchase') then return p_request;end if;
 if s.updated_at is distinct from p_stock_version or s.status<>'available' or s.account_type='split_parent' or exists(select 1 from public.stock_items where parent_stock_id=s.id) or s.username='' or s.password_cipher='' or (s.expires_on is not null and s.expires_on<today) then raise exception 'La cuenta cambió o ya no está disponible. No se descontó saldo.';end if;
 perform public.ma2_wallet_post(p_client,-p_cents,'purchase','Entrega manual MA² · '||s.platform,p_request);
 insert into public.notification_log(id,channel,kind,attempt,status,detail) values(p_request,'protected_delivery','delivery',0,'active',p_document);
 insert into public.ma2_ops_records(id,module,title,status,payload_cipher) values(p_request,'requests',p_title,'completed',p_payload);
 update public.stock_items set status='assigned',client_name=p_name,client_whatsapp=p_phone,delivered_on=today,expires_on=p_expiry,sale_price=p_cents::numeric/100,related_order_id=p_request::text,protected_delivery_id=p_request,updated_at=clock_timestamp() where id=s.id;
 insert into public.stock_history(stock_id,business_id,action,detail) values(s.id,null,'entregado','Entrega manual con saldo · '||p_request::text);
 return p_request;
end;$$;
revoke execute on function public.ma2_manual_wallet_delivery(uuid,uuid,integer,uuid,timestamptz,text,text,bigint,date,text,text,text) from public,anon,authenticated;
grant execute on function public.ma2_manual_wallet_delivery(uuid,uuid,integer,uuid,timestamptz,text,text,bigint,date,text,text,text) to service_role;
notify pgrst,'reload schema';
