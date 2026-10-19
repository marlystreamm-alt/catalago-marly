alter table public.notification_settings
  add column if not exists channel_alexa_app boolean not null default false;

alter table public.notification_settings
  add column if not exists alexa_app_device text not null default '';

alter table public.notification_settings
  add column if not exists whatsapp_provider text not null default 'twilio';

update public.notification_settings
set channel_whatsapp = false
where id = 1;
