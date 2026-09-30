import "server-only";
import { createSupabaseAdminClient } from "@/lib/db/supabase/admin";
import { logger } from "@/lib/logging/logger";

export interface SweepResult {
  expiredUnpaid: number;
  autoReleased: number;
}

/**
 * Housekeeping that must not depend on anyone visiting a page:
 * - cancel orders nobody paid for within the payment window (stock goes back),
 * - release escrow for deliveries the buyer never confirmed or disputed.
 * Runs as the service role inside one database function; safe to run repeatedly.
 */
export async function runSweep(): Promise<SweepResult> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("sweep_overdue_orders");
  if (error) {
    logger.error("jobs.sweep_failed", { code: error.code, message: error.message });
    throw new Error("Sweep failed");
  }
  const row = (data ?? {}) as { expired_unpaid?: number; auto_released?: number };
  const result = { expiredUnpaid: Number(row.expired_unpaid ?? 0), autoReleased: Number(row.auto_released ?? 0) };
  logger.info("jobs.sweep_done", result);
  return result;
}
