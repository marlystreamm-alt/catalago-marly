create or replace function public.ma2_assign_stock_combo_wallet(p_request uuid,p_client uuid,p_client_version integer,p_name text,p_phone text,p_title text,p_kind text,p_items jsonb,p_payload text,p_document text)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare cents bigint; result uuid;
begin
 select sum(round(x.price*100)) into cents from jsonb_to_recordset(p_items) x(id uuid,version timestamptz,price numeric);
 if cents is null or cents<=0 or cents>100000000 then raise exception 'Importe del combo inválido';end if;
 perform 1 from public.ma2_ops_records where id=p_client and module='clients' and status='active' and archived_at is null and version=p_client_version for update;
 if not found then raise exception 'Cliente no disponible';end if;
 if exists(select 1 from public.ma2_ops_records where id=p_request) and not exists(select 1 from public.ma2_wallet_entries where request_id=p_request and client_id=p_client and kind='purchase' and amount_cents=-cents) then raise exception 'Esta entrega ya existía; no se cobrará nuevamente';end if;
 result:=public.ma2_assign_stock_combo(p_request,p_client,p_client_version,p_name,p_phone,p_title,p_kind,p_items,p_payload,p_document);
 perform public.ma2_wallet_post(p_client,-cents,'purchase','Combo manual MA² · '||left(p_title,160),p_request);
 return result;
end;$$;
revoke execute on function public.ma2_assign_stock_combo_wallet(uuid,uuid,integer,text,text,text,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.ma2_assign_stock_combo_wallet(uuid,uuid,integer,text,text,text,text,jsonb,text,text) to service_role;
notify pgrst,'reload schema';
