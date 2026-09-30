import "server-only";
import { z } from "zod";
import { parseEnvLenient } from "./env";

/**
 * Server-only secrets. Importing this module from a Client Component is a
 * build error (via `server-only`), which is the point: these values must
 * never reach the browser bundle.
 *
 * All optional; invalid values are dropped with a warning (see env.ts), so a
 * placeholder for an integration that isn't built yet can't take the site down.
 */
const serverShape = {
  // Supabase's newer secret key, or the legacy service-role key. Bypasses RLS.
  SUPABASE_SECRET_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

  // Payment providers — adapters are built in Phase 5 from verified docs only.
  MTN_API_URL: z.url(),
  MTN_API_KEY: z.string(),
  MTN_API_SECRET: z.string(),
  ORANGE_API_URL: z.url(),
  ORANGE_API_KEY: z.string(),
  ORANGE_API_SECRET: z.string(),

  // Test-provider webhook signing secret (random, server-only). Needed only while the sandbox provider is enabled.
  SANDBOX_WEBHOOK_SECRET: z.string().min(32),

  WEB_PUSH_PRIVATE_KEY: z.string(),
  WEB_PUSH_SUBJECT: z.string(),

  // Shared secret for scheduled jobs (Vercel Cron sends it as a Bearer token). Random, 16+ chars.
  CRON_SECRET: z.string().min(16),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]),

  // TEMPORARY: enables email + password sign-in for pre-provisioned accounts
  // while no SMS provider is configured. Remove once phone OTP is live.
  DEMO_ACCESS_ENABLED: z.enum(["true", "false"]),
} as const;

export const serverEnv = parseEnvLenient(serverShape, process.env, "server");

export function getSupabaseSecretKey(): string | null {
  return serverEnv.SUPABASE_SECRET_KEY ?? serverEnv.SUPABASE_SERVICE_ROLE_KEY ?? null;
}

/** True only when DEMO_ACCESS_ENABLED is exactly "true". */
export function isTemporaryAccessEnabled(): boolean {
  return serverEnv.DEMO_ACCESS_ENABLED === "true";
}
