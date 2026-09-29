import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "@/config/env";
import type { Database } from "@/lib/db/types";

/**
 * Per-request Supabase client for Server Components, Server Actions and Route
 * Handlers. Runs as the signed-in user, so Row Level Security applies.
 * Returns null when Supabase is not configured yet.
 */
export async function createSupabaseServerClient() {
  // Read cookies first: this marks the route as dynamic even when Supabase
  // isn't configured, so user-specific pages are never prerendered.
  const cookieStore = await cookies();
  const config = getSupabasePublicConfig();
  if (!config) return null;

  return createServerClient<Database>(config.url, config.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component where cookies are read-only.
          // Safe to ignore: proxy.ts refreshes the session on every request.
        }
      },
    },
  });
}
