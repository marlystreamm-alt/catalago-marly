-- MA²: campos extra del Gestor de stock e historial.
alter table if exists public.stock_items
  add column if not exists catalog_ref text not null default '';

create table if not exists public.stock_history (
  id uuid primary key default gen_random_uuid(),
  stock_id uuid not null,
  business_id uuid references public.menu_businesses(id) on delete cascade,
  action text not null default '',
  detail text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists stock_history_stock_idx on public.stock_history(stock_id, created_at desc);
create index if not exists stock_history_business_idx on public.stock_history(business_id, created_at desc);
