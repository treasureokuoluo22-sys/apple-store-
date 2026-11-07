import "server-only";

import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL in the server environment.");
  }

  if (!serviceRoleKey) {
    throw new Error(
      "Set SUPABASE_SERVICE_ROLE_KEY in the server environment. Keep it private and do not use a NEXT_PUBLIC_ prefix."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
