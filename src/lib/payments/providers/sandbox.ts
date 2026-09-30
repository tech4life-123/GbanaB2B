import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { serverEnv } from "@/config/env.server";
import type { CollectionRequest, CollectionResult, PaymentProvider, ProviderPaymentStatus, VerifiedWebhookEvent } from "../types";

/**
 * TEST payment provider. Moves no money.
 *
 * It exists so the whole payment path (attempt → signed webhook → escrow →
 * release → payout) can be exercised before real MTN/Orange credentials
 * exist. It is isolated here, turned on and off by the
 * `payments.sandbox_enabled` setting, and labelled "Test payment" in the UI.
 *
 * It behaves like a real provider in the one way that matters: success only
 * counts when a correctly signed webhook says so.
 */
export const SANDBOX_SIGNATURE_HEADER = "x-sandbox-signature";

const eventSchema = z.object({
  eventId: z.string().min(1).max(200),
  reference: z.uuid(),
  providerTransactionId: z.string().min(1).max(200),
  status: z.enum(["PENDING", "REQUIRES_CUSTOMER_ACTION", "SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED"]),
  amountMinor: z.number().int().positive().nullable(),
  currency: z.enum(["USD", "LRD"]).nullable(),
  reason: z.string().max(300).optional(),
  occurredAt: z.iso.datetime(),
});

function secret(): string | null {
  return serverEnv.SANDBOX_WEBHOOK_SECRET ?? null;
}

export function signSandboxBody(rawBody: string): string | null {
  const key = secret();
  return key ? createHmac("sha256", key).update(rawBody).digest("hex") : null;
}

function signatureMatches(rawBody: string, provided: string | null): boolean {
  const expected = signSandboxBody(rawBody);
  if (!expected || !provided || provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

export const sandboxProvider: PaymentProvider = {
  id: "sandbox",
  displayName: "Test payment (no real money)",
  isConfigured: () => secret() !== null,

  async requestCollection(req: CollectionRequest): Promise<CollectionResult> {
    return {
      providerTransactionId: `SBX-${req.reference.slice(0, 8).toUpperCase()}`,
      status: "REQUIRES_CUSTOMER_ACTION",
      raw: { sandbox: true },
    };
  },

  // The sandbox has no ledger of its own: the customer's decision arrives as a webhook.
  async getStatus(reference: string): Promise<CollectionResult> {
    return { providerTransactionId: `SBX-${reference.slice(0, 8).toUpperCase()}`, status: "PENDING", raw: { sandbox: true } };
  },

  async verifyWebhook(headers: Headers, rawBody: string): Promise<VerifiedWebhookEvent | null> {
    if (!signatureMatches(rawBody, headers.get(SANDBOX_SIGNATURE_HEADER))) return null;
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return null;
    }
    const parsed = eventSchema.safeParse(json);
    if (!parsed.success) return null;
    const e = parsed.data;
    return {
      eventId: e.eventId,
      providerTransactionId: e.providerTransactionId,
      reference: e.reference,
      status: e.status satisfies ProviderPaymentStatus,
      amount: e.amountMinor && e.currency ? { amountMinor: e.amountMinor, currency: e.currency } : null,
      occurredAt: e.occurredAt,
      raw: e.reason ? { reason: e.reason } : {},
    };
  },
};

/** Builds the body + signature a real provider would send. Used only by the labelled test panel. */
export function buildSandboxEvent(input: {
  reference: string;
  providerTransactionId: string;
  status: "SUCCEEDED" | "FAILED";
  amountMinor: number;
  currency: "USD" | "LRD";
  reason?: string;
}) {
  const body = JSON.stringify({
    eventId: `sbx-${crypto.randomUUID()}`,
    reference: input.reference,
    providerTransactionId: input.providerTransactionId,
    status: input.status,
    amountMinor: input.amountMinor,
    currency: input.currency,
    reason: input.reason,
    occurredAt: new Date().toISOString(),
  });
  return { body, signature: signSandboxBody(body) };
}
