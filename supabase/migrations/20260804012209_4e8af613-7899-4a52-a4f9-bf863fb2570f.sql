CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  catalog_id TEXT NOT NULL DEFAULT '',
  catalog_name TEXT NOT NULL DEFAULT '',
  service_name TEXT NOT NULL DEFAULT '',
  total NUMERIC NOT NULL DEFAULT 0,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  message TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  recipient TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'nuevo',
  notified_at TIMESTAMPTZ,
  notify_attempts INTEGER NOT NULL DEFAULT 0,
  attended_at TIMESTAMPTZ,
  CONSTRAINT orders_status_check CHECK (status IN ('nuevo','atendido'))
);

GRANT INSERT ON public.orders TO anon;
GRANT INSERT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cualquiera puede registrar un pedido" ON public.orders FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE INDEX orders_status_created_idx ON public.orders (status, created_at DESC);

CREATE TABLE public.notification_settings (
  id INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT true,
  channel_push BOOLEAN NOT NULL DEFAULT true,
  channel_email BOOLEAN NOT NULL DEFAULT false,
  channel_whatsapp BOOLEAN NOT NULL DEFAULT false,
  channel_alexa BOOLEAN NOT NULL DEFAULT false,
  email TEXT NOT NULL DEFAULT '',
  whatsapp_number TEXT NOT NULL DEFAULT '',
  alexa_provider TEXT NOT NULL DEFAULT 'notifyme',
  alexa_token TEXT NOT NULL DEFAULT '',
  alexa_device TEXT NOT NULL DEFAULT '',
  repeat_enabled BOOLEAN NOT NULL DEFAULT true,
  repeat_minutes INTEGER NOT NULL DEFAULT 15,
  quiet_start TEXT NOT NULL DEFAULT '08:00',
  quiet_end TEXT NOT NULL DEFAULT '00:00',
  auto_off_midnight BOOLEAN NOT NULL DEFAULT true,
  timezone TEXT NOT NULL DEFAULT 'America/Monterrey',
  admin_code_hash TEXT NOT NULL DEFAULT '',
  admin_code_salt TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notification_settings_single_row CHECK (id = 1)
);

GRANT ALL ON public.notification_settings TO service_role;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.notification_settings (id) VALUES (1);

CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT ''
);

GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;