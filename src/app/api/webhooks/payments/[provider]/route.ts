import { NextResponse } from "next/server";
import { handleProviderWebhook } from "@/lib/payments/process-event";
import { isProviderId } from "@/lib/payments/registry";
import { clientKey, hit, peek } from "@/lib/security/rate-limit";
import { logger } from "@/lib/logging/logger";

export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 64 * 1024;
/** Per caller address, per provider: generous for real provider retries, tight for scanners. */
const WEBHOOK_PER_MINUTE = 120;
const BAD_SIGNATURES_PER_MINUTE = 10;
const WINDOW_MS = 60_000;

function tooMany(retryAfter: number) {
  return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
}

/**
 * Provider → platform payment notifications.
 * 200 = received (including harmless replays), 400 = not authentic / malformed,
 * 503 = provider not connected, 500 = we failed and the provider should retry.
 */
export async function POST(request: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  if (!isProviderId(provider)) return NextResponse.json({ error: "unknown_provider" }, { status: 404 });

  // Cheap checks first, before reading the body or touching the database.
  const who = `${provider}:${clientKey(request.headers)}`;
  const overall = hit(`wh:${who}`, WEBHOOK_PER_MINUTE, WINDOW_MS);
  if (!overall.allowed) return tooMany(overall.retryAfter);
  const bad = peek(`whbad:${who}`, BAD_SIGNATURES_PER_MINUTE);
  if (!bad.allowed) return tooMany(bad.retryAfter);

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });

  const result = await handleProviderWebhook(provider, request.headers, raw);
  if (result.ok) return NextResponse.json({ received: true, outcome: result.outcome });
  if (result.reason === "invalid_signature") {
    hit(`whbad:${who}`, BAD_SIGNATURES_PER_MINUTE, WINDOW_MS);
    logger.warn("webhook.invalid_signature", { provider });
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (result.reason === "provider_unavailable") return NextResponse.json({ error: "unavailable" }, { status: 503 });
  return NextResponse.json({ error: "retry" }, { status: 500 });
}
