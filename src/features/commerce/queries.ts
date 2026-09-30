import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import { logger } from "@/lib/logging/logger";
import { fromRows } from "@/lib/pricing/tiers";
import type { CartLineInput } from "@/lib/orders/cart";
import type { OrderStatus } from "@/lib/orders/state";
import type { CurrencyCode } from "@/lib/money/currency";
import type { Tables } from "@/lib/db/database.types";

/**
 * Commerce reads. All run as the signed-in user: RLS limits buyers to their
 * own cart/addresses/orders and sellers to orders placed with their business.
 */

export type AddressRow = Tables<"addresses">;
export type OrderRow = Tables<"orders">;
export type OrderItemRow = Tables<"order_items">;
export type OrderHistoryRow = Tables<"order_status_history">;
export type ProformaRow = Tables<"proforma_invoices">;

export interface AddressSnapshot {
  label: string;
  contact_name: string;
  contact_phone: string;
  county: string;
  town: string;
  street: string | null;
  landmark: string | null;
}
export interface BuyerSnapshot {
  name: string;
  phone: string | null;
  business_name: string | null;
}
export interface SellerSnapshot {
  name: string;
  slug: string;
  county: string;
  town: string;
  address_line: string | null;
  phone: string | null;
  registration_number: string | null;
  verification_status: string;
}

async function db() {
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase not configured");
  return client;
}

/* ------------------------------------------------------------------ settings */

export const getCommerceSettings = cache(async () => {
  const client = await db();
  const { data } = await client
    .from("platform_settings")
    .select("key, value")
    .in("key", ["commerce.platform_fee_bps", "commerce.order_cancellation_window_minutes", "commerce.max_cart_lines", "commerce.proforma_validity_days"]);
  const get = (k: string, d: number) => {
    const v = data?.find((r) => r.key === k)?.value;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : d;
  };
  return {
    feeBps: get("commerce.platform_fee_bps", 250),
    cancelWindowMinutes: get("commerce.order_cancellation_window_minutes", 60),
    maxCartLines: get("commerce.max_cart_lines", 50),
    proformaValidityDays: get("commerce.proforma_validity_days", 7),
  };
});

/* ---------------------------------------------------------------- addresses */

export async function listMyAddresses(): Promise<AddressRow[]> {
  const client = await db();
  const { data, error } = await client
    .from("addresses")
    .select("*")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) logger.error("commerce.addresses_query_failed", { message: error.message });
  return data ?? [];
}

/* --------------------------------------------------------------------- cart */

type CartQueryRow = {
  id: string;
  quantity: number;
  product_id: string;
  product: {
    id: string;
    slug: string;
    title: string;
    unit_label: string;
    moq: number;
    quantity_available: number;
    currency: CurrencyCode;
    unit_weight_g: number | null;
    status: string;
    tiers: { min_qty: number; max_qty: number | null; unit_price_minor: number }[];
    images: { storage_path: string; sort_order: number }[];
    business: { id: string; trading_name: string; slug: string; county: string; town: string; verification_status: string; status: string } | null;
  } | null;
};

/** The viewer's cart. Lines whose product is no longer visible (paused/archived) come back with product = null. */
export const getMyCart = cache(async (): Promise<CartLineInput[]> => {
  const client = await db();
  const { data, error } = await client
    .from("cart_items")
    .select(
      "id, quantity, product_id, product:products(id, slug, title, unit_label, moq, quantity_available, currency, unit_weight_g, status, " +
        "tiers:product_price_tiers(min_qty, max_qty, unit_price_minor), images:product_images(storage_path, sort_order), " +
        "business:businesses(id, trading_name, slug, county, town, verification_status, status))",
    )
    .order("created_at", { ascending: true });
  if (error) logger.error("commerce.cart_query_failed", { message: error.message });
  return ((data ?? []) as unknown as CartQueryRow[]).map((row) => {
    const p = row.product;
    const usable = p && p.status === "active" && p.business && p.business.status === "active";
    return {
      id: row.id,
      quantity: row.quantity,
      product: usable
        ? {
            id: p.id,
            slug: p.slug,
            title: p.title,
            unitLabel: p.unit_label,
            moq: p.moq,
            available: p.quantity_available,
            currency: p.currency,
            unitWeightG: p.unit_weight_g,
            tiers: fromRows(p.tiers),
            coverPath: [...p.images].sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path ?? null,
            seller: {
              id: p.business!.id,
              name: p.business!.trading_name,
              slug: p.business!.slug,
              county: p.business!.county,
              town: p.business!.town,
              verified: p.business!.verification_status === "verified",
            },
          }
        : null,
    };
  });
});

export const countMyCart = cache(async (): Promise<number> => {
  const client = await db();
  const { count } = await client.from("cart_items").select("id", { count: "exact", head: true });
  return count ?? 0;
});

export async function getCartQuantity(productId: string): Promise<number | null> {
  const client = await db();
  const { data } = await client.from("cart_items").select("quantity").eq("product_id", productId).maybeSingle();
  return data?.quantity ?? null;
}

/* ------------------------------------------------------------------- orders */

export interface OrderListItem {
  id: string;
  order_number: string;
  status: OrderStatus;
  currency: CurrencyCode;
  subtotal_minor: number;
  platform_fee_minor: number;
  total_minor: number;
  total_weight_g: number;
  item_count: number;
  placed_at: string;
  buyer_snapshot: BuyerSnapshot;
  seller_snapshot: SellerSnapshot;
  delivery_address: AddressSnapshot;
  items: { title: string; quantity: number; unit_label: string }[];
}

const LIST_COLUMNS =
  "id, order_number, status, currency, subtotal_minor, platform_fee_minor, total_minor, total_weight_g, item_count, placed_at, " +
  "buyer_snapshot, seller_snapshot, delivery_address, items:order_items(title, quantity, unit_label)";

export async function listOrders(opts: {
  scope: "buyer" | "seller" | "admin";
  viewerId?: string;
  businessId?: string;
  statuses?: readonly OrderStatus[];
  search?: string;
  limit?: number;
}): Promise<OrderListItem[]> {
  const client = await db();
  let q = client.from("orders").select(LIST_COLUMNS).order("placed_at", { ascending: false }).limit(opts.limit ?? 100);
  if (opts.scope === "buyer" && opts.viewerId) q = q.eq("buyer_id", opts.viewerId);
  if (opts.scope === "seller" && opts.businessId) q = q.eq("seller_business_id", opts.businessId);
  if (opts.statuses?.length) q = q.in("status", [...opts.statuses]);
  if (opts.search) q = q.ilike("order_number", `%${opts.search.replace(/[%_\\]/g, "")}%`);
  const { data, error } = await q;
  if (error) logger.error("commerce.orders_query_failed", { message: error.message, scope: opts.scope });
  return (data ?? []) as unknown as OrderListItem[];
}

export async function countOrdersByStatus(opts: { scope: "buyer" | "seller" | "admin"; viewerId?: string; businessId?: string }) {
  const client = await db();
  let q = client.from("orders").select("status");
  if (opts.scope === "buyer" && opts.viewerId) q = q.eq("buyer_id", opts.viewerId);
  if (opts.scope === "seller" && opts.businessId) q = q.eq("seller_business_id", opts.businessId);
  const { data, error } = await q.limit(5000);
  if (error) logger.error("commerce.order_counts_failed", { message: error.message });
  const counts: Partial<Record<OrderStatus, number>> = {};
  for (const r of data ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return counts;
}

export interface OrderDetail extends Omit<OrderRow, "buyer_snapshot" | "seller_snapshot" | "delivery_address"> {
  buyer_snapshot: BuyerSnapshot;
  seller_snapshot: SellerSnapshot;
  delivery_address: AddressSnapshot;
  items: OrderItemRow[];
  history: OrderHistoryRow[];
  proformas: Pick<ProformaRow, "id" | "invoice_number" | "revision" | "issued_at">[];
  productSlugs: Record<string, string>;
}

export async function getOrder(id: string): Promise<OrderDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const client = await db();
  const { data, error } = await client
    .from("orders")
    .select(
      "*, items:order_items(*), history:order_status_history(*), proformas:proforma_invoices(id, invoice_number, revision, issued_at)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) logger.error("commerce.order_query_failed", { message: error.message });
  if (!data) return null;
  const order = data as unknown as OrderDetail;
  order.items.sort((a, b) => a.title.localeCompare(b.title));
  order.history.sort((a, b) => a.id - b.id);
  order.proformas.sort((a, b) => b.revision - a.revision);

  // Link lines back to listings that are still public.
  const ids = order.items.map((i) => i.product_id).filter((v): v is string => Boolean(v));
  order.productSlugs = {};
  if (ids.length) {
    const { data: products } = await client.from("products").select("id, slug, status").in("id", ids);
    for (const p of products ?? []) if (p.status === "active") order.productSlugs[p.id] = p.slug;
  }
  return order;
}

export interface ProformaSnapshot {
  order_number: string;
  status: OrderStatus;
  currency: CurrencyCode;
  buyer: BuyerSnapshot;
  seller: SellerSnapshot;
  delivery_address: AddressSnapshot;
  items: { title: string; unit_label: string; sku: string | null; quantity: number; unit_price_minor: number; line_total_minor: number; unit_weight_g: number }[];
  subtotal_minor: number;
  freight_minor: number | null;
  platform_fee_bps: number;
  platform_fee_minor: number;
  total_minor: number;
  total_weight_g: number;
  carrier: { name: string; vehicle: string; plate: string; eta_hours: number } | null;
  estimated_delivery: string | null;
  payment_status: string;
  placed_at: string;
  valid_until: string;
  terms: string[];
}

export async function getProforma(orderId: string, revision?: number) {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null;
  const client = await db();
  let q = client.from("proforma_invoices").select("*").eq("order_id", orderId).order("revision", { ascending: false }).limit(1);
  if (revision) q = q.eq("revision", revision);
  const { data, error } = await q.maybeSingle();
  if (error) logger.error("commerce.proforma_query_failed", { message: error.message });
  if (!data) return null;
  return { ...data, snapshot: data.snapshot as unknown as ProformaSnapshot };
}
