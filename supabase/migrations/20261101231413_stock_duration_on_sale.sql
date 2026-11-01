alter table public.stock_items add column duration_months integer not null default 1 check(duration_months between 1 and 36);
alter table public.stock_items add column starts_on_sale boolean not null default true;
notify pgrst,'reload schema';
