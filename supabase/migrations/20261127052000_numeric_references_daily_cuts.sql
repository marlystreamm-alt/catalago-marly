-- Permanent references reserve the 8xxxxxx range. Existing temporary requests
-- remain valid, and legacy MA- references are retained as aliases for old receipts.
lock table public.ma2_recharge_config, public.ma2_recharge_requests, public.ma2_ops_records in share row exclusive mode;
alter table public.ma2_ops_records add column client_reference_legacy text unique;
alter table public.ma2_ops_records add constraint ma2_numeric_client_reference check(client_reference is null or client_reference ~ '^8[0-9]{6}$') not valid;
create or replace function public.ma2_assign_client_reference() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if new.module='clients' and new.client_reference is null then
    loop
      new.client_reference='8'||lpad(nextval('public.ma2_client_reference_sequence')::text,6,'0');
      exit when not exists(select 1 from public.ma2_recharge_requests where reference=new.client_reference);
    end loop;
  end if;
  return new;
end $$;
update public.ma2_ops_records r set client_reference_legacy=r.client_reference,client_reference='8'||substring(r.client_reference from 4)
where r.module='clients' and r.client_reference ~ '^MA-[0-9]{6}$' and not exists(select 1 from public.ma2_recharge_requests t where t.reference='8'||substring(r.client_reference from 4));
do $$ declare r record; ref text; begin
  for r in select id,client_reference from public.ma2_ops_records where module='clients' and client_reference ~ '^MA-[0-9]{6}$' loop
    loop ref='8'||lpad(nextval('public.ma2_client_reference_sequence')::text,6,'0');
      exit when not exists(select 1 from public.ma2_recharge_requests where reference=ref) and not exists(select 1 from public.ma2_ops_records where client_reference=ref);
    end loop;
    update public.ma2_ops_records set client_reference_legacy=r.client_reference,client_reference=ref where id=r.id;
  end loop;
end $$;
alter table public.ma2_ops_records validate constraint ma2_numeric_client_reference;

create or replace function public.ma2_recharge_create(p_client uuid,p_amount bigint) returns public.ma2_recharge_requests language plpgsql security invoker set search_path=public,pg_temp as $$
declare cfg jsonb; row public.ma2_recharge_requests; n integer; payable bigint; ref text; begin
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
 loop ref:=(floor(random()*7000000)+1000000)::text;exit when not exists(select 1 from public.ma2_recharge_requests where reference=ref);end loop;
 insert into public.ma2_recharge_requests(client_id,reference,amount_cents,payable_cents,unique_cents,bonus_percent,expires_at) values(p_client,ref,p_amount,payable,coalesce((cfg->>'uniqueCents')::boolean,false),coalesce((cfg->>'bonusPercent')::integer,0),now()+make_interval(mins=>(cfg->>'minutes')::integer)) returning * into row;
 return row;end;$$;

create or replace function public.ma2_recharge_settle(p_event uuid) returns text
language plpgsql security invoker set search_path=public,pg_temp as $$
declare e public.ma2_recharge_events; cfg public.ma2_recharge_config; c uuid;
begin
  select * into e from public.ma2_recharge_events where id=p_event;
  if e.reference is null or e.reference !~ '^(MA-|8)[0-9]{6}$' or exists(select 1 from public.ma2_recharge_requests where reference=e.reference) then
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
    update public.ma2_recharge_events set status='duplicate',reason='Transacción ya acreditada' where id=e.id;return 'duplicate';
  end if;
  select r.id into c from public.ma2_ops_records r left join public.ma2_customer_accounts a on a.client_id=r.id
    where (r.client_reference=e.reference or r.client_reference_legacy=e.reference) and r.module='clients' and r.status='active'
      and r.archived_at is null and (a.id is null or (a.business_id is null and a.active)) for update of r;
  if c is null or e.amount_cents<(cfg.settings->>'minimum')::bigint*100 or e.amount_cents>(cfg.settings->>'maximum')::bigint*100 then
    update public.ma2_recharge_events set reason='Referencia permanente o importe requiere revisión' where id=e.id;return 'review';
  end if;
  perform public.ma2_wallet_post(c,e.amount_cents,'recharge','Recarga automática · referencia permanente '||e.reference,e.id);
  update public.ma2_recharge_events set status='credited',reason='Saldo acreditado por referencia permanente' where id=e.id;
  return 'credited';
end; $$;

alter table public.ma2_finance_cuts alter column counted_cents drop not null;
alter table public.ma2_finance_cuts add column automatic boolean not null default false,add column confirmed_at timestamptz,add column deleted_at timestamptz,add column income_cents bigint,add column expense_cents bigint,add column transfer_in_cents bigint,add column transfer_out_cents bigint;
update public.ma2_finance_cuts set confirmed_at=created_at where counted_cents is not null;
create unique index ma2_finance_one_automatic_cut on public.ma2_finance_cuts(account_id,cut_on) where automatic;

-- Same lock serializes the midnight exception and the scheduled cut.
create function public.ma2_finance_post_reconciled(p_id uuid,p_source text,p_kind text,p_account uuid,p_amount bigint,p_date date,p_category text,p_note text,p_received timestamptz,p_previous boolean) returns void
language plpgsql security invoker set search_path=public,pg_temp as $$
declare local_now timestamp; local_receipt timestamp; target date:=p_date;
begin
  perform pg_advisory_xact_lock(hashtextextended('ma2-finance-daily-cut',0));
  local_now:=clock_timestamp() at time zone 'America/Monterrey';
  if p_previous then
    local_receipt:=p_received at time zone 'America/Monterrey';
    if p_kind<>'income' or p_received is null or local_receipt::date<>local_now::date or local_receipt::time>=time '00:30' or local_now::time>=time '00:30' or p_received>clock_timestamp() then raise exception 'Ventana de autorización cerrada';end if;
    target:=local_now::date-1;
  end if;
  insert into public.ma2_finance_moves(id,source_key,reference,kind,account_id,amount_cents,occurred_on,category,note)
    values(p_id,p_source,p_source,p_kind,p_account,p_amount,target,p_category,p_note) on conflict(source_key) do nothing;
end; $$;
create function public.ma2_finance_cut_totals(p_account uuid,p_day date) returns table(expected bigint,income bigint,expense bigint,transfer_in bigint,transfer_out bigint)
language sql stable security invoker set search_path=public,pg_temp as $$
  select a.opening_cents+coalesce(sum((case when m.account_id=a.id then case when m.kind='income' then m.amount_cents else -m.amount_cents end else 0 end)+(case when m.to_account_id=a.id then m.amount_cents else 0 end)),0)::bigint,
    coalesce(sum(m.amount_cents) filter(where m.occurred_on=p_day and m.kind='income' and m.account_id=a.id),0)::bigint,
    coalesce(sum(m.amount_cents) filter(where m.occurred_on=p_day and m.kind='expense' and m.account_id=a.id),0)::bigint,
    coalesce(sum(m.amount_cents) filter(where m.occurred_on=p_day and m.kind='transfer' and m.to_account_id=a.id),0)::bigint,
    coalesce(sum(m.amount_cents) filter(where m.occurred_on=p_day and m.kind='transfer' and m.account_id=a.id),0)::bigint
  from public.ma2_finance_accounts a left join public.ma2_finance_moves m on m.voided_at is null and m.occurred_on<=p_day and (m.account_id=a.id or m.to_account_id=a.id)
  where a.id=p_account group by a.id,a.opening_cents;
$$;
create function public.ma2_finance_save_manual_cut(p_account uuid,p_day date,p_counted bigint) returns void
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('ma2-finance-daily-cut',0));
  if exists(select 1 from public.ma2_finance_cuts where account_id=p_account and cut_on=p_day and deleted_at is null) then raise exception 'Ya existe un corte';end if;
  insert into public.ma2_finance_cuts(account_id,cut_on,expected_cents,counted_cents,confirmed_at,income_cents,expense_cents,transfer_in_cents,transfer_out_cents)
    select p_account,p_day,t.expected,p_counted,clock_timestamp(),t.income,t.expense,t.transfer_in,t.transfer_out from public.ma2_finance_cut_totals(p_account,p_day) t;
  if not found then raise exception 'Cuenta no disponible';end if;
end; $$;
create function public.ma2_finance_generate_daily_cuts(p_at timestamptz default clock_timestamp()) returns integer
language plpgsql security invoker set search_path=public,pg_temp as $$
declare local_now timestamp; target date; affected integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('ma2-finance-daily-cut',0));
  local_now:=p_at at time zone 'America/Monterrey';
  if local_now::time<time '00:30' or local_now::time>=time '02:00' then return 0;end if;
  target:=local_now::date-1;
  insert into public.ma2_finance_cuts(account_id,cut_on,expected_cents,counted_cents,automatic,income_cents,expense_cents,transfer_in_cents,transfer_out_cents)
    select a.id,target,t.expected,null,true,t.income,t.expense,t.transfer_in,t.transfer_out
      from public.ma2_finance_accounts a cross join lateral public.ma2_finance_cut_totals(a.id,target) t where (a.created_at at time zone 'America/Monterrey')::date<=target
      and not exists(select 1 from public.ma2_finance_cuts c where c.account_id=a.id and c.cut_on=target)
      on conflict(account_id,cut_on) where automatic do nothing;
  get diagnostics affected=row_count;return affected;
end; $$;
revoke all on function public.ma2_finance_post_reconciled(uuid,text,text,uuid,bigint,date,text,text,timestamptz,boolean),public.ma2_finance_generate_daily_cuts(timestamptz),public.ma2_finance_cut_totals(uuid,date),public.ma2_finance_save_manual_cut(uuid,date,bigint) from public,anon,authenticated;
grant execute on function public.ma2_finance_post_reconciled(uuid,text,text,uuid,bigint,date,text,text,timestamptz,boolean),public.ma2_finance_generate_daily_cuts(timestamptz),public.ma2_finance_cut_totals(uuid,date),public.ma2_finance_save_manual_cut(uuid,date,bigint) to service_role;
notify pgrst,'reload schema';
