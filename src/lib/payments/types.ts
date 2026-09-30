/**
 * Payment-provider contract (INTERFACE ONLY — Phase 1).
 *
 * The financial engine (Phase 5) depends on this interface, never on a
 * specific provider. Concrete adapters (MTN MoMo via Lonestar Cell MTN,
 * Orange Money Liberia) will be written only against verified provider
 * documentation and credentials. A sandbox adapter will live in a separate
 * module that production wiring cannot select.
 *
 * Invariants every adapter must honour:
 *  - A payment is only SUCCEEDED when the provider says so through a verified
 *    webhook or a documented status query — never because a user returned to
 *    the app.
 *  - Every request carries an idempotency key; retries reuse it.
 *  - Amounts are integer minor units + currency (see lib/money).
 */
import type { Money } from "@/lib/money/currency";

export type PaymentProviderId = "sandbox" | "mtn_momo_lr" | "orange_money_lr";

export type ProviderPaymentStatus =
  | "PENDING"
  | "REQUIRES_CUSTOMER_ACTION"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED";

export interface CollectionRequest {
  /** Our payment_transactions id; doubles as the provider reference. */
  reference: string;
  idempotencyKey: string;
  amount: Money;
  payerMsisdn: string; // E.164
  description: string;
}

export interface CollectionResult {
  providerTransactionId: string | null;
  status: ProviderPaymentStatus;
  /** Raw provider payload, stored for reconciliation. */
  raw: unknown;
}

export interface VerifiedWebhookEvent {
  /** Provider's unique id for this message — replays with the same id are ignored. */
  eventId: string;
  providerTransactionId: string;
  reference: string;
  status: ProviderPaymentStatus;
  amount: Money | null;
  occurredAt: string;
  raw: unknown;
}

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  readonly displayName: string;
  /** True only when real credentials are configured for this environment. */
  isConfigured(): boolean;
  requestCollection(req: CollectionRequest): Promise<CollectionResult>;
  getStatus(reference: string): Promise<CollectionResult>;
  /** Must verify authenticity (signature/secret) before returning an event. */
  verifyWebhook(headers: Headers, rawBody: string): Promise<VerifiedWebhookEvent | null>;
}

export const PAYMENT_PROVIDERS: Record<PaymentProviderId, { displayName: string; brandHint: string }> = {
  sandbox: { displayName: "Test payment (no real money)", brandHint: "Development provider" },
  mtn_momo_lr: { displayName: "MTN Mobile Money", brandHint: "Lonestar Cell MTN" },
  orange_money_lr: { displayName: "Orange Money", brandHint: "Orange Liberia" },
};
