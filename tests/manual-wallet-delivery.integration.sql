begin;
do $$
declare c uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); s2 uuid:=gen_random_uuid(); r uuid:=gen_random_uuid(); v timestamptz; v2 timestamptz; today date:=(now() at time zone 'America/Monterrey')::date; failed boolean:=false;
begin
 insert into public.ma2_ops_records(id,module,title,status,payload_cipher) values(c,'clients','Synthetic QA','active','cipher');
 insert into public.stock_items(id,platform,account_type,username,password_cipher,sale_price) values(s,'Synthetic QA','Completa','fixture','cipher',50),(s2,'Synthetic QA','Completa','fixture','cipher',50);
 select updated_at into v from public.stock_items where id=s;
 select updated_at into v2 from public.stock_items where id=s2;
 perform public.ma2_manual_wallet_delivery(r,c,1,s,v,'Synthetic QA','528440000000',5000,today+30,'Synthetic QA','cipher','cipher');
 if (select status from public.stock_items where id=s)<>'assigned' or exists(select 1 from public.ma2_wallet_entries where client_id=c) then raise exception 'Zero-balance delivery failed';end if;
 perform public.ma2_wallet_post(c,7500,'recharge','Synthetic verification',gen_random_uuid());
 perform public.ma2_manual_wallet_delivery(r,c,1,s,v,'Synthetic QA','528440000000',5000,today+30,'Synthetic QA','cipher','cipher');
 perform public.ma2_manual_wallet_delivery(r,c,1,s,v,'Synthetic QA','528440000000',5000,today+30,'Synthetic QA','cipher','cipher');
 if (select sum(amount_cents) from public.ma2_wallet_entries where client_id=c)<>7500 or exists(select 1 from public.ma2_wallet_entries where request_id=r) or (select status from public.stock_items where id=s)<>'assigned' or not exists(select 1 from public.ma2_ops_records where id=r and status='completed') then raise exception 'Delivery or wallet mismatch';end if;
 perform public.ma2_manual_wallet_delivery(gen_random_uuid(),c,1,s2,v2,'Synthetic QA','528440000000',5000,today+30,'Synthetic QA','cipher','cipher');
 if (select status from public.stock_items where id=s2)<>'assigned' or (select sum(amount_cents) from public.ma2_wallet_entries where client_id=c)<>7500 then raise exception 'Wallet changed on second delivery';end if;
 if has_function_privilege('anon','public.ma2_manual_wallet_delivery(uuid,uuid,integer,uuid,timestamptz,text,text,bigint,date,text,text,text)','EXECUTE') or has_function_privilege('authenticated','public.ma2_manual_wallet_delivery(uuid,uuid,integer,uuid,timestamptz,text,text,bigint,date,text,text,text)','EXECUTE') then raise exception 'RPC access leak';end if;
end;$$;
rollback;
select 'Manual delivery without balance deduction and idempotency verified; synthetic data rolled back' as verification;
