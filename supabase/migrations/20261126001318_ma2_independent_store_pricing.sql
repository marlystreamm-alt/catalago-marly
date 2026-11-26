create or replace function public.ma2_effective_stock_price(p_stock public.stock_items,p_tier text) returns bigint language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare cents bigint;
begin
 if p_stock.business_id is not null then return round(p_stock.sale_price*100)::bigint; end if;
 select case when p_tier='reseller' then reseller_cents else retail_cents end into cents
 from public.ma2_product_prices where product_key=public.ma2_pricing_key(p_stock.platform,p_stock.stock_kind,p_stock.duration_months) and published is true;
 return cents;
end;$$;
revoke execute on function public.ma2_effective_stock_price(public.stock_items,text) from public,anon,authenticated;
grant execute on function public.ma2_effective_stock_price(public.stock_items,text) to service_role;
