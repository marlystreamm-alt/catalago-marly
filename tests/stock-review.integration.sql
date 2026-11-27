begin;
do $$
declare s uuid:=gen_random_uuid(); old uuid:=gen_random_uuid(); doc uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); v timestamptz; today date:=(now() at time zone 'America/Monterrey')::date; failed boolean:=false;
begin
 insert into public.ma2_ops_records(id,module,title,status,payload_cipher) values(c,'clients','QA review','active','fixture');
 insert into public.stock_items(id,platform,account_type,username,password_cipher,status,client_name,client_whatsapp,delivered_on,expires_on,sale_price,cost,related_order_id,protected_delivery_id) values
 (s,'QA review','Completa','fixture','fixture','assigned','QA review','528440000000',today-5,today+10,85,30,old::text,doc);
 insert into public.ma2_customer_orders(id,client_id,stock_id,amount_cents,title,detail,expires_on) values(old,c,s,8500,'QA review','{}',today+10);
 insert into public.notification_log(id,channel,kind,attempt,status,detail) values(doc,'protected_delivery','delivery',0,'active','fixture');
 select updated_at into v from public.stock_items where id=s;
 if public.ma2_review_stock(s,null,v,'nonrenewal',null,null)<>'review' then raise exception 'not reviewed';end if;
 if (select status from public.stock_items where id=s)<>'review' or (select status from public.notification_log where id=doc)<>'active' then raise exception 'invalid initial review';end if;
 select updated_at into v from public.stock_items where id=s;
 if public.ma2_review_stock(s,null,v,'release',today+10,'revoked fixture')<>'available' then raise exception 'not released';end if;
 if not exists(select 1 from public.stock_items where id=s and status='available' and client_name='' and delivered_on is null and protected_delivery_id is null and expires_on=today+10 and starts_on_sale=false) then raise exception 'old assignment remained';end if;
 if (select status from public.notification_log where id=doc)<>'revoked' or (select expires_on from public.ma2_customer_orders where id=old)>=today then raise exception 'old access remained';end if;
 if not exists(select 1 from public.ma2_released_stock_sales where stock_id=s and sale_price=85) then raise exception 'lost sale history';end if;
 if exists(select 1 from public.ma2_wallet_entries where client_id=c) then raise exception 'wallet changed';end if;
 update public.stock_items set status='assigned',expires_on=today-1,updated_at=clock_timestamp() where id=s;
 select updated_at into v from public.stock_items where id=s;
 if public.ma2_review_stock(s,null,v,'nonrenewal',null,null)<>'expired' then raise exception 'expired account queued';end if;
 begin perform public.ma2_review_stock(s,null,v,'release',today+10,null); exception when others then failed:=true;end;
 if not failed or (select status from public.stock_items where id=s)<>'expired' then raise exception 'expired account released';end if;
 if has_function_privilege('anon','public.ma2_review_stock(uuid,uuid,timestamptz,text,date,text)','execute') then raise exception 'unexpected permission';end if;
end $$;
rollback;
select 'Review, release, expiration, former access and sale history verified' as verification;
