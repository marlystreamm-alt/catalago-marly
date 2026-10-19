create table if not exists public.directory_menu_requests (
  id uuid primary key default gen_random_uuid(),
  lookup_code text not null unique,
  catalog_id text not null default '',
  service_id text not null default '',
  service_name text not null default '',
  business_name text not null default '',
  contact_name text not null default '',
  whatsapp text not null default '',
  email text not null default '',
  status text not null default 'pending' check (status in ('pending','payment_pending','proof_uploaded','active','rejected')),
  payment_amount numeric not null default 70,
  payment_months integer not null default 3,
  payment_instructions text not null default '',
  payment_proof text not null default '',
  admin_note text not null default '',
  menu_business_id uuid references public.menu_businesses(id) on delete set null,
  menu_url text not null default '',
  access_username text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists directory_menu_requests_status_idx on public.directory_menu_requests(status, created_at desc);
create index if not exists directory_menu_requests_service_idx on public.directory_menu_requests(catalog_id, service_id);
grant all on public.directory_menu_requests to service_role;
alter table public.directory_menu_requests enable row level security;
do $$ begin
  create policy "No direct access to directory menu requests" on public.directory_menu_requests for all to anon, authenticated using (false) with check (false);
exception when duplicate_object then null; end $$;
