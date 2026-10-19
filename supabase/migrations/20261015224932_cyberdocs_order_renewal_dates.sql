-- Fechas comerciales y seguimiento de renovación para pedidos CyberDocs.
alter table public.cyberdocs_orders
  add column if not exists delivered_on date,
  add column if not exists expires_on date,
  add column if not exists renewal_warning_days integer not null default 3
    check (renewal_warning_days between 0 and 90),
  add column if not exists renewal_alerted_for date,
  add column if not exists renewal_notification_order_id uuid
    references public.orders(id) on delete set null,
  add column if not exists renewal_status text not null default '';

create index if not exists cyberdocs_orders_renewal_due_idx
  on public.cyberdocs_orders (expires_on)
  where status = 'completed' and expires_on is not null;
