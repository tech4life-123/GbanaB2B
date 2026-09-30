import "server-only";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import { logger } from "@/lib/logging/logger";
import { CARRIER_DOC_BUCKET, SIGNED_URL_SECONDS } from "@/lib/storage/documents";
import type { Tables } from "@/lib/db/database.types";
import type { CarrierStatus } from "@/lib/freight";

/**
 * Freight reads for buyers, sellers and admins. RLS decides what comes back:
 * buyers and admins get every bid on an RFQ, sellers get none (they see the
 * assignment once a carrier is chosen), carriers never reach these helpers.
 */

export type RfqRow = Tables<"freight_rfqs">;
export type BidRow = Tables<"freight_bids">;
export type AssignmentRow = Tables<"carrier_assignments">;

async function db() {
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase not configured");
  return client;
}

export interface OrderFreight {
  rfq: RfqRow | null;
  history: RfqRow[];
  bids: BidRow[];
  assignment: AssignmentRow | null;
}

export async function getOrderFreight(orderId: string): Promise<OrderFreight> {
  const client = await db();
  const [{ data: rfqs, error }, { data: assignments }] = await Promise.all([
    client.from("freight_rfqs").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
    client.from("carrier_assignments").select("*").eq("order_id", orderId).order("assigned_at", { ascending: false }),
  ]);
  if (error) logger.error("freight.order_rfqs_failed", { message: error.message });
  const live = (rfqs ?? []).find((r) => r.status === "open" || r.status === "awarded") ?? null;
  let bids: BidRow[] = [];
  if (live) {
    const { data } = await client.from("freight_bids").select("*").eq("rfq_id", live.id).order("amount_minor", { ascending: true });
    bids = data ?? [];
  }
  return {
    rfq: live,
    history: (rfqs ?? []).filter((r) => r.id !== live?.id),
    bids,
    assignment: (assignments ?? []).find((a) => a.status === "active") ?? null,
  };
}

export interface RfqListItem extends RfqRow {
  bid_count: number;
  order: { order_number: string; status: string } | null;
}

export async function listRfqs(opts: { scope: "buyer" | "admin"; viewerId?: string; statuses?: RfqRow["status"][]; limit?: number }): Promise<RfqListItem[]> {
  const client = await db();
  let q = client
    .from("freight_rfqs")
    .select("*, order:orders!inner(order_number, status, buyer_id), bids:freight_bids(count)")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 100);
  // A buyer who is also a carrier can see loads on the board — keep this list to their own orders.
  if (opts.scope === "buyer" && opts.viewerId) q = q.eq("order.buyer_id", opts.viewerId);
  if (opts.statuses?.length) q = q.in("status", opts.statuses);
  const { data, error } = await q;
  if (error) logger.error("freight.list_rfqs_failed", { message: error.message });
  return ((data ?? []) as unknown as (RfqRow & { order: RfqListItem["order"]; bids: { count: number }[] })[]).map(({ bids, ...r }) => ({
    ...r,
    bid_count: bids?.[0]?.count ?? 0,
  }));
}

/* ------------------------------------------------------------ admin: carriers */

export interface AdminCarrierListItem extends Tables<"carrier_profiles"> {
  vehicles: { id: string; is_verified: boolean; payload_kg: number }[];
  documents: { id: string }[];
}

export async function listCarriersForReview(status: CarrierStatus | "all"): Promise<AdminCarrierListItem[]> {
  const client = await db();
  let q = client
    .from("carrier_profiles")
    .select("*, vehicles(id, is_verified, payload_kg), documents:carrier_documents(id)")
    .order("submitted_at", { ascending: true, nullsFirst: false })
    .limit(200);
  if (status !== "all") q = q.eq("verification_status", status);
  const { data, error } = await q;
  if (error) logger.error("freight.list_carriers_failed", { message: error.message });
  return (data ?? []) as unknown as AdminCarrierListItem[];
}

export async function countCarriersByStatus() {
  const client = await db();
  const { data } = await client.from("carrier_profiles").select("verification_status").limit(5000);
  const counts: Partial<Record<CarrierStatus, number>> = {};
  for (const r of data ?? []) counts[r.verification_status] = (counts[r.verification_status] ?? 0) + 1;
  return counts;
}

export interface AdminDocument extends Tables<"carrier_documents"> {
  /** Short-lived signed URL; null if it couldn't be created. */
  url: string | null;
}

export async function getCarrierForAdmin(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const client = await db();
  const [{ data: profile }, { data: vehicles }, { data: documents }, { data: bids }, { data: jobs }] = await Promise.all([
    client.from("carrier_profiles").select("*").eq("id", id).maybeSingle(),
    client.from("vehicles").select("*").eq("carrier_id", id).order("created_at"),
    client.from("carrier_documents").select("*").eq("carrier_id", id).order("uploaded_at", { ascending: false }),
    client.from("freight_bids").select("id, status").eq("carrier_id", id),
    client.from("carrier_assignments").select("id, status").eq("carrier_id", id),
  ]);
  if (!profile) return null;
  // Admin storage policy allows reading this private folder; links expire quickly.
  const paths = (documents ?? []).map((d) => d.storage_path);
  const signed = paths.length ? (await client.storage.from(CARRIER_DOC_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS)).data ?? [] : [];
  const urlFor = new Map(signed.map((s) => [s.path, s.signedUrl]));
  return {
    profile,
    vehicles: vehicles ?? [],
    documents: (documents ?? []).map((d) => ({ ...d, url: urlFor.get(d.storage_path) ?? null })) as AdminDocument[],
    stats: {
      bids: bids?.length ?? 0,
      won: (bids ?? []).filter((b) => b.status === "accepted").length,
      jobs: (jobs ?? []).filter((j) => j.status !== "cancelled").length,
    },
  };
}
