"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import { dbFailure, formText as text, zodFieldErrors } from "@/lib/db/action-errors";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { isCurrencyCode, parseMajorToMinor } from "@/lib/money/currency";
import { CARRIER_DOC_BUCKET, isValidDocumentPath } from "@/lib/storage/documents";
import { bidSchema, carrierProfileSchema, documentSchema, uuidSchema, vehicleSchema } from "./schemas";

export type CarrierFormState = ActionResult<null> | null;

async function carrierContext() {
  const viewer = await requireRole("carrier");
  const db = await createSupabaseServerClient();
  if (!db) throw new Error("Supabase not configured");
  return { viewer, db };
}

function revalidateCarrier() {
  revalidatePath("/carrier", "layout");
}

/* ------------------------------------------------------------------ profile */

export async function saveCarrierProfile(_prev: CarrierFormState, fd: FormData): Promise<CarrierFormState> {
  const { viewer, db } = await carrierContext();
  const parsed = carrierProfileSchema.safeParse({
    full_name: text(fd, "full_name"),
    phone: text(fd, "phone"),
    address: text(fd, "address"),
    home_county: text(fd, "home_county"),
    home_town: text(fd, "home_town"),
    coverage_counties: fd.getAll("coverage_counties").filter((v): v is string => typeof v === "string"),
    is_available: fd.get("is_available") === "on",
  });
  if (!parsed.success) return fail("VALIDATION", "Please fix the highlighted fields.", zodFieldErrors(parsed.error.issues));
  const { data: existing } = await db.from("carrier_profiles").select("id").eq("id", viewer.id).maybeSingle();
  const { error } = existing
    ? await db.from("carrier_profiles").update(parsed.data).eq("id", viewer.id)
    : await db.from("carrier_profiles").insert({ ...parsed.data, id: viewer.id });
  if (error) return dbFailure(error, "We couldn't save your profile.", "carrier.save_profile_failed");
  revalidateCarrier();
  return ok(null, "Profile saved.");
}

export async function setAvailability(available: boolean): Promise<ActionResult<null>> {
  const { viewer, db } = await carrierContext();
  const { error } = await db.from("carrier_profiles").update({ is_available: available }).eq("id", viewer.id);
  if (error) return dbFailure(error, "We couldn't update your availability.", "carrier.availability_failed");
  revalidateCarrier();
  return ok(null);
}

/* ----------------------------------------------------------------- vehicles */

export async function saveVehicle(vehicleId: string | null, _prev: CarrierFormState, fd: FormData): Promise<CarrierFormState> {
  const { viewer, db } = await carrierContext();
  const parsed = vehicleSchema.safeParse({
    vehicle_type: text(fd, "vehicle_type"),
    plate_number: text(fd, "plate_number"),
    make_model: text(fd, "make_model"),
    year: text(fd, "year"),
    payload_kg: text(fd, "payload_kg"),
    cargo_volume_m3: text(fd, "cargo_volume_m3"),
    is_active: vehicleId ? fd.get("is_active") === "on" : true,
  });
  if (!parsed.success) return fail("VALIDATION", "Please fix the highlighted fields.", zodFieldErrors(parsed.error.issues));
  if (vehicleId && !uuidSchema.safeParse(vehicleId).success) return fail("VALIDATION", "Invalid vehicle.");
  const { error } = vehicleId
    ? await db.from("vehicles").update(parsed.data).eq("id", vehicleId)
    : await db.from("vehicles").insert({ ...parsed.data, carrier_id: viewer.id });
  if (error) return dbFailure(error, "We couldn't save the vehicle.", "carrier.save_vehicle_failed", "That plate number is already registered.");
  revalidateCarrier();
  return ok(null, vehicleId ? "Vehicle updated." : "Vehicle added. Our team verifies it with your documents.");
}

export async function deleteVehicle(vehicleId: string): Promise<ActionResult<null>> {
  const { db } = await carrierContext();
  if (!uuidSchema.safeParse(vehicleId).success) return fail("VALIDATION", "Invalid vehicle.");
  const { data, error } = await db.from("vehicles").delete().eq("id", vehicleId).select("id");
  if (error) return dbFailure(error, "This vehicle has bids on record — switch it off instead.", "carrier.delete_vehicle_failed");
  if (!data?.length) return fail("VALIDATION", "Verified vehicles can't be deleted — switch them off instead.");
  revalidateCarrier();
  return ok(null);
}

/* ---------------------------------------------------------------- documents */

/** Registers a file the browser already uploaded to the carrier's private folder. */
export async function registerDocument(input: unknown): Promise<ActionResult<null>> {
  const { viewer, db } = await carrierContext();
  const parsed = documentSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "That file couldn't be saved.");
  const d = parsed.data;
  if (!isValidDocumentPath(d.path, viewer.id)) return fail("VALIDATION", "That file couldn't be saved.");
  const { error } = await db.from("carrier_documents").insert({
    carrier_id: viewer.id,
    vehicle_id: d.vehicle_id,
    doc_type: d.doc_type,
    storage_path: d.path,
    file_name: d.file_name,
    mime_type: d.mime_type,
    size_bytes: d.size_bytes,
  });
  if (error) {
    await db.storage.from(CARRIER_DOC_BUCKET).remove([d.path]);
    return dbFailure(error, "We couldn't save that document.", "carrier.register_document_failed");
  }
  revalidateCarrier();
  return ok(null);
}

export async function deleteDocument(documentId: string): Promise<ActionResult<null>> {
  const { db } = await carrierContext();
  if (!uuidSchema.safeParse(documentId).success) return fail("VALIDATION", "Invalid document.");
  const { data, error } = await db.from("carrier_documents").delete().eq("id", documentId).select("storage_path");
  if (error) return dbFailure(error, "We couldn't delete that document.", "carrier.delete_document_failed");
  const path = data?.[0]?.storage_path;
  if (path) await db.storage.from(CARRIER_DOC_BUCKET).remove([path]);
  revalidateCarrier();
  return ok(null);
}

/** Short-lived link so the carrier can check their own upload. */
export async function openMyDocument(documentId: string): Promise<ActionResult<{ url: string }>> {
  const { db } = await carrierContext();
  if (!uuidSchema.safeParse(documentId).success) return fail("VALIDATION", "Invalid document.");
  const { data: doc } = await db.from("carrier_documents").select("storage_path").eq("id", documentId).maybeSingle();
  if (!doc) return fail("NOT_FOUND", "Document not found.");
  const { data, error } = await db.storage.from(CARRIER_DOC_BUCKET).createSignedUrl(doc.storage_path, 120);
  if (error || !data) return fail("INTERNAL", "We couldn't open that file.");
  return ok({ url: data.signedUrl });
}

export async function submitForReview(): Promise<ActionResult<null>> {
  const { db } = await carrierContext();
  const { error } = await db.rpc("submit_carrier_for_review");
  if (error) return dbFailure(error, "We couldn't submit your profile.", "carrier.submit_review_failed");
  logger.info("carrier.submitted_for_review");
  revalidateCarrier();
  revalidatePath("/admin/verification");
  return ok(null, "Submitted. We'll review your documents shortly.");
}

/* -------------------------------------------------------------------- bids */

export async function submitBid(_prev: CarrierFormState, fd: FormData): Promise<CarrierFormState> {
  const { db } = await carrierContext();
  const parsed = bidSchema.safeParse({
    rfq_id: text(fd, "rfq_id"),
    vehicle_id: text(fd, "vehicle_id"),
    amount: text(fd, "amount"),
    eta_hours: text(fd, "eta_hours"),
    delivery_date: text(fd, "delivery_date"),
    note: text(fd, "note"),
  });
  if (!parsed.success) return fail("VALIDATION", "Please fix the highlighted fields.", zodFieldErrors(parsed.error.issues));
  const currency = text(fd, "currency");
  if (!isCurrencyCode(currency)) return fail("VALIDATION", "Invalid currency.");
  const amountMinor = parseMajorToMinor(parsed.data.amount, currency);
  if (!amountMinor || amountMinor < 1) return fail("VALIDATION", "Enter your price, e.g. 180 or 180.50.", { amount: "Enter a valid amount." });

  const { error } = await db.rpc("submit_freight_bid", {
    p_rfq: parsed.data.rfq_id,
    p_vehicle: parsed.data.vehicle_id,
    p_amount_minor: amountMinor,
    p_eta_hours: parsed.data.eta_hours,
    p_delivery_date: parsed.data.delivery_date,
    p_note: parsed.data.note ?? undefined,
  });
  if (error) return dbFailure(error, "We couldn't submit your bid.", "carrier.submit_bid_failed");
  logger.info("carrier.bid_submitted", { rfq: parsed.data.rfq_id });
  revalidatePath(`/carrier/loads/${parsed.data.rfq_id}`);
  revalidateCarrier();
  return ok(null, "Bid sent. Only the buyer can see it.");
}

export async function withdrawBid(bidId: string, rfqId: string): Promise<ActionResult<null>> {
  const { db } = await carrierContext();
  if (!uuidSchema.safeParse(bidId).success) return fail("VALIDATION", "Invalid bid.");
  const { error } = await db.rpc("withdraw_freight_bid", { p_bid: bidId });
  if (error) return dbFailure(error, "We couldn't withdraw the bid.", "carrier.withdraw_bid_failed");
  revalidatePath(`/carrier/loads/${rfqId}`);
  revalidateCarrier();
  return ok(null, "Bid withdrawn.");
}
