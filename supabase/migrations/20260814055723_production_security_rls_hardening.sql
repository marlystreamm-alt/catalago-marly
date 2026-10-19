alter table public.contract_renewals enable row level security;
alter table public.menu_spaces enable row level security;
alter table public.stock_items enable row level security;
alter table public.stock_history enable row level security;

drop policy if exists "No direct access to contract renewals" on public.contract_renewals;
create policy "No direct access to contract renewals" on public.contract_renewals for all to anon, authenticated using (false) with check (false);

drop policy if exists "No direct access to menu spaces" on public.menu_spaces;
create policy "No direct access to menu spaces" on public.menu_spaces for all to anon, authenticated using (false) with check (false);

drop policy if exists "No direct access to stock items" on public.stock_items;
create policy "No direct access to stock items" on public.stock_items for all to anon, authenticated using (false) with check (false);

drop policy if exists "No direct access to stock history" on public.stock_history;
create policy "No direct access to stock history" on public.stock_history for all to anon, authenticated using (false) with check (false);

drop policy if exists "Cualquiera puede registrar un pedido" on public.orders;
drop policy if exists "No direct access to orders" on public.orders;
create policy "No direct access to orders" on public.orders for all to anon, authenticated using (false) with check (false);

grant all on public.contract_renewals, public.menu_spaces, public.stock_items, public.stock_history, public.orders to service_role;
