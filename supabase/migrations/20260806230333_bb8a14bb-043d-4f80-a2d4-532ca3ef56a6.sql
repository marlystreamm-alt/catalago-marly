CREATE TABLE public.menu_businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  owner_name text NOT NULL DEFAULT '',
  whatsapp text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  sort_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.menu_businesses(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  sort_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.menu_businesses(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  price numeric NOT NULL DEFAULT 0,
  price_text text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  available boolean NOT NULL DEFAULT true,
  sort_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX menu_categories_business_idx ON public.menu_categories(business_id);
CREATE INDEX menu_items_business_idx ON public.menu_items(business_id);
CREATE INDEX menu_items_category_idx ON public.menu_items(category_id);

GRANT ALL ON public.menu_businesses TO service_role;
GRANT ALL ON public.menu_categories TO service_role;
GRANT ALL ON public.menu_items TO service_role;

ALTER TABLE public.menu_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access to menu businesses" ON public.menu_businesses FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No direct access to menu categories" ON public.menu_categories FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No direct access to menu items" ON public.menu_items FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE TRIGGER update_menu_businesses_updated_at BEFORE UPDATE ON public.menu_businesses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_menu_categories_updated_at BEFORE UPDATE ON public.menu_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();