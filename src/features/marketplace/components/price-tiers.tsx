import { formatMoney, type CurrencyCode } from "@/lib/money/currency";
import { savingsVersusFirst, tierRangeLabel, type PriceTier } from "@/lib/pricing/tiers";
import { cn } from "@/lib/utils/cn";

/** Quantity-break table: the heart of a wholesale listing. */
export function PriceTierTable({
  tiers,
  currency,
  unitLabel,
  highlightIndex,
}: {
  tiers: PriceTier[];
  currency: CurrencyCode;
  unitLabel: string;
  highlightIndex?: number | null;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Wholesale price per {unitLabel} by quantity</caption>
        <thead>
          <tr className="bg-canvas">
            <th scope="col" className="label-caps px-3 py-2 text-left font-medium text-muted">
              Quantity
            </th>
            <th scope="col" className="label-caps px-3 py-2 text-right font-medium text-muted">
              Price / unit
            </th>
            <th scope="col" className="label-caps hidden px-3 py-2 text-right font-medium text-muted sm:table-cell">
              Saving
            </th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((t, i) => {
            const saving = savingsVersusFirst(tiers, i);
            const active = highlightIndex === i;
            return (
              <tr key={t.minQty} className={cn("border-t border-line", active && "bg-signal-50")}>
                <th scope="row" className="px-3 py-2.5 text-left font-medium text-trade-900">
                  <span className="tabular font-mono">{tierRangeLabel(t)}</span>
                  {active && <span className="sr-only"> (your quantity)</span>}
                </th>
                <td className="tabular px-3 py-2.5 text-right font-mono font-semibold text-trade-900">
                  <span className="mr-1 text-[0.8em] font-medium text-muted">{currency}</span>
                  {formatMoney({ amountMinor: t.unitPriceMinor, currency }, { withCode: false })}
                </td>
                <td className="tabular hidden px-3 py-2.5 text-right font-mono text-escrow-700 sm:table-cell">
                  {saving > 0 ? `−${saving}%` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
