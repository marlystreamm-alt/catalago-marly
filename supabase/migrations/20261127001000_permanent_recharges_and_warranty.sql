-- Preserve the existing temporary-reference settlement and use a separate,
-- equally verified path for permanent client references.
alter function public.ma2_recharge_settle(uuid) rename to ma2_recharge_settle_temporary;

create function public.ma2_recharge_settle(p_event uuid) returns text
language plpgsql security invoker set search_path=public,pg_temp as $$
declare e public.ma2_recharge_events; cfg public.ma2_recharge_config; c uuid;
begin
  select * into e from public.ma2_recharge_events where id=p_event;
  if e.reference is null or e.reference !~ '^MA-[0-9]{6}$' then
    return public.ma2_recharge_settle_temporary(p_event);
  end if;
  select * into cfg from public.ma2_recharge_config where id=1 for update;
  if cfg.id is null or not coalesce((cfg.settings->>'enabled')::boolean,false) then return 'review'; end if;
  select * into e from public.ma2_recharge_events where id=p_event for update;
  if e.status='credited' then return 'credited'; end if;
  if not e.verified or e.config_signature<>coalesce(cfg.tested_signature,'') or e.transfer_key is null or e.received_at<cfg.started_at
    or e.amount_cents is null or e.amount_cents<=0 or e.amount_cents>100000000 then return 'review'; end if;
  perform pg_advisory_xact_lock(hashtextextended(e.transfer_key,0));
  if exists(select 1 from public.ma2_recharge_events where transfer_key=e.transfer_key and status='credited') then
    update public.ma2_recharge_events set status='duplicate',reason='Transacción ya acreditada' where id=e.id;
    return 'duplicate';
  end if;
  -- A permanent reference is accepted only for an active main-store account.
  select r.id into c from public.ma2_ops_records r join public.ma2_customer_accounts a on a.client_id=r.id
    where r.client_reference=e.reference and r.module='clients' and r.status='active'
      and r.archived_at is null and a.business_id is null and a.active for update of r;
  if c is null or e.amount_cents<(cfg.settings->>'minimum')::bigint*100
    or e.amount_cents>(cfg.settings->>'maximum')::bigint*100 then
    update public.ma2_recharge_events set reason='Referencia permanente o importe requiere revisión' where id=e.id;
    return 'review';
  end if;
  perform public.ma2_wallet_post(c,e.amount_cents,'recharge','Recarga automática · referencia permanente '||e.reference,e.id);
  update public.ma2_recharge_events set status='credited',reason='Saldo acreditado por referencia permanente' where id=e.id;
  return 'credited';
end; $$;
revoke all on function public.ma2_recharge_settle(uuid) from public,anon,authenticated;
grant execute on function public.ma2_recharge_settle(uuid) to service_role;

-- Keep the 25-day warranty; automatic replacement is limited to day 18.
alter function public.ma2_auto_replace_purchase(uuid,uuid,uuid,uuid,text,text) rename to ma2_auto_replace_purchase_eligible;
create function public.ma2_auto_replace_purchase(p_purchase uuid,p_client uuid,p_report uuid,p_document uuid,p_name text,p_phone text)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.ma2_customer_orders where id=p_purchase and client_id=p_client and business_id is null
    and (now() at time zone 'America/Monterrey')::date <= (created_at at time zone 'America/Monterrey')::date+18) then return false; end if;
  return public.ma2_auto_replace_purchase_eligible(p_purchase,p_client,p_report,p_document,p_name,p_phone);
end; $$;
revoke all on function public.ma2_auto_replace_purchase(uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.ma2_auto_replace_purchase(uuid,uuid,uuid,uuid,text,text) to service_role;
update public.ma2_product_prices set warranty_days=25,automatic_replacement=true where kind in ('profile','complete');
notify pgrst,'reload schema';
