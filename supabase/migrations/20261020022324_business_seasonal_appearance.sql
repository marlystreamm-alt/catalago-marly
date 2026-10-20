alter table public.menu_businesses add column if not exists appearance jsonb not null default '{}'::jsonb;
notify pgrst, 'reload schema';
