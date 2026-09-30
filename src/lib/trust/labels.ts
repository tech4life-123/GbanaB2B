/**
 * Delivery, dispute and review vocabulary shared by the UI. The database is
 * authoritative for every rule; this file only names things and derives what
 * to show.
 */
import type { Tone } from "@/components/ui/badge";
import type { Enums } from "@/lib/db/database.types";

export type DisputeKind = Enums<"dispute_kind">;
export type DisputeStatus = Enums<"dispute_status">;

export const DISPUTE_KIND: Record<DisputeKind, { label: string; hint: string }> = {
  missing_items: { label: "Missing items", hint: "Some of the goods didn't arrive." },
  damaged_goods: { label: "Damaged goods", hint: "Goods arrived broken, spoiled or unusable." },
  incorrect_quantity: { label: "Wrong quantity", hint: "More or fewer units than ordered." },
  incorrect_product: { label: "Wrong product", hint: "Not what was ordered." },
  delivery_failure: { label: "Delivery failure", hint: "The delivery didn't happen or wasn't completed." },
  payment_issue: { label: "Payment issue", hint: "A problem with the amount or the payment." },
  carrier_issue: { label: "Carrier problem", hint: "Conduct or service of the carrier." },
  seller_issue: { label: "Seller problem", hint: "Conduct or service of the seller." },
};

export const DISPUTE_KINDS = Object.keys(DISPUTE_KIND) as DisputeKind[];

export const DISPUTE_STATUS: Record<DisputeStatus, { label: string; tone: Tone; live: boolean }> = {
  open: { label: "Open", tone: "danger", live: true },
  under_review: { label: "Under review", tone: "signal", live: true },
  resolved: { label: "Resolved", tone: "escrow", live: false },
  rejected: { label: "Rejected", tone: "neutral", live: false },
  refunded: { label: "Refunded", tone: "neutral", live: false },
  partial_refund: { label: "Part refunded", tone: "info", live: false },
};

export const isLiveDispute = (s: DisputeStatus) => DISPUTE_STATUS[s].live;

/** Orders in these states can have a dispute opened (mirrors open_dispute()). */
export const DISPUTABLE_ORDER_STATUSES = ["paid_escrow", "in_transit", "awaiting_confirmation"] as const;
export const canOpenDispute = (status: string) => (DISPUTABLE_ORDER_STATUSES as readonly string[]).includes(status);

export const RESOLUTION_OUTCOMES = [
  { value: "refund", label: "Refund the buyer in full", hint: "All escrowed money goes back. The order is refunded." },
  { value: "partial_refund", label: "Partial refund", hint: "Refund part of the goods value; the rest is released." },
  { value: "release", label: "Release to seller and carrier", hint: "The claim isn't upheld; escrow is released as normal." },
  { value: "reject", label: "Reject the dispute", hint: "Close it and unfreeze the order where it was." },
] as const;
export type ResolutionOutcome = (typeof RESOLUTION_OUTCOMES)[number]["value"];

export const FAULT_OPTIONS = [
  { value: "none", label: "No fault recorded" },
  { value: "seller", label: "Seller at fault" },
  { value: "carrier", label: "Carrier at fault" },
] as const;

export const PARTY_LABEL: Record<string, string> = { buyer: "Buyer", seller: "Seller", carrier: "Carrier", admin: "GbanaB2B", system: "System" };

/* ---------------------------------------------------------------- delivery */

export const DELIVERY_EVENT: Record<string, { label: string }> = {
  picked_up: { label: "Collected from the seller" },
  checkpoint: { label: "Location update" },
  arrived: { label: "Arrived at the delivery address" },
  delivery_failed: { label: "Delivery could not be completed" },
  delivered: { label: "Delivered" },
};

export type CarrierStage = "awaiting_pickup" | "in_transit" | "arrived" | "completed";

/** What a carrier can do next, from the rows they can read (they cannot read the order itself). */
export function carrierStage(d: { picked_up_at: string; arrived_at: string | null; completed_at: string | null } | null): CarrierStage {
  if (!d) return "awaiting_pickup";
  if (d.completed_at) return "completed";
  if (d.arrived_at) return "arrived";
  return "in_transit";
}

/** Code entry: digits only, exactly six. */
export function normalizeDeliveryCode(input: string): string {
  return input.replace(/\D/g, "").slice(0, 6);
}
export const isDeliveryCode = (input: string) => /^\d{6}$/.test(input);

/** "482 913" for legibility. */
export function formatDeliveryCode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}

/** Hours left before silence releases the escrow. Never negative. */
export function autoReleaseHoursLeft(arrivedAt: string, hours: number, now: Date = new Date()): number {
  const ms = new Date(arrivedAt).getTime() + hours * 3_600_000 - now.getTime();
  return Math.max(0, Math.ceil(ms / 3_600_000));
}

/** Seconds until another checkpoint is accepted. */
export function checkpointWaitSeconds(lastCheckpointAt: string | null, minSeconds: number, now: Date = new Date()): number {
  if (!lastCheckpointAt) return 0;
  const left = Math.ceil((new Date(lastCheckpointAt).getTime() + minSeconds * 1000 - now.getTime()) / 1000);
  return Math.max(0, left);
}

/** Round to 4 decimals (about 11 m), matching what the database stores. */
export const roundCoord = (n: number) => Math.round(n * 10_000) / 10_000;

/* ----------------------------------------------------------------- reviews */

export const RATING_LABEL: Record<number, string> = { 1: "Poor", 2: "Fair", 3: "Good", 4: "Very good", 5: "Excellent" };

export function averageRating(ratingSum: number, count: number): number | null {
  return count > 0 ? Math.round((ratingSum / count) * 10) / 10 : null;
}

/** Whether a buyer can still review: completed or part refunded, inside the window. */
export function reviewWindowOpen(closedAt: string | null, windowDays: number, now: Date = new Date()): boolean {
  if (!closedAt) return false;
  return now.getTime() <= new Date(closedAt).getTime() + windowDays * 86_400_000;
}

/** Largest refund a goods-funded partial refund may ask for: strictly less than the goods value. */
export function maxPartialRefund(subtotalMinor: number): number {
  return Math.max(0, subtotalMinor - 1);
}
