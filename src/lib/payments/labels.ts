import type { Tone } from "@/components/ui/badge";

type Enum<T extends string> = Record<T, { label: string; tone: Tone }>;

export const PAYMENT_STATUS: Enum<"initiated" | "pending" | "succeeded" | "failed" | "cancelled" | "expired"> = {
  initiated: { label: "Starting", tone: "neutral" },
  pending: { label: "Waiting for approval", tone: "signal" },
  succeeded: { label: "Paid", tone: "escrow" },
  failed: { label: "Failed", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
};

export const ESCROW_STATUS: Enum<"held" | "released" | "refunded"> = {
  held: { label: "Held in escrow", tone: "escrow" },
  released: { label: "Released", tone: "navy" },
  refunded: { label: "Refunded", tone: "neutral" },
};

export const PAYOUT_STATUS: Enum<"pending" | "initiated" | "paid" | "failed"> = {
  pending: { label: "Ready to send", tone: "signal" },
  initiated: { label: "Sending", tone: "info" },
  paid: { label: "Paid", tone: "escrow" },
  failed: { label: "Failed", tone: "danger" },
};

export const REFUND_STATUS: Enum<"pending" | "paid" | "failed"> = {
  pending: { label: "Ready to send", tone: "signal" },
  paid: { label: "Refunded", tone: "escrow" },
  failed: { label: "Failed", tone: "danger" },
};

export const LEDGER_ACCOUNT: Record<string, string> = {
  provider_clearing: "Provider clearing",
  escrow: "Escrow",
  platform_fees: "Platform fees",
  seller_payable: "Owed to sellers",
  carrier_payable: "Owed to carriers",
  payouts_clearing: "Payouts in flight",
  refunds_payable: "Owed to buyers",
  unapplied_funds: "Unapplied funds",
};

export const LEDGER_KIND: Record<string, string> = {
  escrow_funded: "Buyer payment held in escrow",
  escrow_released: "Escrow released",
  escrow_refunded: "Escrow refunded",
  payment_unapplied: "Payment could not be applied",
  payout_initiated: "Payout started",
  payout_paid: "Payout delivered",
  payout_failed: "Payout failed",
  refund_paid: "Refund delivered",
};

/** Escrow shares for display; the database fixed these when the order was paid. */
export function escrowShares(e: { amount_minor: number; fee_minor: number; seller_net_minor: number; carrier_net_minor: number }) {
  return [
    { key: "seller", label: "Seller", amountMinor: e.seller_net_minor },
    { key: "carrier", label: "Carrier", amountMinor: e.carrier_net_minor },
    { key: "fee", label: "Platform fee", amountMinor: e.fee_minor },
  ];
}
