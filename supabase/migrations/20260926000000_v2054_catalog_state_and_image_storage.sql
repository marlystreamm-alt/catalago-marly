create table if not exists public.catalog_app_state (
  id integer primary key check (id = 1),
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.catalog_app_state enable row level security;
revoke all on table public.catalog_app_state from anon, authenticated;
grant all on table public.catalog_app_state to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ma2-images',
  'ma2-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table storage.objects enable row level security;

drop policy if exists "Public read MA2 catalog images" on storage.objects;
create policy "Public read MA2 catalog images"
  on storage.objects
  for select
  to public
  using (bucket_id = 'ma2-images' and name like 'library/%');
