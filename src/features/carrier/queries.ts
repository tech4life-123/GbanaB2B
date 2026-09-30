import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import { logger } from "@/lib/logging/logger";
import type { Tables } from "@/lib/db/database.types";

/**
 * Carrier-side reads, all as the signed-in user. RLS returns only this
 * carrier's profile, vehicles, documents and bids, and only the loads they
 * are eligible for (or have already bid on).
 */

export type CarrierProfileRow = Tables<"carrier_profiles">;
export type VehicleRow = Tables<"vehicles">;
export type CarrierDocumentRow = Tables<"carrier_documents">;
export type RfqRow = Tables<"freight_rfqs">;
export type BidRow = Tables<"freight_bids">;
export type AssignmentRow = Tables<"carrier_assignments">;

async function db() {
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase not configured");
  return client;
}

export interface MyCarrier {
  profile: CarrierProfileRow | null;
  vehicles: VehicleRow[];
  documents: CarrierDocumentRow[];
}

export const getMyCarrier = cache(async (userId: string): Promise<MyCarrier> => {
  const client = await db();
  const [p, v, d] = await Promise.all([
    client.from("carrier_profiles").select("*").eq("id", userId).maybeSingle(),
    client.from("vehicles").select("*").eq("carrier_id", userId).order("created_at"),
    client.from("carrier_documents").select("*").eq("carrier_id", userId).order("uploaded_at", { ascending: false }),
  ]);
  for (const r of [p, v, d]) if (r.error) logger.error("carrier.query_failed", { message: r.error.message });
  return { profile: p.data ?? null, vehicles: v.data ?? [], documents: d.data ?? [] };
});

export interface BoardLoad extends RfqRow {
  myBid: Pick<BidRow, "id" | "status" | "amount_minor" | "eta_hours" | "proposed_delivery_date" | "vehicle_id" | "note"> | null;
}

/** Loads visible to this carrier: open ones they qualify for plus any they bid on. */
export async function listLoads(userId: string, scope: "open" | "all" = "open"): Promise<BoardLoad[]> {
  const client = await db();
  let q = client.from("freight_rfqs").select("*").order("closes_at", { ascending: true }).limit(100);
  if (scope === "open") q = q.eq("status", "open").gt("closes_at", new Date().toISOString());
  const [{ data: loads, error }, { data: bids }] = await Promise.all([
    q,
    client.from("freight_bids").select("id, rfq_id, status, amount_minor, eta_hours, proposed_delivery_date, vehicle_id, note").eq("carrier_id", userId),
  ]);
  if (error) logger.error("carrier.loads_query_failed", { message: error.message });
  const byRfq = new Map((bids ?? []).map((b) => [b.rfq_id, b]));
  return (loads ?? []).map((l) => ({ ...l, myBid: byRfq.get(l.id) ?? null }));
}

export async function getLoad(id: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const client = await db();
  const [{ data: load }, { data: bid }, { data: assignment }] = await Promise.all([
    client.from("freight_rfqs").select("*").eq("id", id).maybeSingle(),
    client.from("freight_bids").select("*").eq("rfq_id", id).eq("carrier_id", userId).maybeSingle(),
    client.from("carrier_assignments").select("*").eq("rfq_id", id).eq("carrier_id", userId).maybeSingle(),
  ]);
  if (!load) return null;
  return { load, bid: bid ?? null, assignment: assignment ?? null };
}

export interface MyBid extends BidRow {
  rfq: Pick<RfqRow, "id" | "rfq_number" | "status" | "pickup_town" | "pickup_county" | "destination_town" | "destination_county" | "pickup_date" | "cargo_weight_g" | "closes_at"> | null;
}

export async function listMyBids(userId: string): Promise<MyBid[]> {
  const client = await db();
  const { data, error } = await client
    .from("freight_bids")
    .select("*, rfq:freight_rfqs(id, rfq_number, status, pickup_town, pickup_county, destination_town, destination_county, pickup_date, cargo_weight_g, closes_at)")
    .eq("carrier_id", userId)
    .order("submitted_at", { ascending: false })
    .limit(200);
  if (error) logger.error("carrier.bids_query_failed", { message: error.message });
  return (data ?? []) as unknown as MyBid[];
}

export async function listMyAssignments(userId: string): Promise<AssignmentRow[]> {
  const client = await db();
  const { data, error } = await client.from("carrier_assignments").select("*").eq("carrier_id", userId).order("assigned_at", { ascending: false }).limit(100);
  if (error) logger.error("carrier.assignments_query_failed", { message: error.message });
  return data ?? [];
}
