begin;
do $$ declare c uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); r uuid:=gen_random_uuid(); v timestamptz:=now(); items jsonb; failed boolean:=false; begin
insert into public.ma2_ops_records(id,module,title,status,payload_cipher) values(c,'clients','QA combo','active','fixture');
insert into public.stock_items(id,platform,username,password_cipher,stock_kind,account_type,updated_at,status) values(a,'QA platform A','fixture','fixture','profile','Perfil',v,'available'),(b,'QA platform B','fixture','fixture','profile','Perfil',v,'available');
items:=jsonb_build_array(jsonb_build_object('id',a,'version',v,'price',12),jsonb_build_object('id',b,'version',v,'price',13));
update public.stock_items set status='assigned' where id=b;
begin perform public.ma2_assign_stock_combo(r,c,1,'QA combo','', 'QA combo','profile',items,'fixture',null);exception when others then failed:=true;end;
if not failed or (select status from public.stock_items where id=a)<>'available' or exists(select 1 from public.ma2_ops_records where id=r) then raise exception 'partial combo';end if;
update public.stock_items set status='available' where id=b;
perform public.ma2_assign_stock_combo(r,c,1,'QA combo','', 'QA combo','profile',items,'fixture','fixture');
perform public.ma2_assign_stock_combo(r,c,1,'QA combo','', 'QA combo','profile',items,'fixture','fixture');
if (select count(*) from public.stock_items where related_order_id=r::text and status='assigned' and protected_delivery_id=r)<>2 or (select count(*) from public.stock_history where stock_id in(a,b))<>2 or (select count(*) from public.ma2_ops_records where id=r)<>1 then raise exception 'combo verification failed';end if;
if has_function_privilege('anon','public.ma2_assign_stock_combo(uuid,uuid,integer,text,text,text,text,jsonb,text,text)','execute') then raise exception 'unexpected permission';end if;
end;$$;
rollback;
select 'Combo atomico verificado; datos de prueba revertidos' as verification;
