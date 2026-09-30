/**
 * Order lifecycle — the TypeScript mirror of `public.transition_order()`.
 *
 * The database is authoritative: it re-checks the actor, the current state,
 * reasons, the cancellation window and stock. This module lets the UI show
 * only the actions that will succeed and label every state consistently.
 * Keep the two in step (tests/unit/order-state.test.ts guards the table).
 */
import { defineStateMachine } from "@/lib/state-machine";
import type { Tone } from "@/components/ui/badge";
import type { Enums } from "@/lib/db/database.types";

export type OrderStatus = Enums<"order_status">;
export type OrderActor = "buyer" | "seller" | "admin";

/** Full lifecycle across all phases. Phase 3 implements up to ready_for_freight + cancelled. */
export const orderMachine = defineStateMachine<OrderStatus>({
  name: "order",
  initial: "pending_seller",
  transitions: {
    draft: ["pending_seller", "cancelled"],
    pending_seller: ["confirmed", "cancelled"],
    confirmed: ["fulfilling", "cancelled"],
    fulfilling: ["ready_for_freight", "cancelled"],
    ready_for_freight: ["freight_requested", "cancelled"],
    freight_requested: ["carrier_selected", "cancelled"],
    carrier_selected: ["awaiting_payment", "cancelled"],
    awaiting_payment: ["paid_escrow", "cancelled"],
    paid_escrow: ["in_transit", "disputed", "refunded", "completed"],
    in_transit: ["awaiting_confirmation", "delivered", "disputed", "refunded"],
    delivered: ["awaiting_confirmation", "completed", "disputed"],
    awaiting_confirmation: ["delivered", "completed", "disputed", "refunded"],
    disputed: ["in_transit", "paid_escrow", "awaiting_confirmation", "completed", "refunded", "partially_refunded"],
    completed: [],
    cancelled: [],
    refunded: [],
    partially_refunded: [],
  },
});

/** Who may make each transition that is live today. Mirrors transition_order(). */
const ACTORS: Partial<Record<`${OrderStatus}>${OrderStatus}`, readonly OrderActor[]>> = {
  "pending_seller>confirmed": ["seller"],
  "pending_seller>cancelled": ["buyer", "seller", "admin"],
  "confirmed>fulfilling": ["seller"],
  "confirmed>cancelled": ["buyer", "seller", "admin"],
  "fulfilling>ready_for_freight": ["seller"],
  "fulfilling>cancelled": ["seller", "admin"],
  "ready_for_freight>cancelled": ["seller", "admin"],
  // Phase 4: freight_requested and carrier_selected are entered through the
  // freight workflow (create_freight_rfq / select_freight_bid), not here.
  "freight_requested>cancelled": ["seller", "admin"],
  "carrier_selected>cancelled": ["seller", "admin"],
};

export function canTransition(from: OrderStatus, to: OrderStatus, actor: OrderActor): boolean {
  return orderMachine.can(from, to) && (ACTORS[`${from}>${to}`]?.includes(actor) ?? false);
}

/** Cancelling by a seller or admin always needs a reason the buyer can read. */
export function reasonRequired(to: OrderStatus, actor: OrderActor): boolean {
  return to === "cancelled" && actor !== "buyer";
}

/** Whether a buyer can still cancel a confirmed order (the DB enforces the same window). */
export function buyerCancelWindowOpen(placedAt: string | Date, windowMinutes: number, now: Date = new Date()): boolean {
  const placed = new Date(placedAt).getTime();
  return now.getTime() <= placed + windowMinutes * 60_000;
}

export interface OrderAction {
  to: OrderStatus;
  label: string;
  /** Visual weight: one primary per screen. */
  variant: "primary" | "secondary" | "danger";
  confirmTitle: string;
  confirmBody: string;
  needsReason: boolean;
}

const ACTION_COPY: Partial<Record<OrderStatus, Omit<OrderAction, "to" | "needsReason" | "variant">>> = {
  confirmed: {
    label: "Accept order",
    confirmTitle: "Accept this order?",
    confirmBody: "The quantities are reserved from your stock and a proforma invoice is issued to the buyer at the prices shown.",
  },
  fulfilling: {
    label: "Start preparing",
    confirmTitle: "Start preparing the goods?",
    confirmBody: "Tell the buyer you're picking and packing their order.",
  },
  ready_for_freight: {
    label: "Mark ready for pickup",
    confirmTitle: "Goods packed and ready?",
    confirmBody: "Confirm the order is packed and waiting for a carrier. Freight booking opens with the freight exchange.",
  },
  cancelled: {
    label: "Cancel order",
    confirmTitle: "Cancel this order?",
    confirmBody: "This can't be undone. Any reserved stock goes back to the listing.",
  },
};

/** Actions available to `actor` on an order in `status`, in display order (forward first, cancel last). */
export function availableActions(
  status: OrderStatus,
  actor: OrderActor,
  opts: { placedAt?: string; cancelWindowMinutes?: number; now?: Date } = {},
): OrderAction[] {
  const out: OrderAction[] = [];
  for (const to of orderMachine.next(status)) {
    if (!canTransition(status, to, actor)) continue;
    if (
      to === "cancelled" &&
      actor === "buyer" &&
      status === "confirmed" &&
      opts.placedAt &&
      opts.cancelWindowMinutes !== undefined &&
      !buyerCancelWindowOpen(opts.placedAt, opts.cancelWindowMinutes, opts.now)
    ) {
      continue;
    }
    const copy = ACTION_COPY[to];
    if (!copy) continue;
    out.push({ ...copy, to, needsReason: reasonRequired(to, actor), variant: to === "cancelled" ? "danger" : "primary" });
  }
  return out.sort((a, b) => Number(a.to === "cancelled") - Number(b.to === "cancelled"));
}

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone; buyerHint: string; sellerHint: string }> = {
  draft: { label: "Draft", tone: "neutral", buyerHint: "Not yet sent to the seller.", sellerHint: "Not yet placed." },
  pending_seller: {
    label: "Awaiting seller",
    tone: "signal",
    buyerHint: "The seller is checking stock. You'll see a proforma invoice once they accept.",
    sellerHint: "New order — check your stock, then accept or cancel with a reason.",
  },
  confirmed: {
    label: "Confirmed",
    tone: "info",
    buyerHint: "The seller accepted your order and reserved the stock. Your proforma invoice is ready.",
    sellerHint: "Stock is reserved. Start preparing when you begin picking and packing.",
  },
  fulfilling: {
    label: "Preparing",
    tone: "info",
    buyerHint: "The seller is picking and packing your goods.",
    sellerHint: "Mark the order ready once it's packed for pickup.",
  },
  ready_for_freight: {
    label: "Ready for pickup",
    tone: "navy",
    buyerHint: "Packed and waiting. Request freight so verified carriers can bid to deliver it.",
    sellerHint: "Packed and waiting. Request freight (or let the buyer do it) so verified carriers can bid.",
  },
  freight_requested: {
    label: "Finding carrier",
    tone: "signal",
    buyerHint: "Verified carriers are sending sealed bids. Compare them and choose one.",
    sellerHint: "Carriers are bidding. The buyer chooses the carrier.",
  },
  carrier_selected: {
    label: "Carrier booked",
    tone: "navy",
    buyerHint: "Your carrier is booked and the invoice now includes freight. Payment into escrow opens next.",
    sellerHint: "The buyer booked a carrier. Keep the goods ready for pickup on the agreed date.",
  },
  awaiting_payment: {
    label: "Awaiting payment",
    tone: "signal",
    buyerHint: "Pay into escrow so the carrier can collect your goods. Unpaid orders are cancelled automatically after 48 hours.",
    sellerHint: "Waiting for the buyer's payment. Nothing ships until it's held in escrow.",
  },
  paid_escrow: {
    label: "Paid · in escrow",
    tone: "escrow",
    buyerHint: "Your payment is held safely. The carrier collects the goods next.",
    sellerHint: "Payment is secured in escrow. Hand the goods to the carrier at pickup.",
  },
  in_transit: {
    label: "In transit",
    tone: "navy",
    buyerHint: "Your goods are on the road. Keep your delivery code private until the goods arrive and you've checked them.",
    sellerHint: "The carrier has collected the goods and is on the way.",
  },
  delivered: {
    label: "Delivered",
    tone: "escrow",
    buyerHint: "The goods were handed over. Escrow is being released.",
    sellerHint: "Delivered. Your proceeds are being released.",
  },
  awaiting_confirmation: {
    label: "Arrived · awaiting confirmation",
    tone: "signal",
    buyerHint: "The carrier has arrived. Check the goods, then give them your delivery code or confirm receipt here. Payment releases automatically after 72 hours if nobody raises a problem.",
    sellerHint: "The carrier has arrived. Funds release when the buyer confirms, or automatically after 72 hours of silence.",
  },
  completed: { label: "Completed", tone: "escrow", buyerHint: "Delivery confirmed and payment released. You can rate the seller and carrier.", sellerHint: "Delivery confirmed. Your proceeds have been released." },
  cancelled: { label: "Cancelled", tone: "danger", buyerHint: "This order was cancelled.", sellerHint: "This order was cancelled." },
  disputed: {
    label: "Disputed",
    tone: "danger",
    buyerHint: "A dispute is open. Funds stay frozen in escrow while GbanaB2B reviews the evidence.",
    sellerHint: "A dispute is open. Funds stay frozen in escrow while GbanaB2B reviews the evidence.",
  },
  refunded: { label: "Refunded", tone: "neutral", buyerHint: "Your payment was refunded in full.", sellerHint: "The order was refunded to the buyer." },
  partially_refunded: {
    label: "Part refunded",
    tone: "neutral",
    buyerHint: "Part of your payment was refunded; the rest was released. You can still rate the seller and carrier.",
    sellerHint: "Part of the payment was refunded to the buyer; the rest was released.",
  },
};

/** Stages shown on the order tracker. Freight, escrow and delivery light up in later phases. */
export const ORDER_STAGES = [
  { key: "placed", label: "Placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "packed", label: "Packed" },
  { key: "freight", label: "Carrier" },
  { key: "paid", label: "Paid", escrow: true },
  { key: "delivered", label: "Delivered" },
] as const;

const STAGE_INDEX: Record<OrderStatus, number> = {
  draft: 0,
  pending_seller: 0,
  confirmed: 1,
  fulfilling: 1,
  ready_for_freight: 2,
  freight_requested: 3,
  carrier_selected: 3,
  awaiting_payment: 3,
  paid_escrow: 4,
  in_transit: 4,
  delivered: 5,
  awaiting_confirmation: 5,
  completed: 6,
  cancelled: -1,
  disputed: 5,
  refunded: -1,
  partially_refunded: 6,
};

/** Index of the current stage for StageTracker (`-1` = off the happy path). */
export function stageIndex(status: OrderStatus): number {
  return STAGE_INDEX[status];
}

/** Filter groups used by order lists. */
export const ORDER_GROUPS = {
  action: ["pending_seller"],
  active: ["pending_seller", "confirmed", "fulfilling", "ready_for_freight", "freight_requested", "carrier_selected", "awaiting_payment", "paid_escrow", "in_transit", "delivered", "awaiting_confirmation", "disputed"],
  progress: ["confirmed", "fulfilling"],
  ready: ["ready_for_freight"],
  closed: ["completed", "cancelled", "refunded", "partially_refunded"],
  cancelled: ["cancelled"],
} as const satisfies Record<string, readonly OrderStatus[]>;
