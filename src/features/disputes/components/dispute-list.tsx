import Link from "next/link";
import { ChevronRight, Gavel } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { DISPUTE_KIND, DISPUTE_STATUS, PARTY_LABEL } from "@/lib/trust/labels";
import type { DisputeListItem } from "../queries";

const day = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Monrovia" });

export function DisputeList({ items, role, emptyTitle }: { items: DisputeListItem[]; role: "buyer" | "seller" | "carrier" | "admin"; emptyTitle: string }) {
  if (items.length === 0) {
    return (
      <EmptyState icon={<Gavel className="size-5" />} title={emptyTitle}>
        Problems with an order can be reported while its payment is in escrow. Disputes appear here with their evidence and decision.
      </EmptyState>
    );
  }
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white shadow-card">
      {items.map((d) => (
        <li key={d.id}>
          <Link href={`/${role}/disputes/${d.id}`} className="group flex items-center gap-3 p-4 hover:bg-canvas">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-trade-900">{DISPUTE_KIND[d.kind].label}</span>
                <Badge tone={DISPUTE_STATUS[d.status].tone}>{DISPUTE_STATUS[d.status].label}</Badge>
              </p>
              <p className="tabular mt-1 font-mono text-xs text-muted">
                {d.dispute_number}
                {d.order ? ` · order ${d.order.order_number}` : ""} · opened by {PARTY_LABEL[d.opened_by_role]?.toLowerCase()} · {day.format(new Date(d.created_at))}
              </p>
              <p className="mt-1 line-clamp-1 text-sm text-muted">{d.description}</p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-trade-300 group-hover:text-trade-600" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
