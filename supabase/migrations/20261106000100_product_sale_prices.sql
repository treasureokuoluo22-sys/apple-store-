ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sale_price numeric
    CHECK (sale_price IS NULL OR sale_price >= 0),
  ADD COLUMN IF NOT EXISTS sale_price_gbp numeric
    CHECK (sale_price_gbp IS NULL OR sale_price_gbp >= 0),
  ADD COLUMN IF NOT EXISTS sale_price_eur numeric
    CHECK (sale_price_eur IS NULL OR sale_price_eur >= 0);

NOTIFY pgrst, 'reload schema';
