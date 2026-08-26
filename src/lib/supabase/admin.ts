import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS, never import into a "use client" file.
 * Only for server-side operations that need elevated privileges (Storage
 * bucket management, generating signed upload URLs).
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
