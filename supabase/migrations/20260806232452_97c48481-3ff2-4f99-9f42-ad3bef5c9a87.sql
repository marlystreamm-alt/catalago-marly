ALTER TABLE public.menu_businesses ADD COLUMN IF NOT EXISTS slug text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.menu_business_slugify()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base text;
  candidate text;
  n integer := 1;
BEGIN
  IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
    base := lower(regexp_replace(unaccent_fallback(coalesce(NEW.name, '')), '[^a-zA-Z0-9]+', '-', 'g'));
    base := btrim(base, '-');
    IF base = '' THEN
      base := 'negocio';
    END IF;
    candidate := base;
    WHILE EXISTS (SELECT 1 FROM public.menu_businesses b WHERE b.slug = candidate AND b.id <> NEW.id) LOOP
      n := n + 1;
      candidate := base || '-' || n;
    END LOOP;
    NEW.slug := candidate;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.unaccent_fallback(txt text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT translate(
    txt,
    'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
    'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
  );
$$;

DROP TRIGGER IF EXISTS menu_businesses_slugify ON public.menu_businesses;
CREATE TRIGGER menu_businesses_slugify
BEFORE INSERT OR UPDATE ON public.menu_businesses
FOR EACH ROW EXECUTE FUNCTION public.menu_business_slugify();

UPDATE public.menu_businesses SET slug = '' WHERE slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS menu_businesses_slug_key ON public.menu_businesses (slug);