import { Logo } from "@/components/brand/logo";
import { formatWeight } from "@/lib/logistics/units";
import { formatBps, formatMoney } from "@/lib/money/currency";
import type { ProformaSnapshot } from "../queries";
import { AddressBlock, formatDate } from "./order-bits";

/** The printable proforma invoice, rendered purely from its immutable snapshot. */
export function InvoiceDocument({
  invoice,
}: {
  invoice: { invoice_number: string; issued_at: string; revision: number; snapshot: ProformaSnapshot };
}) {
  const s = invoice.snapshot;
  const m = (amountMinor: number) => formatMoney({ amountMinor, currency: s.currency });
  const nf = new Intl.NumberFormat("en-US");
  return (
    <article className="rounded-lg border border-line bg-white p-6 shadow-card sm:p-10 print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <header className="flex flex-col gap-6 border-b-2 border-trade-900 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Logo />
          <p className="mt-2 text-xs text-muted">Liberia&apos;s wholesale marketplace · escrow-protected trade</p>
        </div>
        <div className="sm:text-right">
          <p className="label-caps text-signal-700">Proforma invoice</p>
          <p className="tabular mt-1 font-mono text-xl font-bold text-trade-900">{invoice.invoice_number}</p>
          <dl className="mt-2 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-sm sm:justify-end">
            <dt className="text-muted">Order</dt>
            <dd className="tabular font-mono text-trade-900">{s.order_number}</dd>
            <dt className="text-muted">Issued</dt>
            <dd className="text-trade-900">{formatDate(invoice.issued_at)}</dd>
            <dt className="text-muted">Valid until</dt>
            <dd className="font-semibold text-trade-900">{formatDate(s.valid_until)}</dd>
            {invoice.revision > 1 && (
              <>
                <dt className="text-muted">Revision</dt>
                <dd className="text-trade-900">{invoice.revision}</dd>
              </>
            )}
          </dl>
        </div>
      </header>

      <section className="grid gap-6 border-b border-line py-6 sm:grid-cols-3">
        <div>
          <p className="label-caps mb-1.5 text-muted">Seller</p>
          <p className="font-bold text-trade-900">{s.seller.name}</p>
          <p className="text-sm text-trade-800">
            {s.seller.address_line && <span className="block">{s.seller.address_line}</span>}
            {s.seller.town}, {s.seller.county}
          </p>
          {s.seller.phone && <p className="tabular font-mono text-[0.8125rem]">{s.seller.phone}</p>}
          {s.seller.registration_number && <p className="text-xs text-muted">Reg. {s.seller.registration_number}</p>}
        </div>
        <div>
          <p className="label-caps mb-1.5 text-muted">Bill to</p>
          <p className="font-bold text-trade-900">{s.buyer.business_name || s.buyer.name}</p>
          {s.buyer.business_name && <p className="text-sm text-trade-800">{s.buyer.name}</p>}
          {s.buyer.phone && <p className="tabular font-mono text-[0.8125rem]">{s.buyer.phone}</p>}
        </div>
        <div>
          <p className="label-caps mb-1.5 text-muted">Deliver to</p>
          <AddressBlock address={s.delivery_address} />
        </div>
      </section>

      <table className="mt-6 w-full border-collapse text-left text-sm">
        <caption className="sr-only">Invoice lines</caption>
        <thead>
          <tr className="border-b border-trade-900">
            <th scope="col" className="label-caps py-2 pr-2 font-medium text-muted">Item</th>
            <th scope="col" className="label-caps py-2 px-2 text-right font-medium text-muted">Qty</th>
            <th scope="col" className="label-caps py-2 px-2 text-right font-medium text-muted">Unit price</th>
            <th scope="col" className="label-caps py-2 pl-2 text-right font-medium text-muted">Amount</th>
          </tr>
        </thead>
        <tbody>
          {s.items.map((i, n) => (
            <tr key={n} className="border-b border-line align-top">
              <td className="py-2.5 pr-2">
                <span className="font-semibold text-trade-900">{i.title}</span>
                <span className="block text-xs text-muted">
                  per {i.unit_label}
                  {i.sku && ` · ${i.sku}`}
                </span>
              </td>
              <td className="tabular px-2 py-2.5 text-right font-mono">{nf.format(i.quantity)}</td>
              <td className="tabular px-2 py-2.5 text-right font-mono whitespace-nowrap">{m(i.unit_price_minor)}</td>
              <td className="tabular py-2.5 pl-2 text-right font-mono font-semibold whitespace-nowrap">{m(i.line_total_minor)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end">
        <dl className="w-full max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Goods subtotal</dt>
            <dd className="tabular font-mono">{m(s.subtotal_minor)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Freight</dt>
            <dd className="tabular font-mono">{s.freight_minor !== null ? m(s.freight_minor) : "To be quoted"}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t-2 border-trade-900 pt-2 text-base font-bold text-trade-900">
            <dt>Total {s.freight_minor === null && <span className="text-xs font-normal text-muted">(excl. freight)</span>}</dt>
            <dd className="tabular font-mono">{m(s.total_minor)}</dd>
          </div>
          <div className="flex justify-between gap-4 pt-1 text-xs text-muted">
            <dt>Cargo weight</dt>
            <dd className="tabular font-mono">{formatWeight(s.total_weight_g)}</dd>
          </div>
        </dl>
      </div>

      <section className="mt-8 grid gap-4 rounded-md bg-canvas p-4 text-xs leading-relaxed text-trade-800 sm:grid-cols-2 print:border print:border-line print:bg-white">
        <div>
          <p className="label-caps mb-1 text-muted">Payment</p>
          <p>
            Status: <strong className="uppercase">{s.payment_status}</strong>. Pay only through GbanaB2B escrow (MTN MoMo / Orange Money) once
            freight is booked. Never pay the seller directly.
          </p>
        </div>
        <div>
          <p className="label-caps mb-1 text-muted">Terms</p>
          <ul className="list-disc space-y-0.5 pl-4">
            {s.terms.map((t) => (
              <li key={t}>{t.replace("The platform fee", `The platform fee (${formatBps(s.platform_fee_bps)})`)}</li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="mt-6 border-t border-line pt-3 text-center text-[0.6875rem] text-muted">
        Generated by GbanaB2B from order {s.order_number}. Prices were locked when the order was placed on {formatDate(s.placed_at)}.
      </footer>
    </article>
  );
}
