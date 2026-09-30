import type { Metadata } from "next";
import Link from "next/link";
import { Banknote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { MoneyText } from "@/components/ui/data";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { PayoutControls, RefundControls } from "@/features/payments/components/admin-money";
import { FinanceTabs } from "@/features/payments/components/finance-tabs";
import { getPaymentMethods, listPayouts, listRefunds } from "@/features/payments/queries";
import { requireRole } from "@/lib/auth/session";
import { PAYOUT_STATUS, REFUND_STATUS } from "@/lib/payments/labels";

export const metadata: Metadata = { title: "Payouts · Admin" };

export default async function AdminPayoutsPage() {
  await requireRole("admin");
  const [payouts, refunds, methods] = await Promise.all([listPayouts({ limit: 200 }), listRefunds(), getPaymentMethods()]);
  const providers = methods.map((m) => ({ id: m.id, label: m.label }));
  const open = payouts.filter((p) => p.status !== "paid");
  const done = payouts.filter((p) => p.status === "paid");
  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader eyebrow="Admin · Finance" title="Payouts & refunds" description="Released funds waiting to be sent to sellers and carriers, and refunds owed to buyers. Record the provider's reference once the money has moved." />
      <FinanceTabs active="payouts" />

      <Card>
        <CardHeader eyebrow="To send" title={`${open.length} payout${open.length === 1 ? "" : "s"} open`} />
        {open.length === 0 ? (
          <div className="px-5 pb-5"><EmptyState icon={<Banknote className="size-5" />} title="Nothing to send">Payouts appear here when escrow is released.</EmptyState></div>
        ) : (
          <ul className="divide-y divide-line">
            {open.map((p) => {
              const who = p.recipient === "seller" ? p.seller?.trading_name : p.carrier?.full_name;
              const phone = p.destination_msisdn ?? (p.recipient === "seller" ? p.seller?.contact_phone : p.carrier?.phone) ?? "";
              return (
                <li key={p.id} className="space-y-3 px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-trade-900">{who}</span>
                      <Badge tone="neutral">{p.recipient === "seller" ? "Seller" : "Carrier"}</Badge>
                      <Badge tone={PAYOUT_STATUS[p.status].tone}>{PAYOUT_STATUS[p.status].label}</Badge>
                      <Link href={`/admin/orders/${p.order_id}`} className="font-mono text-xs text-muted hover:underline">{p.order?.order_number}</Link>
                    </p>
                    <MoneyText value={{ amountMinor: p.amount_minor, currency: p.currency }} className="text-lg font-bold" />
                  </div>
                  {p.failure_reason && <p className="text-sm text-red-700">Last attempt failed: {p.failure_reason}</p>}
                  <PayoutControls payoutId={p.id} status={p.status} defaultPhone={phone} providers={providers} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader eyebrow="Buyers" title={`${refunds.length} refund${refunds.length === 1 ? "" : "s"}`} />
        {refunds.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted">No refunds yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {refunds.map((r) => (
              <li key={r.id} className="space-y-3 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/orders/${r.order_id}`} className="font-semibold text-trade-900 hover:underline">{r.order?.order_number}</Link>
                    <Badge tone={REFUND_STATUS[r.status].tone}>{REFUND_STATUS[r.status].label}</Badge>
                    <span className="font-mono text-xs text-muted">to {r.destination_msisdn}</span>
                  </p>
                  <MoneyText value={{ amountMinor: r.amount_minor, currency: r.currency }} className="text-lg font-bold" />
                </div>
                <p className="text-sm text-muted">{r.reason}</p>
                <RefundControls refundId={r.id} orderId={r.order_id} status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {done.length > 0 && (
        <Card>
          <CardHeader eyebrow="History" title={`${done.length} paid out`} />
          <ul className="divide-y divide-line text-sm">
            {done.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <span>{p.recipient === "seller" ? p.seller?.trading_name : p.carrier?.full_name} <span className="font-mono text-xs text-muted">· {p.order?.order_number} · {p.provider_ref}</span></span>
                <MoneyText value={{ amountMinor: p.amount_minor, currency: p.currency }} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
