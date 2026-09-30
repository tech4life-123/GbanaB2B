import "server-only";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import { logger } from "@/lib/logging/logger";
import type { Tables } from "@/lib/db/database.types";
import type { DisputeStatus } from "@/lib/trust/labels";

/**
 * Dispute reads, as the signed-in user. RLS shows a dispute only to the
 * buyer, the seller's team, the assigned carrier and admins. Carriers can't
 * read orders, so order fields are optional.
 */
export type DisputeRow = Tables<"disputes">;
export type DisputeMessageRow = Tables<"dispute_messages">;
export type DisputeEvidenceRow = Tables<"dispute_evidence">;

async function db() {
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase not configured");
  return client;
}

export interface DisputeListItem extends DisputeRow {
  order: { order_number: string; currency: Tables<"orders">["currency"] } | null;
}

export async function listDisputes(opts: { statuses?: DisputeStatus[]; limit?: number } = {}): Promise<DisputeListItem[]> {
  const client = await db();
  let q = client.from("disputes").select("*").order("created_at", { ascending: false }).limit(opts.limit ?? 100);
  if (opts.statuses?.length) q = q.in("status", opts.statuses);
  const { data, error } = await q;
  if (error) logger.error("disputes.list_failed", { message: error.message });
  const rows = data ?? [];
  if (rows.length === 0) return [];
  const { data: orders } = await client.from("orders").select("id, order_number, currency").in("id", [...new Set(rows.map((r) => r.order_id))]);
  const byId = new Map((orders ?? []).map((o) => [o.id, o]));
  return rows.map((r) => ({ ...r, order: byId.get(r.order_id) ?? null }));
}

export interface DisputeDetail {
  dispute: DisputeRow;
  messages: DisputeMessageRow[];
  evidence: DisputeEvidenceRow[];
  order: Pick<Tables<"orders">, "id" | "order_number" | "status" | "currency" | "subtotal_minor" | "freight_minor" | "total_minor" | "platform_fee_bps"> | null;
  escrow: Pick<Tables<"escrow_accounts">, "amount_minor" | "fee_minor" | "seller_net_minor" | "carrier_net_minor" | "status"> | null;
}

export async function getDispute(id: string): Promise<DisputeDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const client = await db();
  const { data: dispute } = await client.from("disputes").select("*").eq("id", id).maybeSingle();
  if (!dispute) return null;
  const [m, e, o, esc] = await Promise.all([
    client.from("dispute_messages").select("*").eq("dispute_id", id).order("id", { ascending: true }).limit(300),
    client.from("dispute_evidence").select("*").eq("dispute_id", id).order("created_at", { ascending: true }).limit(50),
    client.from("orders").select("id, order_number, status, currency, subtotal_minor, freight_minor, total_minor, platform_fee_bps").eq("id", dispute.order_id).maybeSingle(),
    client.from("escrow_accounts").select("amount_minor, fee_minor, seller_net_minor, carrier_net_minor, status").eq("order_id", dispute.order_id).maybeSingle(),
  ]);
  return { dispute, messages: m.data ?? [], evidence: e.data ?? [], order: o.data ?? null, escrow: esc.data ?? null };
}

/** Disputes on one order (newest first) — shown on the order page. */
export async function getOrderDisputes(orderId: string): Promise<DisputeRow[]> {
  const client = await db();
  const { data } = await client.from("disputes").select("*").eq("order_id", orderId).order("created_at", { ascending: false }).limit(10);
  return data ?? [];
}

export async function countLiveDisputes(): Promise<number> {
  const client = await db();
  const { count } = await client.from("disputes").select("id", { count: "exact", head: true }).in("status", ["open", "under_review"]);
  return count ?? 0;
}

export async function getMaxEvidenceFiles(): Promise<number> {
  const client = await db();
  const { data } = await client.from("platform_settings").select("value").eq("key", "disputes.max_evidence_files").maybeSingle();
  const n = typeof data?.value === "number" ? data.value : Number(data?.value);
  return Number.isFinite(n) && n > 0 ? n : 12;
}
