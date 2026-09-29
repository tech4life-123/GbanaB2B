import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/config/env";

/** Liveness probe for uptime monitors. Reveals configuration presence only — never values. */
export function GET() {
  return NextResponse.json(
    { status: "ok", service: "gbanab2b", supabase: isSupabaseConfigured() ? "configured" : "missing", time: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
