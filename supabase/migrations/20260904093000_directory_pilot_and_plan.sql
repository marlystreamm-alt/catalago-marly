alter table public.directory_menu_requests add column if not exists trial_status text not null default 'not_requested';
alter table public.directory_menu_requests add column if not exists trial_space_type text;
alter table public.directory_menu_requests add column if not exists trial_ends_on date;
alter table public.directory_menu_requests add column if not exists plan_space_type text;
alter table public.directory_menu_requests add column if not exists trial_business_id uuid;
alter table public.directory_menu_requests add column if not exists trial_url text;
alter table public.directory_menu_requests add column if not exists directory_image text not null default '';
update public.directory_menu_requests set payment_amount = 100, payment_months = 3 where payment_amount is distinct from 100;
