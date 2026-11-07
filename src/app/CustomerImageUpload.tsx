
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function CustomerImageUpload() {
  const [enabled, setEnabled] = useState(false);
  const [checking, setChecking] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function checkSetting() {
      const { data, error } = await supabase
        .from("store_settings")
        .select("customer_uploads_enabled")
        .eq("id", 1)
        .single();

      if (!error && data) {
        setEnabled(data.customer_uploads_enabled === true);
      }

      setChecking(false);
    }

    checkSetting();
  }, []);

  async function submitImage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!enabled) {
      setMessage("Customer image uploads are currently unavailable.");
      return;
    }

    if (!file) {
      setMessage("Please choose an image first.");
      return;
    }

    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      setMessage("Choose a valid image no larger than 5 MB.");
      return;
    }

    setSubmitting(true);

    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `submissions/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("customer-uploads")
        .upload(filePath, file, {
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        setMessage(
          "The image could not be uploaded. Please try again later."
        );
        console.error("Customer image upload failed:", uploadError.message);
        return;
      }

      const { error: insertError } = await supabase
        .from("customer_uploads")
        .insert({
          image_path: filePath,
          status: "pending",
        });

      if (insertError) {
        console.error("Submission record failed:", insertError.message);

        // Remove the uploaded file if its submission record could not be saved.
        const { error: cleanupError } = await supabase.storage
          .from("customer-uploads")
          .remove([filePath]);

        if (cleanupError) {
          console.error("Could not clean up orphaned image:", cleanupError.message);
        }

        setMessage(
          "Your submission could not be recorded. Please try again later."
        );
        return;
      }

      setFile(null);
      const input = document.getElementById(
        "customer-image-file"
      ) as HTMLInputElement | null;

      if (input) input.value = "";

      setMessage("Image submitted successfully for admin review.");
    } catch {
      setMessage("Something went wrong. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return <p>Checking image-upload availability...</p>;
  }

  if (!enabled) {
    return null;
  }

  return (
    <section className="customer-upload-section" id="customer-upload">
      <p className="eyebrow">CUSTOMER IMAGE SUBMISSION</p>
      <h2>Share your image.</h2>

      <p className="checkout-description">
        Submit an image for review by our store administrator.
      </p>

      <form onSubmit={submitImage} className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="customer-image-file"
            className="mb-2 block text-sm font-medium"
          >
            Choose an image
          </label>

          <input
            id="customer-image-file"
            type="file"
            accept="image/*"
            required
            onChange={(event) =>
              setFile(event.target.files?.[0] ?? null)
            }
            className="block w-full text-sm"
          />

          <p className="mt-2 text-xs text-neutral-500">
            Image files only. Maximum size: 5 MB.
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting || !file}
          className="rounded-xl bg-[#1d1d1f] px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {submitting ? "Submitting..." : "Submit image for review"}
        </button>

        {message && (
          <p role="status" className="text-sm text-neutral-700">
            {message}
          </p>
        )}
      </form>
    </section>
  );
}
