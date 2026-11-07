ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_gbp numeric
    CHECK (price_gbp IS NULL OR price_gbp >= 0),
  ADD COLUMN IF NOT EXISTS price_eur numeric
    CHECK (price_eur IS NULL OR price_eur >= 0);

NOTIFY pgrst, 'reload schema';
