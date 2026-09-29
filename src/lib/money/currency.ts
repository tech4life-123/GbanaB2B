/**
 * Money primitives.
 *
 * RULE: money is always an integer number of MINOR units (cents) paired with
 * an ISO currency code. Never floats. Conversions between USD and LRD must
 * carry the exchange rate that was used, and historical transactions keep the
 * rate they were created with (see docs/payments/README.md).
 *
 * Fee and ledger logic arrives in Phase 5; this module only provides the
 * representation and formatting that every phase shares.
 */

export const CURRENCIES = {
  USD: { code: "USD", minorUnits: 2, symbol: "$", label: "US Dollar" },
  LRD: { code: "LRD", minorUnits: 2, symbol: "L$", label: "Liberian Dollar" },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export interface Money {
  /** Integer amount in minor units (e.g. cents). */
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
}

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && value in CURRENCIES;
}

export function money(amountMinor: number, currency: CurrencyCode): Money {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new RangeError(`Money amounts must be safe integers in minor units, got ${amountMinor}`);
  }
  return { amountMinor, currency };
}

/** Parses a user-typed major-unit string ("1,250.50") into minor units without float drift. */
export function parseMajorToMinor(input: string, currency: CurrencyCode): number | null {
  const cleaned = input.replace(/[,\s]/g, "");
  const { minorUnits } = CURRENCIES[currency];
  const match = new RegExp(`^(\\d+)(?:\\.(\\d{1,${minorUnits}}))?$`).exec(cleaned);
  if (!match) return null;
  const whole = Number(match[1]);
  const frac = Number((match[2] ?? "").padEnd(minorUnits, "0") || "0");
  const result = whole * 10 ** minorUnits + frac;
  return Number.isSafeInteger(result) ? result : null;
}

/**
 * "USD 1,250.00" style formatting. We print the ISO code rather than a bare
 * "$" because USD and LRD both use a dollar sign and mixing them up on an
 * invoice is a real risk in this market.
 */
export function formatMoney(
  value: Money,
  opts: { withCode?: boolean; compact?: boolean } = {},
): string {
  const { withCode = true, compact = false } = opts;
  const { minorUnits } = CURRENCIES[value.currency];
  const major = value.amountMinor / 10 ** minorUnits;
  const number = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: compact ? 0 : minorUnits,
    maximumFractionDigits: compact ? 1 : minorUnits,
    notation: compact ? "compact" : "standard",
  }).format(major);
  return withCode ? `${value.currency} ${number}` : number;
}

/** Basis points helper for display ("250 bps" → "2.5%"). */
export function formatBps(bps: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(bps / 100)}%`;
}
