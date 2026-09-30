import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/data";
import { PAYOUT_STATUS } from "@/lib/payments/labels";
import type { PayoutListItem } from "../queries";

const when = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Monrovia" });

export function PayoutRows({ payouts, orderHref }: { payouts: PayoutListItem[]; orderHref: (orderId: string) => string }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white shadow-card">
      {payouts.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2">
              <Link href={orderHref(p.order_id)} className="font-semibold text-trade-900 hover:underline">{p.order?.order_number}</Link>
              <Badge tone={PAYOUT_STATUS[p.status].tone}>{PAYOUT_STATUS[p.status].label}</Badge>
            </p>
            <p className="mt-1 text-xs text-muted">
              {p.status === "paid" ? `Paid ${when.format(new Date(p.updated_at))}${p.provider_ref ? ` · ref ${p.provider_ref}` : ""}` : p.status === "failed" ? "Sending failed — we're retrying it" : "Released from escrow — being sent"}
            </p>
          </div>
          <MoneyText value={{ amountMinor: p.amount_minor, currency: p.currency }} className="text-lg font-bold text-trade-900" />
        </li>
      ))}
    </ul>
  );
}
