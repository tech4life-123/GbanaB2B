import { NextResponse } from "next/server";
import { serverEnv } from "@/config/env.server";
import { isAuthorizedCron } from "@/lib/jobs/cron-auth";
import { runSweep } from "@/lib/jobs/sweep";

export const dynamic = "force-dynamic";

/** Scheduled by vercel.json. Refuses everything without the shared secret (and when no secret is set). */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request, serverEnv.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const result = await runSweep();
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
