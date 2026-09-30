import type { Metadata } from "next";
import { Banknote } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { MoneyText } from "@/components/ui/data";
import { EmptyState, PageHeader, Stat } from "@/components/ui/feedback";
import { PayoutRows } from "@/features/payments/components/money-lists";
import { listEscrow, listPayouts } from "@/features/payments/queries";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Payouts" };

export default async function SellerPayoutsPage() {
  await requireRole("seller");
  const [payouts, escrow] = await Promise.all([listPayouts({ limit: 100 }), listEscrow(200)]);
  const sum = (rows: { amount_minor: number; currency: string }[], c: string) => rows.filter((r) => r.currency === c).reduce((n, r) => n + r.amount_minor, 0);
  const held = escrow.filter((e) => e.status === "held");
  const currencies = (["USD", "LRD"] as const).filter((c) => payouts.some((p) => p.currency === c) || held.some((e) => e.currency === c));
  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader eyebrow="Seller" title="Payouts" description="Your proceeds after the platform fee. Money is protected in escrow while the goods travel, then released once delivery is confirmed." />
      {currencies.map((c) => (
        <div key={c} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat tone="escrow" label={`${c} protected in escrow`} value={<MoneyText value={{ amountMinor: held.filter((e) => e.currency === c).reduce((n, e) => n + e.seller_net_minor, 0), currency: c }} />} hint="Your share of paid orders in transit" />
          <Stat label={`${c} on its way`} value={<MoneyText value={{ amountMinor: sum(payouts.filter((p) => p.status !== "paid" && p.recipient === "seller"), c), currency: c }} />} hint="Released, being sent" />
          <Stat label={`${c} paid to you`} value={<MoneyText value={{ amountMinor: sum(payouts.filter((p) => p.status === "paid" && p.recipient === "seller"), c), currency: c }} />} />
        </div>
      ))}
      {payouts.length === 0 ? (
        <EmptyState icon={<Banknote className="size-5" />} title="No payouts yet">When a buyer pays and delivery is confirmed, your proceeds appear here.</EmptyState>
      ) : (
        <PayoutRows payouts={payouts} orderHref={(id) => `/seller/orders/${id}`} />
      )}
      <Alert tone="info">Payouts go to your business phone number on file. Keep it up to date in Business.</Alert>
    </div>
  );
}
