import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import { logger } from "@/lib/logging/logger";
import { getProvider } from "@/lib/payments/registry";
import { PAYMENT_PROVIDERS, type PaymentProviderId } from "@/lib/payments/types";
import type { Tables } from "@/lib/db/database.types";

/**
 * Payment reads. All run as the signed-in user, so RLS decides: buyers see their
 * own attempts, sellers see escrow and payouts for their orders (never the
 * buyer's phone), carriers see their payouts, admins see everything.
 */
export type IntentRow = Tables<"payment_intents">;
export type TxnRow = Tables<"payment_transactions">;
export type EscrowRow = Tables<"escrow_accounts">;
export type PayoutRow = Tables<"payouts">;
export type RefundRow = Tables<"refunds">;
export type LedgerRow = Tables<"ledger_entries">;
export type RateRow = Tables<"exchange_rates">;

async function db() {
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase not configured");
  return client;
}

export interface ProviderOption {
  id: PaymentProviderId;
  label: string;
  isTest: boolean;
}

/** Methods a buyer may use right now: switched on by an admin AND connected on the server. */
export const getPaymentMethods = cache(async (): Promise<ProviderOption[]> => {
  const client = await db();
  const { data } = await client
    .from("platform_settings")
    .select("key, value")
    .in("key", ["payments.sandbox_enabled", "payments.mtn_enabled", "payments.orange_enabled"]);
  const on = (key: string) => String(data?.find((r) => r.key === key)?.value) === "1";
  const flags: Record<PaymentProviderId, boolean> = {
    sandbox: on("payments.sandbox_enabled"),
    mtn_momo_lr: on("payments.mtn_enabled"),
    orange_money_lr: on("payments.orange_enabled"),
  };
  return (Object.keys(flags) as PaymentProviderId[])
    .filter((id) => flags[id] && getProvider(id).isConfigured())
    .map((id) => ({ id, label: PAYMENT_PROVIDERS[id].displayName, isTest: id === "sandbox" }));
});

export interface OrderPayment {
  intent: IntentRow | null;
  txns: TxnRow[];
  escrow: EscrowRow | null;
  refund: RefundRow | null;
  payouts: PayoutRow[];
  ledger: LedgerRow[];
}

export async function getOrderPayment(orderId: string, opts: { withLedger?: boolean } = {}): Promise<OrderPayment> {
  const client = await db();
  const [intents, txns, escrow, refund, payouts, ledger] = await Promise.all([
    client.from("payment_intents").select("*").eq("order_id", orderId).order("created_at", { ascending: false }).limit(1),
    client.from("payment_transactions").select("*").eq("order_id", orderId).order("created_at", { ascending: false }).limit(20),
    client.from("escrow_accounts").select("*").eq("order_id", orderId).maybeSingle(),
    client.from("refunds").select("*").eq("order_id", orderId).maybeSingle(),
    client.from("payouts").select("*").eq("order_id", orderId).order("recipient"),
    opts.withLedger ? client.from("ledger_entries").select("*").eq("order_id", orderId).order("id") : Promise.resolve({ data: [] as LedgerRow[] }),
  ]);
  return {
    intent: intents.data?.[0] ?? null,
    txns: txns.data ?? [],
    escrow: escrow.data ?? null,
    refund: refund.data ?? null,
    payouts: payouts.data ?? [],
    ledger: ledger.data ?? [],
  };
}

export async function getUsdLrdRate(): Promise<RateRow | null> {
  const client = await db();
  const { data } = await client.from("exchange_rates").select("*").eq("base", "USD").eq("quote", "LRD").order("effective_at", { ascending: false }).order("id", { ascending: false }).limit(1);
  return data?.[0] ?? null;
}

export async function listRateHistory(limit = 10): Promise<RateRow[]> {
  const client = await db();
  const { data } = await client.from("exchange_rates").select("*").order("effective_at", { ascending: false }).order("id", { ascending: false }).limit(limit);
  return data ?? [];
}

/* ----------------------------------------------------------------- lists */

export interface PaymentListItem extends TxnRow {
  order: { order_number: string } | null;
}

export async function listPayments(opts: { statuses?: TxnRow["status"][]; limit?: number } = {}): Promise<PaymentListItem[]> {
  const client = await db();
  let q = client.from("payment_transactions").select("*, order:orders(order_number)").order("created_at", { ascending: false }).limit(opts.limit ?? 100);
  if (opts.statuses?.length) q = q.in("status", opts.statuses);
  const { data, error } = await q;
  if (error) logger.error("payments.list_failed", { message: error.message });
  return (data ?? []) as unknown as PaymentListItem[];
}

export interface PayoutListItem extends PayoutRow {
  order: { order_number: string } | null;
  seller: { trading_name: string; contact_phone: string | null } | null;
  carrier: { full_name: string; phone: string } | null;
}

export async function listPayouts(opts: { statuses?: PayoutRow["status"][]; limit?: number } = {}): Promise<PayoutListItem[]> {
  const client = await db();
  let q = client
    .from("payouts")
    .select("*, order:orders(order_number), seller:businesses(trading_name, contact_phone), carrier:carrier_profiles(full_name, phone)")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.statuses?.length) q = q.in("status", opts.statuses);
  const { data, error } = await q;
  if (error) logger.error("payments.payouts_failed", { message: error.message });
  return (data ?? []) as unknown as PayoutListItem[];
}

export interface RefundListItem extends RefundRow {
  order: { order_number: string } | null;
}

export async function listRefunds(limit = 100): Promise<RefundListItem[]> {
  const client = await db();
  const { data } = await client.from("refunds").select("*, order:orders(order_number)").order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as unknown as RefundListItem[];
}

export async function getLedgerBalances() {
  const client = await db();
  const { data } = await client.from("ledger_balances").select("*");
  return data ?? [];
}

export interface EscrowListItem extends EscrowRow {
  order: { order_number: string; status: string } | null;
}

export async function listEscrow(limit = 100): Promise<EscrowListItem[]> {
  const client = await db();
  const { data } = await client.from("escrow_accounts").select("*, order:orders(order_number, status)").order("funded_at", { ascending: false }).limit(limit);
  return (data ?? []) as unknown as EscrowListItem[];
}

/** Things an admin should look at: stale attempts and money that arrived with nowhere to go. */
export async function getFinanceExceptions() {
  const client = await db();
  const staleBefore = new Date(Date.now() - 60 * 60_000).toISOString();
  const [stale, unapplied, failedPayouts, failedRefunds] = await Promise.all([
    client.from("payment_transactions").select("id, order_id, provider, amount_minor, currency, status, created_at, order:orders(order_number)").in("status", ["initiated", "pending"]).lt("created_at", staleBefore).order("created_at").limit(50),
    client.from("ledger_entries").select("id, order_id, amount_minor, currency, created_at, order:orders(order_number)").eq("kind", "payment_unapplied").eq("account", "unapplied_funds").order("id", { ascending: false }).limit(50),
    client.from("payouts").select("id", { count: "exact", head: true }).eq("status", "failed"),
    client.from("refunds").select("id", { count: "exact", head: true }).in("status", ["pending", "failed"]),
  ]);
  return {
    stale: (stale.data ?? []) as unknown as { id: string; order_id: string; provider: PaymentProviderId; amount_minor: number; currency: "USD" | "LRD"; status: string; created_at: string; order: { order_number: string } | null }[],
    unapplied: (unapplied.data ?? []) as unknown as { id: number; order_id: string | null; amount_minor: number; currency: "USD" | "LRD"; created_at: string; order: { order_number: string } | null }[],
    failedPayouts: failedPayouts.count ?? 0,
    openRefunds: failedRefunds.count ?? 0,
  };
}
