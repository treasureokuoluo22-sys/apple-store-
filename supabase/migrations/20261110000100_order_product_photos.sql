INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'order-product-photos',
  'order-product-photos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Customers can upload order product photos"
  ON storage.objects;
CREATE POLICY "Customers can upload order product photos"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'order-product-photos'
    AND name ~ '^product-photos/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|png|webp)$'
  );

DROP POLICY IF EXISTS "Restrict order product photo uploads"
  ON storage.objects;
CREATE POLICY "Restrict order product photo uploads"
  ON storage.objects AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id <> 'order-product-photos'
    OR name ~ '^product-photos/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|png|webp)$'
  );

DROP POLICY IF EXISTS "Keep order product photos private"
  ON storage.objects;
CREATE POLICY "Keep order product photos private"
  ON storage.objects AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (bucket_id <> 'order-product-photos');

DROP POLICY IF EXISTS "Prevent order product photo updates"
  ON storage.objects;
CREATE POLICY "Prevent order product photo updates"
  ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (bucket_id <> 'order-product-photos')
  WITH CHECK (bucket_id <> 'order-product-photos');

DROP POLICY IF EXISTS "Prevent order product photo deletes"
  ON storage.objects;
CREATE POLICY "Prevent order product photo deletes"
  ON storage.objects AS RESTRICTIVE FOR DELETE TO anon, authenticated
  USING (bucket_id <> 'order-product-photos');
