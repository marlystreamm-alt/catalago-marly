alter table public.ma2_ops_records add column price_tier text not null default 'retail'
  check (price_tier='retail' or (module='clients' and price_tier='reseller'));
update public.ma2_ops_records c set price_tier=a.price_tier from public.ma2_customer_accounts a
where a.client_id=c.id and a.business_id is null and a.price_tier='reseller';

create function public.ma2_inherit_contact_tier() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.business_id is null then
    select price_tier into strict new.price_tier from public.ma2_ops_records where id=new.client_id for update;
  end if;
  return new;
end $$;
create trigger inherit_contact_tier before insert on public.ma2_customer_accounts
for each row execute function public.ma2_inherit_contact_tier();

create function public.ma2_sync_contact_tier() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  update public.ma2_customer_accounts set price_tier=new.price_tier where client_id=new.id and business_id is null;
  return new;
end $$;
create trigger sync_contact_tier after update of price_tier on public.ma2_ops_records
for each row when (new.module='clients') execute function public.ma2_sync_contact_tier();
