create or replace function public.ma2_wallet_post(p_client uuid,p_amount bigint,p_kind text,p_note text,p_request uuid)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare result uuid; balance bigint;
begin
 perform 1 from public.ma2_ops_records where id=p_client and module='clients' and status='active' and archived_at is null for update;
 if not found then raise exception 'Cliente no disponible'; end if;
 select id into result from public.ma2_wallet_entries where request_id=p_request;
 if result is not null then
 if not exists(select 1 from public.ma2_wallet_entries where id=result and client_id=p_client and amount_cents=p_amount and kind=p_kind and note=p_note) then raise exception 'La referencia ya se utilizó para otro movimiento'; end if;
 return result; end if;
 if p_kind not in ('recharge','withdrawal','credit','repayment','purchase','refund') or p_amount=0 or abs(p_amount)>100000000 or length(trim(p_note))=0 then raise exception 'Movimiento inválido'; end if;
 if (p_kind in ('recharge','refund','credit') and p_amount<0) or (p_kind in ('withdrawal','purchase','repayment') and p_amount>0) then raise exception 'Signo inválido'; end if;
 if p_kind not in ('credit','repayment') then
 select coalesce(sum(amount_cents),0) into balance from public.ma2_wallet_entries where client_id=p_client and kind not in ('credit','repayment');
 if balance+p_amount<0 then raise exception 'Saldo insuficiente'; end if;
 else
 select coalesce(sum(amount_cents),0) into balance from public.ma2_wallet_entries where client_id=p_client and kind in ('credit','repayment');
 if balance+p_amount<0 then raise exception 'El abono supera la deuda'; end if;
 end if;
 insert into public.ma2_wallet_entries(client_id,amount_cents,kind,note,request_id) values(p_client,p_amount,p_kind,p_note,p_request) returning id into result;
 return result;
end; $$;
