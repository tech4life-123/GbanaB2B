import "server-only";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import { logger } from "@/lib/logging/logger";

/** Counts and totals only — the database function returns no names or contact details. */
export interface MarketplaceSnapshot {
  window_days: number;
  orders_by_status: Record<string, number>;
  completed_value_minor: Record<string, number>;
  payments_by_status: Record<string, number>;
  disputes_by_kind: Record<string, number>;
  disputes_by_status: Record<string, number>;
  live_disputes: number;
  oldest_live_dispute_days: number | null;
  orders_awaiting_seller_over_24h: number;
  orders_in_transit: number;
  carriers_awaiting_verification: number;
  businesses_awaiting_verification: number;
  sellers_with_3plus_cancellations: number;
  sellers_with_upheld_disputes: number;
  carriers_with_upheld_disputes: number;
  escrow_held_minor: Record<string, number>;
  payouts_pending: number;
}

export async function getMarketplaceSnapshot(days: number): Promise<MarketplaceSnapshot | null> {
  const db = await createSupabaseServerClient();
  if (!db) return null;
  const { data, error } = await db.rpc("admin_marketplace_snapshot", { p_days: days });
  if (error) {
    logger.error("ai.snapshot_failed", { message: error.message });
    return null;
  }
  return data as unknown as MarketplaceSnapshot;
}
