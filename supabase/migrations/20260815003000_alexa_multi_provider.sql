-- MA² v20.10: Alexa multi-proveedor y selección de eventos.
ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS alexa_webhook_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS alexa_webhook_secret text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS alexa_method text NOT NULL DEFAULT 'POST',
  ADD COLUMN IF NOT EXISTS alexa_body_template text NOT NULL DEFAULT '{"message":"{message}","event":"{event}","source":"MA2"}',
  ADD COLUMN IF NOT EXISTS alexa_events jsonb NOT NULL DEFAULT '{"order_new":true,"order_reminder":true,"directory_request":true,"menu_extra_request":true,"payment_proof":true,"client_suspended":true}'::jsonb;

UPDATE public.notification_settings
SET alexa_provider = 'voicemonkey'
WHERE alexa_provider IS NULL OR alexa_provider = '' OR alexa_provider = 'notifyme';
