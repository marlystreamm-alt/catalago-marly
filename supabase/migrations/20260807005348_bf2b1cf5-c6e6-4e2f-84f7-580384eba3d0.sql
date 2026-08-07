ALTER TABLE public.menu_businesses
  ADD COLUMN IF NOT EXISTS expires_on date,
  ADD COLUMN IF NOT EXISTS logo_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS access_salt text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS access_hash text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS access_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS access_temp boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS access_suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '{
    "show_prices": true,
    "show_photos": true,
    "show_descriptions": true,
    "show_whatsapp": true,
    "show_address": true,
    "edit_prices": true,
    "edit_item_text": true,
    "edit_photos": true,
    "add_items": true,
    "delete_items": false,
    "edit_categories": true,
    "toggle_items": true,
    "edit_business": false
  }'::jsonb;