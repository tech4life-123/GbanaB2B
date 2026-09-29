"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "@/config/env";
import type { Database } from "@/lib/db/types";

/**
 * Browser client — publishable key only, always subject to RLS. Use it for
 * reads the user is entitled to and Realtime subscriptions. Mutations that
 * matter (orders, bids, money, verification) go through server actions.
 */
export function createSupabaseBrowserClient() {
  const config = getSupabasePublicConfig();
  if (!config) return null;
  return createBrowserClient<Database>(config.url, config.key);
}
