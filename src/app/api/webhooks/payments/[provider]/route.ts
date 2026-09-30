import { NextResponse } from "next/server";
import { handleProviderWebhook } from "@/lib/payments/process-event";
import { isProviderId } from "@/lib/payments/registry";

export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 64 * 1024;

/**
 * Provider → platform payment notifications.
 * 200 = received (including harmless replays), 400 = not authentic / malformed,
 * 503 = provider not connected, 500 = we failed and the provider should retry.
 */
export async function POST(request: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  if (!isProviderId(provider)) return NextResponse.json({ error: "unknown_provider" }, { status: 404 });
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });

  const result = await handleProviderWebhook(provider, request.headers, raw);
  if (result.ok) return NextResponse.json({ received: true, outcome: result.outcome });
  if (result.reason === "invalid_signature") return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (result.reason === "provider_unavailable") return NextResponse.json({ error: "unavailable" }, { status: 503 });
  return NextResponse.json({ error: "retry" }, { status: 500 });
}
