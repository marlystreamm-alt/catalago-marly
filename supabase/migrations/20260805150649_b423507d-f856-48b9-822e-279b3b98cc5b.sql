CREATE TABLE IF NOT EXISTS public.menu_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  owner_name text NOT NULL DEFAULT '',
  whatsapp text NOT NULL DEFAULT '',
  slug text NOT NULL UNIQUE,
  catalog_id text NOT NULL DEFAULT 'clientes',
  plan text NOT NULL DEFAULT 'mensual',
  price numeric NOT NULL DEFAULT 0,
  started_on date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Monterrey')::date,
  expires_on date NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Monterrey')::date + 30),
  suspended boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.menu_subscriptions TO service_role;
ALTER TABLE public.menu_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to subscriptions" ON public.menu_subscriptions;
CREATE POLICY "No direct access to subscriptions" ON public.menu_subscriptions FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.subscription_renewals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.menu_subscriptions(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'mes',
  previous_expires date,
  new_expires date,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.subscription_renewals TO service_role;
ALTER TABLE public.subscription_renewals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to renewals" ON public.subscription_renewals;
CREATE POLICY "No direct access to renewals" ON public.subscription_renewals FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_subscription_renewals_sub ON public.subscription_renewals(subscription_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_menu_subscriptions_updated_at ON public.menu_subscriptions;
CREATE TRIGGER update_menu_subscriptions_updated_at
BEFORE UPDATE ON public.menu_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.menu_subscriptions (business_name, owner_name, whatsapp, slug, catalog_id, plan, price, started_on, expires_on, notes)
VALUES ('Boutique Marly', 'Marly Gómez', '528112345678', 'boutique-marly', 'clientes', 'mensual', 250, (now() AT TIME ZONE 'America/Monterrey')::date - 10, (now() AT TIME ZONE 'America/Monterrey')::date + 20, 'Registro de demostración para probar activar, suspender y renovar.')
ON CONFLICT (slug) DO NOTHING;