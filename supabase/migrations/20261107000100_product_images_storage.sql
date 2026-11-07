INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  CREATE POLICY "Public can view product images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'product-images');
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can upload product images to their own folder"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'product-images'
      AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can update product images in their own folder"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
      bucket_id = 'product-images'
      AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    )
    WITH CHECK (
      bucket_id = 'product-images'
      AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can delete product images in their own folder"
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'product-images'
      AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
