import type { Metadata } from "next";
import { Banknote } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { MoneyText } from "@/components/ui/data";
import { EmptyState, PageHeader, Stat } from "@/components/ui/feedback";
import { PayoutRows } from "@/features/payments/components/money-lists";
import { listPayouts } from "@/features/payments/queries";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Earnings" };

export default async function CarrierEarningsPage() {
  await requireRole("carrier");
  const payouts = await listPayouts({ limit: 100 });
  const mine = payouts.filter((p) => p.recipient === "carrier");
  const currencies = (["USD", "LRD"] as const).filter((c) => mine.some((p) => p.currency === c));
  const sum = (rows: typeof mine, c: string) => rows.filter((r) => r.currency === c).reduce((n, r) => n + r.amount_minor, 0);
  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader eyebrow="Carrier" title="Earnings" description="Your freight price is paid in full. It's released from escrow after the buyer confirms delivery." />
      {currencies.map((c) => (
        <div key={c} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Stat label={`${c} on its way`} value={<MoneyText value={{ amountMinor: sum(mine.filter((p) => p.status !== "paid"), c), currency: c }} />} hint="Released, being sent" />
          <Stat tone="escrow" label={`${c} paid to you`} value={<MoneyText value={{ amountMinor: sum(mine.filter((p) => p.status === "paid"), c), currency: c }} />} />
        </div>
      ))}
      {mine.length === 0 ? (
        <EmptyState icon={<Banknote className="size-5" />} title="No earnings yet">Won jobs show up here once delivery is confirmed and the funds are released.</EmptyState>
      ) : (
        <PayoutRows payouts={mine} orderHref={() => "/carrier/bids"} />
      )}
      <Alert tone="info">Payouts go to the phone number on your carrier profile.</Alert>
    </div>
  );
}
