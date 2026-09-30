"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer, requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import { dbFailure, formText as text, zodFieldErrors } from "@/lib/db/action-errors";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { Constants } from "@/lib/db/database.types";

export type FreightFormState = ActionResult<null> | null;

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .transform((v) => (v === "" ? null : v));

const requestSchema = z
  .object({
    order_id: uuid,
    pickup_date: z.iso.date({ error: "Choose a pickup date." }),
    preferred_delivery_date: z.union([z.literal(""), z.iso.date()]).transform((v) => (v === "" ? null : v)),
    package_count: z
      .string()
      .trim()
      .transform((v, ctx) => {
        if (!v) return null;
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1 || n > 1_000_000) {
          ctx.addIssue({ code: "custom", message: "Enter a whole number of pieces." });
          return z.NEVER;
        }
        return n;
      }),
    special_instructions: optionalText(500),
  })
  .refine((v) => !v.preferred_delivery_date || v.preferred_delivery_date >= v.pickup_date, {
    path: ["preferred_delivery_date"],
    message: "Delivery can't be before pickup.",
  });

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
  revalidatePath("/buyer/freight");
  revalidatePath("/admin/freight");
  revalidatePath("/carrier", "layout");
}

export async function requestFreight(_prev: FreightFormState, fd: FormData): Promise<FreightFormState> {
  const viewer = await getViewer();
  if (!viewer) return fail("UNAUTHENTICATED", "Your session ended. Sign in again.");
  const parsed = requestSchema.safeParse({
    order_id: text(fd, "order_id"),
    pickup_date: text(fd, "pickup_date"),
    preferred_delivery_date: text(fd, "preferred_delivery_date"),
    package_count: text(fd, "package_count"),
    special_instructions: text(fd, "special_instructions"),
  });
  if (!parsed.success) return fail("VALIDATION", "Please fix the highlighted fields.", zodFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const db = await client();
  const { error } = await db.rpc("create_freight_rfq", {
    p_order: v.order_id,
    p_pickup_date: v.pickup_date,
    p_preferred_delivery_date: v.preferred_delivery_date ?? undefined,
    p_package_count: v.package_count ?? undefined,
    p_special_instructions: v.special_instructions ?? undefined,
  });
  if (error) return dbFailure(error, "We couldn't request freight. Please try again.", "freight.request_failed", "There's already a freight request for this order.");
  logger.info("freight.requested", { order: v.order_id });
  revalidateOrder(v.order_id);
  return ok(null, "Freight requested. Verified carriers on this route can now bid.");
}

export async function cancelFreightRequest(_prev: FreightFormState, fd: FormData): Promise<FreightFormState> {
  const viewer = await getViewer();
  if (!viewer) return fail("UNAUTHENTICATED", "Your session ended. Sign in again.");
  const rfq = uuid.safeParse(text(fd, "rfq_id"));
  const order = uuid.safeParse(text(fd, "order_id"));
  if (!rfq.success || !order.success) return fail("VALIDATION", "Invalid request.");
  const reason = text(fd, "reason").trim().slice(0, 500);
  const db = await client();
  const { error } = await db.rpc("cancel_freight_rfq", { p_rfq: rfq.data, p_reason: reason || undefined });
  if (error) return dbFailure(error, "We couldn't cancel the freight request.", "freight.cancel_failed");
  revalidateOrder(order.data);
  return ok(null, "Freight request cancelled.");
}

export async function selectBid(_prev: FreightFormState, fd: FormData): Promise<FreightFormState> {
  await requireRole("buyer");
  const bid = uuid.safeParse(text(fd, "bid_id"));
  const order = uuid.safeParse(text(fd, "order_id"));
  const version = Number(text(fd, "version"));
  if (!bid.success || !order.success) return fail("VALIDATION", "Invalid bid.");
  const db = await client();
  const { error } = await db.rpc("select_freight_bid", { p_bid: bid.data, p_expected_version: Number.isInteger(version) && version > 0 ? version : undefined });
  if (error) return dbFailure(error, "We couldn't book that carrier. Please try again.", "freight.select_failed");
  logger.info("freight.carrier_selected", { order: order.data });
  revalidateOrder(order.data);
  return ok(null, "Carrier booked. Your invoice now includes freight.");
}

/* ---------------------------------------------------------------- admin */

const reviewSchema = z.object({
  carrier_id: uuid,
  status: z.enum(Constants.public.Enums.carrier_verification_status),
  note: optionalText(500),
});

export async function adminReviewCarrier(_prev: FreightFormState, fd: FormData): Promise<FreightFormState> {
  await requireRole("admin");
  const parsed = reviewSchema.safeParse({ carrier_id: text(fd, "carrier_id"), status: text(fd, "status"), note: text(fd, "note") });
  if (!parsed.success) return fail("VALIDATION", "Please fix the highlighted fields.", zodFieldErrors(parsed.error.issues));
  const db = await client();
  const { error } = await db.rpc("admin_review_carrier", {
    p_carrier: parsed.data.carrier_id,
    p_status: parsed.data.status,
    p_note: parsed.data.note ?? undefined,
  });
  if (error) return dbFailure(error, "We couldn't save the decision.", "admin.review_carrier_failed");
  revalidatePath("/admin/verification");
  revalidatePath(`/admin/verification/${parsed.data.carrier_id}`);
  revalidatePath("/admin/audit");
  return ok(null, "Decision saved and recorded in the audit log.");
}

export async function adminVerifyVehicle(vehicleId: string, carrierId: string, verified: boolean): Promise<ActionResult<null>> {
  await requireRole("admin");
  if (!uuid.safeParse(vehicleId).success) return fail("VALIDATION", "Invalid vehicle.");
  const db = await client();
  const { error } = await db.rpc("admin_set_vehicle_verified", { p_vehicle: vehicleId, p_verified: verified });
  if (error) return dbFailure(error, "We couldn't update the vehicle.", "admin.verify_vehicle_failed");
  revalidatePath(`/admin/verification/${carrierId}`);
  revalidatePath("/admin/verification");
  return ok(null);
}
