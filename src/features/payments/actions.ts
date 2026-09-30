"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer, requireRole } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/db/supabase/admin";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import { dbFailure, formText as text, zodFieldErrors } from "@/lib/db/action-errors";
import { fail, ok, toFailure, type ActionResult } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { applyStatusQuery, handleProviderWebhook } from "@/lib/payments/process-event";
import { getProvider } from "@/lib/payments/registry";
import { buildSandboxEvent, SANDBOX_SIGNATURE_HEADER } from "@/lib/payments/providers/sandbox";
import { Constants } from "@/lib/db/database.types";

export type PaymentFormState = ActionResult<null> | null;

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const msisdn = z.string().trim().regex(/^\+[1-9][0-9]{7,14}$/, "Use international format, like +231770000000.");
const note = (label: string) => z.string().trim().min(3, `${label} (at least 3 characters).`).max(500, "Keep this under 500 characters.");

async function client() {
  const db = await createSupabaseServerClient();
  if (!db) throw new Error("Supabase not configured");
  return db;
}

function revalidateOrder(orderId: string) {
  for (const base of ["/buyer/orders", "/seller/orders", "/admin/orders"]) {
    revalidatePath(base);
    revalidatePath(`${base}/${orderId}`);
  }
  revalidatePath("/buyer/payments");
  revalidatePath("/seller/payouts");
  revalidatePath("/carrier/earnings");
  revalidatePath("/admin/finance", "layout");
}

/* ---------------------------------------------------------------- buyer */

const payInput = z.object({
  order_id: uuid,
  provider: z.enum(Constants.public.Enums.payment_provider_id),
  msisdn,
  key: z.string().min(8).max(100),
});

/**
 * 1. The database opens an attempt (amount comes from the order, never the form).
 * 2. The server asks the provider to collect — nothing is "paid" yet.
 * 3. Success arrives later, as a verified provider message.
 */
export async function payForOrder(_prev: PaymentFormState, fd: FormData): Promise<PaymentFormState> {
  const viewer = await getViewer();
  if (!viewer) return fail("UNAUTHENTICATED", "Your session ended. Sign in again.");
  const parsed = payInput.safeParse({ order_id: text(fd, "order_id"), provider: text(fd, "provider"), msisdn: text(fd, "msisdn"), key: text(fd, "key") });
  if (!parsed.success) return fail("VALIDATION", "Please fix the highlighted fields.", zodFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const db = await client();

  const { data: txnId, error } = await db.rpc("start_payment", { p_order: v.order_id, p_provider: v.provider, p_msisdn: v.msisdn, p_idempotency_key: v.key });
  if (error) return dbFailure(error, "We couldn't start the payment. Please try again.", "payments.start_failed");

  const { data: txn } = await db.from("payment_transactions").select("id, status, amount_minor, currency").eq("id", txnId).single();
  if (!txn) return fail("INTERNAL", "We couldn't start the payment. Please try again.");

  if (txn.status === "initiated") {
    const admin = createSupabaseAdminClient();
    const provider = getProvider(v.provider);
    try {
      if (!provider.isConfigured()) throw new Error("not configured");
      const res = await provider.requestCollection({
        reference: txn.id,
        idempotencyKey: v.key,
        amount: { amountMinor: txn.amount_minor, currency: txn.currency },
        payerMsisdn: v.msisdn,
        description: "GbanaB2B order payment",
      });
      const accepted = res.status !== "FAILED" && res.status !== "CANCELLED" && res.status !== "EXPIRED";
      await admin.rpc("record_payment_attempt", {
        p_txn: txn.id,
        p_provider_txn_id: res.providerTransactionId ?? undefined,
        p_status: accepted ? "pending" : "failed",
        p_failure: accepted ? undefined : "The provider declined the request",
      });
      if (!accepted) {
        revalidateOrder(v.order_id);
        return fail("PROVIDER_ERROR", "The payment provider declined the request. Check the number and try again.");
      }
    } catch (e) {
      logger.error("payments.request_failed", { provider: v.provider, message: e instanceof Error ? e.message : "unknown" });
      await admin.rpc("record_payment_attempt", { p_txn: txn.id, p_status: "failed", p_failure: "We couldn't reach the payment provider" });
      revalidateOrder(v.order_id);
      return fail("PROVIDER_ERROR", "We couldn't reach the payment provider. You haven't been charged — please try again.");
    }
  }
  revalidateOrder(v.order_id);
  return ok(null, "Payment request sent. Approve it on your phone.");
}

/**
 * TEST PROVIDER ONLY. Plays the customer's decision by sending the platform a
 * correctly signed provider message, so the real verification path is used.
 */
export async function simulateSandboxPayment(_prev: PaymentFormState, fd: FormData): Promise<PaymentFormState> {
  await requireRole("buyer");
  const txnId = uuid.safeParse(text(fd, "txn_id"));
  const outcome = text(fd, "outcome");
  if (!txnId.success || (outcome !== "SUCCEEDED" && outcome !== "FAILED")) return fail("VALIDATION", "Invalid request.");
  const db = await client();
  const { data: txn } = await db.from("payment_transactions").select("id, order_id, provider, status, amount_minor, currency, provider_txn_id").eq("id", txnId.data).maybeSingle();
  if (!txn || txn.provider !== "sandbox") return fail("FORBIDDEN", "This isn't a test payment.");
  const { data: enabled } = await db.rpc("provider_enabled", { p_provider: "sandbox" });
  if (!enabled) return fail("FORBIDDEN", "Test payments are switched off.");
  if (txn.status !== "pending") return fail("CONFLICT", "This payment isn't waiting for approval.");
  const ev = buildSandboxEvent({
    reference: txn.id,
    providerTransactionId: txn.provider_txn_id ?? `SBX-${txn.id.slice(0, 8).toUpperCase()}`,
    status: outcome,
    amountMinor: txn.amount_minor,
    currency: txn.currency,
    reason: outcome === "FAILED" ? "Declined in the test panel" : undefined,
  });
  if (!ev.signature) return fail("NOT_CONFIGURED", "The test provider isn't set up on the server.");
  const res = await handleProviderWebhook("sandbox", new Headers({ [SANDBOX_SIGNATURE_HEADER]: ev.signature }), ev.body);
  revalidateOrder(txn.order_id);
  if (!res.ok) return fail("PROVIDER_ERROR", "The test message was rejected.");
  return ok(null, outcome === "SUCCEEDED" ? "Test payment approved." : "Test payment declined.");
}

/* ---------------------------------------------------------------- admin */

const releaseInput = z.object({ order_id: uuid, note: note("Say why you are releasing these funds") });

export async function adminReleaseEscrow(_prev: PaymentFormState, fd: FormData): Promise<PaymentFormState> {
  await requireRole("admin");
  const p = releaseInput.safeParse({ order_id: text(fd, "order_id"), note: text(fd, "note") });
  if (!p.success) return fail("VALIDATION", p.error.issues[0]?.message ?? "Invalid request.", zodFieldErrors(p.error.issues));
  const db = await client();
  const { data, error } = await db.rpc("admin_release_escrow", { p_order: p.data.order_id, p_note: p.data.note });
  if (error) return dbFailure(error, "We couldn't release the funds.", "escrow.release_failed");
  revalidateOrder(p.data.order_id);
  return ok(null, data ? "Funds released. Payouts are ready to send." : "These funds were already released.");
}

const refundInput = z.object({ order_id: uuid, reason: note("Say why you are refunding this order") });

export async function adminRefundEscrow(_prev: PaymentFormState, fd: FormData): Promise<PaymentFormState> {
  await requireRole("admin");
  const p = refundInput.safeParse({ order_id: text(fd, "order_id"), reason: text(fd, "reason") });
  if (!p.success) return fail("VALIDATION", p.error.issues[0]?.message ?? "Invalid request.", zodFieldErrors(p.error.issues));
  const db = await client();
  const { error } = await db.rpc("admin_refund_escrow", { p_order: p.data.order_id, p_reason: p.data.reason });
  if (error) return dbFailure(error, "We couldn't refund this order.", "escrow.refund_failed");
  revalidateOrder(p.data.order_id);
  return ok(null, "Refund created. Send it to the buyer, then mark it paid.");
}

const markRefundInput = z.object({ refund_id: uuid, paid: z.enum(["yes", "no"]), ref: z.string().trim().max(200).optional(), order_id: uuid });

export async function adminMarkRefund(_prev: PaymentFormState, fd: FormData): Promise<PaymentFormState> {
  await requireRole("admin");
  const p = markRefundInput.safeParse({ refund_id: text(fd, "refund_id"), paid: text(fd, "paid"), ref: text(fd, "ref") || undefined, order_id: text(fd, "order_id") });
  if (!p.success) return fail("VALIDATION", "Invalid request.");
  if (p.data.paid === "yes" && !p.data.ref) return fail("VALIDATION", "Enter the provider's reference for this refund.", { ref: "Required" });
  const db = await client();
  const { error } = await db.rpc("admin_mark_refund", { p_refund: p.data.refund_id, p_paid: p.data.paid === "yes", p_provider_ref: p.data.ref });
  if (error) return dbFailure(error, "We couldn't record the refund.", "refund.mark_failed");
  revalidateOrder(p.data.order_id);
  return ok(null, p.data.paid === "yes" ? "Refund recorded as paid." : "Refund marked as failed.");
}

const beginPayoutInput = z.object({ payout_id: uuid, provider: z.enum(Constants.public.Enums.payment_provider_id), msisdn });

export async function adminBeginPayout(_prev: PaymentFormState, fd: FormData): Promise<PaymentFormState> {
  await requireRole("admin");
  const p = beginPayoutInput.safeParse({ payout_id: text(fd, "payout_id"), provider: text(fd, "provider"), msisdn: text(fd, "msisdn") });
  if (!p.success) return fail("VALIDATION", "Please fix the highlighted fields.", zodFieldErrors(p.error.issues));
  const db = await client();
  const { error } = await db.rpc("admin_begin_payout", { p_payout: p.data.payout_id, p_provider: p.data.provider, p_msisdn: p.data.msisdn });
  if (error) return dbFailure(error, "We couldn't start the payout.", "payout.begin_failed");
  revalidateOrder("");
  return ok(null, "Payout started. Send the money, then record the result.");
}

const finishPayoutInput = z.object({ payout_id: uuid, success: z.enum(["yes", "no"]), ref: z.string().trim().max(200).optional(), reason: z.string().trim().max(300).optional() });

export async function adminFinishPayout(_prev: PaymentFormState, fd: FormData): Promise<PaymentFormState> {
  await requireRole("admin");
  const p = finishPayoutInput.safeParse({ payout_id: text(fd, "payout_id"), success: text(fd, "success"), ref: text(fd, "ref") || undefined, reason: text(fd, "reason") || undefined });
  if (!p.success) return fail("VALIDATION", "Invalid request.");
  if (p.data.success === "yes" && !p.data.ref) return fail("VALIDATION", "Enter the provider's reference for this payout.", { ref: "Required" });
  const db = await client();
  const { error } = await db.rpc("admin_finish_payout", { p_payout: p.data.payout_id, p_success: p.data.success === "yes", p_provider_ref: p.data.ref, p_failure: p.data.reason });
  if (error) return dbFailure(error, "We couldn't record the payout.", "payout.finish_failed");
  revalidateOrder("");
  return ok(null, p.data.success === "yes" ? "Payout recorded as paid." : "Payout marked as failed — you can retry it.");
}

const rateInput = z.object({
  rate: z.string().trim().regex(/^\d{1,7}(\.\d{1,6})?$/, "Enter a rate like 192.50."),
  note: z.string().trim().max(300).optional(),
});

export async function adminSetExchangeRate(_prev: PaymentFormState, fd: FormData): Promise<PaymentFormState> {
  await requireRole("admin");
  const p = rateInput.safeParse({ rate: text(fd, "rate"), note: text(fd, "note") || undefined });
  if (!p.success) return fail("VALIDATION", "Please fix the highlighted fields.", zodFieldErrors(p.error.issues));
  const db = await client();
  const { error } = await db.rpc("set_exchange_rate", { p_base: "USD", p_quote: "LRD", p_rate: Number(p.data.rate), p_note: p.data.note });
  if (error) return dbFailure(error, "We couldn't save the rate.", "fx.set_failed");
  revalidatePath("/admin/finance");
  revalidatePath("/admin/audit");
  return ok(null, "Exchange rate saved. New payments will record it; old ones keep theirs.");
}

export async function adminCheckPayment(_prev: PaymentFormState, fd: FormData): Promise<PaymentFormState> {
  await requireRole("admin");
  const txnId = uuid.safeParse(text(fd, "txn_id"));
  if (!txnId.success) return fail("VALIDATION", "Invalid request.");
  const db = await client();
  const { data: txn } = await db.from("payment_transactions").select("id, provider, order_id").eq("id", txnId.data).maybeSingle();
  if (!txn) return fail("NOT_FOUND", "Payment not found.");
  try {
    const r = await applyStatusQuery(txn.provider, txn.id);
    revalidateOrder(txn.order_id);
    if (!r.ok) return fail("PROVIDER_ERROR", r.message);
    return ok(null, r.outcome === "no_change" ? "The provider says it is still waiting for the customer." : `Provider answered: ${r.status.toLowerCase()}.`);
  } catch (e) {
    return toFailure(e);
  }
}
