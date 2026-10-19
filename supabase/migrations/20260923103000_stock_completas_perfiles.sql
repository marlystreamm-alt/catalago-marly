alter table public.stock_items add column if not exists stock_kind text not null default 'complete';
alter table public.stock_items add column if not exists parent_stock_id uuid references public.stock_items(id) on delete cascade;
alter table public.stock_items drop constraint if exists stock_items_stock_kind_check;
alter table public.stock_items add constraint stock_items_stock_kind_check check (stock_kind in ('complete','profile'));
create index if not exists stock_items_parent_idx on public.stock_items(parent_stock_id);
