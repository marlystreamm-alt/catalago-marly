begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); cut_id uuid; target date:='2026-11-26'; result record; src text:='qa-cut-'||gen_random_uuid()::text; n integer;
begin
  insert into public.ma2_finance_accounts(id,name,opening_cents,created_at) values(a,src||' A',1000,'2026-11-25T12:00:00Z'),(b,src||' B',0,'2026-11-25T12:00:00Z');
  perform public.ma2_finance_post_reconciled(gen_random_uuid(),src,'income',a,5000,target,'Pago','fixture',null,false);
  perform public.ma2_finance_post_reconciled(gen_random_uuid(),src,'income',a,5000,target,'Pago','fixture',null,false);
  insert into public.ma2_finance_moves(id,kind,account_id,amount_cents,occurred_on,category) values(gen_random_uuid(),'expense',a,1000,target,'Compra'),(gen_random_uuid(),'income',a,9000,target+1,'Día nuevo');
  insert into public.ma2_finance_moves(id,kind,account_id,to_account_id,amount_cents,occurred_on,category) values(gen_random_uuid(),'transfer',a,b,2000,target,'Transferencia');
  if public.ma2_finance_generate_daily_cuts('2026-11-27T06:29:59Z'::timestamptz)<>0 then raise exception 'cut before 00:30';end if;
  perform public.ma2_finance_generate_daily_cuts('2026-11-27T06:30:00Z'::timestamptz);
  select * into result from public.ma2_finance_cuts where account_id=a and cut_on=target and automatic;
  if not found or result.expected_cents<>3000 or result.income_cents<>5000 or result.expense_cents<>1000 or result.transfer_out_cents<>2000 or result.counted_cents is not null then raise exception 'cut totals or status incorrect';end if;
  cut_id:=result.id;
  if public.ma2_finance_generate_daily_cuts('2026-11-27T06:45:00Z'::timestamptz)<>0 then raise exception 'duplicate automatic cut';end if;
  update public.ma2_finance_cuts set deleted_at=now() where id=cut_id;
  if public.ma2_finance_generate_daily_cuts('2026-11-27T07:00:00Z'::timestamptz)<>0 then raise exception 'deleted cut recreated automatically';end if;
  perform public.ma2_finance_save_manual_cut(a,target,3000);
  select count(*) into n from public.ma2_finance_cuts where account_id=a and cut_on=target and deleted_at is null;
  if n<>1 or not exists(select 1 from public.ma2_finance_moves where source_key=src and voided_at is null) then raise exception 'recreated cut lost payment';end if;
  if has_function_privilege('anon','public.ma2_finance_generate_daily_cuts(timestamptz)','execute') then raise exception 'private cut operation exposed';end if;
end; $$;
rollback;
select 'Midnight cutoff, idempotency, totals, deletion and recreation verified' as verification;
