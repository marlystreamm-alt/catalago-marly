create table if not exists public.ma2_platform_gallery (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(title) between 1 and 150),
 platform text not null check (char_length(platform) between 1 and 100),
 thumbnail text not null check (char_length(thumbnail) <= 60000),
 image_cipher text not null check (char_length(image_cipher) <= 4000000),
 created_at timestamptz not null default now(),
 archived_at timestamptz
);
alter table public.ma2_platform_gallery enable row level security;
revoke all on table public.ma2_platform_gallery from public, anon, authenticated;
grant select, insert, update on table public.ma2_platform_gallery to service_role;
create index if not exists ma2_platform_gallery_active_created_idx on public.ma2_platform_gallery (created_at desc, id) where archived_at is null;
comment on table public.ma2_platform_gallery is 'Private administrator instruction images. Delivery documents retain their own encrypted snapshots.';
notify pgrst, 'reload schema';
