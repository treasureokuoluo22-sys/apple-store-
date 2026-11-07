ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS usd_to_gbp numeric
    CHECK (usd_to_gbp IS NULL OR usd_to_gbp > 0),
  ADD COLUMN IF NOT EXISTS usd_to_eur numeric
    CHECK (usd_to_eur IS NULL OR usd_to_eur > 0);

NOTIFY pgrst, 'reload schema';
