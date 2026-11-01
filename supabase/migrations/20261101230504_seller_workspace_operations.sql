create table public.ma2_ops_records (
 id uuid primary key default gen_random_uuid(),
 module text not null check(module in ('clients','reports','questions','providers','notices','faq','referrals','songs','documents','codes','config','requests')),
 title text not null check(char_length(title) between 1 and 160),
 status text not null default 'active',
 payload_cipher text not null check(char_length(payload_cipher)<=11500000),
 version integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 archived_at timestamptz
);
create index ma2_ops_module_created on public.ma2_ops_records(module,created_at desc) where archived_at is null;
alter table public.ma2_ops_records enable row level security;
revoke all on public.ma2_ops_records from public,anon,authenticated;
grant select,insert,update on public.ma2_ops_records to service_role;
create table public.ma2_wallet_entries (
 id uuid primary key default gen_random_uuid(),
 client_id uuid not null references public.ma2_ops_records(id),
 amount_cents bigint not null check(amount_cents<>0 and abs(amount_cents)<=100000000),
 kind text not null check(kind in ('recharge','withdrawal','credit','repayment','purchase','refund')),
 note text not null check(char_length(note) between 1 and 500),
 request_id uuid not null unique,
 created_at timestamptz not null default now()
);
create index ma2_wallet_client_date on public.ma2_wallet_entries(client_id,created_at desc);
alter table public.ma2_wallet_entries enable row level security;
revoke all on public.ma2_wallet_entries from public,anon,authenticated;
grant select,insert on public.ma2_wallet_entries to service_role;
create function public.ma2_wallet_post(p_client uuid,p_amount bigint,p_kind text,p_note text,p_request uuid)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare result uuid; balance bigint;
begin
 perform 1 from public.ma2_ops_records where id=p_client and module='clients' and status='active' and archived_at is null for update;
 if not found then raise exception 'Cliente no disponible'; end if;
 select id into result from public.ma2_wallet_entries where request_id=p_request;
 if result is not null then return result; end if;
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
revoke execute on function public.ma2_wallet_post(uuid,bigint,text,text,uuid) from public,anon,authenticated;
grant execute on function public.ma2_wallet_post(uuid,bigint,text,text,uuid) to service_role;
notify pgrst,'reload schema';
