import Link from "next/link";
import { ChevronRight, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDay } from "@/features/carrier/components/load-bits";
import { RFQ_STATUS, timeLeft } from "@/lib/freight";
import { formatWeight } from "@/lib/logistics/units";
import type { RfqListItem } from "../queries";

export function RfqList({ rfqs, orderHref }: { rfqs: RfqListItem[]; orderHref: (orderId: string) => string }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white shadow-card">
      {rfqs.map((r) => {
        const left = timeLeft(r.closes_at);
        return (
          <li key={r.id}>
            <Link href={orderHref(r.order_id)} className="group flex items-center gap-3 p-4 hover:bg-canvas">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-trade-900">
                    {r.pickup_town} → {r.destination_town}
                  </span>
                  <Badge tone={RFQ_STATUS[r.status].tone}>{r.status === "open" && left.closed ? "Bidding closed" : RFQ_STATUS[r.status].label}</Badge>
                </p>
                <p className="tabular mt-1 font-mono text-xs text-muted">
                  {r.rfq_number} · order {r.order?.order_number} · {formatWeight(r.cargo_weight_g)} · pickup {formatDay(r.pickup_date)}
                </p>
                {r.status === "open" && !left.closed && (
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted">
                    <Clock className="size-3.5" aria-hidden="true" /> {left.label}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="tabular font-mono text-lg font-semibold text-trade-900">{r.bid_count}</p>
                <p className="text-[0.6875rem] text-muted">{r.bid_count === 1 ? "bid" : "bids"}</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-trade-300 group-hover:text-trade-600" aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
