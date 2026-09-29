import { z } from "zod";

/**
 * Public environment — safe to ship to the browser. Only NEXT_PUBLIC_* values
 * belong here, and only values that are genuinely safe to expose.
 *
 * NOTE: Next.js inlines NEXT_PUBLIC_* at build time only when referenced
 * literally (process.env.NEXT_PUBLIC_X), so each key is read explicitly.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  // Supabase's newer "publishable" key, or the legacy anon key. Both are
  // designed to be public; RLS is what protects data.
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20).optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20).optional(),
  NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY: z.string().optional(),
});

const rawPublic = {
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || undefined,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined,
  NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY: process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY || undefined,
};

const parsed = publicSchema.safeParse(rawPublic);
if (!parsed.success) {
  // Fail loudly in every environment: a malformed URL/key is a deploy error.
  throw new Error(
    `Invalid public environment variables:\n${z.prettifyError(parsed.error)}`,
  );
}

export const publicEnv = parsed.data;

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
