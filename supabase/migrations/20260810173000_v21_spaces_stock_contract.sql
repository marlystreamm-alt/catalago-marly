-- MA² Connect v21: pestañas por cliente, contratación y gestor de stock aislado.
alter table if exists public.menu_businesses
  add column if not exists allowed_spaces integer not null default 1,
  add column if not exists plan_name text not null default 'Plan base',
  add column if not exists renewal_price numeric not null default 0,
  add column if not exists billing_day integer,
  add column if not exists grace_days integer not null default 1,
  add column if not exists contract_started_on date not null default ((now() at time zone 'America/Monterrey')::date),
  add column if not exists whatsapp_template text not null default 'Hola {cliente}, aquí tienes tu entrega: {link}',
  add column if not exists suspension_message text not null default 'Servicio no disponible. Contacta al administrador.';

do $$ begin
  alter table public.menu_businesses add constraint menu_businesses_allowed_spaces_check check (allowed_spaces >= 1 and allowed_spaces <= 50);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.menu_businesses add constraint menu_businesses_grace_days_check check (grace_days >= 0 and grace_days <= 7);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.menu_businesses add constraint menu_businesses_billing_day_check check (billing_day is null or (billing_day >= 1 and billing_day <= 31));
exception when duplicate_object then null; end $$;

create table if not exists public.menu_spaces (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.menu_businesses(id) on delete cascade,
  kind text not null default 'catalog' check (kind in ('catalog','menu','directory')),
  name text not null default '',
  subtitle text not null default '',
  image_url text not null default '',
  slug text not null unique,
  hidden boolean not null default false,
  sort_index integer not null default 0,
  notice_enabled boolean not null default false,
  notice_title text not null default '',
  notice_message text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists menu_spaces_business_idx on public.menu_spaces(business_id, sort_index);

alter table if exists public.menu_categories
  add column if not exists space_id uuid references public.menu_spaces(id) on delete cascade,
  add column if not exists parent_id uuid references public.menu_categories(id) on delete set null,
  add column if not exists hidden boolean not null default false;
alter table if exists public.menu_items
  add column if not exists space_id uuid references public.menu_spaces(id) on delete cascade;

-- Crea una pestaña base para clientes existentes si aún no tienen ninguna.
insert into public.menu_spaces (business_id, kind, name, subtitle, image_url, slug, hidden, sort_index)
select b.id, 'catalog', b.name, 'Catálogo digital', b.logo_url,
       case when coalesce(nullif(b.slug,''),'') <> '' then b.slug else 'espacio-' || left(b.id::text,8) end,
       false, 0
from public.menu_businesses b
where not exists (select 1 from public.menu_spaces s where s.business_id = b.id)
on conflict (slug) do nothing;

update public.menu_categories c
set space_id = s.id
from public.menu_spaces s
where c.business_id = s.business_id and c.space_id is null and s.sort_index = 0;
update public.menu_items i
set space_id = s.id
from public.menu_spaces s
where i.business_id = s.business_id and i.space_id is null and s.sort_index = 0;

create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.menu_businesses(id) on delete cascade,
  platform text not null default '',
  account_type text not null default '',
  username text not null default '',
  password_cipher text not null default '',
  profile_pin text not null default '',
  panel_url text not null default '',
  provider text not null default '',
  client_name text not null default '',
  client_whatsapp text not null default '',
  status text not null default 'available' check (status in ('available','assigned','expiring','expired','client_replacement','provider_replacement')),
  acquired_on date,
  delivered_on date,
  expires_on date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stock_items_business_idx on public.stock_items(business_id, status, expires_on);

create table if not exists public.contract_renewals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.menu_businesses(id) on delete cascade,
  previous_expires_on date,
  new_expires_on date not null,
  amount numeric not null default 0,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists contract_renewals_business_idx on public.contract_renewals(business_id, created_at desc);
