alter table public.ma2_product_prices
  add column warranty_days integer not null default 0 check(warranty_days between 0 and 365),
  add column automatic_replacement boolean not null default false,
  add constraint ma2_replacement_requires_warranty check(not automatic_replacement or warranty_days>0);

create table public.ma2_report_replacements(
  purchase_id uuid primary key references public.ma2_customer_orders(id),
  report_id uuid not null unique references public.ma2_ops_records(id),
  replacement_stock_id uuid not null unique references public.stock_items(id),
  original_detail jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.ma2_report_replacements enable row level security;
revoke all on public.ma2_report_replacements from public,anon,authenticated;
grant select,insert on public.ma2_report_replacements to service_role;

create table public.ma2_paid_document_claims(
  purchase_id uuid primary key references public.ma2_customer_orders(id),
  created_at timestamptz not null default now()
);
alter table public.ma2_paid_document_claims enable row level security;
revoke all on public.ma2_paid_document_claims from public,anon,authenticated;
grant select,insert on public.ma2_paid_document_claims to service_role;

create function public.ma2_claim_paid_document(p_purchase uuid)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  perform 1 from public.ma2_customer_orders where id=p_purchase and business_id is null for update;
  if not found then return false; end if;
  insert into public.ma2_paid_document_claims(purchase_id) values(p_purchase) on conflict do nothing;
  return true;
end $$;
revoke all on function public.ma2_claim_paid_document(uuid) from public,anon,authenticated;
grant execute on function public.ma2_claim_paid_document(uuid) to service_role;

create function public.ma2_auto_replace_purchase(p_purchase uuid,p_client uuid,p_report uuid,p_document uuid,p_name text,p_phone text)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare o public.ma2_customer_orders; old_stock public.stock_items; replacement public.stock_items;
  policy public.ma2_product_prices; today date:=(now() at time zone 'America/Monterrey')::date;
begin
  select * into o from public.ma2_customer_orders where id=p_purchase and client_id=p_client and business_id is null for update;
  if not found or o.expires_on is null or o.expires_on<today then return false; end if;
  if exists(select 1 from public.ma2_report_replacements where purchase_id=o.id) then
    return exists(select 1 from public.ma2_report_replacements where purchase_id=o.id and report_id=p_report);
  end if;
  if not exists(select 1 from public.ma2_ops_records where id=p_report and module='reports' and status='pending') then return false; end if;
  if exists(select 1 from public.notification_log where id=p_document) or exists(select 1 from public.ma2_paid_document_claims where purchase_id=o.id) then return false; end if;
  select * into old_stock from public.stock_items where id=o.stock_id and business_id is null for update;
  if not found or old_stock.status not in ('assigned','expiring') or old_stock.related_order_id<>o.id::text then return false; end if;
  select * into policy from public.ma2_product_prices
    where product_key=public.ma2_pricing_key(old_stock.platform,old_stock.stock_kind,old_stock.duration_months) for share;
  if not found or not policy.automatic_replacement or today>(o.created_at at time zone 'America/Monterrey')::date+policy.warranty_days then return false; end if;
  select * into replacement from public.stock_items s
    where s.business_id is null and s.status='available' and s.id<>old_stock.id
      and s.stock_kind=old_stock.stock_kind and s.duration_months=old_stock.duration_months
      and public.ma2_pricing_key(s.platform,s.stock_kind,s.duration_months)=policy.product_key
      and s.username<>'' and s.password_cipher<>'' and s.account_type<>'split_parent'
      and not exists(select 1 from public.stock_items child where child.parent_stock_id=s.id)
      and (case when s.starts_on_sale then (today+make_interval(months=>s.duration_months))::date else s.expires_on end)>=o.expires_on
      and s.username<>old_stock.username
    order by s.expires_on asc nulls last,s.id limit 1 for update skip locked;
  if not found then return false; end if;
  insert into public.ma2_report_replacements(purchase_id,report_id,replacement_stock_id,original_detail)
    values(o.id,p_report,replacement.id,o.detail);
  update public.stock_items set status='client_replacement',updated_at=clock_timestamp() where id=old_stock.id;
  update public.stock_items set status='assigned',client_name=p_name,client_whatsapp=p_phone,delivered_on=today,
    expires_on=o.expires_on,related_order_id=o.id::text,sale_price=0,updated_at=clock_timestamp() where id=replacement.id;
  update public.ma2_customer_orders set detail=jsonb_build_object('username',replacement.username,'password_cipher',replacement.password_cipher,'profilePin',replacement.profile_pin,'stockKind',replacement.stock_kind) where id=o.id;
  insert into public.stock_history(stock_id,business_id,action,detail) values
    (old_stock.id,null,'reposición','Reporte automático · '||p_report::text),
    (replacement.id,null,'reposición','Reposición sin cobro · '||p_report::text);
  return true;
end $$;
revoke all on function public.ma2_auto_replace_purchase(uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.ma2_auto_replace_purchase(uuid,uuid,uuid,uuid,text,text) to service_role;
