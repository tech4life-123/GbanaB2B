/**
 * Quantity-break pricing ("1–49 bags $24.50, 50–99 $23.00, 100+ $21.50").
 *
 * Rules (mirrored exactly by public.save_product_pricing in the database,
 * which is the authority — this copy exists for instant form feedback):
 *   - 1 to 10 tiers
 *   - tier 1 starts at the MOQ
 *   - each tier starts right after the previous one ends (no gaps/overlaps)
 *   - every tier but the last has an upper bound; the last is open-ended
 *   - prices are positive integers in minor units
 */

export interface PriceTier {
  minQty: number;
  /** null = open-ended ("100+"). */
  maxQty: number | null;
  unitPriceMinor: number;
}

export const MAX_TIERS = 10;
export const MAX_PRICE_MINOR = 100_000_000_000;

export interface TierIssue {
  index: number | null;
  message: string;
}

export function validateTiers(moq: number, tiers: readonly PriceTier[]): TierIssue[] {
  const issues: TierIssue[] = [];
  if (!Number.isInteger(moq) || moq < 1 || moq > 1_000_000) {
    issues.push({ index: null, message: "Minimum order must be a whole number between 1 and 1,000,000." });
  }
  if (tiers.length < 1 || tiers.length > MAX_TIERS) {
    issues.push({ index: null, message: `Add between 1 and ${MAX_TIERS} price tiers.` });
    return issues;
  }
  tiers.forEach((t, i) => {
    const last = i === tiers.length - 1;
    if (!Number.isInteger(t.unitPriceMinor) || t.unitPriceMinor < 1 || t.unitPriceMinor > MAX_PRICE_MINOR) {
      issues.push({ index: i, message: "Enter a price above zero." });
    }
    if (i === 0 && t.minQty !== moq) {
      issues.push({ index: i, message: `The first tier must start at the minimum order (${moq}).` });
    }
    if (i > 0) {
      const prevMax = tiers[i - 1]!.maxQty;
      if (prevMax !== null && t.minQty !== prevMax + 1) {
        issues.push({ index: i, message: `This tier must start at ${prevMax + 1}.` });
      }
    }
    if (!last && (t.maxQty === null || t.maxQty < t.minQty)) {
      issues.push({ index: i, message: `Enter an upper quantity of at least ${t.minQty}.` });
    }
    if (last && t.maxQty !== null) {
      issues.push({ index: i, message: "The last tier must be open-ended." });
    }
  });
  return issues;
}

/**
 * Rebuilds contiguous bands from the upper bounds the seller typed, so the
 * form only asks for "up to" quantities and prices. The last band is open.
 */
export function buildTiers(moq: number, rows: readonly { maxQty: number | null; unitPriceMinor: number }[]): PriceTier[] {
  let start = moq;
  return rows.map((r, i) => {
    const last = i === rows.length - 1;
    const tier: PriceTier = { minQty: start, maxQty: last ? null : r.maxQty, unitPriceMinor: r.unitPriceMinor };
    if (!last && r.maxQty !== null) start = r.maxQty + 1;
    return tier;
  });
}

/** Unit price for a quantity, or null if below MOQ / no matching tier. */
export function unitPriceFor(tiers: readonly PriceTier[], quantity: number): number | null {
  const tier = tiers.find((t) => quantity >= t.minQty && (t.maxQty === null || quantity <= t.maxQty));
  return tier ? tier.unitPriceMinor : null;
}

export function tierRangeLabel(t: Pick<PriceTier, "minQty" | "maxQty">): string {
  const nf = new Intl.NumberFormat("en-US");
  return t.maxQty === null ? `${nf.format(t.minQty)}+` : `${nf.format(t.minQty)} – ${nf.format(t.maxQty)}`;
}

/** Percentage saved versus the first (MOQ) tier, rounded to a whole percent. */
export function savingsVersusFirst(tiers: readonly PriceTier[], index: number): number {
  const first = tiers[0]?.unitPriceMinor;
  const current = tiers[index]?.unitPriceMinor;
  if (!first || !current || current >= first) return 0;
  return Math.round(((first - current) / first) * 100);
}

export function fromRows(rows: readonly { min_qty: number; max_qty: number | null; unit_price_minor: number }[]): PriceTier[] {
  return [...rows]
    .sort((a, b) => a.min_qty - b.min_qty)
    .map((r) => ({ minQty: r.min_qty, maxQty: r.max_qty, unitPriceMinor: r.unit_price_minor }));
}

export function toRpcPayload(tiers: readonly PriceTier[]) {
  return tiers.map((t) => ({ min_qty: t.minQty, max_qty: t.maxQty, unit_price_minor: t.unitPriceMinor }));
}
