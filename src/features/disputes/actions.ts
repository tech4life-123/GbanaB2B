"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer, requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import { dbFailure, formText as text, zodFieldErrors } from "@/lib/db/action-errors";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { Constants } from "@/lib/db/database.types";
import { isCurrencyCode, parseMajorToMinor } from "@/lib/money/currency";
import { EVIDENCE_BUCKET, isEvidenceMime, isValidEvidencePath, maxEvidenceBytes } from "@/lib/storage/evidence";

export type DisputeFormState = ActionResult<{ id?: string } | null> | null;

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid reference.");

async function client() {
  const db = await createSupabaseServerClient();
  if (!db) throw new Error("Supabase not configured");
  return db;
}

function revalidateDispute(orderId?: string, disputeId?: string) {
  for (const role of ["buyer", "seller", "carrier", "admin"]) {
    revalidatePath(`/${role}/disputes`);
    if (disputeId) revalidatePath(`/${role}/disputes/${disputeId}`);
  }
  if (orderId) {
    for (const base of ["/buyer/orders", "/seller/orders", "/admin/orders"]) {
      revalidatePath(base);
      revalidatePath(`${base}/${orderId}`);
    }
    revalidatePath("/carrier/deliveries", "layout");
  }
  revalidatePath("/admin/finance", "layout");
  revalidatePath("/buyer/payments");
  revalidatePath("/seller/payouts");
  revalidatePath("/carrier/earnings");
}

/** Which workspace a person works in decides where "their" dispute page lives. */
async function orderOfDispute(db: Awaited<ReturnType<typeof client>>, disputeId: string): Promise<string | undefined> {
  const { data } = await db.from("disputes").select("order_id").eq("id", disputeId).maybeSingle();
  return data?.order_id;
}

/* ---------------------------------------------------------------- open */

const openSchema = z.object({
  order_id: uuid,
  kind: z.enum(Constants.public.Enums.dispute_kind, { error: "Choose what went wrong." }),
  description: z.string().trim().min(10, "Describe the problem in at least 10 characters.").max(2000, "Keep this under 2000 characters."),
});

/**
 * Freezes the order and its escrow until GbanaB2B decides. Evidence is added on
 * the dispute page straight after (it needs the dispute to exist first).
 */
export async function openDispute(_prev: DisputeFormState, fd: FormData): Promise<DisputeFormState> {
  const viewer = await getViewer();
  if (!viewer) return fail("UNAUTHENTICATED", "Your session ended. Sign in again.");
  const parsed = openSchema.safeParse({ order_id: text(fd, "order_id"), kind: text(fd, "kind"), description: text(fd, "description") });
  if (!parsed.success) return fail("VALIDATION", "Please fix the highlighted fields.", zodFieldErrors(parsed.error.issues));

  let requested: number | undefined;
  const raw = text(fd, "requested_refund").trim();
  const currency = text(fd, "currency");
  if (raw) {
    if (!isCurrencyCode(currency)) return fail("VALIDATION", "Please fix the highlighted fields.", { requested_refund: "Unknown currency." });
    const minor = parseMajorToMinor(raw, currency);
    if (minor === null || minor < 1) return fail("VALIDATION", "Please fix the highlighted fields.", { requested_refund: "Enter an amount, like 25.00." });
    requested = minor;
  }

  const db = await client();
  const { data, error } = await db.rpc("open_dispute", {
    p_order: parsed.data.order_id,
    p_kind: parsed.data.kind,
    p_description: parsed.data.description,
    p_requested_refund_minor: requested,
  });
  if (error) return dbFailure(error, "We couldn't open the dispute. Please try again.", "disputes.open_failed");
  logger.info("disputes.opened", { disputeId: data });
  revalidateDispute(parsed.data.order_id, data);
  return ok({ id: data }, "Dispute opened. Funds are frozen while we review.");
}

/* ------------------------------------------------------------- messages */

export async function addDisputeMessage(_prev: DisputeFormState, fd: FormData): Promise<DisputeFormState> {
  const viewer = await getViewer();
  if (!viewer) return fail("UNAUTHENTICATED", "Your session ended. Sign in again.");
  const parsed = z.object({ id: uuid, body: z.string().trim().min(1, "Write a message.").max(2000, "Keep this under 2000 characters.") }).safeParse({ id: text(fd, "dispute_id"), body: text(fd, "body") });
  if (!parsed.success) return fail("VALIDATION", "Please fix the highlighted fields.", zodFieldErrors(parsed.error.issues));
  const db = await client();
  const { error } = await db.rpc("add_dispute_message", { p_dispute: parsed.data.id, p_body: parsed.data.body });
  if (error) return dbFailure(error, "We couldn't send that message.", "disputes.message_failed");
  revalidateDispute(undefined, parsed.data.id);
  return ok(null, "Message sent.");
}

/* ------------------------------------------------------------- evidence */

const evidenceSchema = z.object({
  dispute_id: uuid,
  path: z.string().max(200),
  file_name: z.string().trim().min(1).max(160),
  mime_type: z.string().max(60),
  size_bytes: z.number().int().positive(),
  caption: z.string().trim().max(300).optional(),
});

/** Called after the browser put the file in the private bucket. Re-checks the path, type and size. */
export async function registerEvidence(input: unknown): Promise<ActionResult<null>> {
  const viewer = await getViewer();
  if (!viewer) return fail("UNAUTHENTICATED", "Your session ended. Sign in again.");
  const parsed = evidenceSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "That file couldn't be saved.");
  const d = parsed.data;
  if (!isValidEvidencePath(d.path, d.dispute_id) || !isEvidenceMime(d.mime_type) || d.size_bytes > maxEvidenceBytes(d.mime_type)) {
    return fail("VALIDATION", "That file couldn't be saved.");
  }
  const db = await client();
  const { error } = await db.rpc("register_dispute_evidence", {
    p_dispute: d.dispute_id,
    p_path: d.path,
    p_file_name: d.file_name,
    p_mime: d.mime_type,
    p_size: d.size_bytes,
    p_caption: d.caption || undefined,
  });
  if (error) {
    // The file has no record, so it must not linger in the bucket (evidence can't be deleted once registered).
    await db.storage.from(EVIDENCE_BUCKET).remove([d.path]);
    return dbFailure(error, "We couldn't save that file.", "disputes.register_evidence_failed");
  }
  revalidateDispute(undefined, d.dispute_id);
  return ok(null);
}

/** Short-lived link to one evidence file the viewer is allowed to read (storage RLS re-checks). */
export async function openEvidence(evidenceId: string): Promise<ActionResult<{ url: string; mime: string }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("UNAUTHENTICATED", "Your session ended. Sign in again.");
  if (!uuid.safeParse(evidenceId).success) return fail("VALIDATION", "Invalid file.");
  const db = await client();
  const { data: ev } = await db.from("dispute_evidence").select("storage_path, mime_type").eq("id", evidenceId).maybeSingle();
  if (!ev) return fail("NOT_FOUND", "File not found.");
  const { data, error } = await db.storage.from(EVIDENCE_BUCKET).createSignedUrl(ev.storage_path, 120);
  if (error || !data) return fail("INTERNAL", "We couldn't open that file.");
  return ok({ url: data.signedUrl, mime: ev.mime_type });
}

/* ------------------------------------------------------------- withdraw */

export async function withdrawDispute(disputeId: string, note: string): Promise<ActionResult<null>> {
  const viewer = await getViewer();
  if (!viewer) return fail("UNAUTHENTICATED", "Your session ended. Sign in again.");
  const p = z.object({ id: uuid, note: z.string().trim().max(500) }).safeParse({ id: disputeId, note });
  if (!p.success) return fail("VALIDATION", "Keep the note under 500 characters.");
  const db = await client();
  const orderId = await orderOfDispute(db, p.data.id);
  const { error } = await db.rpc("withdraw_dispute", { p_dispute: p.data.id, p_note: p.data.note || undefined });
  if (error) return dbFailure(error, "We couldn't withdraw the dispute.", "disputes.withdraw_failed");
  revalidateDispute(orderId, p.data.id);
  return ok(null, "Dispute withdrawn. The order carries on where it was.");
}

/* ---------------------------------------------------------------- admin */

export async function adminStartReview(disputeId: string): Promise<ActionResult<null>> {
  await requireRole("admin");
  if (!uuid.safeParse(disputeId).success) return fail("VALIDATION", "Invalid dispute.");
  const db = await client();
  const orderId = await orderOfDispute(db, disputeId);
  const { error } = await db.rpc("admin_start_dispute_review", { p_dispute: disputeId });
  if (error) return dbFailure(error, "We couldn't start the review.", "disputes.start_review_failed");
  revalidateDispute(orderId, disputeId);
  return ok(null, "Review started. Both sides can see that.");
}

const resolveSchema = z.object({
  id: uuid,
  outcome: z.enum(["refund", "partial_refund", "release", "reject"], { error: "Choose an outcome." }),
  fault: z.enum(["seller", "carrier", "none"]),
  note: z.string().trim().min(10, "Explain the decision to both sides (at least 10 characters).").max(1000, "Keep this under 1000 characters."),
});

/** The only place money moves because of a dispute. Amount is checked again in the database. */
export async function adminResolveDispute(_prev: DisputeFormState, fd: FormData): Promise<DisputeFormState> {
  await requireRole("admin");
  const parsed = resolveSchema.safeParse({ id: text(fd, "dispute_id"), outcome: text(fd, "outcome"), fault: text(fd, "fault") || "none", note: text(fd, "note") });
  if (!parsed.success) return fail("VALIDATION", "Please fix the highlighted fields.", zodFieldErrors(parsed.error.issues));
  const v = parsed.data;

  let refund: number | undefined;
  if (v.outcome === "partial_refund") {
    const currency = text(fd, "currency");
    const minor = isCurrencyCode(currency) ? parseMajorToMinor(text(fd, "refund_amount"), currency) : null;
    if (minor === null || minor < 1) return fail("VALIDATION", "Please fix the highlighted fields.", { refund_amount: "Enter the amount to refund, like 25.00." });
    if (v.fault === "none") return fail("VALIDATION", "Please fix the highlighted fields.", { fault: "A partial refund is paid from the seller's or the carrier's share. Choose whose." });
    refund = minor;
  }

  const db = await client();
  const orderId = await orderOfDispute(db, v.id);
  const { error } = await db.rpc("admin_resolve_dispute", { p_dispute: v.id, p_outcome: v.outcome, p_note: v.note, p_fault: v.fault, p_refund_minor: refund });
  if (error) return dbFailure(error, "We couldn't record that decision.", "disputes.resolve_failed");
  logger.info("disputes.resolved", { disputeId: v.id, outcome: v.outcome });
  revalidateDispute(orderId, v.id);
  return ok(null, "Decision recorded. Both sides have been told.");
}
