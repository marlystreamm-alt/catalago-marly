alter table public.ma2_product_prices add column if not exists cost_cents bigint check(cost_cents>=0), add column if not exists provider text not null default '', add column if not exists image text not null default '', add column if not exists description text not null default '', add column if not exists published boolean;
alter table public.ma2_product_prices drop constraint if exists ma2_product_prices_check;
alter table public.ma2_product_prices add constraint ma2_product_prices_requires_price check (published=false or retail_cents is not null or reseller_cents is not null);
create or replace function public.ma2_effective_stock_price(p_stock public.stock_items,p_tier text) returns bigint language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare k text; cents bigint; visible boolean;
begin
 if p_stock.business_id is not null then return round(p_stock.sale_price*100)::bigint; end if;
 k:=public.ma2_pricing_key(p_stock.platform,p_stock.stock_kind,p_stock.duration_months);
 select case when p_tier='reseller' then reseller_cents else retail_cents end,published into cents,visible from public.ma2_product_prices where product_key=k;
 if visible=false or (visible=true and cents is null) then return null; end if;
 if cents is null then cents:=public.ma2_catalog_tier_price(k,p_tier); end if;
 if cents is null and p_tier<>'reseller' then cents:=round(p_stock.sale_price*100)::bigint; end if;
 return cents;
end;$$;
revoke execute on function public.ma2_effective_stock_price(public.stock_items,text) from public,anon,authenticated;
grant execute on function public.ma2_effective_stock_price(public.stock_items,text) to service_role;
