ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.notification_settings ADD COLUMN IF NOT EXISTS escalate_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.notification_settings ADD COLUMN IF NOT EXISTS escalate_minutes integer NOT NULL DEFAULT 30;
ALTER TABLE public.notification_settings ADD COLUMN IF NOT EXISTS escalate_channel text NOT NULL DEFAULT 'whatsapp';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS escalated_at timestamptz;

CREATE TABLE IF NOT EXISTS public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  order_id uuid,
  channel text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'nuevo',
  attempt integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'enviado',
  detail text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS notification_log_created_idx ON public.notification_log (created_at DESC);

GRANT ALL ON public.notification_log TO service_role;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;