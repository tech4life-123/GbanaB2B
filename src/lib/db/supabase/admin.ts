import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/config/env";
import { getSupabaseSecretKey } from "@/config/env.server";
import { AppError } from "@/lib/errors";
import type { Database } from "@/lib/db/types";

/**
 * Privileged client. BYPASSES Row Level Security.
 *
 * Only for trusted server workflows that have already authorised the caller
 * (payment webhooks, scheduled jobs, admin operations after a role check).
 * Never import from client code — `server-only` makes that a build error.
 */
export function createSupabaseAdminClient() {
  const config = getSupabasePublicConfig();
  const secret = getSupabaseSecretKey();
  if (!config || !secret) {
    throw new AppError("NOT_CONFIGURED", "Supabase admin access is not configured.");
  }
  return createClient<Database>(config.url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
