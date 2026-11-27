alter table public.menu_admins
  add column username text check (username ~ '^[a-z0-9][a-z0-9._-]{2,29}$'),
  add column client_id uuid references public.ma2_ops_records(id) on delete set null;

create unique index menu_admins_business_username_uidx
  on public.menu_admins (business_id, username)
  where username is not null;

create unique index menu_admins_business_client_uidx
  on public.menu_admins (business_id, client_id)
  where client_id is not null;
