import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import { logger } from "@/lib/logging/logger";
import type { BusinessRow, ProductImageRow, ProductRow, ProductStatus } from "@/lib/db/types";

/**
 * Seller-side reads. These run as the signed-in user, so RLS returns the
 * seller's own drafts/paused listings (which the public client never sees).
 */

export interface MyBusiness extends BusinessRow {
  member_role: "owner" | "manager" | "staff";
}

export const getMyBusiness = cache(async (): Promise<MyBusiness | null> => {
  const db = await createSupabaseServerClient();
  if (!db) return null;
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await db
    .from("business_members")
    .select("member_role, business:businesses(*)")
    .eq("profile_id", auth.user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) logger.error("seller.business_query_failed", { message: error.message });
  if (!data?.business) return null;
  return { ...(data.business as unknown as BusinessRow), member_role: data.member_role };
});

export interface SellerListing {
  id: string;
  slug: string;
  title: string;
  status: ProductStatus;
  unit_label: string;
  moq: number;
  quantity_available: number;
  currency: "USD" | "LRD";
  unit_weight_g: number | null;
  updated_at: string;
  published_at: string | null;
  tiers: { unit_price_minor: number; min_qty: number }[];
  images: { storage_path: string; sort_order: number }[];
  category: { name: string } | null;
}

export async function listMyListings(businessId: string, status?: ProductStatus | "all"): Promise<SellerListing[]> {
  const db = await createSupabaseServerClient();
  if (!db) return [];
  let q = db
    .from("products")
    .select(
      "id, slug, title, status, unit_label, moq, quantity_available, currency, unit_weight_g, updated_at, published_at, " +
        "tiers:product_price_tiers(unit_price_minor, min_qty), images:product_images(storage_path, sort_order), category:product_categories(name)",
    )
    .eq("business_id", businessId)
    .order("updated_at", { ascending: false });
  if (status && status !== "all") q = q.eq("status", status);
  const { data, error } = await q;
  if (error) logger.error("seller.listings_query_failed", { message: error.message });
  return (data ?? []) as unknown as SellerListing[];
}

export interface EditableListing extends ProductRow {
  tiers: { min_qty: number; max_qty: number | null; unit_price_minor: number }[];
  specs: { label: string; value: string; sort_order: number }[];
  images: ProductImageRow[];
}

export async function getMyListing(id: string): Promise<EditableListing | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const db = await createSupabaseServerClient();
  if (!db) return null;
  const { data, error } = await db
    .from("products")
    .select(
      "*, tiers:product_price_tiers(min_qty, max_qty, unit_price_minor), specs:product_specifications(label, value, sort_order), images:product_images(*)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) logger.error("seller.listing_query_failed", { message: error.message });
  return (data as unknown as EditableListing | null) ?? null;
}

export async function countMyListings(businessId: string) {
  const db = await createSupabaseServerClient();
  const empty = { draft: 0, active: 0, paused: 0, archived: 0 } as Record<ProductStatus, number>;
  if (!db) return empty;
  const { data } = await db.from("products").select("status").eq("business_id", businessId);
  for (const row of data ?? []) empty[row.status] += 1;
  return empty;
}
