import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/config/env";
import type { Database } from "@/lib/db/types";

/**
 * Anonymous, cookie-less client for public marketplace pages. Always sees
 * exactly what the public sees (RLS as `anon`), regardless of who is signed
 * in — so a seller previewing their shop sees the real public view.
 */
export function createSupabasePublicClient() {
  const config = getSupabasePublicConfig();
  if (!config) return null;
  return createClient<Database>(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
