alter table public.ma2_recharge_events
  add column finance_direction text check (finance_direction in ('income', 'expense')),
  add column finance_key text;
create index ma2_recharge_events_finance_key on public.ma2_recharge_events
  ((coalesce(finance_key, transfer_key, source_key)));

create or replace function public.ma2_recharge_settle(p_event uuid) returns text
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  e public.ma2_recharge_events;
  cfg public.ma2_recharge_config;
  request public.ma2_recharge_requests;
  credit bigint;
begin
  select * into cfg from public.ma2_recharge_config where id = 1 for update;
  if not found or not coalesce((cfg.settings->>'enabled')::boolean, false) then return 'review'; end if;
  select * into e from public.ma2_recharge_events where id = p_event for update;
  if not found then raise exception 'Aviso no disponible'; end if;
  if e.status = 'credited' then return 'credited'; end if;
  if not e.verified or e.finance_direction = 'expense'
    or e.config_signature <> coalesce(cfg.tested_signature, '') or e.transfer_key is null
    or e.amount_cents is null or e.received_at < cfg.started_at then return 'review'; end if;
  perform pg_advisory_xact_lock(hashtextextended(e.transfer_key, 0));
  if exists (select 1 from public.ma2_recharge_events where transfer_key = e.transfer_key and status = 'credited') then
    update public.ma2_recharge_events set status = 'duplicate', reason = 'Transacción ya acreditada' where id = e.id;
    return 'duplicate';
  end if;
  select * into request from public.ma2_recharge_requests
  where reference = e.reference and payable_cents = e.amount_cents
    and status in ('pending', 'expired') and created_at <= e.received_at and expires_at >= e.received_at
  for update;
  if not found then
    update public.ma2_recharge_events set reason = 'Sin referencia e importe exactos de una recarga vigente' where id = e.id;
    return 'review';
  end if;
  credit := request.payable_cents + round(request.amount_cents * request.bonus_percent / 100.0)::bigint;
  perform public.ma2_wallet_post(request.client_id, credit, 'recharge', 'Recarga automática · referencia ' || request.reference, request.id);
  update public.ma2_recharge_requests set status = 'credited', credited_at = now() where id = request.id;
  update public.ma2_recharge_events set status = 'credited', request_id = request.id, reason = 'Saldo acreditado' where id = e.id;
  return 'credited';
end;
$$;

alter table public.ma2_finance_cuts add column excluded_move_ids uuid[] not null default '{}';

create function public.ma2_finance_match_bank_email(
  p_id uuid, p_transfer text, p_kind text, p_account uuid, p_manual uuid, p_previous boolean
) returns void
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  email public.ma2_recharge_events;
  source text := 'bank-mail:' || p_kind || ':' || p_transfer;
  existing uuid;
  details text;
begin
  perform pg_advisory_xact_lock(hashtextextended('ma2-finance-daily-cut', 0));

  if p_kind not in ('income', 'expense') or (p_kind = 'expense' and p_previous) then
    raise exception 'Tipo de movimiento no válido';
  end if;
  select * into email from public.ma2_recharge_events e
  where coalesce(e.finance_key, e.transfer_key, e.source_key) = p_transfer
    and (e.finance_direction = p_kind or (p_kind = 'income' and e.verified and e.status in ('review', 'credited')))
    and e.amount_cents > 0
  order by received_at, id limit 1;
  if not found or exists (
    select 1 from public.ma2_recharge_events e
    where coalesce(e.finance_key, e.transfer_key, e.source_key) = p_transfer
      and (e.finance_direction = p_kind or (p_kind = 'income' and e.verified and e.status in ('review', 'credited')))
      and e.amount_cents > 0 and e.amount_cents <> email.amount_cents
  ) then
    raise exception 'El aviso bancario no es verificable';
  end if;

  select m.id into existing from public.ma2_finance_moves m
  where m.voided_at is null and (m.source_key = source or exists (
    select 1 from public.ma2_recharge_events e
    join public.ma2_wallet_entries w on w.request_id in (e.request_id, e.id) and w.kind = 'recharge'
    where p_kind = 'income' and coalesce(e.finance_key, e.transfer_key, e.source_key) = p_transfer and e.verified and e.status = 'credited'
      and m.source_key = 'recharge:' || w.id::text
  )) limit 1;
  if existing is not null then
    if p_manual is not null and existing <> p_manual then
      raise exception 'El correo ya está conciliado con otro movimiento';
    end if;
    return;
  end if;

  if p_manual is not null then
    update public.ma2_finance_moves set source_key = source
    where id = p_manual and account_id = p_account and kind = p_kind
      and amount_cents = email.amount_cents and source_key is null and voided_at is null;
    if not found then raise exception 'El movimiento manual debe estar activo y coincidir en cuenta e importe'; end if;
    return;
  end if;

  details := case when coalesce(email.reference,'') = '' then 'Aviso bancario verificado' else 'Referencia ' || email.reference end;
  perform public.ma2_finance_post_reconciled(
    p_id, source, p_kind, p_account, email.amount_cents,
    (email.received_at at time zone 'America/Monterrey')::date,
    case when p_kind = 'income' then 'Ingreso por correo' else 'Salida por correo' end, details, email.received_at, p_previous
  );
end;
$$;

create function public.ma2_finance_move_to_today(p_move uuid) returns void
language plpgsql security invoker set search_path = public, pg_temp as $$
declare movement public.ma2_finance_moves; today date := (clock_timestamp() at time zone 'America/Monterrey')::date;
begin
  perform pg_advisory_xact_lock(hashtextextended('ma2-finance-daily-cut', 0));
  select * into movement from public.ma2_finance_moves
  where id = p_move and source_key is null and voided_at is null for update;
  if not found then raise exception 'El movimiento manual no está disponible'; end if;
  if movement.occurred_on = today then return; end if;
  if exists (
    select 1 from public.ma2_finance_cuts c where c.deleted_at is null and c.confirmed_at is not null
      and c.cut_on >= movement.occurred_on and c.cut_on <= today
      and (c.account_id = movement.account_id or c.account_id = movement.to_account_id)
      and (c.cut_on <> movement.occurred_on or not (movement.id = any(c.excluded_move_ids)))
  ) then
    raise exception 'Este movimiento afecta un corte confirmado. Revísalo antes de cambiar la fecha';
  end if;
  update public.ma2_finance_moves set occurred_on = today where id = p_move;
end;
$$;

create function public.ma2_finance_save_selected_cut(
  p_cut uuid, p_account uuid, p_day date, p_counted bigint, p_excluded uuid[], p_reviewed uuid[]
) returns void
language plpgsql security invoker set search_path = public, pg_temp as $$
declare account uuid := p_account; cut_day date := p_day; totals record; selected_cut public.ma2_finance_cuts;
begin
  perform pg_advisory_xact_lock(hashtextextended('ma2-finance-daily-cut', 0));
  if p_cut is not null then
    select * into selected_cut from public.ma2_finance_cuts
      where id = p_cut and confirmed_at is null and deleted_at is null for update;
    if not found then raise exception 'El corte ya no está pendiente'; end if;
    account := selected_cut.account_id;
    cut_day := selected_cut.cut_on;
  elsif exists(select 1 from public.ma2_finance_cuts where account_id=account and cut_on=cut_day and deleted_at is null) then
    raise exception 'Ya existe un corte para esa cuenta y fecha';
  end if;

  if cut_day is null or cut_day > (clock_timestamp() at time zone 'America/Monterrey')::date
    or p_counted is null or p_counted not between -100000000 and 100000000
  then raise exception 'Fecha o saldo del corte inválidos'; end if;
  p_excluded := coalesce(p_excluded, '{}');
  p_reviewed := coalesce(p_reviewed, '{}');
  if exists (
    select 1 from public.ma2_finance_moves m where m.voided_at is null and m.occurred_on = cut_day
      and (m.account_id = account or m.to_account_id = account) and not (m.id = any(p_reviewed))
  ) then raise exception 'Entraron movimientos nuevos. Actualiza para revisar el corte'; end if;
  if exists (
    select 1 from unnest(p_excluded) as excluded(id) where not exists (
      select 1 from public.ma2_finance_moves m where m.id = excluded.id and m.voided_at is null
        and m.occurred_on = cut_day and (m.account_id = account or m.to_account_id = account)
    )
  ) then raise exception 'Un movimiento cambió. Actualiza el corte'; end if;

  select
    a.opening_cents + coalesce(sum((case when m.account_id = a.id then case when m.kind = 'income' then m.amount_cents else -m.amount_cents end else 0 end)
      + (case when m.to_account_id = a.id then m.amount_cents else 0 end)), 0) as expected,
    coalesce(sum(m.amount_cents) filter (where m.occurred_on = cut_day and m.kind = 'income' and m.account_id = a.id), 0) as income,
    coalesce(sum(m.amount_cents) filter (where m.occurred_on = cut_day and m.kind = 'expense' and m.account_id = a.id), 0) as expense,
    coalesce(sum(m.amount_cents) filter (where m.occurred_on = cut_day and m.kind = 'transfer' and m.to_account_id = a.id), 0) as transfer_in,
    coalesce(sum(m.amount_cents) filter (where m.occurred_on = cut_day and m.kind = 'transfer' and m.account_id = a.id), 0) as transfer_out
  into totals
  from public.ma2_finance_accounts a
  left join public.ma2_finance_moves m on m.voided_at is null and m.occurred_on <= cut_day
    and (m.account_id = a.id or m.to_account_id = a.id) and (m.occurred_on < cut_day or (m.id = any(p_reviewed) and not (m.id = any(p_excluded))))
  where a.id = account group by a.id, a.opening_cents;
  if not found then raise exception 'Cuenta no disponible'; end if;

  if p_cut is null then
    insert into public.ma2_finance_cuts(account_id, cut_on, expected_cents, counted_cents, confirmed_at,
      income_cents, expense_cents, transfer_in_cents, transfer_out_cents, excluded_move_ids)
    values(account, cut_day, totals.expected, p_counted, clock_timestamp(),
      totals.income, totals.expense, totals.transfer_in, totals.transfer_out, p_excluded);
  else
    update public.ma2_finance_cuts set expected_cents=totals.expected, counted_cents=p_counted, confirmed_at=clock_timestamp(),
      income_cents=totals.income, expense_cents=totals.expense, transfer_in_cents=totals.transfer_in,
      transfer_out_cents=totals.transfer_out, excluded_move_ids=p_excluded where id=p_cut;
  end if;
end;
$$;

revoke execute on function public.ma2_finance_match_bank_email(uuid,text,text,uuid,uuid,boolean),
  public.ma2_finance_move_to_today(uuid), public.ma2_finance_save_selected_cut(uuid,uuid,date,bigint,uuid[],uuid[])
  from public, anon, authenticated;
grant execute on function public.ma2_finance_match_bank_email(uuid,text,text,uuid,uuid,boolean),
  public.ma2_finance_move_to_today(uuid), public.ma2_finance_save_selected_cut(uuid,uuid,date,bigint,uuid[],uuid[])
  to service_role;
notify pgrst, 'reload schema';
