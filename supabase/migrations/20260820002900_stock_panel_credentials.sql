alter table public.stock_items
  add column if not exists panel_username text not null default '',
  add column if not exists panel_password_cipher text not null default '';
