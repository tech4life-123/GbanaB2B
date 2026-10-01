import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/config/env";
import { createSupabasePublicClient } from "@/lib/db/supabase/public";
import { clientKey, hit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };
const DB_TIMEOUT_MS = 4000;

/**
 * Uptime probe.
 *   GET /api/health          liveness: the app is up (cheap, no database).
 *   GET /api/health?deep=1   readiness: also proves the database answers.
 * Reveals configuration presence and timings only — never values or errors.
 * Deep checks are rate limited because each one touches the database.
 */
export async function GET(request: Request) {
  const base = { service: "gbanab2b", time: new Date().toISOString() };
  const supabase = isSupabaseConfigured() ? "configured" : "missing";
  const deep = new URL(request.url).searchParams.get("deep") === "1";
  if (!deep) return NextResponse.json({ status: "ok", supabase, ...base }, { headers: NO_STORE });

  const limit = hit(`health:${clientKey(request.headers)}`, 30, 60_000);
  if (!limit.allowed) return NextResponse.json({ status: "rate_limited" }, { status: 429, headers: { ...NO_STORE, "Retry-After": String(limit.retryAfter) } });

  const db = createSupabasePublicClient();
  if (!db) return NextResponse.json({ status: "degraded", supabase, database: { ok: false, reason: "not_configured" }, ...base }, { status: 503, headers: NO_STORE });

  const started = Date.now();
  try {
    const query = db.from("product_categories").select("id", { head: true, count: "exact" }).limit(1);
    const result = await Promise.race([
      query,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), DB_TIMEOUT_MS)),
    ]);
    const ms = Date.now() - started;
    if (result.error) return NextResponse.json({ status: "degraded", supabase, database: { ok: false, ms }, ...base }, { status: 503, headers: NO_STORE });
    return NextResponse.json({ status: "ok", supabase, database: { ok: true, ms }, ...base }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ status: "degraded", supabase, database: { ok: false, ms: Date.now() - started }, ...base }, { status: 503, headers: NO_STORE });
  }
}
