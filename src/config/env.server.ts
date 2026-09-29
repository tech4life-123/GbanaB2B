import "server-only";
import { z } from "zod";

/**
 * Server-only secrets. Importing this module from a Client Component is a
 * build error (via `server-only`), which is the point: these values must
 * never reach the browser bundle.
 */
const serverSchema = z.object({
  // Supabase's newer secret key, or the legacy service-role key. Bypasses RLS.
  SUPABASE_SECRET_KEY: z.string().min(20).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),

  // Payment providers — adapters are built in Phase 5 from verified docs only.
  MTN_API_URL: z.url().optional(),
  MTN_API_KEY: z.string().optional(),
  MTN_API_SECRET: z.string().optional(),
  ORANGE_API_URL: z.url().optional(),
  ORANGE_API_KEY: z.string().optional(),
  ORANGE_API_SECRET: z.string().optional(),

  WEB_PUSH_PRIVATE_KEY: z.string().optional(),
  WEB_PUSH_SUBJECT: z.string().optional(),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
});

function blankToUndefined(env: NodeJS.ProcessEnv) {
  return Object.fromEntries(
    Object.entries(env).map(([k, v]) => [k, v === "" ? undefined : v]),
  );
}

const parsed = serverSchema.safeParse(blankToUndefined(process.env));
if (!parsed.success) {
  throw new Error(`Invalid server environment variables:\n${z.prettifyError(parsed.error)}`);
}

export const serverEnv = parsed.data;

export function getSupabaseSecretKey(): string | null {
  return serverEnv.SUPABASE_SECRET_KEY ?? serverEnv.SUPABASE_SERVICE_ROLE_KEY ?? null;
}
