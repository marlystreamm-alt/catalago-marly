alter table public.ma2_finance_cuts add column included_move_ids uuid[];

create function public.ma2_finance_save_expanded_cut(
  p_cut uuid, p_account uuid, p_day date, p_counted bigint, p_excluded uuid[], p_reviewed uuid[], p_additional uuid[]
) returns void
language plpgsql security invoker set search_path = public, pg_temp as $$
declare account uuid := p_account; cut_day date := p_day; totals record; included uuid[]; available uuid[]; day_moves uuid[]; selected_cut public.ma2_finance_cuts;
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
  p_additional := coalesce(p_additional, '{}');
  select coalesce(array_agg(m.id), '{}'),
         coalesce(array_agg(m.id) filter (where m.occurred_on = cut_day), '{}')
  into available, day_moves
  from public.ma2_finance_moves m
  where m.voided_at is null and (m.account_id = account or m.to_account_id = account)
    and not exists (
      select 1 from public.ma2_finance_cuts c
      where c.account_id = account and c.deleted_at is null and c.confirmed_at is not null
        and (m.id = any(c.included_move_ids) or (
          c.included_move_ids is null and c.cut_on = m.occurred_on and m.created_at <= c.confirmed_at
          and not (m.id = any(c.excluded_move_ids))
        ))
    );
  if not day_moves <@ p_reviewed then
    raise exception 'Entraron movimientos nuevos. Actualiza para revisar el corte';
  end if;
  if not p_excluded <@ day_moves or not p_additional <@ available or p_additional && day_moves then
    raise exception 'Un movimiento cambió. Actualiza el corte';
  end if;

  select coalesce(array_agg(distinct id), '{}') into included
  from unnest(day_moves || p_additional) as movement(id) where not (id = any(p_excluded));

  with movements as (
    select m.*, coalesce(assignment.cut_on, m.occurred_on) as balance_day
    from public.ma2_finance_moves m
    left join lateral (
      select c.cut_on from public.ma2_finance_cuts c
      where c.account_id = account and c.deleted_at is null and c.confirmed_at is not null
        and m.id = any(c.included_move_ids)
      order by c.cut_on limit 1
    ) assignment on true
    where m.voided_at is null and (m.account_id = account or m.to_account_id = account)
  )
  select
    a.opening_cents + coalesce(sum((case when m.account_id = a.id then case when m.kind = 'income' then m.amount_cents else -m.amount_cents end else 0 end)
      + (case when m.to_account_id = a.id then m.amount_cents else 0 end)), 0) as expected,
    coalesce(sum(m.amount_cents) filter (where m.id = any(included) and m.kind = 'income' and m.account_id = a.id), 0) as income,
    coalesce(sum(m.amount_cents) filter (where m.id = any(included) and m.kind = 'expense' and m.account_id = a.id), 0) as expense,
    coalesce(sum(m.amount_cents) filter (where m.id = any(included) and m.kind = 'transfer' and m.to_account_id = a.id), 0) as transfer_in,
    coalesce(sum(m.amount_cents) filter (where m.id = any(included) and m.kind = 'transfer' and m.account_id = a.id), 0) as transfer_out
  into totals
  from public.ma2_finance_accounts a
  left join movements m on (m.id = any(included) or m.balance_day < cut_day)
  where a.id = account group by a.id, a.opening_cents;
  if not found then raise exception 'Cuenta no disponible'; end if;

  if p_cut is null then
    insert into public.ma2_finance_cuts(account_id, cut_on, expected_cents, counted_cents, confirmed_at,
      income_cents, expense_cents, transfer_in_cents, transfer_out_cents, excluded_move_ids, included_move_ids)
    values(account, cut_day, totals.expected, p_counted, clock_timestamp(),
      totals.income, totals.expense, totals.transfer_in, totals.transfer_out, p_excluded, included);
  else
    update public.ma2_finance_cuts set expected_cents=totals.expected, counted_cents=p_counted, confirmed_at=clock_timestamp(),
      income_cents=totals.income, expense_cents=totals.expense, transfer_in_cents=totals.transfer_in,
      transfer_out_cents=totals.transfer_out, excluded_move_ids=p_excluded, included_move_ids=included where id=p_cut;
  end if;
end;
$$;

revoke execute on function public.ma2_finance_save_expanded_cut(uuid,uuid,date,bigint,uuid[],uuid[],uuid[]) from public, anon, authenticated;
grant execute on function public.ma2_finance_save_expanded_cut(uuid,uuid,date,bigint,uuid[],uuid[],uuid[]) to service_role;
notify pgrst, 'reload schema';
