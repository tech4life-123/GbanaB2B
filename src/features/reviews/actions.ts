"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer, requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import { dbFailure, formText as text, zodFieldErrors } from "@/lib/db/action-errors";
import { fail, ok, type ActionResult } from "@/lib/errors";

export type ReviewFormState = ActionResult<null> | null;

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid reference.");

async function client() {
  const db = await createSupabaseServerClient();
  if (!db) throw new Error("Supabase not configured");
  return db;
}

function revalidateReviews(orderId?: string) {
  if (orderId) revalidatePath(`/buyer/orders/${orderId}`);
  for (const p of ["/seller/reviews", "/carrier/reviews", "/admin/reviews"]) revalidatePath(p);
  revalidatePath("/sellers/[slug]", "page");
  revalidatePath("/buyer/freight");
}

const submitSchema = z.object({
  order_id: uuid,
  subject: z.enum(["seller", "carrier"]),
  rating: z.coerce.number({ error: "Choose a rating." }).int().min(1, "Choose a rating.").max(5, "Choose a rating."),
  comment: z.string().trim().max(1000, "Keep this under 1000 characters."),
});

/** One review per subject per order, never editable — so a rating means what it says. */
export async function submitReview(_prev: ReviewFormState, fd: FormData): Promise<ReviewFormState> {
  const viewer = await getViewer();
  if (!viewer) return fail("UNAUTHENTICATED", "Your session ended. Sign in again.");
  const parsed = submitSchema.safeParse({ order_id: text(fd, "order_id"), subject: text(fd, "subject"), rating: text(fd, "rating"), comment: text(fd, "comment") });
  if (!parsed.success) return fail("VALIDATION", "Please fix the highlighted fields.", zodFieldErrors(parsed.error.issues));
  const db = await client();
  const { error } = await db.rpc("submit_review", { p_order: parsed.data.order_id, p_subject: parsed.data.subject, p_rating: parsed.data.rating, p_comment: parsed.data.comment || undefined });
  if (error) return dbFailure(error, "We couldn't save your review.", "reviews.submit_failed", "You've already reviewed this one.");
  revalidateReviews(parsed.data.order_id);
  return ok(null, "Thanks — your review is live. It can't be edited.");
}

export async function replyToReview(_prev: ReviewFormState, fd: FormData): Promise<ReviewFormState> {
  const viewer = await getViewer();
  if (!viewer) return fail("UNAUTHENTICATED", "Your session ended. Sign in again.");
  const parsed = z.object({ id: uuid, reply: z.string().trim().min(2, "Write a reply.").max(1000, "Keep this under 1000 characters.") }).safeParse({ id: text(fd, "review_id"), reply: text(fd, "reply") });
  if (!parsed.success) return fail("VALIDATION", "Please fix the highlighted fields.", zodFieldErrors(parsed.error.issues));
  const db = await client();
  const { error } = await db.rpc("reply_to_review", { p_review: parsed.data.id, p_reply: parsed.data.reply });
  if (error) return dbFailure(error, "We couldn't post your reply.", "reviews.reply_failed", "You've already replied to this review.");
  revalidateReviews();
  return ok(null, "Reply posted. It can't be edited.");
}

export async function adminHideReview(reviewId: string, hidden: boolean, reason: string): Promise<ActionResult<null>> {
  await requireRole("admin");
  const p = z.object({ id: uuid, reason: z.string().trim().max(500) }).safeParse({ id: reviewId, reason });
  if (!p.success) return fail("VALIDATION", "Keep the reason under 500 characters.");
  if (hidden && p.data.reason.length < 5) return fail("VALIDATION", "Say why it's being hidden (at least 5 characters).");
  const db = await client();
  const { error } = await db.rpc("admin_hide_review", { p_review: p.data.id, p_hidden: hidden, p_reason: p.data.reason || undefined });
  if (error) return dbFailure(error, "We couldn't update that review.", "reviews.hide_failed");
  revalidateReviews();
  return ok(null, hidden ? "Review hidden." : "Review restored.");
}
