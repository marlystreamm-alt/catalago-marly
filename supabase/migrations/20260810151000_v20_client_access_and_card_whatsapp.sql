ALTER TABLE public.menu_businesses
  ADD COLUMN IF NOT EXISTS access_username text NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS menu_businesses_access_username_unique
  ON public.menu_businesses (lower(access_username))
  WHERE access_username <> '';

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS whatsapp text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS whatsapp_message text NOT NULL DEFAULT '';
