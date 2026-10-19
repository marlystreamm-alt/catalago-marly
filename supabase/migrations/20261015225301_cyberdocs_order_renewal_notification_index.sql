create index if not exists cyberdocs_orders_renewal_notification_idx
  on public.cyberdocs_orders (renewal_notification_order_id)
  where renewal_notification_order_id is not null;
