create table public.ma2_recharge_config(id integer primary key check(id=1), settings jsonb not null, password_cipher text not null default '', version integer not null default 1, tested_signature text, last_uid bigint not null default 0, uid_validity text not null default '', started_at timestamptz not null default now(), last_check timestamptz, last_error text, lease_until timestamptz not null default now());
create table public.ma2_recharge_requests(id uuid primary key default gen_random_uuid(),client_id uuid not null references public.ma2_ops_records(id), reference text not null unique check(reference ~ '^[0-9]{7}$'),amount_cents bigint not null check(amount_cents>0),payable_cents bigint not null check(payable_cents>0),unique_cents boolean not null default false,bonus_percent integer not null default 0 check(bonus_percent between 0 and 100),status text not null default 'pending' check(status in ('pending','credited','expired','cancelled')),created_at timestamptz not null default now(),expires_at timestamptz not null,credited_at timestamptz);
create unique index ma2_recharge_unique_amount on public.ma2_recharge_requests(payable_cents) where status='pending' and unique_cents;
create index ma2_recharge_client_time on public.ma2_recharge_requests(client_id,created_at desc);
create table public.ma2_recharge_events(id uuid primary key default gen_random_uuid(),source_key text not null unique,received_at timestamptz not null,amount_cents bigint,reference text,tracking text,transfer_key text,verified boolean not null default false,config_signature text not null default '',status text not null default 'review' check(status in ('review','credited','ignored','duplicate')),reason text not null default '',request_id uuid references public.ma2_recharge_requests(id),created_at timestamptz not null default now());
create unique index ma2_recharge_transfer_credited on public.ma2_recharge_events(transfer_key) where status='credited';
create index ma2_recharge_event_time on public.ma2_recharge_events(created_at desc);
alter table public.ma2_recharge_config enable row level security;
alter table public.ma2_recharge_requests enable row level security;
alter table public.ma2_recharge_events enable row level security;
revoke all on public.ma2_recharge_config,public.ma2_recharge_requests,public.ma2_recharge_events from public,anon,authenticated;
grant select,insert,update on public.ma2_recharge_config,public.ma2_recharge_requests,public.ma2_recharge_events to service_role;
create function public.ma2_recharge_create(p_client uuid,p_amount bigint) returns public.ma2_recharge_requests language plpgsql security invoker set search_path=public,pg_temp as $$
declare cfg jsonb; row public.ma2_recharge_requests; n integer; payable bigint; ref text; expiry timestamptz; begin
 select settings into cfg from public.ma2_recharge_config where id=1 for update;
 if cfg is null or not coalesce((cfg->>'enabled')::boolean,false) then raise exception 'Las recargas automáticas no están activas';end if;
 perform 1 from public.ma2_ops_records where id=p_client and module='clients' and status='active' and archived_at is null;
 if not found then raise exception 'Cliente no disponible';end if;
 if p_amount<(cfg->>'minimum')::bigint*100 or p_amount>(cfg->>'maximum')::bigint*100 or p_amount%100<>0 then raise exception 'Importe fuera de los límites';end if;
 update public.ma2_recharge_requests set status='expired' where status='pending' and expires_at<now();
 select count(*) into n from public.ma2_recharge_requests where client_id=p_client and status='pending';
 if n>=(cfg->>'openLimit')::integer then raise exception 'Ya tienes el máximo de referencias abiertas';end if;
 if (cfg->>'dailyLimit')::integer>0 then select count(*) into n from public.ma2_recharge_requests where client_id=p_client and created_at>=date_trunc('day',now() at time zone 'America/Monterrey') at time zone 'America/Monterrey'; if n>=(cfg->>'dailyLimit')::integer then raise exception 'Límite diario de referencias alcanzado';end if;end if;
 payable:=p_amount;
 if (cfg->>'uniqueCents')::boolean then
 select p_amount+s into payable from generate_series(1,99) s where not exists(select 1 from public.ma2_recharge_requests where status='pending' and payable_cents=p_amount+s) order by random() limit 1;
 if payable is null then raise exception 'No hay centavos disponibles para este importe. Intenta otro monto';end if;
 end if;
 loop ref:=(floor(random()*9000000)+1000000)::text;exit when not exists(select 1 from public.ma2_recharge_requests where reference=ref);end loop;
 insert into public.ma2_recharge_requests(client_id,reference,amount_cents,payable_cents,unique_cents,bonus_percent,expires_at) values(p_client,ref,p_amount,payable,coalesce((cfg->>'uniqueCents')::boolean,false),coalesce((cfg->>'bonusPercent')::integer,0),now()+make_interval(mins=>(cfg->>'minutes')::integer)) returning * into row;
 return row;end;$$;
create function public.ma2_recharge_settle(p_event uuid) returns text language plpgsql security invoker set search_path=public,pg_temp as $$
declare e public.ma2_recharge_events; r public.ma2_recharge_requests; n integer; credit bigint; cfg public.ma2_recharge_config; begin
 select * into cfg from public.ma2_recharge_config where id=1 for update;
 if cfg.id is null or not coalesce((cfg.settings->>'enabled')::boolean,false) then return 'review';end if;
 select * into e from public.ma2_recharge_events where id=p_event for update;
 if not found then raise exception 'Aviso no disponible';end if;
 if e.status='credited' then return 'credited';end if;
 if not e.verified or e.config_signature<>coalesce(cfg.tested_signature,'') or e.amount_cents is null or e.transfer_key is null then return 'review';end if;
 perform pg_advisory_xact_lock(hashtextextended(e.transfer_key,0));
 if exists(select 1 from public.ma2_recharge_events where transfer_key=e.transfer_key and status='credited') then update public.ma2_recharge_events set status='duplicate',reason='Transacción ya acreditada' where id=e.id;return 'duplicate';end if;
 if e.reference is not null then select * into r from public.ma2_recharge_requests where reference=e.reference for update;
 end if;
 if r.id is null then
 select count(*) into n from public.ma2_recharge_requests where status in ('pending','expired') and unique_cents and payable_cents=e.amount_cents and created_at<=e.received_at and expires_at>=e.received_at;
 if n=1 then select * into r from public.ma2_recharge_requests where status in ('pending','expired') and unique_cents and payable_cents=e.amount_cents and created_at<=e.received_at and expires_at>=e.received_at for update;end if;
 end if;
 if r.id is null or r.status not in ('pending','expired') or e.amount_cents<>r.payable_cents or e.received_at<r.created_at or e.received_at>r.expires_at then update public.ma2_recharge_events set reason='Referencia, importe o vigencia no coinciden' where id=e.id;return 'review';end if;
 credit:=r.payable_cents+round(r.amount_cents*r.bonus_percent/100.0)::bigint;
 perform public.ma2_wallet_post(r.client_id,credit,'recharge','Recarga automática · referencia '||r.reference,r.id);
 update public.ma2_recharge_requests set status='credited',credited_at=now() where id=r.id;
 update public.ma2_recharge_events set status='credited',request_id=r.id,reason='Saldo acreditado' where id=e.id;
 return 'credited';end;$$;
revoke execute on function public.ma2_recharge_create(uuid,bigint),public.ma2_recharge_settle(uuid) from public,anon,authenticated;
grant execute on function public.ma2_recharge_create(uuid,bigint),public.ma2_recharge_settle(uuid) to service_role;
notify pgrst,'reload schema';
