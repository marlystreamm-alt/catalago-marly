alter table public.ma2_customer_accounts add column if not exists price_tier text not null default 'retail' check (price_tier in ('retail','reseller') and (business_id is null or price_tier='retail'));

create table if not exists public.ma2_product_prices (
  product_key text primary key,
  name text not null,
  kind text not null,
  months integer not null check (months between 1 and 1200),
  retail_cents bigint check (retail_cents between 1 and 100000000),
  reseller_cents bigint check (reseller_cents between 1 and 100000000),
  updated_at timestamptz not null default now(),
  check (retail_cents is not null or reseller_cents is not null)
);
alter table public.ma2_product_prices enable row level security;
revoke all on public.ma2_product_prices from public,anon,authenticated;
grant select,insert,update on public.ma2_product_prices to service_role;

create or replace function public.ma2_price_norm(p_name text) returns text language sql immutable security invoker set search_path=public,pg_temp as $$
  select trim(regexp_replace(translate(lower(coalesce(p_name,'')),'áéíóúüñ','aeiouun'),'[^a-z0-9]+',' ','g'));
$$;
create or replace function public.ma2_pricing_key(p_name text,p_kind text,p_months integer) returns text language sql immutable security invoker set search_path=public,pg_temp as $$
  select (case public.ma2_price_norm(p_name)
    when 'disney estandar' then 'dis-std' when 'disney standard' then 'dis-std' when 'disney premium' then 'dis-pre'
    when 'max estandar' then 'max-std' when 'hbo max estandar' then 'max-std' when 'hbo estandar' then 'max-std' when 'max standard' then 'max-std'
    when 'max premium' then 'max-pre' when 'hbo max premium' then 'max-pre' when 'hbo premium' then 'max-pre'
    when 'max premium hulu' then 'max-hulu' when 'hbo max premium hulu' then 'max-hulu'
    when 'netflix privado' then 'net-pri' when 'netflix estandar' then 'net-std' when 'netflix standard' then 'net-std' when 'netflix premium' then 'net-pre'
    when 'paramount premium' then 'par-pre' when 'paramount' then 'par-base'
    when 'prime video' then 'pri-base' when 'amazon prime video' then 'pri-base' when 'prime video s a' then 'pri-sa' when 'prime video sin anuncios' then 'pri-sa'
    when 'crunchyroll' then 'cru-base' when 'vix premium 1 mes' then 'vix-mes' when 'vix premium mensual' then 'vix-mes'
    when 'vix premium anual' then 'vix-ano' when 'vix premium 1 ano' then 'vix-ano' when 'fox one' then 'fox-one'
    else public.ma2_price_norm(p_name) end)||'|'||p_kind||'|'||p_months::text;
$$;
create or replace function public.ma2_catalog_months(p_name text) returns integer language plpgsql immutable security invoker set search_path=public,pg_temp as $$
declare n text:=public.ma2_price_norm(p_name); m text[];
begin
  m:=regexp_match(n,'(^| )([0-9]{1,3}) mes(es)?( |$)'); if m is not null then return m[2]::integer; end if;
  m:=regexp_match(n,'(^| )([0-9]{1,2}) ano(s)?( |$)'); if m is not null then return m[2]::integer*12; end if;
  if n ~ '(^| )anual( |$)' then return 12; end if; return 1;
end;$$;

create or replace function public.ma2_catalog_tier_price(p_key text,p_tier text) returns bigint language sql stable security invoker set search_path=public,pg_temp as $$
  select case when count(*)=1 then max(case when jsonb_typeof(card->'price')='number' and (card->>'price')::numeric between 0.01 and 1000000 and coalesce(card->>'priceText','')='' then round((card->>'price')::numeric*100)::bigint end) end
  from public.catalog_app_state c cross join lateral jsonb_array_elements(coalesce(c.state::jsonb->'catalogs'->(case when p_tier='reseller' then 'revendedores' else 'clientes' end)->'services','[]'::jsonb)) card
  where c.id=1 and coalesce(card->>'active','true')='true' and coalesce(card->>'onRequest','')='' and
    public.ma2_pricing_key(card->>'name',case card->>'sectionId' when 'perfiles' then 'profile' when 'completas' then 'complete' else 'catalog-'||coalesce(card->>'sectionId','otros') end,public.ma2_catalog_months(card->>'name'))=p_key;
$$;

create or replace function public.ma2_effective_stock_price(p_stock public.stock_items,p_tier text) returns bigint language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare k text; cents bigint;
begin
  if p_stock.business_id is not null then return round(p_stock.sale_price*100)::bigint; end if;
  k:=public.ma2_pricing_key(p_stock.platform,p_stock.stock_kind,p_stock.duration_months);
  select case when p_tier='reseller' then reseller_cents else retail_cents end into cents from public.ma2_product_prices where product_key=k;
  if cents is null then cents:=public.ma2_catalog_tier_price(k,p_tier); end if;
  if cents is null and p_tier<>'reseller' then cents:=round(p_stock.sale_price*100)::bigint; end if;
  return cents;
end;$$;

create or replace function public.ma2_customer_prices(p_account uuid,p_stock_ids uuid[]) returns table(stock_id uuid,price_cents bigint) language sql stable security invoker set search_path=public,pg_temp as $$
  select s.id,public.ma2_effective_stock_price(s,a.price_tier) from public.ma2_customer_accounts a join public.stock_items s on s.business_id is not distinct from a.business_id
  where a.id=p_account and a.active and not a.must_change and s.id=any(p_stock_ids) and s.status='available';
$$;

create or replace function public.ma2_customer_buy(p_account uuid,p_stock uuid,p_price bigint,p_request uuid) returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare a public.ma2_customer_accounts; s public.stock_items; o public.ma2_customer_orders; today date:=(now() at time zone 'America/Monterrey')::date; expiry date; actual_price bigint;
begin
 select * into a from public.ma2_customer_accounts where id=p_account and active and not must_change for update;
 if not found then raise exception 'Inicia sesión y actualiza tu contraseña';end if;
 if a.business_id is not null then perform 1 from public.menu_businesses where id=a.business_id and active and not access_suspended and (expires_on is null or expires_on+grace_days>=today) for share;if not found then raise exception 'Tienda no disponible';end if;end if;
 select * into o from public.ma2_customer_orders where id=p_request;
 if found then if o.client_id<>a.client_id or o.stock_id<>p_stock or o.amount_cents<>p_price then raise exception 'Solicitud ya utilizada';end if;return o.id;end if;
 select * into s from public.stock_items where id=p_stock and business_id is not distinct from a.business_id for update;
 if not found or s.status<>'available' or s.account_type='split_parent' or exists(select 1 from public.stock_items where parent_stock_id=s.id) or (a.business_id is not null and (s.sale_price is null or s.sale_price<=0)) or s.username='' or s.password_cipher='' or (s.expires_on is not null and s.expires_on<today) then raise exception 'Este producto ya no está disponible';end if;
 if a.business_id is null then
   perform 1 from public.catalog_app_state where id=1 for share;
   perform 1 from public.ma2_product_prices where product_key=public.ma2_pricing_key(s.platform,s.stock_kind,s.duration_months) for share;
 end if;
 actual_price:=public.ma2_effective_stock_price(s,a.price_tier);
 if actual_price is null or actual_price<=0 or actual_price is distinct from p_price then raise exception 'El precio cambió o no está disponible para tu categoría. Actualiza la tienda';end if;
 expiry:=case when s.starts_on_sale then (today+make_interval(months=>s.duration_months))::date else s.expires_on end;
 perform public.ma2_wallet_post(a.client_id,-p_price,'purchase','Compra en tienda · '||s.platform,p_request);
 insert into public.ma2_customer_orders(id,client_id,business_id,stock_id,amount_cents,title,detail,expires_on) values(p_request,a.client_id,a.business_id,s.id,p_price,s.platform||' · '||s.account_type,jsonb_build_object('username',s.username,'password_cipher',s.password_cipher,'profilePin',s.profile_pin,'stockKind',s.stock_kind),expiry);
 update public.stock_items set status='assigned',client_name=(select title from public.ma2_ops_records where id=a.client_id),client_whatsapp='',delivered_on=today,expires_on=expiry,related_order_id=p_request::text,updated_at=clock_timestamp() where id=s.id;
 insert into public.stock_history(stock_id,business_id,action,detail) values(s.id,s.business_id,'entregado','Compra desde el portal · '||p_request::text);
 return p_request;
end;$$;

revoke execute on function public.ma2_price_norm(text),public.ma2_pricing_key(text,text,integer),public.ma2_catalog_months(text),public.ma2_catalog_tier_price(text,text),public.ma2_effective_stock_price(public.stock_items,text),public.ma2_customer_prices(uuid,uuid[]),public.ma2_customer_buy(uuid,uuid,bigint,uuid) from public,anon,authenticated;
grant execute on function public.ma2_price_norm(text),public.ma2_pricing_key(text,text,integer),public.ma2_catalog_months(text),public.ma2_catalog_tier_price(text,text),public.ma2_effective_stock_price(public.stock_items,text),public.ma2_customer_prices(uuid,uuid[]),public.ma2_customer_buy(uuid,uuid,bigint,uuid) to service_role;
