begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); m uuid:=gen_random_uuid(); src text:='qa-finance-'||gen_random_uuid()::text; blocked boolean:=false;
begin
 insert into public.ma2_finance_accounts(id,name,opening_cents) values(a,src||' A',1000),(b,src||' B',0);
 insert into public.ma2_finance_moves(id,kind,account_id,amount_cents,occurred_on,category,source_key) values(m,'income',a,5000,current_date,'Recarga',src);
 begin insert into public.ma2_finance_moves(id,kind,account_id,amount_cents,occurred_on,category,source_key) values(gen_random_uuid(),'income',a,5000,current_date,'Recarga',src);exception when unique_violation then blocked:=true;end;
 if not blocked then raise exception 'duplicate source accepted';end if;
 insert into public.ma2_finance_moves(id,kind,account_id,to_account_id,amount_cents,occurred_on,category) values(gen_random_uuid(),'transfer',a,b,2000,current_date,'Transferencia');
 if has_table_privilege('anon','public.ma2_finance_moves','select') or has_table_privilege('authenticated','public.ma2_finance_accounts','select') then raise exception 'private finance exposed';end if;
 update public.ma2_finance_moves set voided_at=now(),reference=source_key,source_key=null where id=m;
 if not exists(select 1 from public.ma2_finance_moves where id=m and voided_at is not null and reference=src) then raise exception 'void history lost';end if;
end;$$;
rollback;
select 'Financial source uniqueness, transfer, private access and void history verified; fixture rolled back' as verification;
