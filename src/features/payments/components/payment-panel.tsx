import Link from "next/link";
import { Clock, Landmark, ShieldCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { MoneyText } from "@/components/ui/data";
import { ESCROW_STATUS, escrowShares, LEDGER_ACCOUNT, LEDGER_KIND, PAYMENT_STATUS, PAYOUT_STATUS, REFUND_STATUS } from "@/lib/payments/labels";
import { PAYMENT_PROVIDERS } from "@/lib/payments/types";
import { formatMoney, type CurrencyCode } from "@/lib/money/currency";
import type { OrderActor, OrderStatus } from "@/lib/orders/state";
import type { OrderPayment, ProviderOption } from "../queries";
import { CheckPaymentButton, RefundControls, RefundEscrowButton, ReleaseEscrowButton } from "./admin-money";
import { PayForm, SandboxPanel } from "./pay-forms";

const when = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Monrovia" });
const RELEASABLE: OrderStatus[] = ["paid_escrow", "in_transit", "delivered", "awaiting_confirmation"];
/** A disputed order is frozen: money moves only through the dispute decision. */
const REFUNDABLE: OrderStatus[] = RELEASABLE;

/**
 * Payment section of an order page.
 * buyer — pay, wait for approval, see escrow; seller — see protected proceeds (never the buyer's phone);
 * admin — everything, plus release/refund with a written reason.
 */
export function PaymentPanel({
  order,
  payment,
  perspective,
  methods,
  buyerPhone,
}: {
  order: { id: string; status: OrderStatus; currency: CurrencyCode; total_minor: number };
  payment: OrderPayment;
  perspective: OrderActor;
  methods: ProviderOption[];
  buyerPhone: string;
}) {
  const { escrow, txns, refund, payouts } = payment;
  const money = (amountMinor: number, currency: CurrencyCode = order.currency) => <MoneyText value={{ amountMinor, currency }} />;
  const liveTxn = txns.find((t) => t.status === "initiated" || t.status === "pending") ?? null;
  const lastFailed = txns[0] && (txns[0].status === "failed" || txns[0].status === "expired") ? txns[0] : null;
  const payable = order.status === "carrier_selected" || order.status === "awaiting_payment";

  /* ---- before payment ------------------------------------------------ */
  if (!escrow) {
    if (!payable && txns.length === 0) return null;
    if (perspective === "seller") {
      return payable ? (
        <Alert tone="info" title="Waiting for the buyer to pay">
          The buyer&apos;s payment goes into escrow before anything is dispatched. You&apos;ll see it here.
        </Alert>
      ) : null;
    }
    return (
      <Card>
        <CardHeader eyebrow="Payment" title={perspective === "buyer" ? "Pay into escrow" : "Awaiting payment"} description="Products plus freight, held until delivery is confirmed." />
        <CardBody className="space-y-5">
          <div className="flex items-end justify-between gap-4 rounded-lg bg-canvas px-4 py-3">
            <span className="text-sm text-muted">Amount due</span>
            <span className="text-2xl font-bold text-trade-900">{money(order.total_minor)}</span>
          </div>
          {perspective === "buyer" && payable && !liveTxn && (
            <PayForm
              orderId={order.id}
              methods={methods}
              totalLabel={formatMoney({ amountMinor: order.total_minor, currency: order.currency })}
              defaultPhone={buyerPhone}
              lastFailure={lastFailed?.failure_reason ?? (lastFailed ? "The attempt expired before it was approved." : null)}
            />
          )}
          {liveTxn && (
            <div className="space-y-3">
              <Alert tone="info" title="Approve the payment on your phone">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-4" aria-hidden="true" /> We asked {PAYMENT_PROVIDERS[liveTxn.provider].displayName} to collect. This page updates once they confirm — a screen on your phone alone isn&apos;t proof of payment.
                </span>
              </Alert>
              {perspective === "buyer" && liveTxn.provider === "sandbox" && liveTxn.status === "pending" && <SandboxPanel txnId={liveTxn.id} />}
              {perspective === "admin" && <CheckPaymentButton txnId={liveTxn.id} />}
            </div>
          )}
          {perspective === "admin" && <TxnList txns={txns} />}
        </CardBody>
      </Card>
    );
  }

  /* ---- escrow exists --------------------------------------------------- */
  const status = ESCROW_STATUS[escrow.status];
  const shares = escrowShares(escrow);
  return (
    <Card>
      <CardHeader
        eyebrow="Payment"
        title={escrow.status === "held" ? "Funds held in escrow" : escrow.status === "released" ? "Escrow released" : "Payment refunded"}
        description={
          escrow.status === "held"
            ? perspective === "buyer"
              ? "Your payment is safe. It's released to the seller and carrier once delivery is confirmed."
              : "The buyer has paid. Funds are released after delivery is confirmed."
            : undefined
        }
        action={
          <Badge tone={status.tone}>
            <ShieldCheck className="size-3.5" aria-hidden="true" /> {status.label}
          </Badge>
        }
      />
      <CardBody className="space-y-5">
        {perspective === "seller" ? (
          <div className="flex items-end justify-between gap-4 rounded-lg bg-escrow-50 px-4 py-3">
            <span className="text-sm text-escrow-800">Your proceeds (after the platform fee)</span>
            <span className="text-2xl font-bold text-escrow-800">{money(escrow.seller_net_minor)}</span>
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between gap-4 rounded-lg bg-canvas px-4 py-3">
              <span className="text-sm text-muted">{escrow.status === "refunded" ? "Refunded" : "Held"}</span>
              <span className="text-2xl font-bold text-trade-900">{money(escrow.amount_minor)}</span>
            </div>
            {escrow.refunded_minor > 0 && escrow.status !== "refunded" && (
              <div className="flex items-end justify-between gap-4 rounded-lg bg-canvas px-4 py-3">
                <span className="text-sm text-muted">Part refunded to the buyer</span>
                <span className="text-lg font-bold text-trade-900">{money(escrow.refunded_minor)}</span>
              </div>
            )}
            {perspective === "admin" && (
              <dl className="grid grid-cols-3 gap-3 text-sm">
                {shares.map((s) => (
                  <div key={s.key} className="rounded-md border border-line px-3 py-2">
                    <dt className="text-xs text-muted">{s.label}</dt>
                    <dd className="font-mono font-semibold text-trade-900">{money(s.amountMinor)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </>
        )}

        {order.status === "disputed" && (
          <Alert tone="warning" title="Frozen while a dispute is open">
            Release and refund are paused. The dispute decision decides where the money goes.
          </Alert>
        )}

        {perspective === "admin" && escrow.status === "held" && order.status !== "disputed" && (
          <div className="flex flex-wrap gap-2">
            {RELEASABLE.includes(order.status) && <ReleaseEscrowButton orderId={order.id} />}
            {REFUNDABLE.includes(order.status) && <RefundEscrowButton orderId={order.id} />}
          </div>
        )}

        {refund && (perspective === "admin" || perspective === "buyer") && (
          <div className="rounded-lg border border-line p-4">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-trade-900">
              Refund {money(refund.amount_minor)} <Badge tone={REFUND_STATUS[refund.status].tone}>{REFUND_STATUS[refund.status].label}</Badge>
            </p>
            <p className="mt-1 text-sm text-muted">{refund.reason}</p>
            {perspective === "admin" && <div className="mt-3"><RefundControls refundId={refund.id} orderId={order.id} status={refund.status} /></div>}
          </div>
        )}

        {payouts.length > 0 && perspective !== "buyer" && (
          <div className="space-y-2">
            <h3 className="label-caps text-muted">Payouts</h3>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {payouts.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span className="flex items-center gap-2">
                    <Landmark className="size-4 text-trade-400" aria-hidden="true" /> {p.recipient === "seller" ? "Seller" : "Carrier"}
                    <Badge tone={PAYOUT_STATUS[p.status].tone}>{PAYOUT_STATUS[p.status].label}</Badge>
                  </span>
                  <span className="font-mono font-semibold">{money(p.amount_minor)}</span>
                </li>
              ))}
            </ul>
            {perspective === "admin" && (
              <p className="text-xs text-muted">
                Send these from <Link href="/admin/finance/payouts" className="font-semibold text-trade-700 underline">Payouts</Link>.
              </p>
            )}
          </div>
        )}

        {perspective === "admin" && <TxnList txns={txns} />}
        {perspective === "admin" && payment.ledger.length > 0 && <LedgerTrail entries={payment.ledger} />}
      </CardBody>
    </Card>
  );
}

function TxnList({ txns }: { txns: OrderPayment["txns"] }) {
  if (txns.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="label-caps text-muted">Payment attempts</h3>
      <ul className="divide-y divide-line rounded-lg border border-line">
        {txns.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <Badge tone={PAYMENT_STATUS[t.status].tone}>{PAYMENT_STATUS[t.status].label}</Badge>
                <span className="text-trade-900">{PAYMENT_PROVIDERS[t.provider].displayName}</span>
              </span>
              <span className="mt-0.5 block font-mono text-xs text-muted">
                {t.provider_txn_id ?? "no provider id yet"} · {when.format(new Date(t.created_at))}
                {t.failure_reason ? ` · ${t.failure_reason}` : ""}
              </span>
            </span>
            <span className="font-mono font-semibold">{formatMoney({ amountMinor: t.amount_minor, currency: t.currency })}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LedgerTrail({ entries }: { entries: OrderPayment["ledger"] }) {
  return (
    <details className="rounded-lg border border-line">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-trade-900">Ledger trail ({entries.length} entries)</summary>
      <div className="overflow-x-auto border-t border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">Event</th>
              <th className="px-4 py-2 font-medium">Account</th>
              <th className="px-4 py-2 text-right font-medium">Debit</th>
              <th className="px-4 py-2 text-right font-medium">Credit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line font-mono text-xs">
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap px-4 py-2 text-muted">{when.format(new Date(e.created_at))}</td>
                <td className="px-4 py-2 font-sans text-trade-800">{LEDGER_KIND[e.kind] ?? e.kind}</td>
                <td className="px-4 py-2 font-sans">{LEDGER_ACCOUNT[e.account] ?? e.account}</td>
                <td className="px-4 py-2 text-right">{e.direction === "debit" ? formatMoney({ amountMinor: e.amount_minor, currency: e.currency }, { withCode: false }) : ""}</td>
                <td className="px-4 py-2 text-right">{e.direction === "credit" ? formatMoney({ amountMinor: e.amount_minor, currency: e.currency }, { withCode: false }) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
