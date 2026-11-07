
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export default function CustomerUploadSettings() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadSettings() {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("store_settings")
        .select("customer_uploads_enabled")
        .eq("id", 1)
        .single();

      if (error) {
        setMessage("Could not load the setting. Check your Supabase policies.");
      } else {
        setEnabled(data.customer_uploads_enabled);
      }

      setLoading(false);
    }

    loadSettings();
  }, []);

  async function saveSetting(nextEnabled: boolean) {
    setSaving(true);
    setMessage("");

    try {
      const supabase = createClient();

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        setMessage("Your session expired. Please sign in again.");
        return;
      }

      const { error } = await supabase
        .from("store_settings")
        .update({ customer_uploads_enabled: nextEnabled })
        .eq("id", 1);

      if (error) {
        setMessage("Could not save the setting. Check your Supabase policies.");
        return;
      }

      setEnabled(nextEnabled);
      setMessage(
        nextEnabled
          ? "Customer image uploads enabled."
          : "Customer image uploads disabled."
      );
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="mt-4 text-sm text-neutral-600">Loading settings...</p>;
  }

  return (
    <section className="mt-8 rounded-2xl border border-black/5 bg-white p-6">
      <h2 className="text-lg font-semibold">Customer image uploads</h2>

      <p className="mt-2 text-sm text-neutral-600">
        Control whether customers can submit images through the storefront.
      </p>

      <div className="mt-5 flex items-center justify-between gap-4">
        <div>
          <p className="font-medium">
            {enabled ? "Enabled" : "Disabled"}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {enabled
              ? "Customers may access the upload feature."
              : "Customers cannot access the upload feature."}
          </p>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={() => saveSetting(!enabled)}
          className="rounded-xl bg-[#1d1d1f] px-5 py-3 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
        >
          {saving
            ? "Saving..."
            : enabled
              ? "Disable uploads"
              : "Enable uploads"}
        </button>
      </div>

      {message && (
        <p role="status" className="mt-4 text-sm text-neutral-700">
          {message}
        </p>
      )}
    </section>
  );
}
