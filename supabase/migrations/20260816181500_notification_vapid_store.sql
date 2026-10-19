alter table public.notification_settings add column if not exists vapid_public_key text;
alter table public.notification_settings add column if not exists vapid_private_key text;
alter table public.notification_settings add column if not exists vapid_subject text;
