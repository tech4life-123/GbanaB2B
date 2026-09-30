import "server-only";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import { logger } from "@/lib/logging/logger";
import type { Tables } from "@/lib/db/database.types";

/**
 * Public review columns only — the database never exposes who the reviewer
 * is beyond the display label, nor which order it was. Hidden reviews are
 * filtered out by RLS for everyone but admins (who use admin_list_reviews).
 */
const COLUMNS = "id, subject_kind, seller_business_id, carrier_id, rating, comment, reviewer_label, reply, replied_at, created_at";

export type PublicReview = Pick<Tables<"reviews">, "id" | "subject_kind" | "seller_business_id" | "carrier_id" | "rating" | "comment" | "reviewer_label" | "reply" | "replied_at" | "created_at">;
export type TrustStats = Tables<"trust_stats">;

async function db() {
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase not configured");
  return client;
}

export async function getTrustStats(kind: "seller" | "carrier", subjectId: string): Promise<TrustStats | null> {
  const client = await db();
  const { data } = await client.from("trust_stats").select("*").eq("subject_kind", kind).eq("subject_id", subjectId).maybeSingle();
  return data ?? null;
}

export async function getTrustStatsFor(kind: "seller" | "carrier", ids: string[]): Promise<Map<string, TrustStats>> {
  if (ids.length === 0) return new Map();
  const client = await db();
  const { data } = await client.from("trust_stats").select("*").eq("subject_kind", kind).in("subject_id", ids);
  return new Map((data ?? []).map((t) => [t.subject_id, t]));
}

export async function listReviewsFor(kind: "seller" | "carrier", subjectId: string, limit = 50): Promise<PublicReview[]> {
  const client = await db();
  const col = kind === "seller" ? "seller_business_id" : "carrier_id";
  const { data, error } = await client.from("reviews").select(COLUMNS).eq(col, subjectId).eq("subject_kind", kind).order("created_at", { ascending: false }).limit(limit);
  if (error) logger.error("reviews.list_failed", { message: error.message });
  return data ?? [];
}

/** What this buyer already submitted for an order (subject, rating, reply). */
export async function getOrderReviewStatus(orderId: string) {
  const client = await db();
  const { data } = await client.rpc("order_review_status", { p_order: orderId });
  return data ?? [];
}

export async function listAdminReviews(limit = 100) {
  const client = await db();
  const { data, error } = await client.rpc("admin_list_reviews", { p_limit: limit });
  if (error) logger.error("reviews.admin_list_failed", { message: error.message });
  return data ?? [];
}
