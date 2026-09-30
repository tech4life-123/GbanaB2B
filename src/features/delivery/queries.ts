import "server-only";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import { logger } from "@/lib/logging/logger";
import type { Tables } from "@/lib/db/database.types";

/**
 * Delivery reads, all as the signed-in user so RLS decides:
 * the buyer alone can read the delivery code; carriers read their own
 * assignment and its tracking but never the order; sellers/admins read tracking.
 */
export type DeliveryRow = Tables<"order_deliveries">;
export type DeliveryEventRow = Tables<"delivery_events">;
export type AssignmentRow = Tables<"carrier_assignments">;

async function db() {
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase not configured");
  return client;
}

export interface DeliverySettings {
  autoConfirmHours: number;
  checkpointMinSeconds: number;
  maxAttempts: number;
  paymentWindowHours: number;
}

export async function getDeliverySettings(): Promise<DeliverySettings> {
  const client = await db();
  const { data } = await client
    .from("platform_settings")
    .select("key, value")
    .in("key", ["delivery.auto_confirm_hours", "delivery.checkpoint_min_seconds", "delivery.code_max_attempts", "orders.payment_window_hours"]);
  const get = (k: string, d: number) => {
    const v = data?.find((r) => r.key === k)?.value;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) && n > 0 ? n : d;
  };
  return {
    autoConfirmHours: get("delivery.auto_confirm_hours", 72),
    checkpointMinSeconds: get("delivery.checkpoint_min_seconds", 120),
    maxAttempts: get("delivery.code_max_attempts", 5),
    paymentWindowHours: get("orders.payment_window_hours", 48),
  };
}

export interface OrderDelivery {
  delivery: DeliveryRow | null;
  events: DeliveryEventRow[];
  /** Only ever present for the buyer — RLS returns nothing to anyone else. */
  code: { code: string; locked: boolean; attempts: number } | null;
}

export async function getOrderDelivery(orderId: string, opts: { withCode?: boolean } = {}): Promise<OrderDelivery> {
  const client = await db();
  const [d, e, c] = await Promise.all([
    client.from("order_deliveries").select("*").eq("order_id", orderId).maybeSingle(),
    client.from("delivery_events").select("*").eq("order_id", orderId).order("id", { ascending: true }).limit(200),
    opts.withCode ? client.from("delivery_codes").select("code, locked, attempts").eq("order_id", orderId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (d.error) logger.error("delivery.query_failed", { message: d.error.message });
  return { delivery: d.data ?? null, events: e.data ?? [], code: c.data ?? null };
}

export interface CarrierJob {
  assignment: AssignmentRow;
  delivery: DeliveryRow | null;
  /** Carriers can't read the order, so the freight request is their reference for it. */
  rfq: Pick<Tables<"freight_rfqs">, "rfq_number" | "cargo_summary" | "package_count" | "cargo_weight_g" | "is_fragile" | "handling_notes"> | null;
  liveDispute: { id: string; dispute_number: string; status: Tables<"disputes">["status"] } | null;
}

const RFQ_COLUMNS = "id, rfq_number, cargo_summary, package_count, cargo_weight_g, is_fragile, handling_notes";

export async function listCarrierJobs(userId: string): Promise<CarrierJob[]> {
  const client = await db();
  const { data: assignments, error } = await client
    .from("carrier_assignments")
    .select("*")
    .eq("carrier_id", userId)
    .order("assigned_at", { ascending: false })
    .limit(100);
  if (error) logger.error("delivery.jobs_failed", { message: error.message });
  const rows = assignments ?? [];
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.order_id);
  const [{ data: deliveries }, { data: disputes }, { data: rfqs }] = await Promise.all([
    client.from("order_deliveries").select("*").in("order_id", ids),
    client.from("disputes").select("id, dispute_number, status, order_id").in("order_id", ids).in("status", ["open", "under_review"]),
    client.from("freight_rfqs").select(RFQ_COLUMNS).in("id", rows.map((r) => r.rfq_id)),
  ]);
  return rows.map((a) => ({
    assignment: a,
    delivery: deliveries?.find((d) => d.order_id === a.order_id) ?? null,
    rfq: rfqs?.find((r) => r.id === a.rfq_id) ?? null,
    liveDispute: disputes?.find((d) => d.order_id === a.order_id) ?? null,
  }));
}

export async function getCarrierJob(orderId: string, userId: string): Promise<(CarrierJob & { events: DeliveryEventRow[] }) | null> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null;
  const client = await db();
  const { data: assignment } = await client.from("carrier_assignments").select("*").eq("order_id", orderId).eq("carrier_id", userId).maybeSingle();
  if (!assignment) return null;
  const [{ data: delivery }, { data: events }, { data: disputes }, { data: rfq }] = await Promise.all([
    client.from("order_deliveries").select("*").eq("order_id", orderId).maybeSingle(),
    client.from("delivery_events").select("*").eq("order_id", orderId).order("id", { ascending: true }).limit(200),
    client.from("disputes").select("id, dispute_number, status").eq("order_id", orderId).in("status", ["open", "under_review"]).limit(1),
    client.from("freight_rfqs").select(RFQ_COLUMNS).eq("id", assignment.rfq_id).maybeSingle(),
  ]);
  return { assignment, delivery: delivery ?? null, events: events ?? [], rfq: rfq ?? null, liveDispute: disputes?.[0] ?? null };
}
