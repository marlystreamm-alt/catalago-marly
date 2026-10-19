-- MA² v20.56 · seguridad, revisiones, actividad, versiones y respaldos.

alter table public.directory_menu_requests add column if not exists trial_status text not null default 'not_requested';
alter table public.directory_menu_requests add column if not exists trial_space_type text;
alter table public.directory_menu_requests add column if not exists trial_ends_on date;
alter table public.directory_menu_requests add column if not exists plan_space_type text;
alter table public.directory_menu_requests add column if not exists trial_business_id uuid references public.menu_businesses(id) on delete set null;
alter table public.directory_menu_requests add column if not exists trial_url text;
alter table public.directory_menu_requests add column if not exists directory_image text not null default '';

alter table public.notification_settings add column if not exists admin_recovery_hash text not null default '';
alter table public.notification_settings add column if not exists admin_recovery_salt text not null default '';
alter table public.notification_settings add column if not exists admin_password_updated_at timestamptz;

create table if not exists public.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  actor_name text not null default 'Administrador',
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  user_agent text not null default ''
);

create table if not exists public.system_activity (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.menu_businesses(id) on delete cascade,
  actor_name text not null default 'Sistema',
  actor_kind text not null default 'system',
  section text not null,
  action text not null,
  entity_type text not null default '',
  entity_id text not null default '',
  detail text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.entity_versions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.menu_businesses(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  revision integer not null,
  action text not null check (action in ('update','delete','backup')),
  payload jsonb not null,
  actor_name text not null default 'Sistema',
  created_at timestamptz not null default now()
);

create table if not exists public.app_backups (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  business_id uuid references public.menu_businesses(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  created_by text not null default 'scheduled',
  note text not null default ''
);

create table if not exists public.stock_alert_settings (
  business_key text primary key,
  minimum_per_platform integer not null default 2 check (minimum_per_platform between 1 and 999),
  expiry_warning_days integer not null default 7 check (expiry_warning_days between 1 and 90),
  renewal_warning_days integer not null default 7 check (renewal_warning_days between 1 and 90),
  updated_at timestamptz not null default now()
);

alter table public.catalog_app_state add column if not exists revision integer not null default 1;
alter table public.menu_spaces add column if not exists revision integer not null default 1;
alter table public.menu_categories add column if not exists revision integer not null default 1;
alter table public.menu_items add column if not exists revision integer not null default 1;
alter table public.stock_items add column if not exists revision integer not null default 1;

create or replace function public.ma2_capture_version()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  old_json jsonb := to_jsonb(old);
  bid uuid;
  rev integer;
begin
  bid := nullif(old_json ->> 'business_id', '')::uuid;
  rev := coalesce((old_json ->> 'revision')::integer, 1);
  insert into public.entity_versions (business_id, entity_type, entity_id, revision, action, payload)
  values (bid, tg_table_name, old_json ->> 'id', rev, lower(tg_op), old_json);
  if tg_op = 'UPDATE' then
    new.revision := rev + 1;
    return new;
  end if;
  return old;
end;
$$;

drop trigger if exists menu_spaces_versioning on public.menu_spaces;
create trigger menu_spaces_versioning before update or delete on public.menu_spaces for each row execute function public.ma2_capture_version();
drop trigger if exists menu_categories_versioning on public.menu_categories;
create trigger menu_categories_versioning before update or delete on public.menu_categories for each row execute function public.ma2_capture_version();
drop trigger if exists menu_items_versioning on public.menu_items;
create trigger menu_items_versioning before update or delete on public.menu_items for each row execute function public.ma2_capture_version();
drop trigger if exists stock_items_versioning on public.stock_items;
create trigger stock_items_versioning before update or delete on public.stock_items for each row execute function public.ma2_capture_version();

create index if not exists admin_sessions_active_idx on public.admin_sessions (expires_at) where revoked_at is null;
create index if not exists system_activity_created_idx on public.system_activity (created_at desc);
create index if not exists system_activity_business_idx on public.system_activity (business_id, created_at desc);
create index if not exists entity_versions_entity_idx on public.entity_versions (entity_type, entity_id, revision desc);
create index if not exists entity_versions_business_idx on public.entity_versions (business_id, created_at desc);
create index if not exists app_backups_created_idx on public.app_backups (created_at desc);
create index if not exists app_backups_business_idx on public.app_backups (business_id, created_at desc);

grant all on public.admin_sessions, public.system_activity, public.entity_versions, public.app_backups, public.stock_alert_settings to service_role;
alter table public.admin_sessions enable row level security;
alter table public.system_activity enable row level security;
alter table public.entity_versions enable row level security;
alter table public.app_backups enable row level security;
alter table public.stock_alert_settings enable row level security;

drop policy if exists "Server only admin sessions" on public.admin_sessions;
create policy "Server only admin sessions" on public.admin_sessions for all to anon, authenticated using (false) with check (false);
drop policy if exists "Server only system activity" on public.system_activity;
create policy "Server only system activity" on public.system_activity for all to anon, authenticated using (false) with check (false);
drop policy if exists "Server only entity versions" on public.entity_versions;
create policy "Server only entity versions" on public.entity_versions for all to anon, authenticated using (false) with check (false);
drop policy if exists "Server only app backups" on public.app_backups;
create policy "Server only app backups" on public.app_backups for all to anon, authenticated using (false) with check (false);
drop policy if exists "Server only stock alert settings" on public.stock_alert_settings;
create policy "Server only stock alert settings" on public.stock_alert_settings for all to anon, authenticated using (false) with check (false);
