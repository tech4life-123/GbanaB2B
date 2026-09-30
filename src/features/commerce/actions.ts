"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer, requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import { fail, ok, type ActionResult, type FieldErrors } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { safeNextPath } from "@/lib/security/redirect";
import { addressSchema, addToCartSchema, cartLineSchema, checkoutSchema, transitionSchema, uuidSchema } from "./schemas";

export type CommerceFormState = ActionResult<{ added?: number } | null> | null;

type PgError = { code?: string; message: string };

/** Workflow functions and triggers raise human-written messages with these codes. */
const USER_FACING = new Set(["23514", "42501", "40001", "P0002", "22023"]);

function dbFailure(error: PgError, fallback: string, event: string): ActionResult<never> {
  logger.warn(event, { code: error.code, message: error.message });
  if (error.code === "40001") return fail("CONFLICT", error.message);
  if (error.code === "23505") return fail("CONFLICT", "That's already saved.");
  if (error.code && USER_FACING.has(error.code)) return fail("VALIDATION", error.message);
  return fail("INTERNAL", fallback);
}

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]): FieldErrors {
  const out: FieldErrors = {};
  for (const i of issues) out[String(i.path[0] ?? "_")] ??= i.message;
  return out;
}

function text(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

async function client() {
  const db = await createSupabaseServerClient();
  if (!db) throw new Error("Supabase not configured");
  return db;
}

function revalidateCart() {
  revalidatePath("/buyer", "layout");
}

/* --------------------------------------------------------------------- cart */

/** Adds a product to the cart, or sets its quantity if it's already there. */
export async function addToCart(_prev: CommerceFormState, fd: FormData): Promise<CommerceFormState> {
  const viewer = await getViewer();
  if (!viewer) return fail("UNAUTHENTICATED", "Sign in to add products to your cart.");
  if (!viewer.roles.includes("buyer")) return fail("FORBIDDEN", "Add the buyer role to your account to order.");
  const parsed = addToCartSchema.safeParse({ product_id: text(fd, "product_id"), quantity: text(fd, "quantity") });
  if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Check the quantity.", fieldErrors(parsed.error.issues));
  const { product_id, quantity } = parsed.data;

  const db = await client();
  const { data: product } = await db.from("products").select("moq, quantity_available, slug").eq("id", product_id).maybeSingle();
  if (!product) return fail("NOT_FOUND", "This product is no longer available.");
  if (quantity < product.moq) return fail("VALIDATION", `The minimum order is ${product.moq.toLocaleString("en-US")}.`, { quantity: "Below the minimum order." });
  if (quantity > product.quantity_available)
    return fail("VALIDATION", `Only ${product.quantity_available.toLocaleString("en-US")} available.`, { quantity: "More than the seller has." });

  const { data: existing } = await db.from("cart_items").select("id").eq("product_id", product_id).maybeSingle();
  const { error } = existing
    ? await db.from("cart_items").update({ quantity }).eq("id", existing.id)
    : await db.from("cart_items").insert({ profile_id: viewer.id, product_id, quantity });
  if (error) return dbFailure(error, "We couldn't update your cart. Please try again.", "commerce.add_to_cart_failed");

  revalidateCart();
  revalidatePath(`/products/${product.slug}`);
  return ok({ added: quantity }, existing ? "Cart updated." : "Added to your cart.");
}

export async function updateCartLine(_prev: CommerceFormState, fd: FormData): Promise<CommerceFormState> {
  await requireRole("buyer");
  const parsed = cartLineSchema.safeParse({ line_id: text(fd, "line_id"), quantity: text(fd, "quantity") });
  if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Check the quantity.");
  const db = await client();
  const { error } = await db.from("cart_items").update({ quantity: parsed.data.quantity }).eq("id", parsed.data.line_id);
  if (error) return dbFailure(error, "We couldn't update that line.", "commerce.update_cart_failed");
  revalidateCart();
  return ok(null);
}

export async function removeCartLine(lineId: string): Promise<ActionResult<null>> {
  await requireRole("buyer");
  if (!uuidSchema.safeParse(lineId).success) return fail("VALIDATION", "Invalid line.");
  const db = await client();
  const { error } = await db.from("cart_items").delete().eq("id", lineId);
  if (error) return dbFailure(error, "We couldn't remove that line.", "commerce.remove_cart_failed");
  revalidateCart();
  return ok(null);
}

/* ---------------------------------------------------------------- addresses */

export async function saveAddress(addressId: string | null, _prev: CommerceFormState, fd: FormData): Promise<CommerceFormState> {
  const viewer = await requireRole("buyer");
  const parsed = addressSchema.safeParse({
    label: text(fd, "label"),
    contact_name: text(fd, "contact_name"),
    contact_phone: text(fd, "contact_phone"),
    county: text(fd, "county"),
    town: text(fd, "town"),
    street: text(fd, "street"),
    landmark: text(fd, "landmark"),
    is_default: fd.get("is_default") === "on",
  });
  if (!parsed.success) return fail("VALIDATION", "Please fix the highlighted fields.", fieldErrors(parsed.error.issues));
  const db = await client();
  const v = parsed.data;
  if (addressId) {
    if (!uuidSchema.safeParse(addressId).success) return fail("VALIDATION", "Invalid address.");
    // Only switch the default on, never off: there must always be one default.
    const { is_default, ...rest } = v;
    const { error } = await db.from("addresses").update(is_default ? v : rest).eq("id", addressId);
    if (error) return dbFailure(error, "We couldn't save the address.", "commerce.update_address_failed");
  } else {
    const { error } = await db.from("addresses").insert({ ...v, profile_id: viewer.id });
    if (error) return dbFailure(error, "We couldn't save the address.", "commerce.create_address_failed");
  }
  revalidatePath("/buyer/addresses");
  revalidatePath("/buyer/checkout");
  const next = safeNextPath(text(fd, "next"), "");
  if (next) redirect(next);
  return ok(null, "Address saved.");
}

export async function deleteAddress(addressId: string): Promise<ActionResult<null>> {
  await requireRole("buyer");
  if (!uuidSchema.safeParse(addressId).success) return fail("VALIDATION", "Invalid address.");
  const db = await client();
  const { error } = await db.from("addresses").delete().eq("id", addressId);
  if (error) return dbFailure(error, "We couldn't delete the address.", "commerce.delete_address_failed");
  revalidatePath("/buyer/addresses");
  revalidatePath("/buyer/checkout");
  return ok(null, "Address removed.");
}

export async function makeDefaultAddress(addressId: string): Promise<ActionResult<null>> {
  await requireRole("buyer");
  if (!uuidSchema.safeParse(addressId).success) return fail("VALIDATION", "Invalid address.");
  const db = await client();
  const { error } = await db.from("addresses").update({ is_default: true }).eq("id", addressId);
  if (error) return dbFailure(error, "We couldn't update the address.", "commerce.default_address_failed");
  revalidatePath("/buyer/addresses");
  revalidatePath("/buyer/checkout");
  return ok(null);
}

/* ----------------------------------------------------------------- checkout */

export async function placeOrders(_prev: CommerceFormState, fd: FormData): Promise<CommerceFormState> {
  await requireRole("buyer");
  const parsed = checkoutSchema.safeParse({
    address_id: text(fd, "address_id"),
    business_name: text(fd, "business_name"),
    note: text(fd, "note"),
  });
  if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Check the form.", fieldErrors(parsed.error.issues));
  const db = await client();
  const { data, error } = await db.rpc("place_orders", {
    p_address: parsed.data.address_id,
    p_buyer_business_name: parsed.data.business_name ?? undefined,
    p_note: parsed.data.note ?? undefined,
  });
  if (error || !data) return dbFailure(error ?? { message: "no orders" }, "We couldn't place your order. Your cart is unchanged — please try again.", "commerce.place_orders_failed");
  logger.info("commerce.orders_placed", { count: data.length });
  revalidatePath("/buyer", "layout");
  revalidatePath("/seller", "layout");
  revalidatePath("/admin/orders");
  redirect(data.length === 1 ? `/buyer/orders/${data[0]}?placed=1` : `/buyer/orders?placed=${data.length}`);
}

/* --------------------------------------------------------------- lifecycle */

export async function transitionOrder(_prev: CommerceFormState, fd: FormData): Promise<CommerceFormState> {
  const viewer = await getViewer();
  if (!viewer) return fail("UNAUTHENTICATED", "Your session ended. Sign in again.");
  const parsed = transitionSchema.safeParse({
    order_id: text(fd, "order_id"),
    to: text(fd, "to"),
    note: text(fd, "note"),
    version: text(fd, "version") || undefined,
  });
  if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Check the form.", fieldErrors(parsed.error.issues));
  const { order_id, to, note, version } = parsed.data;
  const db = await client();
  const { error } = await db.rpc("transition_order", {
    p_order: order_id,
    p_to: to,
    p_note: note ?? undefined,
    p_expected_version: version,
  });
  if (error) return dbFailure(error, "We couldn't update the order. Please try again.", "commerce.transition_failed");
  logger.info("commerce.order_transition", { order: order_id, to });
  for (const p of ["/buyer/orders", "/seller/orders", "/admin/orders", `/buyer/orders/${order_id}`, `/seller/orders/${order_id}`, `/admin/orders/${order_id}`]) {
    revalidatePath(p);
  }
  revalidatePath("/seller", "layout");
  return ok(null, to === "cancelled" ? "Order cancelled." : "Order updated.");
}
