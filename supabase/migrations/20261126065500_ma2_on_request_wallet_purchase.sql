create or replace function public.ma2_buy_on_request(
  p_id uuid, p_client uuid, p_product text, p_tier text, p_name text, p_email text, p_phone text
) returns boolean
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  product_name text;
  cents bigint;
  inserted uuid;
begin
  select name, case when p_tier = 'reseller' then reseller_cents else retail_cents end
    into product_name, cents
    from public.ma2_product_prices
    where product_key = p_product and published and kind like 'catalog-request-%';
  if not found or cents is null or cents <= 0 then
    raise exception 'Producto no disponible';
  end if;

  insert into public.orders (id, catalog_id, catalog_name, service_name, total, items, message, link, recipient, status)
    values (p_id, 'store-ma2', 'Tienda web MA²', product_name, cents / 100.0,
      jsonb_build_array(jsonb_build_object('name', product_name, 'price', cents / 100.0, 'productKey', p_product)),
      concat_ws(E'\n', 'Modalidad: Por encargo', 'Cliente: ' || p_name, 'Correo del cliente: ' || p_email,
        'WhatsApp del cliente: ' || p_phone, 'Pago confirmado con saldo · entrega manual'),
      '/tienda/ma2', '', 'nuevo')
    on conflict (id) do nothing returning id into inserted;

  if inserted is null then
    if exists (
      select 1 from public.orders o join public.ma2_wallet_entries w on w.request_id = o.id
      where o.id = p_id and o.catalog_id = 'store-ma2' and o.items #>> '{0,productKey}' = p_product
        and w.client_id = p_client and w.kind = 'purchase'
    ) then return false;
    end if;
    raise exception 'La referencia ya corresponde a otro pedido';
  end if;

  perform public.ma2_wallet_post(p_client, -cents, 'purchase', 'Pedido web por encargo · ' || product_name, p_id);
  return true;
end;
$$;
revoke execute on function public.ma2_buy_on_request(uuid,uuid,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.ma2_buy_on_request(uuid,uuid,text,text,text,text,text) to service_role;
