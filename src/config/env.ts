import { z } from "zod";

/**
 * Public environment — safe to ship to the browser. Only NEXT_PUBLIC_* values
 * belong here, and only values that are genuinely safe to expose.
 *
 * NOTE: Next.js inlines NEXT_PUBLIC_* at build time only when referenced
 * literally (process.env.NEXT_PUBLIC_X), so each key is read explicitly.
 *
 * Every value is optional. An invalid value (e.g. a placeholder pasted into
 * the hosting dashboard) is dropped with a warning instead of crashing the
 * whole site; the feature that needs it then reports "not configured".
 */
const publicShape = {
  NEXT_PUBLIC_SITE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  // Supabase's newer "publishable" key, or the legacy anon key. Both are
  // designed to be public; RLS is what protects data.
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY: z.string().min(1),
} as const;

type PublicEnv = { [K in keyof typeof publicShape]?: z.infer<(typeof publicShape)[K]> };

const rawPublic: Record<keyof typeof publicShape, string | undefined> = {
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY: process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY,
};

/** Validates each key independently; blank or invalid values become undefined. */
export function parseEnvLenient<S extends Record<string, z.ZodType>>(
  shape: S,
  raw: Record<string, string | undefined>,
  label: string,
): { [K in keyof S]?: z.infer<S[K]> } {
  const out: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(shape)) {
    const value = raw[key]?.trim();
    if (!value) continue;
    const result = schema.safeParse(value);
    if (result.success) out[key] = result.data;
    // Never print the value itself — it may be a secret.
    else console.warn(`[env] Ignoring invalid ${label} variable ${key}: ${result.error.issues[0]?.message ?? "invalid"}`);
  }
  return out as { [K in keyof S]?: z.infer<S[K]> };
}

export const publicEnv: PublicEnv = parseEnvLenient(publicShape, rawPublic, "public");

export interface SupabasePublicConfig {
  url: string;
  key: string;
}

/**
 * Returns the Supabase public config, or null when the project hasn't been
 * connected yet. The app renders a clear "not connected" state instead of
 * crashing, so the UI shell can be developed before a Supabase project exists.
 */
export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  return getSupabasePublicConfig() !== null;
}
