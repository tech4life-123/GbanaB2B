import type { Metadata } from "next";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/data";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { FilterTabs } from "@/features/commerce/components/order-bits";
import { CheckPaymentButton } from "@/features/payments/components/admin-money";
import { FinanceTabs } from "@/features/payments/components/finance-tabs";
import { listPayments } from "@/features/payments/queries";
import { requireRole } from "@/lib/auth/session";
import { PAYMENT_STATUS } from "@/lib/payments/labels";
import { PAYMENT_PROVIDERS } from "@/lib/payments/types";

export const metadata: Metadata = { title: "Payments · Admin" };
const when = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Monrovia" });

const TABS = [
  { key: "all", label: "All", statuses: [] as ("initiated" | "pending" | "succeeded" | "failed" | "cancelled" | "expired")[] },
  { key: "waiting", label: "Waiting", statuses: ["initiated", "pending"] as const },
  { key: "paid", label: "Paid", statuses: ["succeeded"] as const },
  { key: "problems", label: "Failed & expired", statuses: ["failed", "expired", "cancelled"] as const },
];

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireRole("admin");
  const wanted = (await searchParams).tab;
  const tab = TABS.find((t) => t.key === wanted) ?? TABS[0]!;
  const payments = await listPayments({ statuses: [...tab.statuses], limit: 200 });
  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader eyebrow="Admin · Finance" title="Payments" description="Every attempt to pay an order, with the provider's reference." />
      <FinanceTabs active="payments" />
      <FilterTabs label="Filter payments" active={tab.key} tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: `/admin/finance/payments?tab=${t.key}` }))} />
      {payments.length === 0 ? (
        <EmptyState icon={<Wallet className="size-5" />} title="No payments here">Attempts appear as soon as a buyer starts paying.</EmptyState>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white shadow-card">
          {payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/orders/${p.order_id}`} className="font-semibold text-trade-900 hover:underline">{p.order?.order_number}</Link>
                  <Badge tone={PAYMENT_STATUS[p.status].tone}>{PAYMENT_STATUS[p.status].label}</Badge>
                </p>
                <p className="mt-1 font-mono text-xs text-muted">
                  {PAYMENT_PROVIDERS[p.provider].displayName} · {p.provider_txn_id ?? "no provider id"} · {when.format(new Date(p.created_at))}
                  {p.failure_reason ? ` · ${p.failure_reason}` : ""}
                </p>
              </div>
              <MoneyText value={{ amountMinor: p.amount_minor, currency: p.currency }} className="text-base font-semibold" />
              {(p.status === "pending" || p.status === "initiated") && <CheckPaymentButton txnId={p.id} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
