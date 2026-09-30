import "server-only";
import { cache } from "react";
import { createSupabasePublicClient } from "@/lib/db/supabase/public";
import { logger } from "@/lib/logging/logger";
import type { CategoryRow, ProductListingRow } from "@/lib/db/types";
import { PAGE_SIZE } from "./constants";
import { toWebSearch, type ListingQuery } from "./search-params";

export type Listing = ProductListingRow;

const LISTING_COLUMNS =
  "id, slug, title, unit_label, packaging_type, moq, quantity_available, currency, published_at, unit_weight_g, " +
  "category_slug, category_name, business_id, business_slug, business_name, business_county, business_town, " +
  "business_verification, min_price_minor, moq_price_minor, tier_count, cover_image_path";

export const listCategories = cache(async (): Promise<CategoryRow[]> => {
  const db = createSupabasePublicClient();
  if (!db) return [];
  const { data, error } = await db.from("product_categories").select("*").order("sort_order").order("name");
  if (error) logger.error("marketplace.categories_failed", { message: error.message });
  return data ?? [];
});

export async function searchListings(query: ListingQuery): Promise<{ items: Listing[]; total: number; failed: boolean }> {
  const db = createSupabasePublicClient();
  if (!db) return { items: [], total: 0, failed: false };

  let req = db
    .from("product_listings")
    .select(LISTING_COLUMNS, { count: "exact" })
    .eq("status", "active")
    .eq("currency", query.currency);

  const text = toWebSearch(query.q);
  if (text) req = req.textSearch("search_vector", text, { type: "websearch", config: "english" });
  if (query.category) req = req.eq("category_slug", query.category);
  if (query.seller) req = req.eq("business_slug", query.seller);
  if (query.county) req = req.eq("business_county", query.county);
  if (query.minPriceMinor !== null) req = req.gte("min_price_minor", query.minPriceMinor);
  if (query.maxPriceMinor !== null) req = req.lte("min_price_minor", query.maxPriceMinor);
  if (query.maxMoq !== null) req = req.lte("moq", query.maxMoq);
  if (query.inStock) req = req.gt("quantity_available", 0);

  switch (query.sort) {
    case "price_asc":
      req = req.order("min_price_minor", { ascending: true, nullsFirst: false });
      break;
    case "price_desc":
      req = req.order("min_price_minor", { ascending: false, nullsFirst: false });
      break;
    case "moq_asc":
      req = req.order("moq", { ascending: true });
      break;
    default:
      req = req.order("published_at", { ascending: false });
  }
  req = req.order("id");

  const from = (query.page - 1) * PAGE_SIZE;
  const { data, count, error } = await req.range(from, from + PAGE_SIZE - 1);
  if (error) {
    logger.error("marketplace.search_failed", { message: error.message, code: error.code });
    return { items: [], total: 0, failed: true };
  }
  return { items: (data ?? []) as unknown as Listing[], total: count ?? 0, failed: false };
}

export async function listingsByIds(ids: string[]): Promise<Listing[]> {
  const db = createSupabasePublicClient();
  if (!db || ids.length === 0) return [];
  const { data } = await db.from("product_listings").select(LISTING_COLUMNS).in("id", ids);
  return (data ?? []) as unknown as Listing[];
}

export async function relatedListings(categorySlug: string, excludeId: string, limit = 4): Promise<Listing[]> {
  const db = createSupabasePublicClient();
  if (!db) return [];
  const { data } = await db
    .from("product_listings")
    .select(LISTING_COLUMNS)
    .eq("status", "active")
    .eq("category_slug", categorySlug)
    .neq("id", excludeId)
    .order("published_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as Listing[];
}

export const getPublicProduct = cache(async (slug: string) => {
  const db = createSupabasePublicClient();
  if (!db) return null;
  const { data, error } = await db
    .from("products")
    .select(
      "*, business:businesses(id, slug, trading_name, business_type, county, town, verification_status, created_at, description), " +
        "category:product_categories(id, slug, name), " +
        "tiers:product_price_tiers(min_qty, max_qty, unit_price_minor), " +
        "specs:product_specifications(label, value, sort_order), " +
        "images:product_images(id, storage_path, alt_text, width, height, sort_order)",
    )
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (error) logger.error("marketplace.product_failed", { message: error.message });
  return data as unknown as PublicProduct | null;
});

export interface PublicProduct {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  sku: string | null;
  unit_label: string;
  packaging_type: ProductListingRow["packaging_type"] & string;
  moq: number;
  quantity_available: number;
  currency: "USD" | "LRD";
  origin_country: string | null;
  unit_weight_g: number | null;
  unit_volume_cm3: number | null;
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  is_fragile: boolean;
  is_stackable: boolean;
  max_stack_layers: number | null;
  handling_notes: string | null;
  published_at: string | null;
  updated_at: string;
  business: {
    id: string;
    slug: string;
    trading_name: string;
    business_type: string;
    county: string;
    town: string;
    verification_status: "unverified" | "pending" | "verified" | "rejected";
    created_at: string;
    description: string | null;
  };
  category: { id: string; slug: string; name: string };
  tiers: { min_qty: number; max_qty: number | null; unit_price_minor: number }[];
  specs: { label: string; value: string; sort_order: number }[];
  images: { id: string; storage_path: string; alt_text: string | null; width: number | null; height: number | null; sort_order: number }[];
}

export const getPublicSeller = cache(async (slug: string) => {
  const db = createSupabasePublicClient();
  if (!db) return null;
  const { data, error } = await db
    .from("businesses")
    .select("id, slug, trading_name, business_type, description, county, town, verification_status, verified_at, created_at")
    .eq("slug", slug)
    .maybeSingle();
  if (error) logger.error("marketplace.seller_failed", { message: error.message });
  return data;
});
