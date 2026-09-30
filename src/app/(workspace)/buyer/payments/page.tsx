import type { Metadata } from "next";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/data";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { listPayments } from "@/features/payments/queries";
import { requireRole } from "@/lib/auth/session";
import { PAYMENT_STATUS } from "@/lib/payments/labels";
import { PAYMENT_PROVIDERS } from "@/lib/payments/types";

export const metadata: Metadata = { title: "Payments" };
const when = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Monrovia" });

export default async function BuyerPaymentsPage() {
  await requireRole("buyer");
  const payments = await listPayments({ limit: 100 });
  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader eyebrow="Buyer" title="Payments" description="Your payments into escrow. Open an order to pay or to see where your money is." />
      {payments.length === 0 ? (
        <EmptyState icon={<Wallet className="size-5" />} title="No payments yet">After you book a carrier on an order, you&apos;ll pay from that order&apos;s page.</EmptyState>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white shadow-card">
          {payments.map((p) => (
            <li key={p.id}>
              <Link href={`/buyer/orders/${p.order_id}`} className="flex flex-wrap items-center gap-3 p-4 hover:bg-canvas">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-trade-900">{p.order?.order_number}</span>
                    <Badge tone={PAYMENT_STATUS[p.status].tone}>{PAYMENT_STATUS[p.status].label}</Badge>
                  </p>
                  <p className="mt-1 text-xs text-muted">{PAYMENT_PROVIDERS[p.provider].displayName} · {when.format(new Date(p.created_at))}{p.failure_reason ? ` · ${p.failure_reason}` : ""}</p>
                </div>
                <MoneyText value={{ amountMinor: p.amount_minor, currency: p.currency }} className="text-lg font-bold text-trade-900" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
