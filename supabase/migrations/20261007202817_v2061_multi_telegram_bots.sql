-- MA² v20.61 · CyberDocs y bots adicionales de Telegram.
-- El bot receptor y sus secretos siguen viviendo sólo en el servidor.

alter table public.cyberdocs_integration_state
  add column if not exists additional_telegram_bots jsonb not null default '[]'::jsonb;

alter table public.cyberdocs_integration_state
  drop constraint if exists cyberdocs_integration_state_additional_telegram_bots_check;
alter table public.cyberdocs_integration_state
  add constraint cyberdocs_integration_state_additional_telegram_bots_check
  check (jsonb_typeof(additional_telegram_bots) = 'array');

alter table public.cyberdocs_orders
  add column if not exists source_key text not null default 'cyberdocsmx_bot',
  add column if not exists source_label text not null default 'CyberDocs',
  add column if not exists whatsapp text not null default '';

-- Los registros existentes conservan el valor predeterminado CyberDocs. En pantalla,
-- el contacto original funciona como respaldo si todavía no se guardó `whatsapp`.

alter table public.cyberdocs_orders
  drop constraint if exists cyberdocs_orders_cyberdocs_order_id_key;

create unique index if not exists cyberdocs_orders_source_external_id_key
  on public.cyberdocs_orders (source_key, cyberdocs_order_id);

create index if not exists cyberdocs_orders_source_created_idx
  on public.cyberdocs_orders (source_key, created_at desc);

create index if not exists cyberdocs_orders_protected_delivery_idx
  on public.cyberdocs_orders (protected_delivery_id)
  where protected_delivery_id is not null;

-- La función sólo se usa como trigger interno; no debe exponerse como RPC.
revoke execute on function public.cyberdocs_audit_order_change() from public, anon, authenticated;
grant execute on function public.cyberdocs_audit_order_change() to service_role;
