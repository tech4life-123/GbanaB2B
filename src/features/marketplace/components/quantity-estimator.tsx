"use client";

import { useId, useMemo, useState } from "react";
import { Calculator, Truck } from "lucide-react";
import { formatMoney, type CurrencyCode } from "@/lib/money/currency";
import { carrierClassFor, formatWeight } from "@/lib/logistics/units";
import { unitPriceFor, type PriceTier } from "@/lib/pricing/tiers";
import { PriceTierTable } from "./price-tiers";

/**
 * Lets a buyer try a quantity and see the tier that applies, the subtotal and
 * the cargo weight/carrier class. Estimation only — prices are locked when an
 * order is placed, and freight is priced by carrier bids.
 */
export function QuantityEstimator({
  tiers,
  currency,
  moq,
  unitLabel,
  unitWeightG,
  available,
  inputName,
  initialQty,
}: {
  tiers: PriceTier[];
  currency: CurrencyCode;
  moq: number;
  unitLabel: string;
  unitWeightG: number | null;
  available: number;
  /** Set when the estimator sits inside an add-to-cart form. */
  inputName?: string;
  initialQty?: number;
}) {
  const id = useId();
  const [raw, setRaw] = useState(String(initialQty ?? moq));
  const qty = Number.parseInt(raw, 10);
  const valid = Number.isFinite(qty) && qty > 0;

  const { unitPrice, tierIndex } = useMemo(() => {
    if (!valid) return { unitPrice: null, tierIndex: null };
    const price = unitPriceFor(tiers, qty);
    const index = tiers.findIndex((t) => qty >= t.minQty && (t.maxQty === null || qty <= t.maxQty));
    return { unitPrice: price, tierIndex: index >= 0 ? index : null };
  }, [tiers, qty, valid]);

  const nextTier = tierIndex !== null ? tiers[tierIndex + 1] : undefined;
  const belowMoq = valid && qty < moq;
  const overStock = valid && available > 0 && qty > available;
  const nf = new Intl.NumberFormat("en-US");

  return (
    <div className="space-y-4">
      <PriceTierTable tiers={tiers} currency={currency} unitLabel={unitLabel} highlightIndex={tierIndex} />

      <div className="rounded-lg border border-line bg-canvas p-4">
        <label htmlFor={id} className="flex items-center gap-2 text-sm font-bold text-trade-900">
          <Calculator className="size-4 text-trade-500" aria-hidden="true" /> {inputName ? "Quantity" : "Estimate your order"}
        </label>
        <div className="mt-2.5 flex items-center gap-2">
          <input
            id={id}
            name={inputName}
            inputMode="numeric"
            value={raw}
            onChange={(e) => setRaw(e.target.value.replace(/\D/g, "").slice(0, 7))}
            className="tabular h-11 w-28 rounded-md border border-line-strong bg-white px-3 font-mono text-base font-semibold text-trade-900 focus:border-trade-700 focus:ring-3 focus:ring-signal-500/25 focus:outline-none"
            aria-describedby={`${id}-help`}
          />
          <span className="text-sm text-muted">× {unitLabel}</span>
        </div>
        <p id={`${id}-help`} className="sr-only">
          Minimum order is {moq}.
        </p>

        <div aria-live="polite" className="mt-3 space-y-1.5 text-sm">
          {belowMoq && <p className="font-medium text-red-700">The minimum order is {nf.format(moq)}.</p>}
          {overStock && <p className="font-medium text-signal-800">The seller lists {nf.format(available)} available.</p>}
          {unitPrice !== null && !belowMoq && (
            <>
              <Row label="Unit price" value={formatMoney({ amountMinor: unitPrice, currency })} />
              <Row label="Subtotal" value={formatMoney({ amountMinor: unitPrice * qty, currency })} strong />
              {unitWeightG && (
                <Row
                  label="Cargo weight"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <Truck className="size-3.5 text-trade-400" aria-hidden="true" />
                      {formatWeight(unitWeightG * qty)} · {carrierClassFor(unitWeightG * qty)} carrier
                    </span>
                  }
                />
              )}
              {nextTier && (
                <p className="pt-1 text-[0.8125rem] text-escrow-700">
                  Order {nf.format(nextTier.minQty)} or more to pay {formatMoney({ amountMinor: nextTier.unitPriceMinor, currency })} each.
                </p>
              )}
            </>
          )}
        </div>
        <p className="mt-3 border-t border-line pt-2.5 text-xs leading-relaxed text-muted">
          Prices lock when you place your order. Freight is priced separately by verified carriers.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className={strong ? "tabular font-mono text-base font-bold text-trade-900" : "tabular font-mono font-medium text-trade-900"}>
        {value}
      </span>
    </div>
  );
}
