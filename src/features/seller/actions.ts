"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import { fail, ok, type ActionResult, type FieldErrors } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { buildTiers, toRpcPayload, validateTiers } from "@/lib/pricing/tiers";
import { isValidImagePath, PRODUCT_IMAGE_BUCKET } from "@/lib/storage/images";
import { getMyBusiness } from "./queries";
import { businessSchema, listingBasicsSchema, logisticsSchema, pricingSchema, specsSchema, statusSchema } from "./schemas";

export type FormState = ActionResult<null> | null;

/* ------------------------------------------------------------------ helpers */

type PgError = { code?: string; message: string };

/** Database workflow errors carry human-written messages for these codes. */
const USER_FACING_CODES = new Set(["23514", "42501", "23505", "P0002", "22023"]);

function dbFailure(error: PgError, fallback: string, event: string): ActionResult<never> {
  logger.warn(event, { code: error.code, message: error.message });
  if (error.code && USER_FACING_CODES.has(error.code)) {
    const msg = error.code === "23505" && /products_business_sku_key/.test(error.message)
      ? "Another of your listings already uses that reference/SKU."
      : error.message;
    return fail("VALIDATION", msg);
  }
  return fail("INTERNAL", fallback);
}

function zodFieldErrors(issues: { path: PropertyKey[]; message: string }[]): FieldErrors {
  const out: FieldErrors = {};
  for (const i of issues) out[String(i.path[0] ?? "_")] ??= i.message;
  return out;
}

async function sellerContext() {
  await requireRole("seller");
  const db = await createSupabaseServerClient();
  if (!db) throw new Error("Supabase not configured");
  const business = await getMyBusiness();
  return { db, business };
}

function text(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

/* ----------------------------------------------------------------- business */

export async function saveBusiness(_prev: FormState, fd: FormData): Promise<FormState> {
  const { db, business } = await sellerContext();
  const parsed = businessSchema.safeParse({
    trading_name: text(fd, "trading_name"),
    legal_name: text(fd, "legal_name"),
    business_type: text(fd, "business_type"),
    county: text(fd, "county"),
    town: text(fd, "town"),
    address_line: text(fd, "address_line"),
    description: text(fd, "description"),
    contact_phone: text(fd, "contact_phone"),
    whatsapp_phone: text(fd, "whatsapp_phone"),
    registration_number: text(fd, "registration_number"),
  });
  if (!parsed.success) return fail("VALIDATION", "Please fix the highlighted fields.", zodFieldErrors(parsed.error.issues));
  const v = parsed.data;

  if (!business) {
    const { data: id, error } = await db.rpc("create_business", {
      p_trading_name: v.trading_name,
      p_business_type: v.business_type,
      p_county: v.county,
      p_town: v.town,
      p_description: v.description ?? undefined,
      p_contact_phone: v.contact_phone ?? undefined,
    });
    if (error || !id) return dbFailure(error ?? { message: "no id" }, "We couldn't create your business. Please try again.", "seller.create_business_failed");
    // Remaining optional fields are ordinary profile edits.
    await db
      .from("businesses")
      .update({ legal_name: v.legal_name, address_line: v.address_line, whatsapp_phone: v.whatsapp_phone, registration_number: v.registration_number })
      .eq("id", id);
    revalidatePath("/seller", "layout");
    redirect("/seller/listings/new?welcome=1");
  }

  const { error } = await db.from("businesses").update(v).eq("id", business.id);
  if (error) return dbFailure(error, "We couldn't save your business profile.", "seller.update_business_failed");
  revalidatePath("/seller", "layout");
  revalidatePath(`/sellers/${business.slug}`);
  return ok(null, "Business profile saved.");
}

/* ------------------------------------------------------------------ listings */

export async function createListing(_prev: FormState, fd: FormData): Promise<FormState> {
  const { db, business } = await sellerContext();
  if (!business) return fail("VALIDATION", "Create your business profile first.");
  const parsed = listingBasicsSchema.safeParse({
    title: text(fd, "title"),
    category_id: text(fd, "category_id"),
    unit_label: text(fd, "unit_label"),
    packaging_type: text(fd, "packaging_type") || "other",
    description: text(fd, "description"),
    sku: text(fd, "sku"),
    origin_country: text(fd, "origin_country"),
  });
  if (!parsed.success) return fail("VALIDATION", "Please fix the highlighted fields.", zodFieldErrors(parsed.error.issues));

  const { data, error } = await db
    .from("products")
    .insert({ ...parsed.data, business_id: business.id })
    .select("id")
    .single();
  if (error || !data) return dbFailure(error ?? { message: "no row" }, "We couldn't create the listing.", "seller.create_listing_failed");
  revalidatePath("/seller", "layout");
  redirect(`/seller/listings/${data.id}?created=1`);
}

async function editableListing(productId: string) {
  const ctx = await sellerContext();
  if (!ctx.business) throw new Error("No business");
  if (!/^[0-9a-f-]{36}$/.test(productId)) throw new Error("Bad id");
  const { data } = await ctx.db.from("products").select("id, slug, business_id, status").eq("id", productId).maybeSingle();
  if (!data || data.business_id !== ctx.business.id) throw new Error("Not your listing");
  return { ...ctx, product: data };
}

function revalidateListing(id: string, slug: string) {
  revalidatePath(`/seller/listings/${id}`);
  revalidatePath("/seller/listings");
  revalidatePath(`/products/${slug}`);
  revalidatePath("/marketplace");
}

export async function updateListingBasics(productId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { db, product } = await editableListing(productId);
  const parsed = listingBasicsSchema.safeParse({
    title: text(fd, "title"),
    category_id: text(fd, "category_id"),
    unit_label: text(fd, "unit_label"),
    packaging_type: text(fd, "packaging_type") || "other",
    description: text(fd, "description"),
    sku: text(fd, "sku"),
    origin_country: text(fd, "origin_country"),
  });
  if (!parsed.success) return fail("VALIDATION", "Please fix the highlighted fields.", zodFieldErrors(parsed.error.issues));
  const { error } = await db.from("products").update(parsed.data).eq("id", product.id);
  if (error) return dbFailure(error, "We couldn't save these details.", "seller.update_basics_failed");
  revalidateListing(product.id, product.slug);
  return ok(null, "Details saved.");
}

export async function saveListingPricing(productId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { db, product } = await editableListing(productId);
  let tiersRaw: unknown;
  try {
    tiersRaw = JSON.parse(text(fd, "tiers") || "[]");
  } catch {
    return fail("VALIDATION", "The price tiers couldn't be read. Please try again.");
  }
  const parsed = pricingSchema.safeParse({
    currency: text(fd, "currency"),
    moq: text(fd, "moq"),
    quantity_available: text(fd, "quantity_available"),
    tiers: tiersRaw,
  });
  if (!parsed.success) return fail("VALIDATION", "Please fix the highlighted fields.", zodFieldErrors(parsed.error.issues));

  const tiers = buildTiers(parsed.data.moq, parsed.data.tiers);
  const issues = validateTiers(parsed.data.moq, tiers);
  if (issues.length) return fail("VALIDATION", issues[0]!.message, { tiers: issues[0]!.message });

  const { error } = await db.rpc("save_product_pricing", {
    p_product: product.id,
    p_moq: parsed.data.moq,
    p_currency: parsed.data.currency,
    p_tiers: toRpcPayload(tiers),
  });
  if (error) return dbFailure(error, "We couldn't save the prices.", "seller.save_pricing_failed");

  const { error: qtyError } = await db.from("products").update({ quantity_available: parsed.data.quantity_available }).eq("id", product.id);
  if (qtyError) return dbFailure(qtyError, "Prices saved, but the stock quantity couldn't be updated.", "seller.save_qty_failed");

  revalidateListing(product.id, product.slug);
  return ok(null, "Prices and stock saved.");
}

export async function saveListingLogistics(productId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { db, product } = await editableListing(productId);
  const parsed = logisticsSchema.safeParse({
    unit_weight_g: text(fd, "unit_weight_kg"),
    length_mm: text(fd, "length_cm"),
    width_mm: text(fd, "width_cm"),
    height_mm: text(fd, "height_cm"),
    is_fragile: fd.get("is_fragile") === "on",
    is_stackable: fd.get("is_stackable") === "on",
    max_stack_layers: text(fd, "max_stack_layers"),
    handling_notes: text(fd, "handling_notes"),
  });
  if (!parsed.success) {
    const fe = zodFieldErrors(parsed.error.issues);
    // Map DB column names back to the form's field names.
    const renamed: FieldErrors = {
      unit_weight_kg: fe.unit_weight_g,
      length_cm: fe.length_mm,
      width_cm: fe.width_mm,
      height_cm: fe.height_mm,
      max_stack_layers: fe.max_stack_layers,
      handling_notes: fe.handling_notes,
    };
    return fail("VALIDATION", "Please fix the highlighted fields.", renamed);
  }
  const v = parsed.data;
  const dims = [v.length_mm, v.width_mm, v.height_mm];
  if (dims.some(Boolean) && !dims.every(Boolean)) {
    return fail("VALIDATION", "Enter all three dimensions, or leave them all blank.", { length_cm: "Enter length, width and height together." });
  }
  const volume = dims.every(Boolean) ? Math.max(1, Math.round((v.length_mm! / 10) * (v.width_mm! / 10) * (v.height_mm! / 10))) : null;

  const { error } = await db
    .from("products")
    .update({ ...v, unit_volume_cm3: volume, max_stack_layers: v.is_stackable ? v.max_stack_layers : null })
    .eq("id", product.id);
  if (error) return dbFailure(error, "We couldn't save the shipping details.", "seller.save_logistics_failed");
  revalidateListing(product.id, product.slug);
  return ok(null, "Shipping details saved.");
}

export async function saveListingSpecs(productId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { db, product } = await editableListing(productId);
  const labels = fd.getAll("spec_label").map(String);
  const values = fd.getAll("spec_value").map(String);
  const parsed = specsSchema.safeParse(labels.map((label, i) => ({ label, value: values[i] ?? "" })));
  if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Check the specifications.");
  const half = parsed.data.find((s) => (s.label && !s.value) || (!s.label && s.value));
  if (half) return fail("VALIDATION", "Each specification needs both a name and a value.");
  const { error } = await db.rpc("save_product_specifications", {
    p_product: product.id,
    p_specs: parsed.data.filter((s) => s.label && s.value),
  });
  if (error) return dbFailure(error, "We couldn't save the specifications.", "seller.save_specs_failed");
  revalidateListing(product.id, product.slug);
  return ok(null, "Specifications saved.");
}

export async function setListingStatus(productId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { db, product } = await editableListing(productId);
  const parsed = statusSchema.safeParse(text(fd, "status"));
  if (!parsed.success) return fail("VALIDATION", "Unknown action.");
  const { error } = await db.from("products").update({ status: parsed.data }).eq("id", product.id);
  if (error) return dbFailure(error, "We couldn't change the listing status.", "seller.status_failed");
  revalidateListing(product.id, product.slug);
  const messages = { active: "Your listing is live on the marketplace.", paused: "Listing paused — it's hidden from buyers.", archived: "Listing archived." };
  return ok(null, messages[parsed.data]);
}

export async function deleteDraftListing(productId: string): Promise<void> {
  const { db, product } = await editableListing(productId);
  if (product.status !== "draft") redirect(`/seller/listings/${product.id}`);
  const { data: imgs } = await db.from("product_images").select("storage_path").eq("product_id", product.id);
  const { error } = await db.from("products").delete().eq("id", product.id);
  if (error) {
    logger.warn("seller.delete_listing_failed", { code: error.code });
    redirect(`/seller/listings/${product.id}?error=delete`);
  }
  if (imgs?.length) await db.storage.from(PRODUCT_IMAGE_BUCKET).remove(imgs.map((i) => i.storage_path));
  revalidatePath("/seller", "layout");
  redirect("/seller/listings?deleted=1");
}

/* -------------------------------------------------------------------- images */

export async function registerProductImage(
  productId: string,
  input: { path: string; width: number; height: number },
): Promise<ActionResult<{ id: string }>> {
  const { db, business, product } = await editableListing(productId);
  if (!business || !isValidImagePath(input.path, business.id, product.id)) {
    return fail("VALIDATION", "That upload doesn't belong to this listing.");
  }
  const { count } = await db.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", product.id);
  const { data, error } = await db
    .from("product_images")
    .insert({
      product_id: product.id,
      storage_path: input.path,
      width: Math.round(input.width) || null,
      height: Math.round(input.height) || null,
      sort_order: count ?? 0,
    })
    .select("id")
    .single();
  if (error || !data) {
    await db.storage.from(PRODUCT_IMAGE_BUCKET).remove([input.path]);
    return dbFailure(error ?? { message: "no row" }, "We couldn't save the photo.", "seller.register_image_failed");
  }
  revalidateListing(product.id, product.slug);
  return ok({ id: data.id });
}

export async function deleteProductImage(productId: string, imageId: string): Promise<ActionResult<null>> {
  const { db, product } = await editableListing(productId);
  const { data: img } = await db.from("product_images").select("id, storage_path").eq("id", imageId).eq("product_id", product.id).maybeSingle();
  if (!img) return fail("NOT_FOUND", "Photo not found.");
  const { error } = await db.from("product_images").delete().eq("id", img.id);
  if (error) return dbFailure(error, "We couldn't remove the photo.", "seller.delete_image_failed");
  await db.storage.from(PRODUCT_IMAGE_BUCKET).remove([img.storage_path]);
  revalidateListing(product.id, product.slug);
  return ok(null);
}

export async function makeCoverImage(productId: string, imageId: string): Promise<ActionResult<null>> {
  const { db, product } = await editableListing(productId);
  const { data: imgs } = await db.from("product_images").select("id, sort_order").eq("product_id", product.id).order("sort_order");
  if (!imgs?.some((i) => i.id === imageId)) return fail("NOT_FOUND", "Photo not found.");
  const ordered = [imageId, ...imgs.filter((i) => i.id !== imageId).map((i) => i.id)];
  for (const [index, id] of ordered.entries()) {
    await db.from("product_images").update({ sort_order: index }).eq("id", id);
  }
  revalidateListing(product.id, product.slug);
  return ok(null);
}
