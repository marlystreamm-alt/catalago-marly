-- MA² v20.11 · Recepción obligatoria de pedidos CyberDocs con respaldo y auditoría.
-- Los secretos de Telegram viven únicamente en variables del servidor, nunca en estas tablas.

create table if not exists public.cyberdocs_integration_state (
  id smallint primary key default 1 check (id = 1),
  connection_required boolean not null default true check (connection_required = true),
  receiving_required boolean not null default true check (receiving_required = true),
  telegram_bot_username text not null default 'marstreambotbot',
  cyberdocs_username text not null default 'cyberdocsmx_bot',
  last_event_at timestamptz,
  last_order_at timestamptz,
  last_fallback_at timestamptz,
  last_error text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.cyberdocs_integration_state (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.cyberdocs_orders (
  id uuid primary key default gen_random_uuid(),
  cyberdocs_order_id text not null unique,
  source text not null default 'telegram_business'
    check (source in ('telegram_business', 'telegram_message', 'webhook_fallback', 'manual_fallback')),
  source_event_key text not null unique,
  source_message_id text not null default '',
  source_chat_id text not null default '',
  business_connection_id text not null default '',
  sender_username text not null default '',
  raw_message text not null,
  parsed_payload jsonb not null default '{}'::jsonb,
  client_name text not null default '',
  service_name text not null default '',
  contact_label text not null default '',
  contact_value text not null default '',
  status text not null default 'new'
    check (status in ('new', 'in_process', 'completed', 'rejected', 'cancelled', 'error')),
  assign_from_stock boolean,
  stock_item_id uuid references public.stock_items(id) on delete set null,
  stock_snapshot_before jsonb,
  protected_delivery_id uuid references public.notification_log(id) on delete set null,
  notification_order_id uuid references public.orders(id) on delete set null,
  assigned_at timestamptz,
  assigned_by text not null default '',
  finalized_at timestamptz,
  finalized_by text not null default '',
  final_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cyberdocs_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  source text not null
    check (source in ('telegram_business', 'telegram_message', 'webhook_fallback', 'manual_fallback')),
  telegram_update_id text not null default '',
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received'
    check (status in ('received', 'processed', 'ignored', 'duplicate', 'error')),
  error_detail text not null default '',
  order_id uuid references public.cyberdocs_orders(id) on delete set null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.cyberdocs_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.cyberdocs_orders(id) on delete restrict,
  action text not null,
  actor text not null default 'system',
  detail text not null default '',
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists cyberdocs_orders_status_created_idx
  on public.cyberdocs_orders (status, created_at desc);
create index if not exists cyberdocs_orders_stock_idx
  on public.cyberdocs_orders (stock_item_id) where stock_item_id is not null;
create index if not exists cyberdocs_orders_notification_idx
  on public.cyberdocs_orders (notification_order_id) where notification_order_id is not null;
create index if not exists cyberdocs_webhook_events_status_idx
  on public.cyberdocs_webhook_events (status, received_at desc);
create index if not exists cyberdocs_webhook_events_order_idx
  on public.cyberdocs_webhook_events (order_id) where order_id is not null;
create index if not exists cyberdocs_order_events_order_created_idx
  on public.cyberdocs_order_events (order_id, created_at desc);

create or replace function public.cyberdocs_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cyberdocs_orders_touch_updated_at on public.cyberdocs_orders;
create trigger cyberdocs_orders_touch_updated_at
before update on public.cyberdocs_orders
for each row execute function public.cyberdocs_touch_updated_at();

drop trigger if exists cyberdocs_integration_touch_updated_at on public.cyberdocs_integration_state;
create trigger cyberdocs_integration_touch_updated_at
before update on public.cyberdocs_integration_state
for each row execute function public.cyberdocs_touch_updated_at();

create or replace function public.cyberdocs_audit_order_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.cyberdocs_order_events (order_id, action, actor, detail, after_data)
    values (new.id, 'db_created', 'database', 'Pedido respaldado en la base de datos', to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.cyberdocs_order_events (order_id, action, actor, detail, before_data, after_data)
    values (new.id, 'db_updated', 'database', 'Cambio respaldado automáticamente', to_jsonb(old), to_jsonb(new));
    return new;
  end if;

  insert into public.cyberdocs_order_events (order_id, action, actor, detail, before_data)
  values (old.id, 'db_delete_attempt', 'database', 'El pedido no debe eliminarse; evento de auditoría', to_jsonb(old));
  return old;
end;
$$;

drop trigger if exists cyberdocs_orders_audit on public.cyberdocs_orders;
create trigger cyberdocs_orders_audit
after insert or update on public.cyberdocs_orders
for each row execute function public.cyberdocs_audit_order_change();

alter table public.cyberdocs_integration_state enable row level security;
alter table public.cyberdocs_orders enable row level security;
alter table public.cyberdocs_webhook_events enable row level security;
alter table public.cyberdocs_order_events enable row level security;

drop policy if exists "CyberDocs state is server only" on public.cyberdocs_integration_state;
create policy "CyberDocs state is server only"
on public.cyberdocs_integration_state for all to anon, authenticated
using (false) with check (false);

drop policy if exists "CyberDocs orders are server only" on public.cyberdocs_orders;
create policy "CyberDocs orders are server only"
on public.cyberdocs_orders for all to anon, authenticated
using (false) with check (false);

drop policy if exists "CyberDocs webhooks are server only" on public.cyberdocs_webhook_events;
create policy "CyberDocs webhooks are server only"
on public.cyberdocs_webhook_events for all to anon, authenticated
using (false) with check (false);

drop policy if exists "CyberDocs audit is server only" on public.cyberdocs_order_events;
create policy "CyberDocs audit is server only"
on public.cyberdocs_order_events for all to anon, authenticated
using (false) with check (false);

revoke all on public.cyberdocs_integration_state from anon, authenticated;
revoke all on public.cyberdocs_orders from anon, authenticated;
revoke all on public.cyberdocs_webhook_events from anon, authenticated;
revoke all on public.cyberdocs_order_events from anon, authenticated;

grant all on public.cyberdocs_integration_state to service_role;
grant all on public.cyberdocs_orders to service_role;
grant all on public.cyberdocs_webhook_events to service_role;
grant all on public.cyberdocs_order_events to service_role;

