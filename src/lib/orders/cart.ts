/**
 * Pure cart maths shared by the cart, checkout and tests. The database
 * re-prices every line inside place_orders(); this is for showing the buyer
 * what to expect and blocking checkout early when something is wrong.
 */
import type { CurrencyCode } from "@/lib/money/currency";
import { unitPriceFor, type PriceTier } from "@/lib/pricing/tiers";

/** Half-up integer rounding of amount × bps / 10 000 — same as public.fee_for (ADR 0010). */
export function feeFor(amountMinor: number, bps: number): number {
  return Math.floor((amountMinor * bps + 5000) / 10000);
}

export interface CartLineInput {
  id: string;
  quantity: number;
  product: {
    id: string;
    slug: string;
    title: string;
    unitLabel: string;
    moq: number;
    available: number;
    currency: CurrencyCode;
    unitWeightG: number | null;
    tiers: PriceTier[];
    coverPath: string | null;
    seller: { id: string; name: string; slug: string; county: string; town: string; verified: boolean };
  } | null;
}

export type LineIssue = "unavailable" | "below_moq" | "over_stock" | "no_price";

export interface PricedLine extends CartLineInput {
  unitPriceMinor: number | null;
  lineTotalMinor: number | null;
  weightG: number;
  issue: LineIssue | null;
  /** Next tier the buyer could reach, if any. */
  nextTier: { minQty: number; unitPriceMinor: number } | null;
}

export interface CartGroup {
  key: string;
  seller: NonNullable<CartLineInput["product"]>["seller"];
  currency: CurrencyCode;
  lines: PricedLine[];
  subtotalMinor: number;
  weightG: number;
}

export interface CartSummary {
  groups: CartGroup[];
  unavailable: PricedLine[];
  lineCount: number;
  hasIssues: boolean;
  /** Totals per currency — USD and LRD are never added together. */
  totals: { currency: CurrencyCode; subtotalMinor: number }[];
}

export function priceLine(line: CartLineInput): PricedLine {
  const p = line.product;
  if (!p) return { ...line, unitPriceMinor: null, lineTotalMinor: null, weightG: 0, issue: "unavailable", nextTier: null };
  const unit = unitPriceFor(p.tiers, line.quantity);
  let issue: LineIssue | null = null;
  if (line.quantity < p.moq) issue = "below_moq";
  else if (line.quantity > p.available) issue = "over_stock";
  else if (unit === null) issue = "no_price";
  const idx = p.tiers.findIndex((t) => line.quantity >= t.minQty && (t.maxQty === null || line.quantity <= t.maxQty));
  const next = idx >= 0 ? p.tiers[idx + 1] : undefined;
  return {
    ...line,
    unitPriceMinor: unit,
    lineTotalMinor: unit !== null ? unit * line.quantity : null,
    weightG: (p.unitWeightG ?? 0) * line.quantity,
    issue,
    nextTier: next ? { minQty: next.minQty, unitPriceMinor: next.unitPriceMinor } : null,
  };
}

/** Groups lines the way place_orders() will split them: one order per seller and currency. */
export function summarizeCart(lines: CartLineInput[]): CartSummary {
  const priced = lines.map(priceLine);
  const groups = new Map<string, CartGroup>();
  const unavailable: PricedLine[] = [];
  for (const l of priced) {
    if (!l.product) {
      unavailable.push(l);
      continue;
    }
    const key = `${l.product.seller.id}:${l.product.currency}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, seller: l.product.seller, currency: l.product.currency, lines: [], subtotalMinor: 0, weightG: 0 };
      groups.set(key, g);
    }
    g.lines.push(l);
    g.subtotalMinor += l.lineTotalMinor ?? 0;
    g.weightG += l.weightG;
  }
  const list = [...groups.values()].sort((a, b) => a.seller.name.localeCompare(b.seller.name) || a.currency.localeCompare(b.currency));
  for (const g of list) g.lines.sort((a, b) => a.product!.title.localeCompare(b.product!.title));
  const totals = new Map<CurrencyCode, number>();
  for (const g of list) totals.set(g.currency, (totals.get(g.currency) ?? 0) + g.subtotalMinor);
  return {
    groups: list,
    unavailable,
    lineCount: priced.length,
    hasIssues: priced.some((l) => l.issue !== null),
    totals: [...totals.entries()].map(([currency, subtotalMinor]) => ({ currency, subtotalMinor })),
  };
}

export const ISSUE_TEXT: Record<LineIssue, (l: PricedLine) => string> = {
  unavailable: () => "No longer available — remove it to continue.",
  below_moq: (l) => `Minimum order is ${l.product!.moq.toLocaleString("en-US")}.`,
  over_stock: (l) => `Only ${l.product!.available.toLocaleString("en-US")} available.`,
  no_price: () => "The seller has no price for this quantity.",
};
