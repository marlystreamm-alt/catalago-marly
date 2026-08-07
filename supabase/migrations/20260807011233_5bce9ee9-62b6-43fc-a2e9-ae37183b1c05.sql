ALTER TABLE public.menu_businesses ADD COLUMN IF NOT EXISTS multi_admin boolean NOT NULL DEFAULT false;

CREATE TABLE public.menu_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.menu_businesses(id) ON DELETE CASCADE,
  actor_kind text NOT NULL DEFAULT 'dueno',
  actor_name text NOT NULL DEFAULT '',
  action text NOT NULL DEFAULT 'edicion',
  target text NOT NULL DEFAULT '',
  field text NOT NULL DEFAULT '',
  before_value text NOT NULL DEFAULT '',
  after_value text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX menu_audit_business_created_idx ON public.menu_audit (business_id, created_at DESC);
GRANT ALL ON public.menu_audit TO service_role;
ALTER TABLE public.menu_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access to menu audit" ON public.menu_audit FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE TABLE public.menu_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.menu_businesses(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  access_salt text NOT NULL DEFAULT '',
  access_hash text NOT NULL DEFAULT '',
  access_temp boolean NOT NULL DEFAULT true,
  suspended boolean NOT NULL DEFAULT false,
  last_login_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX menu_admins_business_idx ON public.menu_admins (business_id);
GRANT ALL ON public.menu_admins TO service_role;
ALTER TABLE public.menu_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access to menu admins" ON public.menu_admins FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER update_menu_admins_updated_at BEFORE UPDATE ON public.menu_admins FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();