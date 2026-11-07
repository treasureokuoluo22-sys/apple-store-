ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id);

DO $$
DECLARE
  existing_user_count integer;
  original_admin_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.products WHERE owner_id IS NULL) THEN
    SELECT
      count(*),
      (array_agg(id ORDER BY created_at ASC))[1]
    INTO existing_user_count, original_admin_id
    FROM auth.users;

    IF existing_user_count <> 1 THEN
      RAISE EXCEPTION
        'Product ownership migration requires exactly one existing Supabase Auth user to safely assign the current catalog.';
    END IF;

    UPDATE public.products
    SET owner_id = original_admin_id
    WHERE owner_id IS NULL;
  END IF;
END $$;

ALTER TABLE public.products
  ALTER COLUMN owner_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS products_owner_id_idx
  ON public.products (owner_id);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read products" ON public.products;
CREATE POLICY "Public can read products"
  ON public.products FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert their own products" ON public.products;
CREATE POLICY "Admins can insert their own products"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can update their own products" ON public.products;
CREATE POLICY "Admins can update their own products"
  ON public.products FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can delete their own products" ON public.products;
CREATE POLICY "Admins can delete their own products"
  ON public.products FOR DELETE TO authenticated
  USING (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Restrict product inserts to the owner" ON public.products;
CREATE POLICY "Restrict product inserts to the owner"
  ON public.products AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Restrict product updates to the owner" ON public.products;
CREATE POLICY "Restrict product updates to the owner"
  ON public.products AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Restrict product deletes to the owner" ON public.products;
CREATE POLICY "Restrict product deletes to the owner"
  ON public.products AS RESTRICTIVE FOR DELETE TO authenticated
  USING (owner_id = (SELECT auth.uid()));

NOTIFY pgrst, 'reload schema';
