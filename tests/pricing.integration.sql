begin;
do $$
declare marker text:='qa-price-'||gen_random_uuid()::text; a1 uuid;a2 uuid;c1 uuid;c2 uuid;s1 uuid:=gen_random_uuid();s2 uuid:=gen_random_uuid();req uuid:=gen_random_uuid();k text;failed boolean;
begin
 a1:=public.ma2_customer_register(null,marker||'-1@example.invalid','hash','salt',marker,'cipher');
 a2:=public.ma2_customer_register(null,marker||'-2@example.invalid','hash','salt',marker,'cipher');
 select client_id into c1 from public.ma2_customer_accounts where id=a1;
 select client_id into c2 from public.ma2_customer_accounts where id=a2;
 if (select price_tier from public.ma2_customer_accounts where id=a1)<>'retail' then raise exception 'Registration did not default to retail';end if;
 update public.ma2_customer_accounts set price_tier='reseller' where id=a2;
 perform public.ma2_wallet_post(c1,10000,'recharge','Synthetic pricing verification',gen_random_uuid());
 perform public.ma2_wallet_post(c2,10000,'recharge','Synthetic pricing verification',gen_random_uuid());
 insert into public.stock_items(id,platform,account_type,stock_kind,duration_months,username,password_cipher,sale_price) values(s1,marker,'Completa','complete',1,'fixture1','cipher',80),(s2,marker,'Perfil','profile',1,'fixture2','cipher',80);
 k:=public.ma2_pricing_key(marker,'complete',1);
 insert into public.ma2_product_prices(product_key,name,kind,months,retail_cents,reseller_cents) values(k,marker,'complete',1,5000,2000);
 if (select price_cents from public.ma2_customer_prices(a1,array[s1]))<>5000 or (select price_cents from public.ma2_customer_prices(a2,array[s1]))<>2000 then raise exception 'Wrong role price';end if;
 if (select price_cents from public.ma2_customer_prices(a2,array[s2])) is not null then raise exception 'Profile inherited full account tariff';end if;
 failed:=false;begin perform public.ma2_customer_buy(a1,s1,2000,gen_random_uuid());exception when others then failed:=true;end;if not failed then raise exception 'Retail accepted reseller price';end if;
 perform public.ma2_customer_buy(a2,s1,2000,req);perform public.ma2_customer_buy(a2,s1,2000,req);
 if (select count(*) from public.ma2_wallet_entries where request_id=req)<>1 then raise exception 'Duplicate debit';end if;
 if (select amount_cents from public.ma2_customer_orders where id=req)<>2000 then raise exception 'Incorrect paid snapshot';end if;
 failed:=false;begin perform public.ma2_customer_buy(a1,s1,5000,gen_random_uuid());exception when others then failed:=true;end;if not failed then raise exception 'One shared stock was sold twice';end if;
 update public.ma2_customer_accounts set price_tier='retail' where id=a2;
 if (select price_cents from public.ma2_customer_prices(a2,array[s2]))<>8000 then raise exception 'Role change did not restore regular price';end if;
 if has_table_privilege('anon','public.ma2_product_prices','select') or has_function_privilege('anon','public.ma2_customer_prices(uuid,uuid[])','execute') then raise exception 'Public access to pricing database';end if;
end;$$;
rollback;
select 'Pricing role, exact variant, verified debit and shared stock passed; synthetic data rolled back' as verification;
