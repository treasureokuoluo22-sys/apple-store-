ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS recipient_name text;

NOTIFY pgrst, 'reload schema';
