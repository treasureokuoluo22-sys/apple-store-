"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import {
  getProductImageStoragePath,
  uploadProductImages,
  validateProductImage,
} from "@/lib/product-images";

type EditableProductDetails = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  image_url_2: string | null;
  image_url_3: string | null;
};

export default function ProductDetailsEditor({
  product,
}: {
  product: EditableProductDetails;
}) {
  const router = useRouter();
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? "");
  const [photoUrls, setPhotoUrls] = useState([
    product.image_url,
    product.image_url_2,
    product.image_url_3,
  ]);
  const [photoFiles, setPhotoFiles] = useState<(File | null)[]>([
    null,
    null,
    null,
  ]);
  const [removedPhotos, setRemovedPhotos] = useState([
    false,
    false,
    false,
  ]);
  const photoPreviews = useMemo(
    () =>
      photoFiles.map((file) => (file ? URL.createObjectURL(file) : null)),
    [photoFiles]
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(
    () => () => {
      photoPreviews.forEach((preview) => {
        if (preview) URL.revokeObjectURL(preview);
      });
    },
    [photoPreviews]
  );

  async function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!name.trim()) {
      setMessage("Enter a product name.");
      return;
    }

    const invalidFile = photoFiles.find(
      (file): file is File => file !== null && validateProductImage(file) !== null
    );
    if (invalidFile) {
      setMessage(validateProductImage(invalidFile) ?? "Invalid product photo.");
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        setMessage("Your session expired. Please sign in again.");
        return;
      }

      const { urls: uploadedUrls, paths: uploadedPaths } =
        await uploadProductImages(
          supabase,
          photoFiles,
          authData.user.id,
          product.id
        );
      const nextPhotoUrls = photoUrls.map((currentUrl, index) =>
        uploadedUrls[index] ?? (removedPhotos[index] ? null : currentUrl)
      );

      const { data, error } = await supabase
        .from("products")
        .update({
          name: name.trim(),
          description: description.trim(),
          image_url: nextPhotoUrls[0],
          image_url_2: nextPhotoUrls[1],
          image_url_3: nextPhotoUrls[2],
        })
        .eq("id", product.id)
        .select("id")
        .maybeSingle();

      if (error) {
        if (uploadedPaths.length > 0) {
          const { error: cleanupError } = await supabase.storage
            .from("product-images")
            .remove(uploadedPaths);
          if (cleanupError) {
            console.error(
              "Could not clean up uploaded product photos:",
              cleanupError.message
            );
          }
        }
        console.error("Could not save product details:", error.message);
        setMessage(
          "Could not save product details. Check the products table columns and admin update policy."
        );
        return;
      }

      if (!data) {
        if (uploadedPaths.length > 0) {
          const { error: cleanupError } = await supabase.storage
            .from("product-images")
            .remove(uploadedPaths);
          if (cleanupError) {
            console.error(
              "Could not clean up uploaded product photos:",
              cleanupError.message
            );
          }
        }
        setMessage(
          "No product was updated. Check that the product exists and your admin update policy allows it."
        );
        return;
      }

      const replacedImagePaths = photoUrls
        .map((url, index) =>
          photoFiles[index] || removedPhotos[index]
            ? getProductImageStoragePath(url)
            : null
        )
        .filter(
          (path): path is string =>
            path !== null &&
            path.startsWith(`${authData.user.id}/${product.id}/`)
        );
      let cleanupFailed = false;

      if (replacedImagePaths.length > 0) {
        const { error: cleanupError } = await supabase.storage
          .from("product-images")
          .remove(replacedImagePaths);
        if (cleanupError) {
          console.error(
            "Could not remove replaced product photos:",
            cleanupError.message
          );
          cleanupFailed = true;
        }
      }

      setPhotoUrls(nextPhotoUrls);
      setPhotoFiles([null, null, null]);
      setRemovedPhotos([false, false, false]);
      setMessage(
        cleanupFailed
          ? "Product details saved, but an old product photo could not be removed from storage."
          : "Product details saved."
      );
      router.refresh();
    } catch (error) {
      console.error("Could not save product details:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while saving product details."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={saveDetails} className="mt-5 space-y-4">
      <label className="block space-y-2 text-sm font-medium">
        Product name
        <input
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-xl border border-neutral-300 px-4 py-3 font-normal outline-none focus:border-neutral-800"
        />
      </label>

      <label className="block space-y-2 text-sm font-medium">
        Description
        <textarea
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="w-full rounded-xl border border-neutral-300 px-4 py-3 font-normal outline-none focus:border-neutral-800"
        />
      </label>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold">Product photos</legend>
        <p className="text-sm text-neutral-600">
          Upload JPG, PNG, or WebP photos up to 5 MB each. Select a replacement
          or remove an existing photo.
        </p>

        {photoUrls.map((currentUrl, index) => {
          const id = `product-photo-url-${index + 1}`;
          const preview = photoPreviews[index];
          const displayedUrl = preview
            ? preview
            : removedPhotos[index]
              ? null
              : currentUrl;

          return (
            <div key={id} className="space-y-3 rounded-xl border border-neutral-200 p-4">
              <label className="block space-y-2 text-sm font-medium">
                Photo {index + 1}
                <input
                  id={id}
                  key={`${id}-${photoFiles[index]?.name ?? "empty"}`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setPhotoFiles((currentFiles) =>
                      currentFiles.map((currentFile, photoIndex) =>
                        photoIndex === index ? file : currentFile
                      )
                    );
                    if (file) {
                      setRemovedPhotos((current) =>
                        current.map((removed, photoIndex) =>
                          photoIndex === index ? false : removed
                        )
                      );
                    }
                  }}
                  className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-4 file:py-2 file:font-medium"
                />
              </label>
              {displayedUrl && (
                <img
                  src={displayedUrl}
                  alt={`Product photo ${index + 1} preview`}
                  className="h-28 w-28 rounded-lg border border-neutral-200 object-contain"
                />
              )}
              {(currentUrl || photoFiles[index]) && (
                <button
                  type="button"
                  onClick={() => {
                    setPhotoFiles((currentFiles) =>
                      currentFiles.map((currentFile, photoIndex) =>
                        photoIndex === index ? null : currentFile
                      )
                    );
                    setRemovedPhotos((current) =>
                      current.map((removed, photoIndex) =>
                        photoIndex === index ? !removed : removed
                      )
                    );
                  }}
                  className="text-sm font-medium text-red-700 hover:underline"
                >
                  {removedPhotos[index] ? "Keep current photo" : "Remove photo"}
                </button>
              )}
            </div>
          );
        })}
      </fieldset>

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-[#1d1d1f] px-5 py-3 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save product details"}
      </button>

      {message && (
        <p role="status" className="text-sm text-neutral-700">
          {message}
        </p>
      )}
    </form>
  );
}
