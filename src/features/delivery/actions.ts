"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer, requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import { dbFailure } from "@/lib/db/action-errors";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { isDeliveryCode, roundCoord } from "@/lib/trust/labels";
import { runSweep } from "@/lib/jobs/sweep";

/** Every delivery step is a database workflow that re-checks who you are, the order state and the rate limits. */
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid reference.");
const note = z.string().trim().max(300, "Keep the note under 300 characters.");

async function client() {
  const db = await createSupabaseServerClient();
  if (!db) throw new Error("Supabase not configured");
  return db;
}

function revalidateDelivery(orderId: string) {
  for (const base of ["/buyer/orders", "/seller/orders", "/admin/orders"]) {
    revalidatePath(base);
    revalidatePath(`${base}/${orderId}`);
  }
  revalidatePath("/carrier/deliveries", "layout");
  revalidatePath("/buyer/payments");
  revalidatePath("/seller/payouts");
  revalidatePath("/carrier/earnings");
  revalidatePath("/admin/finance", "layout");
}

/* --------------------------------------------------------------- carrier */

export async function carrierPickUp(orderId: string, text: string): Promise<ActionResult<null>> {
  await requireRole("carrier");
  const p = z.object({ id: uuid, note }).safeParse({ id: orderId, note: text });
  if (!p.success) return fail("VALIDATION", p.error.issues[0]?.message ?? "Check the details.");
  const db = await client();
  const { error } = await db.rpc("carrier_mark_picked_up", { p_order: p.data.id, p_note: p.data.note || undefined });
  if (error) return dbFailure(error, "We couldn't record the pickup. Please try again.", "delivery.pickup_failed");
  revalidateDelivery(p.data.id);
  return ok(null, "Pickup recorded. The buyer now has their delivery code.");
}

export async function carrierCheckpoint(orderId: string, text: string, lat: number | null, lng: number | null): Promise<ActionResult<null>> {
  await requireRole("carrier");
  const p = z
    .object({ id: uuid, note, lat: z.number().min(-90).max(90).nullable(), lng: z.number().min(-180).max(180).nullable() })
    .safeParse({ id: orderId, note: text, lat, lng });
  if (!p.success) return fail("VALIDATION", p.error.issues[0]?.message ?? "Check the details.");
  if ((p.data.lat === null) !== (p.data.lng === null)) return fail("VALIDATION", "Location needs both latitude and longitude.");
  const db = await client();
  const { error } = await db.rpc("carrier_post_checkpoint", {
    p_order: p.data.id,
    p_note: p.data.note || undefined,
    p_lat: p.data.lat === null ? undefined : roundCoord(p.data.lat),
    p_lng: p.data.lng === null ? undefined : roundCoord(p.data.lng),
  });
  if (error) return dbFailure(error, "We couldn't post that update.", "delivery.checkpoint_failed");
  revalidateDelivery(p.data.id);
  return ok(null, "Update posted.");
}

export async function carrierArrived(orderId: string, text: string): Promise<ActionResult<null>> {
  await requireRole("carrier");
  const p = z.object({ id: uuid, note }).safeParse({ id: orderId, note: text });
  if (!p.success) return fail("VALIDATION", p.error.issues[0]?.message ?? "Check the details.");
  const db = await client();
  const { error } = await db.rpc("carrier_mark_arrived", { p_order: p.data.id, p_note: p.data.note || undefined });
  if (error) return dbFailure(error, "We couldn't record your arrival.", "delivery.arrived_failed");
  revalidateDelivery(p.data.id);
  return ok(null, "Arrival recorded. Ask the buyer for their delivery code once they've checked the goods.");
}

export async function carrierDeliveryFailed(orderId: string, reason: string): Promise<ActionResult<null>> {
  await requireRole("carrier");
  const p = z.object({ id: uuid, reason: z.string().trim().min(5, "Say what went wrong (at least 5 characters).").max(300) }).safeParse({ id: orderId, reason });
  if (!p.success) return fail("VALIDATION", p.error.issues[0]?.message ?? "Check the details.");
  const db = await client();
  const { error } = await db.rpc("carrier_report_delivery_failed", { p_order: p.data.id, p_reason: p.data.reason });
  if (error) return dbFailure(error, "We couldn't record that.", "delivery.failed_report_failed");
  revalidateDelivery(p.data.id);
  return ok(null, "Recorded. The buyer and seller can see this. You can still try again or open a dispute.");
}

/**
 * The database answers `confirmed`, `wrong_code` or `locked` instead of raising,
 * so a wrong guess is counted even though nothing else changes.
 */
export async function carrierConfirmCode(orderId: string, code: string): Promise<ActionResult<{ result: "confirmed" | "wrong_code" | "locked" }>> {
  await requireRole("carrier");
  const p = z.object({ id: uuid }).safeParse({ id: orderId });
  if (!p.success) return fail("VALIDATION", "Invalid delivery.");
  if (!isDeliveryCode(code)) return fail("VALIDATION", "Enter the 6-digit code the buyer shows you.");
  const db = await client();
  const { data, error } = await db.rpc("carrier_confirm_delivery", { p_order: p.data.id, p_code: code });
  if (error) return dbFailure(error, "We couldn't check that code. Please try again.", "delivery.confirm_failed");
  revalidateDelivery(p.data.id);
  if (data === "confirmed") return ok({ result: "confirmed" as const }, "Delivery confirmed. Payment is being released.");
  if (data === "locked") return ok({ result: "locked" as const }, "Too many wrong codes. The buyer must regenerate the code or confirm receipt in the app.");
  return ok({ result: "wrong_code" as const }, "That code doesn't match.");
}

/* ----------------------------------------------------------------- buyer */

export async function buyerConfirmDelivery(orderId: string): Promise<ActionResult<null>> {
  const viewer = await getViewer();
  if (!viewer) return fail("UNAUTHENTICATED", "Your session ended. Sign in again.");
  const p = uuid.safeParse(orderId);
  if (!p.success) return fail("VALIDATION", "Invalid order.");
  const db = await client();
  const { error } = await db.rpc("buyer_confirm_delivery", { p_order: orderId });
  if (error) return dbFailure(error, "We couldn't confirm receipt. Please try again.", "delivery.buyer_confirm_failed");
  logger.info("delivery.buyer_confirmed", { orderId });
  revalidateDelivery(orderId);
  return ok(null, "Thanks — receipt confirmed and payment released.");
}

export async function regenerateDeliveryCode(orderId: string): Promise<ActionResult<null>> {
  const viewer = await getViewer();
  if (!viewer) return fail("UNAUTHENTICATED", "Your session ended. Sign in again.");
  if (!uuid.safeParse(orderId).success) return fail("VALIDATION", "Invalid order.");
  const db = await client();
  const { error } = await db.rpc("regenerate_delivery_code", { p_order: orderId });
  if (error) return dbFailure(error, "We couldn't make a new code.", "delivery.regenerate_failed");
  revalidateDelivery(orderId);
  return ok(null, "New code ready. The old one no longer works.");
}

/** Buyer or admin: cancel an order that hasn't been paid, releasing stock and the freight request. */
export async function cancelUnpaidOrder(orderId: string, reason: string): Promise<ActionResult<null>> {
  const viewer = await getViewer();
  if (!viewer) return fail("UNAUTHENTICATED", "Your session ended. Sign in again.");
  const p = z.object({ id: uuid, reason: z.string().trim().max(300) }).safeParse({ id: orderId, reason });
  if (!p.success) return fail("VALIDATION", "Keep the reason under 300 characters.");
  const db = await client();
  const { error } = await db.rpc("cancel_unpaid_order", { p_order: p.data.id, p_reason: p.data.reason || undefined });
  if (error) return dbFailure(error, "We couldn't cancel the order.", "delivery.cancel_unpaid_failed");
  revalidateDelivery(p.data.id);
  return ok(null, "Order cancelled. Stock has been released.");
}

/** Admin: run the same housekeeping the nightly job runs (expire unpaid orders, release silent deliveries). */
export async function runSweepNow(): Promise<ActionResult<{ expiredUnpaid: number; autoReleased: number }>> {
  await requireRole("admin");
  try {
    const r = await runSweep();
    revalidatePath("/admin/orders");
    revalidatePath("/admin/finance", "layout");
    return ok(r, `Expired ${r.expiredUnpaid} unpaid ${r.expiredUnpaid === 1 ? "order" : "orders"}; released ${r.autoReleased} silent ${r.autoReleased === 1 ? "delivery" : "deliveries"}.`);
  } catch {
    return fail("INTERNAL", "The sweep couldn't run. Check the server logs.");
  }
}
