import "server-only";
import { createSupabaseAdminClient } from "@/lib/db/supabase/admin";
import { logger } from "@/lib/logging/logger";
import { getProvider } from "./registry";
import { toDbStatus } from "./status";
import type { PaymentProviderId } from "./types";

export type WebhookResult =
  | { ok: true; outcome: string }
  | { ok: false; reason: "invalid_signature" | "provider_unavailable" | "error" };

/**
 * The only door through which a payment can succeed.
 * 1. The provider adapter verifies authenticity (signature/secret).
 * 2. Only then is the event handed to the database, which is idempotent and
 *    re-checks reference, provider, amount and currency.
 * Unverified requests are dropped without storing anything.
 */
export async function handleProviderWebhook(providerId: PaymentProviderId, headers: Headers, rawBody: string): Promise<WebhookResult> {
  const provider = getProvider(providerId);
  if (!provider.isConfigured()) return { ok: false, reason: "provider_unavailable" };
  const event = await provider.verifyWebhook(headers, rawBody);
  if (!event) {
    logger.warn("payments.webhook_rejected", { provider: providerId });
    return { ok: false, reason: "invalid_signature" };
  }
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db.rpc("apply_provider_event", {
      p_provider: providerId,
      p_event_id: event.eventId,
      p_reference: event.reference,
      p_provider_txn_id: event.providerTransactionId,
      p_status: toDbStatus(event.status),
      p_amount_minor: event.amount?.amountMinor,
      p_currency: event.amount?.currency,
      p_payload: (event.raw ?? {}) as never,
    });
    if (error) {
      logger.error("payments.webhook_apply_failed", { provider: providerId, code: error.code, message: error.message });
      return { ok: false, reason: "error" };
    }
    logger.info("payments.webhook_applied", { provider: providerId, outcome: data, reference: event.reference });
    return { ok: true, outcome: String(data) };
  } catch (e) {
    logger.error("payments.webhook_exception", { provider: providerId, message: e instanceof Error ? e.message : "unknown" });
    return { ok: false, reason: "error" };
  }
}

/**
 * Reconciliation by a documented status query (spec: success may come from a
 * verified webhook OR a documented verification mechanism). Uses a stable
 * event id so repeating the check is harmless.
 */
export async function applyStatusQuery(providerId: PaymentProviderId, transactionId: string): Promise<{ ok: true; outcome: string; status: string } | { ok: false; message: string }> {
  const provider = getProvider(providerId);
  if (!provider.isConfigured()) return { ok: false, message: `${provider.displayName} isn't connected.` };
  try {
    const result = await provider.getStatus(transactionId);
    if (result.status === "PENDING" || result.status === "REQUIRES_CUSTOMER_ACTION") return { ok: true, outcome: "no_change", status: result.status };
    const db = createSupabaseAdminClient();
    const { data, error } = await db.rpc("apply_provider_event", {
      p_provider: providerId,
      p_event_id: `status-query:${transactionId}:${result.status}`,
      p_reference: transactionId,
      p_provider_txn_id: result.providerTransactionId ?? undefined,
      p_status: toDbStatus(result.status),
      p_payload: { source: "status_query" } as never,
    });
    if (error) return { ok: false, message: "We couldn't record the provider's answer." };
    return { ok: true, outcome: String(data), status: result.status };
  } catch (e) {
    logger.error("payments.status_query_failed", { provider: providerId, message: e instanceof Error ? e.message : "unknown" });
    return { ok: false, message: "The provider couldn't be reached. Try again shortly." };
  }
}
