import type { SupabaseClient } from "@supabase/supabase-js";

export const PRODUCT_IMAGE_BUCKET = "product-images";
export const PRODUCT_IMAGE_MAX_SIZE = 5 * 1024 * 1024;

const extensionByType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function validateProductImage(file: File): string | null {
  if (!extensionByType[file.type]) {
    return "Product photos must be JPG, PNG, or WebP images.";
  }

  if (file.size > PRODUCT_IMAGE_MAX_SIZE) {
    return "Each product photo must be 5 MB or smaller.";
  }

  return null;
}

export async function uploadProductImages(
  supabase: SupabaseClient,
  files: readonly (File | null)[],
  userId: string,
  productId: string
): Promise<{ urls: (string | null)[]; paths: string[] }> {
  const urls: (string | null)[] = [];
  const paths: string[] = [];

  try {
    for (const file of files) {
      if (!file) {
        urls.push(null);
        continue;
      }

      const validationError = validateProductImage(file);
      if (validationError) {
        throw new Error(validationError);
      }

      const path = `${userId}/${productId}/${crypto.randomUUID()}.${extensionByType[file.type]}`;
      const { error } = await supabase.storage
        .from(PRODUCT_IMAGE_BUCKET)
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
        });

      if (error) {
        throw new Error(`Could not upload product photo: ${error.message}`);
      }

      paths.push(path);
      const { data } = supabase.storage
        .from(PRODUCT_IMAGE_BUCKET)
        .getPublicUrl(path);
      urls.push(data.publicUrl);
    }

    return { urls, paths };
  } catch (error) {
    if (paths.length > 0) {
      const { error: cleanupError } = await supabase.storage
        .from(PRODUCT_IMAGE_BUCKET)
        .remove(paths);

      if (cleanupError) {
        console.error(
          "Could not clean up product photos after an upload failed:",
          cleanupError.message
        );
      }
    }

    throw error;
  }
}

export function getProductImageStoragePath(url: string | null): string | null {
  if (!url) return null;

  try {
    const pathname = new URL(url).pathname;
    const marker = `/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/`;
    const markerIndex = pathname.indexOf(marker);

    return markerIndex < 0
      ? null
      : decodeURIComponent(pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}
