CREATE TABLE public.menu_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.menu_businesses(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  origin text NOT NULL DEFAULT 'export',
  label text NOT NULL DEFAULT '',
  actor_kind text NOT NULL DEFAULT 'admin',
  actor_name text NOT NULL DEFAULT '',
  categories_count integer NOT NULL DEFAULT 0,
  items_count integer NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.menu_backups TO service_role;

ALTER TABLE public.menu_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access to menu backups"
  ON public.menu_backups FOR ALL
  TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE INDEX menu_backups_business_created_idx
  ON public.menu_backups (business_id, created_at DESC);